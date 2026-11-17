import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createWorker, OEM } from 'tesseract.js';

export const FILE_LIMIT = 8 * 1024 * 1024;

@Injectable()
export class DocumentFiles {
  private readonly directory = resolve(process.env.WMS_DOCUMENT_STORAGE || 'var/document-storage');
  private scanning = false;

  mime(bytes: Buffer): string {
    if (bytes.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
    if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
    if (bytes.subarray(0, 3).equals(Buffer.from([255,216,255]))) return 'image/jpeg';
    if (bytes.subarray(0, 4).equals(Buffer.from([80,75,3,4]))) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    throw new BadRequestException('Chỉ hỗ trợ ảnh JPG/PNG, PDF và XLSX hợp lệ');
  }

  private path(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid storage key');
    return join(this.directory,key);
  }

  async save(bytes: Buffer) {
    const key = randomUUID();
    await mkdir(this.directory, { recursive:true, mode:0o700 });
    await writeFile(this.path(key),bytes,{flag:'wx', mode:0o600});
    return key;
  }

  read(key: string) { return readFile(this.path(key)); }
  discard(key: string) { return unlink(this.path(key)).catch(() => undefined); }

  private python(command: string, input: object): Promise<Buffer> {
    return new Promise((ok, fail) => {
      const child = execFile(process.env.WMS_DOCUMENT_PYTHON || 'python',
        [resolve('scripts/document_worker.py'),command], {encoding:'buffer',timeout:25000,maxBuffer:32*1024*1024},
        (err, output) => err ? fail(err) : ok(output));
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(JSON.stringify(input));
    });
  }

  async inspect(key:string,mime:string) {
    try { await this.python('validate',{path:this.path(key),mime}); }
    catch { throw new BadRequestException('Tệp hỏng, bị mã hóa hoặc vượt giới hạn trang/kích thước'); }
  }

  async page(key:string,mime:string,page:number) {
    try { return await this.python('page',{path:this.path(key),mime,page}); }
    catch { throw new BadRequestException('Không xem được trang tệp này'); }
  }

  async pdf(snapshot:object) {
    try { return await this.python('print',snapshot); }
    catch { throw new ServiceUnavailableException('Máy chủ chưa tạo được PDF. Kiểm tra bộ xử lý và font in.'); }
  }

  async scan(key:string,mime:string) {
    if (this.scanning) throw new ServiceUnavailableException('OCR đang bận. Hãy thử lại.');
    this.scanning = true;
    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
    try {
      const input = {path:this.path(key),mime};
      const pages: {text:string; scan?:boolean}[] = JSON.parse((await this.python('text',input)).toString('utf8'));
      const output: {page:number;text:string;engine:string;confidence?:number;words?:unknown[]}[] = [];
      for (const [i,page] of pages.entries()) {
        if (!page.scan) { output.push({page:i+1,text:page.text,engine:mime.includes('spreadsheet')?'XLSX':'PDF text'}); continue; }
        if (!worker) {
          const langPath = resolve(process.env.WMS_TESSDATA || 'var/tessdata');
          await Promise.all(['vie','eng'].map(lang => access(join(langPath,`${lang}.traineddata.gz`))));
          worker = await createWorker(['vie','eng'], OEM.LSTM_ONLY,{langPath,cacheMethod:'none'});
        }
        const recognition = await worker.recognize(await this.page(key,mime,i+1),{}, {blocks:true,text:true});
        const words = recognition.data.blocks?.flatMap(block => block.paragraphs.flatMap(p =>
          p.lines.flatMap(l => l.words.map(w => ({text:w.text,confidence:w.confidence,box:w.bbox})))));
        output.push({page:i+1,text:recognition.data.text.slice(0,24000),engine:'Tesseract vie+eng',
          confidence:recognition.data.confidence,words:words?.slice(0,500)});
      }
      return output;
    } catch {
      throw new ServiceUnavailableException('Không đọc được tệp hoặc chưa cài đặt OCR tiếng Việt cục bộ');
    } finally {
      try { await worker?.terminate(); } finally { this.scanning = false; }
    }
  }
}
