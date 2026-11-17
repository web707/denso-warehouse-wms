import io
import json
import os
import sys
from xml.sax.saxutils import escape
from zipfile import ZipFile

import pymupdf as fitz
from PIL import Image, ImageEnhance, ImageOps
from openpyxl import load_workbook
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

Image.MAX_IMAGE_PIXELS = 20_000_000
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def read_source(action, request):
    path, mime = request['path'], request['mime']
    if mime == 'application/pdf':
        with fitz.open(path, filetype='pdf') as source:
            if source.needs_pass or not 1 <= len(source) <= 12:
                raise ValueError('PDF page limit or encryption')
            if action == 'text':
                texts = [page.get_text(sort=True)[:24000] for page in source]
                return [{'text': text, 'scan': not text.strip()} for text in texts]
            if action == 'page':
                index = int(request['page']) - 1
                if not 0 <= index < len(source):
                    raise ValueError('page index')
                page = source[index]
                scale = min(2.4, 1900 / max(page.rect.width, page.rect.height))
                return page.get_pixmap(matrix=fitz.Matrix(scale, scale), annots=False).tobytes('png')
    elif mime == XLSX:
        with ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > 250 or sum(x.file_size for x in entries) > 24_000_000:
                raise ValueError('expanded workbook size')
            if 'xl/workbook.xml' not in archive.namelist() or any('vbaProject' in x.filename for x in entries):
                raise ValueError('unsupported workbook')
            for entry in entries:
                if entry.filename.lower().endswith(('.xml','.rels')):
                    xml = archive.read(entry).replace(b'\x00',b'').upper()
                    if b'<!DOCTYPE' in xml or b'<!ENTITY' in xml:
                        raise ValueError('unsupported XML declarations')
        if action == 'page':
            raise ValueError('workbook image unavailable')
        with open(path, 'rb') as source:
            workbook = load_workbook(source, read_only=True, data_only=True, keep_links=False)
            try:
                if len(workbook.worksheets) > 12:
                    raise ValueError('worksheet limit')
                if action == 'text':
                    return [{'text': '\n'.join(' | '.join(str(v or '')[:500] for v in row)
                            for row in sheet.iter_rows(max_row=201, max_col=12, values_only=True))[:24000]}
                            for sheet in workbook.worksheets]
            finally:
                workbook.close()
    else:
        with Image.open(path) as image:
            expected = 'PNG' if mime == 'image/png' else 'JPEG'
            if image.format != expected or image.width * image.height > 20_000_000:
                raise ValueError('invalid image')
            if action == 'text':
                return [{'text': '', 'scan': True}]
            if action == 'page':
                if int(request['page']) != 1:
                    raise ValueError('page index')
                normalized = ImageOps.exif_transpose(image).convert('L')
                normalized.thumbnail((1900,1900))
                normalized = ImageEnhance.Contrast(normalized).enhance(1.18)
                output = io.BytesIO()
                normalized.save(output,format='PNG')
                return output.getvalue()
            image.verify()
    return {'ok': True}


def render(snapshot):
    default = os.path.join(os.environ.get('WINDIR','C:/Windows'), 'Fonts', 'arial.ttf')
    font = os.environ.get('WMS_PDF_FONT', default)
    pdfmetrics.registerFont(TTFont('Wms',font))
    bold = os.environ.get('WMS_PDF_BOLD_FONT', os.path.join(os.path.dirname(font),'arialbd.ttf'))
    pdfmetrics.registerFont(TTFont('WmsBold',bold if os.path.isfile(bold) else font))
    output = io.BytesIO()
    page = landscape(A4) if snapshot.get('landscape') else A4
    doc = SimpleDocTemplate(output,pagesize=page,leftMargin=38,rightMargin=38,topMargin=39,bottomMargin=50)
    ink = colors.HexColor('#17313b')
    ochre = colors.HexColor('#187263')
    muted = colors.HexColor('#51636a')
    normal = ParagraphStyle('body', fontName='Wms',fontSize=9,leading=13,textColor=ink,splitLongWords=True)
    small = ParagraphStyle('small', parent=normal,fontSize=8,leading=11,textColor=muted)
    label = ParagraphStyle('label',parent=normal,fontName='WmsBold',textColor=colors.white)
    title = ParagraphStyle('title',parent=normal,fontName='WmsBold',fontSize=21,leading=27)
    def p(value, style=normal):
        return Paragraph(escape(str(value)[:650]) if value is not None and value != '' else '—', style)
    qr = snapshot.get('qr')
    head = [p(snapshot.get('issuer') or 'MASAN WMS · NỘI BỘ',small),Spacer(1,5),
            p(snapshot['title'],title),p(snapshot['template']+' · '+snapshot['status'],small)]
    if qr:
        widget = QrCodeWidget(qr)
        left, bottom, right, top = widget.getBounds()
        scale = 68/(right-left)
        drawing=Drawing(68,68,transform=[scale,0,0,scale,-left*scale,-bottom*scale])
        drawing.add(widget)
        header=Table([[head,drawing]],colWidths=[doc.width-74,74])
        header.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP')]))
        story=[header]
    else:
        story=head
    story += [Spacer(1,10),p('Số chứng từ: '+str(snapshot.get('number') or 'Chưa xác định')),
              p('Thời điểm: '+str(snapshot.get('date') or 'Chưa có'),small)]
    for name, value in snapshot.get('meta', {}).items():
        if value:
            story.append(p(f'{name}: {value}',small))
    story.append(Spacer(1,16))
    rows=[[p(x,label) for x in ['STT','Sản phẩm / SKU','Lô / vị trí','ĐVT',snapshot.get('expectedLabel','Theo chứng từ'),snapshot.get('actualLabel','Thực tế')]]]
    for i,row in enumerate(snapshot['lines'],1):
        product=' · '.join(str(row.get(k)) for k in ('name','sku') if row.get(k))
        lot=' · '.join(str(row.get(k)) for k in ('lot','location') if row.get(k))
        rows.append([p(i),p(product),p(lot),p(row.get('uom')),p(row.get('expected')),p(row.get('actual'))])
    widths=[35,doc.width-280,100,36,55,54]
    table=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),ink),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#eff6f5')]),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),
        ('LINEBELOW',(0,-1),(-1,-1),.6,ochre)]))
    story += [table,Spacer(1,15),p('Chứng từ nội bộ. Đối chiếu trạng thái và phiên bản trong WMS.',small)]
    totals = {}
    for row in snapshot['lines']:
        unit = row.get('uom')
        if unit and isinstance(row.get('expected'), (int,float)):
            totals[unit] = totals.get(unit,0) + row['expected']
    if totals:
        story.append(p('Tổng theo chứng từ: '+', '.join(f'{value} {unit}' for unit,value in totals.items()),small))
    story.append(Table([[p('Người lập'),p('Người giao / nhận'),p('Người phụ trách')]],colWidths=[doc.width/3]*3))
    def frame(canvas, _):
        canvas.setStrokeColor(ochre)
        canvas.line(38,37,page[0]-38,37)
        canvas.setFont('Wms',8)
        canvas.setFillColor(muted)
        canvas.drawString(38,24,'MASAN WMS  |  '+snapshot['template'])
        canvas.drawRightString(page[0]-38,24,f'Trang {canvas.getPageNumber()}')
    doc.build(story,onFirstPage=frame,onLaterPages=frame)
    return output.getvalue()


request = json.load(sys.stdin.buffer)
action = sys.argv[1]
result = render(request) if action == 'print' else read_source(action,request)
sys.stdout.buffer.write(result if isinstance(result,bytes) else json.dumps(result,ensure_ascii=False).encode('utf-8'))
