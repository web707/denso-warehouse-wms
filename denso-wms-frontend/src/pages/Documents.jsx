import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Camera, ChevronLeft, ChevronRight, FilePlus2, FileText, History, MoreHorizontal, Pencil, Printer, QrCode, ScanLine, Search, UploadCloud } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { raw, request } from '@/api/client';
import { useAuth } from '@/lib/auth';

const kinds = {
  '01-VT':'Phiếu nhập kho','02-VT':'Phiếu xuất kho','03-VT':'Kiểm nghiệm','05-VT':'Tổng hợp kiểm kê',
  DELIVERY:'Phiếu giao hàng',DISCREPANCY:'Sai lệch nhận hàng',QUARANTINE:'Hàng hỏng / cách ly',
  ISSUE_REQUEST:'Yêu cầu xuất',PICKING:'Picking List',PACKING:'Packing List',TRANSPORT:'Bàn giao vận chuyển',
  SHIP_CONFIRMATION:'Xác nhận xuất',TRANSFER:'Điều chuyển',CYCLE_COUNT:'Kiểm kê',ADJUSTMENT:'Điều chỉnh tồn',
  ERP_ATTACHMENT:'Đính kèm ERP',PURCHASE_ORDER:'Purchase Order',SALES_ORDER:'Sales Order',INVOICE:'Hóa đơn',
};
const states={UPLOADED:'Đã tải',NEEDS_REVIEW:'Cần kiểm tra',DRAFT:'Bản nháp',ISSUED:'Đã phát hành',VOIDED:'Đã hủy'};
const formClass='rounded-xl border bg-card p-4 space-y-3';
const selectClass='h-9 rounded-md border bg-background px-2 text-sm';
const emptyLine={sku:'',name:'',uom:'',expected:'',actual:'',lot:'',expirationDate:''};
const headers={number:'Số chứng từ',po:'PO / SO',issuer:'Đơn vị phát hành',date:'Ngày lập',note:'Ghi chú'};
const columns={sku:'SKU',name:'Tên hàng',uom:'ĐVT',expected:'Theo chứng từ',actual:'Thực tế trên phiếu',lot:'Số lô',expirationDate:'Hạn dùng'};
const writers=['admin','warehouse_manager','warehouse_staff'];
const issuers=['admin','warehouse_manager'];
const inbound=['01-VT','DELIVERY','PURCHASE_ORDER'];
const root='/documents';
const errorText=e=>e?.message||'Không xử lý được yêu cầu';
const badgeTone={UPLOADED:'text-sky-400 bg-sky-500/10',NEEDS_REVIEW:'text-amber-500 bg-amber-500/10',
  DRAFT:'text-muted-foreground bg-muted',ISSUED:'text-emerald-500 bg-emerald-500/10',VOIDED:'text-rose-500 bg-rose-500/10'};

function StatusBadge({status}) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${badgeTone[status]||'bg-muted'}`}>
    <span className="size-1.5 rounded-full bg-current" aria-hidden="true"/>{states[status]||status}
  </span>;
}

function KindSelect({value,change,all=false}) {
  return <select className={selectClass} value={value} onChange={e=>change(e.target.value)}>
    {all&&<option value="">Tất cả loại</option>}
    {Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}
  </select>;
}

function sourceFile(file,rotation,crop) {
  if (!imageFile(file) || (!rotation&&!crop)) return Promise.resolve(file);
  return createImageBitmap(file).then(bitmap=>{
    const inset=Math.floor(Math.min(bitmap.width,bitmap.height)*crop/100);
    const w=bitmap.width-2*inset,h=bitmap.height-2*inset;
    const canvas=document.createElement('canvas');
    const vertical=rotation%180!==0;
    canvas.width=vertical?h:w;canvas.height=vertical?w:h;
    const ctx=canvas.getContext('2d');
    ctx.translate(canvas.width/2,canvas.height/2);
    ctx.rotate(rotation*Math.PI/180);
    ctx.drawImage(bitmap,inset,inset,w,h,-w/2,-h/2,w,h);
    bitmap.close();
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(new File([blob],'capture.jpg',{type:'image/jpeg'})) : reject(Error('Không xử lý được ảnh')),'image/jpeg',0.9));
  });
}
const imageFile=file=>file?.type.startsWith('image/');

function useObjectUrl(blob) {
  const [url,setUrl]=useState('');
  useEffect(()=>{
    if(!blob){setUrl('');return;}
    const next=URL.createObjectURL(blob);
    setUrl(next);
    return ()=>URL.revokeObjectURL(next);
  },[blob]);
  return url;
}
async function fileBlob(url) { return (await raw(url)).blob(); }
function saveFile(blob,name) {
  const link=document.createElement('a');
  const url=URL.createObjectURL(blob);
  link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function DocumentSourceButton({reference,kind,children}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  const {user}=useAuth();
  if (!writers.includes(user?.role) || !reference) return null;
  async function open(){
    setBusy(true);setError('');
    try {
      const result=await request(`${root}/source/${kind}/${reference}`,{method:'POST'});
      navigate(root+'/'+result.id);
    } catch(e){ setError(errorText(e)); }
    finally {setBusy(false);}
  }
  return <span className="inline-flex flex-col">
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={open}>{children}</Button>
    {error&&<span role="alert" className="text-sm text-red-500">{error}</span>}
  </span>;
}

function Upload({mode}) {
  const [kind,setKind]=useState('01-VT');
  const [file,setFile]=useState(null);
  const [rotation,setRotation]=useState(0);
  const [crop,setCrop]=useState(0);
  const [qr,setQr]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [dragging,setDragging]=useState(false);
  const [stream,setStream]=useState(null);
  const video=useRef(null);
  const navigate=useNavigate();
  const fileUrl=useObjectUrl(file);
  const image=imageFile(file)?fileUrl:'';
  useEffect(()=>{
    if(!stream)return;
    if(video.current)video.current.srcObject=stream;
    return ()=>stream.getTracks().forEach(track=>track.stop());
  },[stream]);
  function selectFile(next) {
    setError('');setRotation(0);setCrop(0);
    if (!next) return;
    if (!/\.(jpe?g|png|pdf|xlsx)$/i.test(next.name)) {setError('Chọn một tệp JPG, PNG, PDF hoặc XLSX.');return;}
    if (next.size>8*1024*1024) {setError('Tệp vượt quá giới hạn 8 MiB.');return;}
    setFile(next);
  }
  const choose=e=>selectFile(e.target.files[0]);
  async function upload(create=false){
    setBusy(true);setError('');
    try{
      let result;
      if(create) result=await request(root,{method:'POST',body:{kind}});
      else {
        const data=new FormData();
        data.append('kind',kind);
        data.append('file',await sourceFile(file,rotation,crop));
        result=await request(root+'/upload',{method:'POST',body:data});
      }
      navigate(root+'/'+result.id);
    }catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }
  function openCode(value){
    try{
      const url=new URL(value.trim(),window.location.origin);
      if(url.origin!==window.location.origin||!/^\/documents\/[\da-f-]{36}$/i.test(url.pathname)){
        throw Error('QR không thuộc Document Center của môi trường này.');
      }
      setError('');navigate(url.pathname);
    }catch(e){setError(errorText(e));}
  }
  async function decode(event){
    const image=event.target.files[0];
    if (!image) return;
    try{
      const bitmap=await createImageBitmap(image);
      const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      const ctx=canvas.getContext('2d');
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();
      const {default:jsQR}=await import('jsqr');
      const data=ctx.getImageData(0,0,canvas.width,canvas.height);
      const code=jsQR(data.data,data.width,data.height);
      if(!code)throw Error('Không đọc được QR trong ảnh.');
      openCode(code.data);
    }catch(e){setError(errorText(e));}
  }
  async function camera(){
    try{
      setError('');
      setStream(await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}));
    }catch{setError('Không mở được camera. Hãy cấp quyền hoặc tải ảnh từ thiết bị.');}
  }
  function capture(){
    const frame=video.current;
    if(!frame?.videoWidth){setError('Camera chưa sẵn sàng.');return;}
    const canvas=document.createElement('canvas');
    canvas.width=frame.videoWidth;canvas.height=frame.videoHeight;
    canvas.getContext('2d').drawImage(frame,0,0);
    canvas.toBlob(blob=>{
      if(!blob){setError('Không chụp được ảnh.');return;}
      setFile(new File([blob],'camera.jpg',{type:'image/jpeg'}));setRotation(0);setCrop(0);setStream(null);
    },'image/jpeg',0.92);
  }
  return <div className="space-y-4">
    {mode!=='qr'&&<label className="flex flex-wrap items-center gap-2 text-sm">Loại chứng từ <KindSelect value={kind} change={setKind}/></label>}
    {mode==='create'&&<Button disabled={busy} onClick={()=>upload(true)}>Tạo bản nháp thủ công</Button>}
    {mode==='scan'&&<>
      <p className="text-xs font-medium text-muted-foreground">Bước {file?'2/7 · Xem trước tệp':'1/7 · Chọn nguồn'}</p>
      <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-7 text-center focus-within:ring-2 focus-within:ring-ring ${dragging?'bg-primary/10 border-primary':'bg-muted/30'}`}
        onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);selectFile(e.dataTransfer.files[0]);}}>
        <UploadCloud className="size-6 text-primary" aria-hidden="true"/>
        <span className="text-sm font-medium">{file?'Chọn tệp khác':'Kéo thả hoặc chọn tệp'}</span>
        <span className="text-xs text-muted-foreground">JPG, PNG, PDF hoặc XLSX · tối đa 8 MiB</span>
        <input className="sr-only" aria-label="Tải ảnh, PDF hoặc XLSX" type="file" accept=".jpg,.jpeg,.png,.pdf,.xlsx" onChange={choose}/>
      </label>
      {!stream?<Button type="button" variant="outline" onClick={camera}><Camera className="mr-2 size-4"/>Mở camera</Button>:
        <div className="space-y-2"><video ref={video} autoPlay playsInline muted className="max-h-72 rounded"/>
          <Button type="button" onClick={capture}>Chụp ảnh</Button>{' '}
          <Button type="button" variant="outline" onClick={()=>setStream(null)}>Tắt camera</Button></div>}
      {image&&<div className="space-y-2">
        <div className="grid h-52 place-items-center overflow-hidden rounded-lg bg-muted">
          <img className="max-h-44 max-w-full object-contain" src={image} alt="Ảnh phiếu đã chọn"
            style={{transform:`rotate(${rotation}deg) scale(${1+crop/75})`,clipPath:`inset(${crop}%)`}}/>
        </div>
        <Button type="button" variant="outline" onClick={()=>setRotation((rotation+90)%360)}>Xoay 90°</Button>
        <label className="ml-3">Cắt mép <input type="range" min="0" max="20" value={crop} onChange={e=>setCrop(Number(e.target.value))}/></label>
      </div>}
      {file&&<p className="break-all text-sm text-muted-foreground"><FileText className="mr-1 inline size-4"/>{file.name} · {Math.ceil(file.size/1024)} KiB</p>}
      {fileUrl&&file?.type==='application/pdf'&&<iframe title="Xem trước tệp PDF" sandbox="" src={fileUrl} className="h-56 w-full rounded border"/>}
      <Button disabled={busy||!file} onClick={()=>upload()}>{busy?'Đang tải…':'Tải lên để kiểm tra'}<ArrowRight className="ml-2 size-4"/></Button>
    </>}
    {mode==='qr'&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();openCode(qr);}}>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 p-6 focus-within:ring-2 focus-within:ring-ring">
        <QrCode className="size-5 text-primary"/>Chọn ảnh QR
        <input className="sr-only" aria-label="Quét ảnh QR" type="file" accept="image/*" capture="environment" onChange={decode}/>
      </label>
      <label className="block text-sm">Liên kết QR<Input className="mt-1" value={qr} onChange={e=>setQr(e.target.value)} /></label>
      <Button disabled={!qr.trim()}>Mở chứng từ</Button>
    </form>}
    {error&&<p role="alert" className="text-red-500">{error}</p>}
  </div>;
}

export default function Documents() {
  const {id}=useParams();
  const {user}=useAuth();
  const canWrite=writers.includes(user?.role), canIssue=issuers.includes(user?.role);
  const [filters,setFilters]=useState({q:'',kind:'',status:'',day:'',creator:''});
  const [search,setSearch]=useState('');
  const [mode,setMode]=useState(null);
  const [page,setPage]=useState(1);
  const [downloadError,setDownloadError]=useState('');
  const pageSize=10;
  const change=(key,value)=>{setFilters(f=>({...f,[key]:value}));setPage(1);};
  const results=useQuery({queryKey:['documents',filters],enabled:!id,queryFn:()=>request(root+'?'+new URLSearchParams(filters))});
  const rows=results.data??[];
  const last=Math.max(1,Math.ceil(rows.length/pageSize));
  const current=Math.min(page,last);
  const visible=rows.slice((current-1)*pageSize,current*pageSize);
  const dialogTitles={create:'Tạo chứng từ',scan:'Quét chứng từ',qr:'Quét QR chứng từ'};
  const dialogDescriptions={create:'Chọn loại chứng từ để mở bản nháp.',scan:'Chọn ảnh, PDF, XLSX hoặc chụp phiếu từ camera.',qr:'Dùng ảnh mã QR trên phiếu WMS hoặc dán liên kết.'};

  async function download(doc) {
    setDownloadError('');
    try {
      const path=root+'/'+doc.id;
      const info=await request(path);
      const version=info.versions[0]?.version;
      if(version) saveFile(await fileBlob(path+'/pdf?version='+version),`${doc.kind}-${doc.number||doc.id}.pdf`);
      else if(info.hasFile) saveFile(await fileBlob(path+'/file'),doc.filename||doc.id);
      else throw Error('Chứng từ chưa có tệp tải xuống.');
    } catch(e){setDownloadError(errorText(e));}
  }
  if (id) return <DocumentDetail key={id} id={id} user={user} canWrite={canWrite} canIssue={canIssue}/>;

  return <main className="mx-auto max-w-[1480px] space-y-6 px-4 py-6 md:px-7 md:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Chứng từ kho</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Số hóa phiếu, tra cứu chứng từ và in bản phát hành từ WMS.</p>
      </div>
      {canWrite&&<div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={()=>setMode('create')}><FilePlus2 className="mr-2 size-4"/>Tạo chứng từ</Button>
        <Button onClick={()=>setMode('scan')}><ScanLine className="mr-2 size-4"/>Quét chứng từ</Button>
      </div>}
    </header>
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ...(canWrite?[{icon:ScanLine,label:'Quét phiếu giấy',detail:'Nhận diện ảnh, PDF và bảng tính',onClick:()=>setMode('scan')}]:[]),
        {icon:QrCode,label:'Quét QR',detail:'Mở chứng từ từ mã trên phiếu',onClick:()=>setMode('qr')},
        {icon:Printer,label:'Xem/In chứng từ',detail:'Tra cứu phiếu và bản phát hành',onClick:()=>document.getElementById('document-search')?.focus()},
      ].map(({icon:Icon,label,detail,onClick})=><button key={label} type="button" onClick={onClick}
        className="group flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3.5 text-left hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="size-5" aria-hidden="true"/></span>
        <span className="min-w-0 flex-1"><strong className="block text-sm font-medium">{label}</strong>
          <span className="block text-xs text-muted-foreground">{detail}</span></span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true"/>
      </button>)}
    </div>
    <Dialog open={!!mode} onOpenChange={open=>{if(!open)setMode(null);}}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{dialogTitles[mode]}</DialogTitle><DialogDescription>{dialogDescriptions[mode]}</DialogDescription></DialogHeader>
        {mode&&<Upload key={mode} mode={mode}/>}
      </DialogContent>
    </Dialog>
    <section className="rounded-xl border bg-card" aria-labelledby="documents-table-title">
      <details className="group border-b" open>
       <summary className="cursor-pointer px-4 pt-4 text-sm font-semibold md:hidden">Tìm kiếm và bộ lọc</summary>
       <div className="space-y-4 p-4 md:px-5">
        <h2 id="documents-table-title" className="font-semibold">Danh sách chứng từ</h2>
        <form className="flex flex-wrap items-end gap-2.5" onSubmit={e=>{e.preventDefault();change('q',search.trim());}}>
          <label className="min-w-44 grow text-xs text-muted-foreground">Tìm mã, PO, SKU
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4" aria-hidden="true"/>
              <Input id="document-search" className="pl-9" placeholder="VD: mã phiếu hoặc SKU" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">Loại <KindSelect all value={filters.kind} change={v=>change('kind',v)}/></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Trạng thái
            <select className={selectClass} value={filters.status} onChange={e=>change('status',e.target.value)}>
              <option value="">Tất cả trạng thái</option>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">Ngày tạo<Input type="date" value={filters.day} onChange={e=>change('day',e.target.value)}/></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Người lập<Input className="w-36" value={filters.creator} onChange={e=>change('creator',e.target.value)}/></label>
          <Button type="submit" variant="secondary">Tìm kiếm</Button>
          {Object.values(filters).some(Boolean)&&<Button type="button" variant="ghost" onClick={()=>{
            setSearch('');setFilters({q:'',kind:'',status:'',day:'',creator:''});setPage(1);
          }}>Xóa bộ lọc</Button>}
        </form>
       </div>
      </details>
      {downloadError&&<p role="alert" className="px-5 py-3 text-sm text-red-500">{downloadError}</p>}
      {results.isPending&&<div role="status" className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">Đang tải chứng từ…</p>
        {[0,1,2].map(n=><div key={n} className="h-10 animate-pulse rounded bg-muted"/>)}
      </div>}
      {results.isError&&<div className="p-5"><p role="alert" className="mb-2 text-sm text-red-500">{errorText(results.error)}</p><Button variant="outline" onClick={()=>results.refetch()}>Thử lại</Button></div>}
      {results.isSuccess&&(!rows.length?<div className="grid justify-items-center gap-2 px-4 py-10 text-center">
        <FileText className="size-7 text-muted-foreground" aria-hidden="true"/><p className="font-medium">Chưa có chứng từ phù hợp</p>
      </div>:<>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm md:min-w-[880px]">
            <thead className="hidden border-b bg-muted/35 text-xs font-medium text-muted-foreground md:table-header-group">
              <tr>{['Loại chứng từ','Mã chứng từ','Đơn liên kết','PO/SO liên kết','Ngày tạo','Người lập','Trạng thái','Thao tác']
                .map(label=><th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="block divide-y md:table-row-group">
              {visible.map(doc=>{
                const path=root+'/'+doc.id;
                const editable=canWrite&&!doc.reference_id&&['UPLOADED','NEEDS_REVIEW'].includes(doc.status)&&
                  (canIssue||doc.creator?.toLowerCase()===user?.email?.toLowerCase());
                return <tr key={doc.id} className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-4 hover:bg-muted/25 md:table-row md:p-0">
                  <td data-label="Loại" className="text-xs font-medium text-primary md:px-4 md:py-3">{kinds[doc.kind]||doc.kind}</td>
                  <td data-label="Mã chứng từ" className="row-start-1 break-all font-medium md:px-4 md:py-3">
                    <Link className="hover:underline" to={path}>{doc.reference_id?doc.id.slice(0,8):doc.number||doc.id.slice(0,8)}</Link>
                    <button type="button" className="ml-2 text-xs text-primary underline" aria-label={`Sao chép mã chứng từ ${doc.id}`}
                      onClick={async()=>{try{await navigator.clipboard.writeText(doc.id);setDownloadError('');}catch{setDownloadError('Không sao chép được mã chứng từ.');}}}>Sao chép</button>
                  </td>
                  <td data-label="Đơn liên kết" className="break-all text-xs text-muted-foreground md:px-4 md:py-3">{doc.reference_id?doc.number||'—':'—'}</td>
                  <td data-label="PO/SO" className="break-all text-xs text-muted-foreground md:px-4 md:py-3">{doc.po||'—'}</td>
                  <td data-label="Ngày tạo" className="text-xs text-muted-foreground md:whitespace-nowrap md:px-4 md:py-3">{new Date(doc.created_at).toLocaleDateString('vi-VN')}</td>
                  <td data-label="Người lập" className="break-all text-xs text-muted-foreground md:px-4 md:py-3">{doc.creator}</td>
                  <td className="md:px-4 md:py-3"><StatusBadge status={doc.status}/></td>
                  <td className="col-span-2 md:px-4 md:py-3">
                    <div className="flex items-center gap-1">
                      <Button asChild size="sm" variant="ghost"><Link to={path}>Xem</Link></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Thao tác ${kinds[doc.kind]||doc.kind} ${doc.number||doc.id}`}>
                          <MoreHorizontal className="size-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {editable&&<DropdownMenuItem asChild><Link to={path+'#review'}><Pencil className="mr-2 size-4"/>Sửa bản nháp</Link></DropdownMenuItem>}
                          {doc.status!=='VOIDED'&&<DropdownMenuItem asChild><Link to={path+'#print'}><Printer className="mr-2 size-4"/>Xem/In PDF</Link></DropdownMenuItem>}
                          {(doc.filename||doc.status==='ISSUED')&&<DropdownMenuItem onSelect={()=>download(doc)}><ArrowDownToLine className="mr-2 size-4"/>Tải tệp</DropdownMenuItem>}
                          <DropdownMenuItem asChild><Link to={path+'#history'}><History className="mr-2 size-4"/>Lịch sử</Link></DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground md:px-5">
          <span>{(current-1)*pageSize+1}–{Math.min(current*pageSize,rows.length)} / {rows.length}{rows.length===150?' kết quả gần nhất':' chứng từ'}</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Trang trước" disabled={current<=1} onClick={()=>setPage(current-1)}><ChevronLeft className="size-4"/></Button>
            <span>Trang {current} / {last}</span>
            <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Trang sau" disabled={current>=last} onClick={()=>setPage(current+1)}><ChevronRight className="size-4"/></Button>
          </div>
        </div>
      </>)}
    </section>
  </main>;
}


function DocumentDetail({id,user,canWrite,canIssue}) {
  const path=root+'/'+id;
  const {hash}=useLocation();
  const result=useQuery({queryKey:['document',id],queryFn:()=>request(path)});
  const doc=result.data;
  const [draft,setDraft]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [page,setPage]=useState(1);
  const [box,setBox]=useState(null);
  const [size,setSize]=useState(null);
  const [pdf,setPdf]=useState(null);
  const [qr,setQr]=useState(true);
  const [landscape,setLandscape]=useState(false);
  const [reason,setReason]=useState('');
  const [manualReview,setManualReview]=useState(false);
  const [confirmation,setConfirmation]=useState(null);
  const imageQuery=useQuery({queryKey:['document-page',id,page],enabled:!!doc?.hasFile&&!doc.mime.includes('spreadsheet'),
    queryFn:()=>fileBlob(path+'/file?page='+page),retry:false});
  const image=useObjectUrl(imageQuery.data);
  const preview=useObjectUrl(pdf);
  const fields=draft??doc?.fields??{};
  const pages=doc?.extraction??[];
  const editable=canWrite&&(canIssue||doc?.created_by===user?.id)&&!doc?.reference_id&&['UPLOADED','NEEDS_REVIEW'].includes(doc?.status);
  const waitingForScan=editable&&doc?.status==='UPLOADED'&&!manualReview;
  const scannedInbound=doc?.hasFile&&!doc?.reference_id&&inbound.includes(doc?.kind);
  const receiveReady=scannedInbound&&doc?.status==='DRAFT';
  const options={qr,landscape};
  useEffect(()=>{
    if(doc&&['#review','#print','#history'].includes(hash)) {
      document.getElementById(hash.slice(1))?.scrollIntoView({block:'start'});
    }
  },[doc,hash]);

  async function run(fn){
    setBusy(true);setError('');setNotice('');
    try { await fn(); }
    catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }
  function change(key,value){setDraft({...fields,[key]:value});}
  function cell(i,key,value){change('lines',fields.lines.map((line,index)=>index===i?{...line,[key]:value}:line));}
  async function review(mode){
    const payload={fields:{...fields,lines:fields.lines??[]},revision:doc.revision};
    const result=await request(path+'/'+mode,{method:mode==='draft'?'PATCH':'POST',body:payload});
    if(mode==='validate') {
      if(result.errors.length) throw Error(result.errors.join(' · '));
      setNotice('Dữ liệu hợp lệ để xác nhận bản nháp.');
    } else {setDraft(null);await reload();setNotice(mode==='confirm'?'Đã xác nhận bản nháp.':'Đã lưu bản nháp.');}
  }
  function reload(){return result.refetch();}
  function highlight(value){
    if(!value)return;
    const candidate=pages.flatMap(p=>p.words?.map(w=>({...w,page:p.page}))??[])
      .find(w=>w.text.toLowerCase().includes(String(value).split(/\s/)[0].toLowerCase()));
    if(candidate){setPage(candidate.page);setBox(candidate.box);}
  }
  if(result.isPending)return <main className="p-5">Đang tải chứng từ…</main>;
  if(result.isError)return <main className="p-5"><p role="alert">{errorText(result.error)}</p><Link to={root}>Danh sách</Link></main>;
  return <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-7">
    <Link to={root} className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="size-4"/> Chứng từ kho</Link>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">{kinds[doc.kind]}</h1>
        <p className="mt-1 break-all text-sm text-muted-foreground">{fieldDisplay(fields.number,doc.id)}</p></div>
      <StatusBadge status={doc.status}/>
    </header>
    {doc.hasFile&&!doc.reference_id&&<nav aria-label="Tiến độ nhận diện" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card p-3 text-xs md:px-4">
      <span className="text-muted-foreground">1. Chọn nguồn</span>
      <span className="text-muted-foreground">2. Xem trước</span>
      <span className={waitingForScan?'font-medium text-primary':'text-muted-foreground'}>3. Chạy OCR</span>
      <span className={editable&&!waitingForScan?'font-medium text-primary':'text-muted-foreground'}>4. Kiểm tra kết quả</span>
      <span className={editable&&!waitingForScan?'font-medium text-primary':'text-muted-foreground'}>5. Đối chiếu SKU</span>
      <span className={doc.status==='DRAFT'?'font-medium text-primary':'text-muted-foreground'}>6. Xác nhận bản nháp</span>
      {scannedInbound&&<span className={receiveReady?'font-medium text-primary':'text-muted-foreground'}>7. Mở Receiving</span>}
    </nav>}
    {error&&<p role="alert" className="rounded-lg border border-red-500/40 p-3 text-red-500">{error}</p>}
    {notice&&<p role="status" className="text-primary">{notice}</p>}
    <div className={`grid items-start gap-4 ${doc.hasFile?'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]':''}`}>
      {doc.hasFile&&<section className={`${formClass} min-w-0`}>
        <h2 className="font-semibold">Chứng từ gốc</h2>
        {doc.hasFile&&<>
          <Button variant="outline" disabled={busy} onClick={()=>run(async()=>saveFile(await fileBlob(path+'/file'),doc.filename||id))}>Tải bản gốc</Button>
          {imageQuery.isFetching&&<p>Đang dựng trang…</p>}
          {image&&<div className="relative inline-block">
            <img alt={'Trang '+page+' của chứng từ'} src={image} className="max-h-[560px] max-w-full rounded"
              onLoad={e=>setSize([e.target.naturalWidth,e.target.naturalHeight])}/>
            {box&&size&&<span className="pointer-events-none absolute border-2 border-amber-500" style={{
              left:box.x0/size[0]*100+'%',top:box.y0/size[1]*100+'%',width:(box.x1-box.x0)/size[0]*100+'%',height:(box.y1-box.y0)/size[1]*100+'%'}}/>}
          </div>}
          {pages.length>1&&<label className="block">Trang <select className={selectClass} value={page}
            onChange={e=>{setPage(Number(e.target.value));setBox(null);}}>{pages.map(p=><option key={p.page}>{p.page}</option>)}</select></label>}
          {imageQuery.isError&&<p>Không có bản xem trước cho trang này.</p>}
          {editable&&<Button disabled={busy} onClick={()=>run(async()=>{await request(path+'/scan',{method:'POST'});setDraft(null);await reload();})}>
            {busy?'Đang xử lý…':'Chạy OCR / trích xuất'}
          </Button>}
        </>}
        {!doc.hasFile&&<p className="text-muted-foreground">Chứng từ tạo từ WMS hoặc nhập thủ công.</p>}
        {pages.length>0&&<details><summary>Văn bản nhận diện</summary>
          {pages.map(p=><section key={p.page} className="my-2">
            <p className="text-sm">Trang {p.page} · {p.engine}{Number.isFinite(p.confidence)?` · ${Math.round(p.confidence)}% toàn trang`:''}</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{p.text||'Không nhận diện được chữ.'}</pre>
          </section>)}</details>}
      </section>}
      <section id="review" className={`${formClass} min-w-0 scroll-mt-20`}>
        <h2 className="font-semibold">{editable?'Kiểm tra dữ liệu nhận diện':'Dữ liệu chứng từ'}</h2>
        {waitingForScan?<div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          <p className="mb-3">Chạy OCR trên tệp nguồn để đọc dữ liệu, hoặc mở biểu mẫu để nhập thủ công.</p>
          <Button variant="outline" onClick={()=>setManualReview(true)}>Nhập thủ công</Button>
        </div>:<>
        <div className="grid gap-3 sm:grid-cols-2">{Object.entries(headers).map(([key,label])=><label key={key} className="grid gap-1 text-xs text-muted-foreground">
          {label}<Input type={key==='date'?'date':'text'} readOnly={!editable} value={fields[key]??''} placeholder="Chưa có"
            onFocus={()=>highlight(fields[key])} onChange={e=>change(key,e.target.value)}/>
        </label>)}</div>
        <h3 className="pt-2 text-sm font-medium">Dòng hàng · SKU và đơn vị tính</h3>
        {(fields.lines??[]).map((line,i)=><fieldset key={i} className="grid gap-3 rounded-lg border bg-muted/15 p-3 sm:grid-cols-2">
          <legend className="px-2 text-xs font-medium">Dòng {i+1}</legend>
          {Object.entries(columns).map(([key,label])=><label key={key} className="grid gap-1 text-xs text-muted-foreground">{label}
            <Input type={key==='expirationDate'?'date':['expected','actual'].includes(key)?'number':'text'} readOnly={!editable}
              onFocus={()=>highlight(line[key])} value={line[key]??''} placeholder="Chưa có" onChange={e=>cell(i,key,e.target.value)}/>
          </label>)}
          {editable&&<Button variant="outline" onClick={()=>change('lines',fields.lines.filter((_,index)=>index!==i))}>Xóa dòng</Button>}
          {!editable&&!doc.reference_id&&doc.status==='DRAFT'&&inbound.includes(doc.kind)&&(
            doc.receipts.some(r=>r.line_number===i+1)?<span>Đã liên kết phiếu nhận</span>:
            <Link className="self-end text-primary" to={'/inventory?'+new URLSearchParams({tab:'receiving',document:id,line:String(i+1)})}>Tiếp tục nhận dòng {i+1}</Link>
          )}
        </fieldset>)}
        {editable&&<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={()=>change('lines',[...(fields.lines??[]),{...emptyLine}])}>Thêm dòng</Button>
          <Button variant="outline" disabled={busy} onClick={()=>run(()=>review('draft'))}>Lưu sửa đổi</Button>
          <Button variant="outline" disabled={busy} onClick={()=>run(()=>review('validate'))}>Kiểm tra SKU và ĐVT</Button>
          <Button disabled={busy} onClick={()=>setConfirmation('draft')}>Xác nhận bản nháp</Button>
        </div>}
        </>}
      </section>
    </div>
    {!waitingForScan&&<section id="print" className={`${formClass} scroll-mt-20`}>
      <h2 className="font-semibold">PDF và bản phát hành</h2>
      <div className="flex flex-wrap items-center gap-3">
        <label><input type="checkbox" checked={qr} onChange={e=>setQr(e.target.checked)}/> In QR</label>
        <label><input type="checkbox" checked={landscape} onChange={e=>setLandscape(e.target.checked)}/> A4 ngang</label>
        {doc.status!=='VOIDED'&&<Button disabled={busy} onClick={()=>run(async()=>setPdf(await fileBlob(path+'/preview?'+new URLSearchParams(options))))}>Xem PDF</Button>}
        {preview&&<><Button variant="outline" onClick={()=>saveFile(pdf,`${doc.kind}-${id}.pdf`)}>Tải PDF</Button>
          <a className="text-primary underline" href={preview} target="_blank" rel="noreferrer">Mở PDF để in</a></>}
        {canIssue&&doc.reference_id&&doc.status!=='VOIDED'&&<Button variant="outline" disabled={busy} onClick={()=>setConfirmation('issue')}>Lưu bản phát hành</Button>}
      </div>
      {preview&&<iframe title="Xem PDF A4" src={preview} className="h-[580px] w-full rounded border"/>}
      {doc.versions.map(v=><div className="flex items-center gap-2 text-sm" key={v.version}>
        <span>Bản {v.version} · {new Date(v.created_at).toLocaleString('vi-VN')}</span>
        <Button variant="outline" size="sm" disabled={busy} onClick={()=>run(async()=>setPdf(await fileBlob(path+'/pdf?version='+v.version)))}>Xem lại</Button>
      </div>)}
      {canIssue&&doc.status!=='VOIDED'&&<form className="flex flex-wrap items-end gap-2" onSubmit={e=>{
        e.preventDefault();setConfirmation('void');
      }}><label>Lý do hủy<Input value={reason} onChange={e=>setReason(e.target.value)} required/></label>
        <Button variant="destructive" disabled={busy||!reason.trim()}>Hủy hiệu lực</Button></form>}
    </section>}
    <section id="history" className={`${formClass} scroll-mt-20`}>
      <h2 className="font-semibold">Lịch sử xử lý</h2>
      {doc.events.map((event,index)=><p key={index} className="break-all text-sm">{event.action} · {new Date(event.created_at).toLocaleString('vi-VN')} · {event.actor_id}{event.reason?' · '+event.reason:''}</p>)}
    </section>
    <ConfirmDialog open={!!confirmation} onOpenChange={open=>{if(!open)setConfirmation(null);}}
      title={{draft:'Xác nhận bản nháp?',issue:'Lưu bản phát hành?',void:'Hủy hiệu lực chứng từ?'}[confirmation]}
      description={{draft:'Dữ liệu đã duyệt sẽ được khóa. Việc xác nhận bản nháp không ghi tồn.',
        issue:'WMS sẽ lưu nội dung PDF và thông tin phiên bản.',void:'Bản PDF đã phát hành vẫn được giữ trong lịch sử.'}[confirmation]}
      confirmLabel={confirmation==='void'?'Hủy hiệu lực':'Xác nhận'} onConfirm={()=>{
        if(confirmation==='draft')run(()=>review('confirm'));
        if(confirmation==='issue')run(async()=>{await request(path+'/issue',{method:'POST',body:options});await reload();});
        if(confirmation==='void')run(async()=>{await request(path+'/void',{method:'POST',body:{reason}});setPdf(null);await reload();});
      }}/>
  </main>;
}
const fieldDisplay=(number,id)=> number ? `${number} · ${id}` : id;
