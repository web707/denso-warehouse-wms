import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AnimatedSupplyScene, { qualityForPart, selectedRackLayout } from '@/components/viz/AnimatedSupplyScene';
import { sandboxState, SANDBOX_SLOTS, getSlotSpec, buildRackSlots, ZONE_A_RACK_CONFIG } from '@/components/viz/s01Sandbox';

const labels={RESERVED:'Giữ tồn',PICKED:'Đã soạn',PACKING:'Đóng gói',SHIPPED:'Đã xuất',CANCELLED:'Đã hủy',
 inbound:'Nhập kho',outbound:'Xuất kho',transfer:'Điều chuyển',adjustment:'Điều chỉnh'};
const box='rounded-xl border bg-card p-4';
function webglAvailable() {
 try {const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));} catch{return false;}
}
function Sandbox({onExit}) {
 const [progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[camera,setCamera]=useState('overview'),[info,setInfo]=useState('');
 const [rackId,setRackId]=useState('R01');
 const [slotId,setSlotId]=useState('R01:S01');
 const [mode,setMode]=useState('putaway');
 const [occupied,setOccupied]=useState(false);

 const availableSlots = useMemo(() => buildRackSlots(rackId), [rackId]);
 const slotSpec = useMemo(() => getSlotSpec(slotId, rackId), [slotId, rackId]);
 const state = useMemo(() => sandboxState(progress, { slotId, rackId, mode, occupied }), [progress, slotId, rackId, mode, occupied]);

 const handleSelectRack = (newRackId) => {
  setPlaying(false);
  setProgress(0);
  setRackId(newRackId);
  setSlotId(`${newRackId}:S01`);
  setInfo(`Đã chuyển sang kệ ${newRackId} · Đặt lại timeline 0%`);
 };

 const handleSelectSlot = (newSlotId) => {
  setPlaying(false);
  setProgress(0);
  setSlotId(newSlotId);
  setInfo(`Đã chuyển sang ${newSlotId} · Đặt lại timeline 0%`);
 };

 const handleSelectMode = (newMode) => {
  setPlaying(false);
  setProgress(0);
  setMode(newMode);
  setInfo(`Đã chuyển chế độ ${newMode==='partial_picking'?'Partial Picking 20/100':'Putaway 20 ô'} · Đặt lại timeline 0%`);
 };

 const handleToggleOccupied = () => {
  setPlaying(false);
  setOccupied(v => !v);
 };

 useEffect(()=>{if(!playing)return;let last=performance.now();const timer=setInterval(()=>{const now=performance.now(),elapsed=now-last;last=now;setProgress(p=>{const next=Math.min(1,p+elapsed/18000);if(next>=1)setPlaying(false);return next;});},50);return()=>clearInterval(timer);},[playing]);
 return <main className="mx-auto max-w-[1650px] space-y-4 p-4 md:p-6">
  <header className="rounded-xl border border-emerald-500/50 bg-emerald-950/30 p-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
     <h1 className="text-xl font-semibold">S01 · Physical Simulation Sandbox · Quy trình 20 Ô & Partial Picking</h1>
     <p className="text-sm">SIMULATION / NO INVENTORY EFFECT · Pallet thử nghiệm độc lập, không có PART, lô hoặc sự kiện WMS.</p>
    </div>
    <div className="flex items-center gap-2">
     <span className="rounded bg-purple-900/60 px-2 py-1 text-xs font-semibold text-purple-300">
      KỆ {rackId} (ZONE-A)
     </span>
     <span className="rounded bg-emerald-900/60 px-2 py-1 text-xs font-semibold text-emerald-300">
      {mode==='partial_picking'?'XUẤT KHO 20/100':'NHẬP KHO 20 Ô'}
     </span>
     <span className="rounded bg-sky-900/60 px-2 py-1 text-xs font-semibold text-sky-300">
      {slotSpec.code} (Bay {slotSpec.bay} · Tầng {slotSpec.level})
     </span>
    </div>
   </div>
   <p role="status" className="mt-2 text-sm text-emerald-300">
    {mode==='partial_picking'
     ?`Quy trình Soạn hàng: Tiếp cận kệ ${rackId} → Căn chỉnh → Đưa càng vào lớp 20 đơn vị → Tách và nâng 20 đơn vị (80 đơn vị giữ tại vị trí) → Rút càng → Vận chuyển về điểm tập kết.`
     :`Quy trình Nhập kho: Tiếp cận → Căn chỉnh → Đưa càng vào rãnh → Nâng pallet → Vận chuyển qua lối đi → Đến kệ ${rackId} ô ${slotSpec.code} → Nâng đúng tầng ${slotSpec.level} → Hạ đúng mặt đỡ → Nhả pallet → Rút càng.`}
   </p>
  </header>
  <div className="flex items-center justify-between gap-2">
   <Button variant="outline" onClick={onExit}>Quay về Operational Replay</Button>
   <Link to="/racks?zone=ZONE-A" className="text-sm font-medium text-primary hover:underline">Mở Trung tâm điều hành 3D (Zone A) →</Link>
  </div>
  <div className="relative h-[min(62vh,650px)] min-h-[380px] overflow-hidden rounded-xl border bg-[#101b28]">
   <AnimatedSupplyScene sandbox progress={progress} type="receipt" cameraMode={camera} onSelect={setInfo} quality="normal" showWalls sandboxSlotId={slotId} sandboxMode={mode} sandboxOccupied={occupied}/>
   <span className="absolute bottom-3 left-3 rounded bg-slate-950/90 px-3 py-2 text-xs">
    SIMULATION / NO INVENTORY EFFECT · {rackId} / {slotSpec.code} · {mode==='partial_picking'?'Xuất kho một phần 20/100':'Nhập kho 20 ô'}
   </span>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <Button size="sm" variant="outline" onClick={()=>{setPlaying(false);setProgress(0)}}>Phát lại sandbox</Button>
   <Button size="sm" onClick={()=>{if(progress>=1)setProgress(0);setPlaying(v=>!v)}}>{playing?'Tạm dừng sandbox':'Phát sandbox'}</Button>
   <label className="flex items-center gap-1 text-sm">Chế độ:
    <select aria-label="Chế độ sandbox" className="rounded border bg-background p-1 text-sm" value={mode} onChange={e=>handleSelectMode(e.target.value)}>
     <option value="putaway">Nhập kho 20 ô (Putaway S01-S20)</option>
     <option value="partial_picking">Xuất một phần (Partial Picking 20/100)</option>
    </select>
   </label>
   <label className="flex items-center gap-1 text-sm">Kệ:
    <select aria-label="Chọn kệ sandbox" className="rounded border bg-background p-1 font-semibold text-sm" value={rackId} onChange={e=>handleSelectRack(e.target.value)}>
     <option value="R01">R01 (Trái · x = -2.80)</option>
     <option value="R02">R02 (Giữa · x = 0.00)</option>
     <option value="R03">R03 (Phải · x = +2.80)</option>
    </select>
   </label>
   <label className="flex items-center gap-1 text-sm">Ô kệ:
    <select aria-label="Chọn ô sandbox" className="rounded border bg-background p-1 font-mono text-sm" value={slotId} onChange={e=>handleSelectSlot(e.target.value)}>
     {availableSlots.map(s=>(
      <option key={s.slotId} value={s.slotId}>
       {s.code} · Bay {s.bay} · Tầng {s.level} (x={s.position[0].toFixed(2)}, y={s.restY.toFixed(2)})
      </option>
     ))}
    </select>
   </label>
   {mode==='putaway'&&(
    <Button size="sm" variant={occupied?'destructive':'outline'} onClick={handleToggleOccupied} title="Kiểm tra trạng thái ô bị chiếm chỗ (BLOCKED)">
     {occupied?'Ô: BỊ CHIẾM (OCCUPIED)':'Ô: TRỐNG (EMPTY)'}
    </Button>
   )}
   <label className="flex items-center gap-1 text-sm">Camera:
    <select aria-label="Camera sandbox" className="rounded border bg-background p-1 text-sm" value={camera} onChange={e=>setCamera(e.target.value)}>
     <option value="overview">Toàn cảnh</option>
     <option value="forklift">Xe nâng</option>
     <option value="pallet">{mode==='partial_picking'?'Hàng soạn 20 pcs':'Pallet'}</option>
     <option value="rack">{slotSpec.code}</option>
     <option value="free">Tự do</option>
    </select>
   </label>
  </div>
  <label className="block text-xs">Timeline sandbox · {mode==='partial_picking'?'Quy trình xuất 20/100':'Quy trình hoàn chỉnh'} (0% - 100%)
   <input aria-label="Timeline sandbox" className="mt-1 w-full" type="range" min="0" max="100" value={Math.round(progress*100)} onChange={e=>{setPlaying(false);setProgress(Number(e.target.value)/100)}}/>
  </label>
  {mode==='partial_picking'?(
   <p className="text-sm text-muted-foreground">
    Pha: <strong className="text-white">{state.forkliftPhase}</strong> ({Math.round(progress*100)}%) · Tồn trên kệ: <strong className="text-emerald-400">{state.partialPicking?.shelfQty} đơn vị</strong> · Đã soạn: <strong className="text-sky-400">{state.partialPicking?.pickedQty} / {state.partialPicking?.orderQty} đơn vị</strong> · Trạng thái: <strong>{state.partialPicking?.status}</strong>
   </p>
  ):(
   <p className="text-sm text-muted-foreground">
    Pha: <strong className="text-white">{state.forkliftPhase}</strong> ({Math.round(progress*100)}%) · Pallet: <strong>{state.attachment}</strong> · {slotSpec.code}: <strong>{state.slotOccupancy}</strong> · Tiếp xúc: <strong>{state.collisionStatus}</strong>
   </p>
  )}
  {info&&<p className="text-sm">{info}</p>}
 </main>;
}
export default function SupplyChain3D() {
 const [type,setType]=useState('receipt'),[selected,setSelected]=useState(''),[query,setQuery]=useState('');
 const [mode,setMode]=useState('overview'),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[info,setInfo]=useState('');
 const [progress,setProgress]=useState(0),[cameraMode,setCameraMode]=useState('overview'),[quality,setQuality]=useState('normal');
 const [showWalls,setShowWalls]=useState(true);
 const [sandbox,setSandbox]=useState(false);
 const [partId,setPartId]=useState('');
 const [nav,setNav]=useState(null);
 const [showOrders,setShowOrders]=useState(true),[showDetails,setShowDetails]=useState(true);
 const sceneRef=useRef(null);
 const available=useMemo(webglAvailable,[]);
 const receipts=useQuery({queryKey:['journey-receipts'],enabled:!sandbox,queryFn:()=>request('/receiving?limit=100')});
 const dispatch=useQuery({queryKey:['journey-dispatch'],enabled:!sandbox,queryFn:()=>request('/inventory/dispatches')});
 const journey=useQuery({queryKey:['journey',type,selected],enabled:!sandbox&&!!selected,
  queryFn:()=>request('/supply-chain/'+type+'/'+selected)});
 const qcQuery=useQuery({queryKey:['journey-qc-status'],enabled:!sandbox&&!!selected,queryFn:()=>request('/inspections/lot-status')});
 const rackQuery=useQuery({queryKey:['journey-racks'],enabled:!sandbox&&!!selected,queryFn:()=>request('/racks')});
 const data=journey.data;
 const parts=(type==='receipt'?data?.parts:data?.allocations)||[];
 const selectedPart=parts.find(p=>(p.id||p.part_id)===partId)||(!partId?parts[0]:undefined);
 const selectedPartId=selectedPart?.id||selectedPart?.part_id||'';
 const judgment=qcQuery.isSuccess?qualityForPart(selectedPart,qcQuery.data):undefined;
 const mapping=useMemo(()=>selectedRackLayout(selectedPart,rackQuery.data),[selectedPart,rackQuery.data]);
 useEffect(()=>{
  if(sandbox||type!=='receipt'||!mapping){setNav(null);return;}
  setNav({status:'LOADING'});
  const worker=new Worker(new URL('../components/viz/navigationWorker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>setNav(data.error?{status:'ERROR'}:data.result);
  worker.onerror=()=>setNav({status:'ERROR'});
  worker.postMessage({start:{x:-5.22,z:1.4,heading:0},goal:{x:mapping.position[0],z:-1.2,heading:1},options:{step:.2,maxNodes:10000}});
  return()=>worker.terminate();
 },[type,mapping,sandbox]);
 const events=useMemo(()=>{
  if(!journey.data)return [];
  const d=journey.data;
  if(type==='dispatch')return d.events.map(e=>({id:e.source+e.at+e.event,at:e.at,label:labels[e.event]||e.event,detail:e.detail,source:e.source}));
  return [
   {id:'receipt',at:d.receipt.created_at,label:'Nhận hàng',detail:d.receipt.received_quantity_pcs+' đơn vị',source:'receipt'},
   ...d.inspections.filter(x=>selectedPart?.quality_scope_id&&x.quality_scope_id===selectedPart.quality_scope_id).map(x=>({id:x.id,at:x.inspection_date,label:'QC · '+x.judgment,detail:x.inspection_id,source:'qc'})),
   ...d.ledger.filter(x=>x.part_id===selectedPartId||x.destination_part_id===selectedPartId).map(x=>({id:x.id,at:x.created_at,label:labels[x.type]||x.type,detail:x.quantity_pcs+' đơn vị',source:'ledger'})),
  ].sort((a,b)=>new Date(a.at)-new Date(b.at));
 },[journey.data,type,selectedPart?.quality_scope_id,selectedPartId]);
 useEffect(()=>{if(!playing)return;let last=performance.now();const timer=setInterval(()=>{const now=performance.now();const elapsed=now-last;last=now;setProgress(p=>{
  const next=Math.min(1,p+speed*elapsed/15000);
  if(next>=1)setPlaying(false);
  return next;
 });},50);return()=>clearInterval(timer);},[playing,speed]);
 function choose(value){setSelected(value);setPartId('');setInfo('');setIndex(0);setProgress(0);setPlaying(false);}
 const list=(type==='receipt'?receipts.data:dispatch.data)||[];
 const filtered=list.filter(x=>String(type==='receipt'?x.receiptNumber:x.reference).toLowerCase().includes(query.toLowerCase()));
 const sandboxAllowed=typeof window!=='undefined'&&['localhost','127.0.0.1'].includes(window.location.hostname);
 if(sandbox&&sandboxAllowed)return <Sandbox onExit={()=>{setSandbox(false);choose('');}}/>;
 return <main className="mx-auto max-w-[1650px] space-y-4 p-4 md:p-6">
  <header><h1 className="text-2xl font-semibold">Hành trình chuỗi cung ứng 3D</h1>
   <p className="mt-1 text-sm text-muted-foreground">Theo dõi chứng từ và sự kiện đã ghi nhận trong WMS.</p></header>
  <div className="flex gap-2">{sandboxAllowed&&<Button size="sm" variant="outline" onClick={()=>{setPlaying(false);setSandbox(true);}}>Sandbox vật lý S01 · QA</Button>}<Button size="sm" variant="outline" onClick={()=>setShowOrders(v=>!v)}>{showOrders?'Ẩn đơn':'Hiện đơn'}</Button>
   <Button size="sm" variant="outline" onClick={()=>setShowDetails(v=>!v)}>{showDetails?'Ẩn chi tiết':'Hiện chi tiết'}</Button></div>
  <div className="flex flex-col gap-4 xl:flex-row">
   {showOrders&&<aside className={`${box} xl:w-60 xl:shrink-0`}><h2 className="font-semibold">Chọn hành trình</h2>
    <div className="mt-3 flex gap-2"><Button size="sm" variant={type==='receipt'?'default':'outline'} onClick={()=>{setType('receipt');choose('');}}>Nhập</Button>
     <Button size="sm" variant={type==='dispatch'?'default':'outline'} onClick={()=>{setType('dispatch');choose('');}}>Xuất</Button></div>
    <Input className="mt-3" aria-label="Tìm đơn" placeholder="Tìm số phiếu" value={query} onChange={e=>setQuery(e.target.value)}/>
    {(type==='receipt'?receipts:dispatch).isError&&<p role="alert">Không tải được danh sách.</p>}
    <div className="mt-3 max-h-[420px] space-y-1 overflow-auto">{filtered.map(row=><button key={row.id} onClick={()=>choose(row.id)}
     className={`w-full rounded-lg border p-2 text-left text-sm ${selected===row.id?'border-primary bg-primary/10':'hover:bg-muted'}`}>
     <strong>{type==='receipt'?row.receiptNumber:row.reference}</strong><span className="block text-xs text-muted-foreground">{type==='receipt'?row.productCode:row.sku}</span>
    </button>)}{!filtered.length&&<p className="text-sm text-muted-foreground">Chưa có dữ liệu phù hợp.</p>}</div>
   </aside>}
   <section className="min-w-0 flex-1 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
     <Button size="sm" variant={mode==='overview'?'default':'outline'} onClick={()=>{setMode('overview');setCameraMode('overview');}}>Tổng thể</Button>
     <Button size="sm" variant={mode==='warehouse'?'default':'outline'} onClick={()=>{setMode('warehouse');setCameraMode('dock');}}>Hoạt động kho</Button>
     <Button size="sm" variant={mode==='distribution'?'default':'outline'} onClick={()=>{setMode('distribution');setCameraMode('truck');}}>Phân phối</Button>
     <Link className="ml-auto text-sm text-primary" to="/racks">Mở Trung tâm điều hành 3D →</Link>
    </div>
    {!!parts.length&&<div className="rounded-lg border p-3 text-sm"><label>PART / lô đang mô phỏng{' '}
     <select aria-label="Chọn PART" value={selectedPartId} onChange={e=>{setPartId(e.target.value);setProgress(0);setPlaying(false);setInfo('');}} className="max-w-full rounded border bg-background p-1">
      {parts.map((p,i)=><option key={(p.id||p.part_id)+':'+i} value={p.id||p.part_id}>{p.lot_number||'Chưa có lô'} · PART {(p.id||p.part_id).slice(0,8)} · {p.quantity_pcs??p.quantity} đơn vị</option>)}
     </select></label><p className="mt-1 text-xs text-muted-foreground">QC hiện tại: {qcQuery.isFetching?'Đang tải':judgment||'Chưa xác định'} · Nguồn: trạng thái QC backend; không phải kết luận tại thời điểm xuất trước đây.</p>
     {qcQuery.isError&&<p role="alert" className="text-red-500">Không tải được QC; hoạt ảnh bị giới hạn an toàn.</p>}</div>}
    {selectedPart&&<p className="text-xs text-muted-foreground">{mapping?`SIMULATED LAYOUT · ${mapping.warehouseId||'Kho chưa rõ'} / ${mapping.zoneId||'Zone chưa rõ'} / ${mapping.rackName} / S${String(mapping.slot+1).padStart(2,'0')} · tầng ${mapping.level}. ${nav?.status==='LOADING'?'Đang tính tuyến mô phỏng.':nav?.status==='CANDIDATE ONLY'?`Tuyến staging: kiểm tra liên tục vật cản tĩnh ${nav.continuousStatic||'chưa rõ'}; chưa kiểm chứng nhận hàng và đặt hàng.`:'NO SAFE SIMULATED ROUTE hoặc chưa có tuyến được xác minh.'} Cảnh nhập dừng tại QC.`:'Chưa có kệ và ô hợp lệ để ánh xạ; cảnh nhận hàng dừng tại QC.'}</p>}
    <div ref={sceneRef} className="relative h-[min(62vh,650px)] min-h-[380px] overflow-hidden rounded-xl border bg-[#101b28] fullscreen:h-screen">
     {available?<Suspense fallback={<p className="p-5">Đang tải cảnh…</p>}><AnimatedSupplyScene progress={progress} type={type} data={data}
       partId={selectedPartId} statuses={qcQuery.isSuccess?qcQuery.data:undefined} racks={rackQuery.data} cameraMode={cameraMode} onSelect={setInfo} quality={quality} showWalls={showWalls}/></Suspense>:
      <p className="p-5">Thiết bị không hỗ trợ WebGL. Danh sách sự kiện vẫn sẵn sàng bên dưới.</p>}
     <span className="absolute bottom-3 left-3 rounded bg-slate-950/90 px-3 py-2 text-xs text-slate-200">SIMULATION · bố trí kệ và lộ trình minh họa · không có GPS trực tiếp</span>
     <Button size="sm" variant="outline" className="absolute right-3 top-3" onClick={async()=>{
      try {if(document.fullscreenElement) await document.exitFullscreen(); else await sceneRef.current?.requestFullscreen();}
      catch {setInfo('Trình duyệt không hỗ trợ toàn màn hình.');}
     }}>Toàn màn hình</Button>
    </div>
    <div className="flex flex-wrap gap-2">
     <label className="text-sm">Camera <select aria-label="Camera" value={cameraMode} onChange={e=>setCameraMode(e.target.value)} className="rounded border bg-background p-1">
      <option value="overview">Toàn cảnh</option><option value="truck">Theo xe tải</option><option value="forklift">Theo xe nâng</option>
      <option value="pallet">Theo pallet</option><option value="rack">Kệ</option><option value="dock">Dock</option>
      <option value="factory">Nhà máy mô phỏng</option><option value="distributor">Điểm nhận mô phỏng</option><option value="free">Tự do</option></select></label>
     <label className="text-sm">Chất lượng <select value={quality} onChange={e=>setQuality(e.target.value)} className="rounded border bg-background p-1">
      <option value="normal">Tiêu chuẩn</option><option value="low">Thấp</option></select></label>
     <Button size="sm" variant="outline" onClick={()=>setCameraMode('overview')}>Đặt lại góc nhìn</Button>
     <Button size="sm" variant="outline" onClick={()=>setShowWalls(v=>!v)}>{showWalls?'Ẩn tường':'Hiện tường'}</Button>
    </div>
    <section className={box}><div className="flex flex-wrap items-center justify-between gap-2">
     <h2 className="font-semibold">Sự kiện WMS</h2><div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={()=>{setIndex(0);setProgress(0);setPlaying(false);}}>Phát lại</Button>
      <Button size="sm" onClick={()=>{if(progress===1)setProgress(0);setPlaying(v=>!v);}}>{playing?'Tạm dừng':'Phát'}</Button>
      <label className="text-sm">Tốc độ <select value={speed} onChange={e=>setSpeed(Number(e.target.value))} className="rounded border bg-background p-1">
       <option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div></div>
     <label className="mt-3 block text-xs text-muted-foreground">Tua hoạt ảnh mô phỏng
      <input aria-label="Tua hoạt ảnh mô phỏng" className="mt-1 w-full" type="range" min="0" max="100" value={Math.round(progress*100)}
       onChange={e=>{setProgress(Number(e.target.value)/100);setPlaying(false);}}/></label>
     {type==='dispatch'&&data?.order?.status!=='SHIPPED'&&<p className="text-xs text-amber-500">Chưa xác nhận xuất. Cảnh xe rời kho được giữ lại.</p>}
     {journey.isError&&<p role="alert" className="mt-3 text-sm text-red-500">Không tải được hành trình.</p>}
     {journey.isFetching&&<p className="mt-3 text-sm">Đang tải sự kiện…</p>}
     {!selected&&<p className="mt-3 text-sm text-muted-foreground">Chọn phiếu để xem sự kiện.</p>}
     <ol className="mt-3 flex gap-2 overflow-x-auto pb-2">{events.map((e,i)=><li key={e.id}><button onClick={()=>{setIndex(i);setPlaying(false);}}
      className={`min-w-36 rounded-lg border p-3 text-left text-xs ${index===i?'border-primary bg-primary/10':''}`}>
      <strong className="block">{e.label}</strong><span>REAL EVENT · {new Date(e.at).toLocaleString('vi-VN')}</span><span className="block">{e.detail}</span>
     </button></li>)}</ol>
    </section>
   </section>
   {showDetails&&<aside className={`${box} xl:w-60 xl:shrink-0`}><h2 className="font-semibold">Thông tin</h2>
    <p className="mt-2 text-sm text-muted-foreground">{info||'Chọn một khu vực trong mô hình.'}</p>
    {data&&<div className="mt-4 space-y-3 text-sm">
     {type==='receipt'?<><p>{data.receipt.receipt_number} · {data.receipt.product_code}</p><p>Nhận {data.receipt.received_quantity_pcs} · Hỏng {data.receipt.damaged_quantity_pcs}</p>
      {data.parts.map(p=><p key={p.id}>Lô {p.lot_number} · tồn {p.quantity_pcs} · {p.rack||'Chưa có kệ'}</p>)}</>:
      <><p>{data.order.reference} · {data.order.sku}</p><p>Yêu cầu {data.order.quantity} · {data.order.status}</p>
       {data.allocations.map(p=><p key={p.part_id}>Lô {p.lot_number} · {p.quantity} · {p.rack||'Vị trí chưa có'}</p>)}</>}
     {data.documents.map(d=><Link key={d.id} className="block text-primary" to={'/documents/'+d.id}>{d.kind} · {d.status}</Link>)}
    </div>}
    {mode==='distribution'&&<p className="mt-4 text-xs text-muted-foreground">Chưa có nguồn TMS/GPS hoặc xác nhận giao hàng liên kết với đơn xuất.</p>}
   </aside>}
  </div>
 </main>;
}
