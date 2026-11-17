import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../auth/entities/user.entity';
import { DocumentFiles } from './document-files';

export const kinds = ['01-VT','02-VT','03-VT','PICKING','PACKING','DELIVERY','DISCREPANCY','QUARANTINE',
  'ISSUE_REQUEST','TRANSPORT','SHIP_CONFIRMATION','TRANSFER','CYCLE_COUNT','ADJUSTMENT','05-VT','ERP_ATTACHMENT','PURCHASE_ORDER','SALES_ORDER','INVOICE'] as const;
const titles: Record<string,string> = {'01-VT':'PHIẾU NHẬP KHO','02-VT':'PHIẾU XUẤT KHO','03-VT':'BIÊN BẢN KIỂM NGHIỆM',PICKING:'PHIẾU SOẠN HÀNG',PACKING:'PHIẾU ĐÓNG GÓI'};
const digest = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex');
const text = (v:unknown, max=180) => typeof v === 'string' ? v.trim().slice(0,max) : '';
const amount = (v:unknown) => v === '' || v === null || v === undefined ? null :
  typeof v === 'number' || typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
const privileged = (u:AuthenticatedUser) => u.role === UserRole.ADMIN || u.role === UserRole.WAREHOUSE_MANAGER;

@Injectable()
export class DocumentsService {
  constructor(private readonly db:DataSource, private readonly files:DocumentFiles) {}

  private async row(em:EntityManager,id:string,user:AuthenticatedUser,lock=false) {
    const [doc] = await em.query(`
      SELECT * FROM warehouse_documents WHERE id=$1 AND ($2 OR created_by=$3 OR reference_id IS NOT NULL)
      ${lock?'FOR UPDATE':''}
    `,[id,privileged(user),user.id]);
    if (!doc) throw new NotFoundException('Không tìm thấy chứng từ');
    return doc;
  }

  private event(em:EntityManager,id:string,user:AuthenticatedUser,action:string,reason?:string) {
    return em.query('INSERT INTO warehouse_document_events(document_id,actor_id,action,reason) VALUES ($1,$2,$3,$4)',
      [id,user.id,action,reason ?? null]);
  }

  async list(user:AuthenticatedUser,q:string,kind:string,status:string,day:string,creator:string) {
    return this.db.query(`
      SELECT d.id,d.kind,d.status,d.created_at,d.filename,d.reference_id,d.fields->>'number' AS number,d.fields->>'po' AS po,
        u.email AS creator
      FROM warehouse_documents d JOIN users u ON u.id=d.created_by
      WHERE ($1 OR d.created_by=$2 OR d.reference_id IS NOT NULL)
        AND ($3='' OR COALESCE(d.filename,'') ILIKE $3 OR d.fields::text ILIKE $3 OR d.id::text=$7)
        AND ($4='' OR d.kind=$4) AND ($5='' OR d.status=$5)
        AND ($6='' OR to_char(d.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD')=$6)
        AND ($8='' OR u.email ILIKE $8)
      ORDER BY d.created_at DESC LIMIT 150
    `,[privileged(user),user.id,q?'%'+q+'%':'',kind,status,day,q,creator?'%'+creator+'%':'']);
  }

  async detail(id:string,user:AuthenticatedUser) {
    const doc = await this.row(this.db.manager,id,user);
    const [events,versions,receipts] = await Promise.all([
      this.db.query('SELECT action,actor_id,reason,created_at FROM warehouse_document_events WHERE document_id=$1 ORDER BY id DESC',[id]),
      this.db.query('SELECT version,checksum,actor_id,created_at FROM warehouse_document_versions WHERE document_id=$1 ORDER BY version DESC',[id]),
      this.db.query('SELECT line_number,receipt_id FROM warehouse_document_receipts WHERE document_id=$1 ORDER BY line_number',[id]),
    ]);
    const { original_key, identity, checksum, ...visible } = doc;
    const live = doc.reference_id ? await this.snapshot(this.db.manager,doc) : null;
    return {...visible,fields:live?{...doc.fields,date:String(live.date instanceof Date?live.date.toISOString():live.date??'').slice(0,10),lines:live.lines}:doc.fields,
      hasFile:!!original_key,events,versions,receipts};
  }

  async create(kind:string,user:AuthenticatedUser,bytes?:Buffer,filename?:string) {
    if (!kinds.includes(kind as typeof kinds[number])) throw new BadRequestException('Loại chứng từ không hợp lệ');
    const mime = bytes ? this.files.mime(bytes) : null;
    const hash = bytes ? digest(bytes) : null;
    if (hash && (await this.db.query('SELECT 1 FROM warehouse_documents WHERE checksum=$1',[hash])).length) {
      throw new ConflictException('Tệp này đã được tải lên trước đó');
    }
    const key = bytes ? await this.files.save(bytes) : null;
    try {
      if (key && mime) await this.files.inspect(key,mime);
      return await this.db.transaction(async em => {
        const [doc] = await em.query(`
          INSERT INTO warehouse_documents(kind,status,original_key,filename,mime,checksum,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(checksum) DO NOTHING RETURNING id,status
        `,[kind,bytes?'UPLOADED':'NEEDS_REVIEW',key,text(filename),mime,hash,user.id]);
        if (!doc) throw new ConflictException('Tệp này đã được tải lên trước đó');
        await this.event(em,doc.id,user,bytes?'UPLOAD':'CREATE');
        return doc;
      });
    } catch (error) {
      if (key) await this.files.discard(key);
      throw error;
    }
  }

  async file(id:string,user:AuthenticatedUser,page?:number) {
    const doc = await this.row(this.db.manager,id,user);
    if (!doc.original_key) throw new NotFoundException('Chứng từ không có tệp gốc');
    return page ? { bytes:await this.files.page(doc.original_key,doc.mime,page),mime:'image/png' } :
      {bytes:await this.files.read(doc.original_key),mime:doc.mime};
  }

  async scan(id:string,user:AuthenticatedUser) {
    const doc = await this.row(this.db.manager,id,user);
    if (!doc.original_key || !['UPLOADED','NEEDS_REVIEW'].includes(doc.status)) throw new ConflictException('Chứng từ hiện không thể nhận diện');
    const pages = await this.files.scan(doc.original_key,doc.mime);
    const source = pages.map(p=>p.text).join('\n');
    const capture = (pattern:RegExp) => source.match(pattern)?.[1]?.trim() ?? '';
    const fields = {
      number:capture(/(?:Mã phiếu|Số phiếu|Document No)\s*[:：]\s*([^\r\n]+)/iu),
      po:capture(/(?:\bPO|\bSO)\s*[:：]\s*([^\r\n]+)/iu),
      issuer:capture(/(?:Nhà cung cấp|Supplier)\s*[:：]\s*([^\r\n]+)/iu),
      date:capture(/(?:Ngày lập|Date)\s*[:：]\s*(\d{4}-\d{2}-\d{2})/iu),
      lines:source.split(/\r?\n/).flatMap(line => {
        const columns = line.trim().split(/\s*[|¦]\s*|\s{2,}/);
        if (columns.length < 4 || !/^[A-Z\d][A-Z\d._-]{2,}$/i.test(columns[0]) || !/^\d+$/.test(columns[3])) return [];
        const [sku,name,uom,expected,lot,expirationDate] = columns;
        return [{sku,name,uom,expected:Number(expected),lot:lot??'',expirationDate:expirationDate??''}];
      }).slice(0,200),
    };
    return this.db.transaction(async em => {
      const current = await this.row(em,id,user,true);
      if (current.revision !== doc.revision || !['UPLOADED','NEEDS_REVIEW'].includes(current.status)) throw new ConflictException('Chứng từ vừa thay đổi');
      await em.query(`
        UPDATE warehouse_documents SET status='NEEDS_REVIEW',fields=$2,extraction=$3,revision=revision+1 WHERE id=$1
      `,[id,JSON.stringify(fields),JSON.stringify(pages)]);
      await this.event(em,id,user,'SCAN');
      return {fields,pages};
    });
  }

  private normalize(input:any) {
    if (!input || !Array.isArray(input.lines) || input.lines.length>200) throw new BadRequestException('Tối đa 200 dòng chứng từ');
    const sourceLines: unknown[] = input.lines;
    const lines = sourceLines.map((l:any) => {
      const expected = amount(l?.expected);
      const actual = amount(l?.actual);
      if ([expected,actual].some(v => v !== null && (!Number.isSafeInteger(v) || v<0 || v>2147483647))) throw new BadRequestException('Số lượng phải là số nguyên hợp lệ');
      return {sku:text(l?.sku,120),name:text(l?.name),uom:text(l?.uom,20),lot:text(l?.lot,120),expirationDate:text(l?.expirationDate,10),expected,actual};
    });
    return {number:text(input.number),po:text(input.po),issuer:text(input.issuer),date:text(input.date,10),note:text(input.note,800),lines};
  }

  private async validate(em:EntityManager, fields:ReturnType<DocumentsService['normalize']>, inbound:boolean) {
    const errors:string[] = [];
    if (!fields.number || !fields.issuer || !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) errors.push('Cần mã phiếu, đơn vị phát hành và ngày YYYY-MM-DD');
    if (inbound && !fields.po) errors.push('Cần PO tham chiếu');
    if (!fields.lines.length) errors.push('Cần ít nhất một dòng');
    const catalog = await em.query(`
      SELECT product_code,array_agg(DISTINCT uom_code) FILTER(WHERE uom_code IS NOT NULL) AS units
      FROM parts WHERE product_code=ANY($1::text[]) GROUP BY product_code
    `,[fields.lines.map(line=>line.sku)]);
    const indexed = new Map<string,string[]|null>(catalog.map((r:any)=>[r.product_code,r.units]));
    for (const [index,line] of fields.lines.entries()) {
      const prefix = `Dòng ${index+1}`;
      const units = indexed.get(line.sku);
      if (!indexed.has(line.sku)) errors.push(`${prefix}: SKU chưa khớp danh mục WMS`);
      if (!units?.some(u=>u.toLowerCase()===line.uom.toLowerCase())) errors.push(`${prefix}: ĐVT chưa xác minh, chưa có quy cách chuyển đổi`);
      if (inbound && !['EA','PCS'].includes(line.uom.toUpperCase())) errors.push(`${prefix}: luồng nhận hiện chỉ đăng số lượng đơn vị đếm EA/PCS`);
      if (!line.expected) errors.push(`${prefix}: cần số lượng lớn hơn 0`);
      if (inbound && !line.lot) errors.push(`${prefix}: cần khai báo số lô thực tế`);
    }
    return errors;
  }

  async review(id:string,user:AuthenticatedUser,input:any,action:'save'|'validate'|'confirm') {
    const fields = this.normalize(input?.fields);
    return this.db.transaction(async em => {
      const doc = await this.row(em,id,user,true);
      if (doc.reference_id || !['UPLOADED','NEEDS_REVIEW'].includes(doc.status) || doc.revision!==input.revision) {
        throw new ConflictException('Bản nháp vừa thay đổi hoặc đã khóa');
      }
      const errors = action==='save'?[]:await this.validate(em,fields,['01-VT','DELIVERY','PURCHASE_ORDER'].includes(doc.kind));
      if (action==='validate') return {errors};
      if (errors.length) throw new BadRequestException(errors);
      const identity = action==='confirm' ? [doc.kind,fields.issuer,fields.number,fields.date].map(s=>s.normalize('NFKC').toLowerCase()).join('\u001f') : null;
      try {
        await em.query('UPDATE warehouse_documents SET fields=$2,status=$3,identity=$4,revision=revision+1 WHERE id=$1',
          [id,JSON.stringify(fields),action==='confirm'?'DRAFT':'NEEDS_REVIEW',identity]);
      } catch(error) {
        if ((error as {code?:string}).code==='23505') throw new ConflictException('Chứng từ cùng đơn vị, loại, số và ngày đã tồn tại');
        throw error;
      }
      await this.event(em,id,user,action==='confirm'?'CONFIRM_DRAFT':'EDIT');
      return {id};
    });
  }

  async fromReference(kind:string,ref:string,user:AuthenticatedUser) {
    if (!titles[kind]) throw new BadRequestException('Mẫu in chưa được hỗ trợ');
    const snapshot = await this.snapshot(this.db.manager,{kind,reference_id:ref,fields:{}});
    return this.db.transaction(async em => {
      const [doc] = await em.query(`
        INSERT INTO warehouse_documents(kind,status,reference_id,created_by,fields)
        VALUES ($1,'DRAFT',$2,$3,$4) ON CONFLICT(kind,reference_id) DO NOTHING RETURNING id
      `,[kind,ref,user.id,JSON.stringify({number:snapshot.number,po:snapshot.meta?.PO})]);
      if (doc) { await this.event(em,doc.id,user,'LINK_WMS'); return doc; }
      const [existing] = await em.query('SELECT id FROM warehouse_documents WHERE kind=$1 AND reference_id=$2',[kind,ref]);
      return existing;
    });
  }

  private async snapshot(em:EntityManager,doc:any): Promise<any> {
    const {kind,reference_id:ref,fields}=doc;
    const head={title:titles[kind] || kind,template:kind,number:fields.number,date:fields.date,meta:{PO:fields.po,'Đơn vị nguồn':fields.issuer},lines:fields.lines??[]};
    if (!ref) return {...head,status:'BẢN NHÁP'};
    if(kind==='01-VT') {
      const [r]=await em.query(`
        SELECT r.*,p.uom_code,p.supplier_name,c.name AS rack
        FROM receiving_receipts r LEFT JOIN parts p ON p.id=COALESCE(r.part_id,r.damaged_part_id)
        LEFT JOIN containers c ON c.id=r.target_rack_id WHERE r.id=$1
      `,[ref]);
      if (!r) throw new NotFoundException('Không tìm thấy phiếu nhận');
      return {...head,number:r.receipt_number,date:r.created_at,meta:{PO:r.po_number,'Người nhận':r.received_by,'Nhà cung cấp':r.supplier_name,'Kệ nhập':r.rack,'Hàng hỏng':r.damaged_quantity_pcs},
        status:r.status==='DISCREPANCY_PENDING'?'CHỜ DUYỆT SAI LỆCH':'ĐÃ GHI NHẬN',
        lines:[{sku:r.product_code,name:r.part_name,lot:r.lot_number,uom:r.uom_code,expected:r.expected_quantity_pcs,actual:r.received_quantity_pcs}]};
    }
    if(kind==='03-VT') {
      const [q]=await em.query('SELECT i.*,l.product_code FROM inspections i LEFT JOIN inventory_lots l ON l.id=i.lot_id WHERE i.id=$1',[ref]);
      if(!q) throw new NotFoundException('Không tìm thấy phiếu kiểm nghiệm');
      return {...head,number:q.inspection_id,date:q.inspection_date,status:q.judgment,
        meta:{'Người kiểm':q.inspector_id,'Phạm vi QC':q.quality_scope_id,'Mã lỗi':q.defect_code,'Số không đạt':q.fail_quantity},
        expectedLabel:'Lấy mẫu',actualLabel:'Đạt',lines:[{sku:q.product_code,lot:q.lot_number,expected:q.sample_size,actual:q.pass_quantity}]};
    }
    const [d]=await em.query(`
      SELECT d.*,u.email AS creator, e.created_at AS action_date, e.email AS action_actor
      FROM dispatch_orders d LEFT JOIN users u ON u.id=d.actor_id
      LEFT JOIN LATERAL (
        SELECT t.created_at, actor.email FROM dispatch_events t LEFT JOIN users actor ON actor.id=t.actor_id
        WHERE t.dispatch_id=d.id AND t.status=$2 ORDER BY t.created_at DESC,t.id DESC LIMIT 1
      ) e ON true WHERE d.id=$1
    `,[ref,kind==='PICKING'?'PICKED':'SHIPPED']);
    if(!d) throw new NotFoundException('Không tìm thấy đơn xuất');
    const rows=await em.query(`
      SELECT a.quantity,l.lot_number,p.part_name,p.uom_code,c.name AS rack,p.preferred_rack_slot,
        (SELECT SUM(e.quantity)::int FROM dispatch_packing_entries e WHERE e.dispatch_id=a.dispatch_id AND e.part_id=a.part_id) AS packed,
        (SELECT SUM(t.quantity_pcs)::int FROM inventory_transactions t
         WHERE t.type='outbound' AND t.part_id=a.part_id AND t.lot_id=a.lot_id AND t.note=$2) AS shipped
      FROM dispatch_allocations a JOIN inventory_lots l ON l.id=a.lot_id JOIN parts p ON p.id=a.part_id
      LEFT JOIN containers c ON c.id=p.container_id WHERE a.dispatch_id=$1 ORDER BY a.part_id
    `,[ref,'Đơn xuất '+ref]);
    const preliminary = kind==='02-VT' && d.status!=='SHIPPED' ||
      kind==='PICKING' && !['PICKED','SHIPPED'].includes(d.status) ||
      kind==='PACKING' && !rows.some((row:{packed:number|null})=>(row.packed??0)>0);
    const [packer]=kind==='PACKING'?await em.query(`
      SELECT p.created_at,u.email FROM dispatch_packing_entries p LEFT JOIN users u ON u.id=p.actor_id
      WHERE p.dispatch_id=$1 ORDER BY p.created_at DESC,p.id DESC LIMIT 1
    `,[ref]):[];
    return {...head,number:d.reference,date:packer?.created_at??d.action_date??d.created_at,
      meta:{'Lượng yêu cầu của đơn':d.quantity,'Người lập':d.creator,'Người thực hiện':packer?.email??d.action_actor},
      status:preliminary?'BẢN NHÁP · CHƯA XÁC NHẬN':d.status,
      expectedLabel:'Cấp phát',actualLabel:kind==='PACKING'?'Đã đóng':kind==='PICKING'?'Đã soạn':'Thực xuất',
      lines:rows.map((r:any)=>({sku:d.sku,name:r.part_name,lot:r.lot_number,uom:r.uom_code,expected:r.quantity,
        location:r.rack ? r.rack+(r.preferred_rack_slot===null?'':' / '+(r.preferred_rack_slot+1)):null,
        actual:kind==='PACKING'?r.packed:kind==='PICKING'?(['PICKED','SHIPPED'].includes(d.status)?r.quantity:null):d.status==='SHIPPED'?r.shipped:null}))};
  }

  private async printable(em:EntityManager,doc:any,options:{landscape:boolean; qr:boolean}) {
    const origin=process.env.WMS_PUBLIC_APP_URL;
    return {...await this.snapshot(em,doc),issuer:process.env.WMS_DOCUMENT_ISSUER,...options,
      qr:options.qr && origin ? new URL('/documents/'+doc.id,origin).toString() : undefined};
  }

  async preview(id:string,user:AuthenticatedUser,options:{landscape:boolean;qr:boolean}) {
    const doc=await this.row(this.db.manager,id,user);
    if (doc.status==='VOIDED') throw new ConflictException('Chứng từ đã hủy. Dùng bản lưu nếu cần đối chiếu.');
    return this.files.pdf(await this.printable(this.db.manager,doc,options));
  }

  async issue(id:string,user:AuthenticatedUser,options:{landscape:boolean;qr:boolean}) {
    let key:string|undefined;
    try {
      return await this.db.transaction('REPEATABLE READ',async em=>{
        const doc=await this.row(em,id,user,true);
        if (!doc.reference_id || !['DRAFT','ISSUED'].includes(doc.status)) throw new ConflictException('Chỉ phát hành bản in từ chứng từ WMS đủ điều kiện');
        const snapshot=await this.printable(em,doc,options);
        if (snapshot.status.includes('BẢN NHÁP') || snapshot.status==='CANCELLED') throw new ConflictException('Chứng từ nguồn chưa đủ điều kiện phát hành');
        const [last]=await em.query('SELECT version,snapshot FROM warehouse_document_versions WHERE document_id=$1 ORDER BY version DESC LIMIT 1',[id]);
        const [same]=last?await em.query('SELECT $1::jsonb = $2::jsonb AS value',[JSON.stringify(snapshot),JSON.stringify(last.snapshot)]):[];
        if (same?.value) return {version:last.version};
        const bytes=await this.files.pdf(snapshot);
        key=await this.files.save(bytes);
        const version=(last?.version??0)+1;
        await em.query('INSERT INTO warehouse_document_versions(document_id,version,storage_key,checksum,snapshot,actor_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [id,version,key,digest(bytes),JSON.stringify(snapshot),user.id]);
        await em.query("UPDATE warehouse_documents SET status='ISSUED',revision=revision+1 WHERE id=$1",[id]);
        await this.event(em,id,user,'ISSUE');
        return {version};
      });
    } catch(error) {
      // Retain bytes if the commit outcome is ambiguous; the reconciliation job must check references before removal.
      if ((error as {code?:string}).code==='40001') throw new ConflictException('Chứng từ vừa phát hành, tải lại để xem phiên bản');
      throw error;
    }
  }

  async issued(id:string,version:number,user:AuthenticatedUser) {
    await this.row(this.db.manager,id,user);
    const [row]=await this.db.query('SELECT storage_key,checksum FROM warehouse_document_versions WHERE document_id=$1 AND version=$2',[id,version]);
    if(!row) throw new NotFoundException('Không tìm thấy bản phát hành');
    const bytes=await this.files.read(row.storage_key);
    if(digest(bytes)!==row.checksum) throw new ConflictException('Tệp phát hành bị sai checksum');
    return bytes;
  }

  async void(id:string,user:AuthenticatedUser,reason:string) {
    if (typeof reason!=='string' || !reason.trim()) throw new BadRequestException('Cần lý do hủy');
    return this.db.transaction(async em=>{
      const doc=await this.row(em,id,user,true);
      if (doc.status==='VOIDED') return {id};
      await em.query("UPDATE warehouse_documents SET status='VOIDED',revision=revision+1 WHERE id=$1",[id]);
      await this.event(em,id,user,'VOID',text(reason,500));
      return {id};
    });
  }
}
