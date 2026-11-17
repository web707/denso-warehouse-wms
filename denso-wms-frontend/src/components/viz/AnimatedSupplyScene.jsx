import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { RACK_SPEC } from '@/lib/viz/rackLayout';
import { SIM_LAYOUT } from '@/components/viz/warehouseNavigation';
import { SANDBOX_TARGET, SANDBOX_SLOTS, getSlotSpec, sandboxState } from '@/components/viz/s01Sandbox';
import SharedRackGeometry from '@/components/viz/SharedRackGeometry';
import InventoryVisualization from '@/components/viz/InventoryVisualization';
import { buildUnifiedWarehouseModel, SHARED_WAREHOUSE_COORDINATES } from '@/lib/viz/warehouseLayoutAdapter';
import { mapPartToSceneLayout } from '@/lib/viz/sceneCoordinateMapper';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;
const phase=(v,a,b)=>clamp((v-a)/(b-a),0,1);
const vectorMix=(a,b,t)=>a.map((x,i)=>mix(x,b[i],t));

// Unified rack & slot layout mapper for Operational Replay.
// Maps part to exact surveyed/unified warehouse coordinates for Zone A (R01, R02, R03).
export function selectedRackLayout(part, racks) {
 if (!part) return undefined;
 const layout = mapPartToSceneLayout(part, racks, 'ZONE-A');
 if (!layout) return undefined;
 return {
  ...layout,
  slot: layout.slotIndex,
  zoneId: layout.zoneCode,
  warehouseId: layout.warehouseCode
 };
}
export function qualityForPart(part,statuses) {
 if(!part||!Array.isArray(statuses)) return undefined;
 const scope=part.quality_scope_id, lot=part.lot_id;
 if(!scope&&!lot) return undefined;
 const rows=statuses.filter(s=>scope ? s.qualityScopeId===scope&&s.lotId===lot : !s.qualityScopeId&&s.lotId===lot);
 if(!rows.length) return undefined;
 const values=new Set(rows.map(r=>r.judgment));
 if(values.size!==1) return undefined;
 const row=rows[0];
 if(['OK','AVAILABLE'].includes(row.judgment)&&rows.some(r=>r.requiresReinspection)) return undefined;
 return row.judgment;
}
export function sceneState(progress,type,data,partId,statuses,mapping) {
 const shipped=data?.order?.status==='SHIPPED';
 const picked=['PICKED','SHIPPED'].includes(data?.order?.status);
 const parts=type==='receipt'?data?.parts:data?.allocations;
 const part=parts?.find(x=>(x.id||x.part_id)===partId) || (!partId?parts?.[0]:undefined);
 // The backend resolves event order (inspection date, creation time, id) and
 // quarantine. Never borrow a judgment from another scope or another lot.
 const judgment=qualityForPart(part,statuses);
 const qcAvailable=['OK','AVAILABLE'].includes(judgment);
 const held=!!part&&!qcAvailable;
 const hasPutaway=type==='receipt'&&!!part&&data?.ledger?.some(e=>e.type==='transfer'&&e.to_rack_id&&(e.part_id===part.id||e.destination_part_id===part.id));
 // Do not animate placement until a path has passed collision verification.
 const canPlace=type==='receipt'&&mapping?.routeVerified===true&&!!hasPutaway&&qcAvailable;
 const p=!data||!part?0:type==='dispatch'&&!qcAvailable?Math.min(progress,.18):type==='dispatch'&&!shipped?Math.min(progress,picked ? .76 : .18):
   type==='receipt'&&!canPlace?Math.min(progress,.64):progress;
 const isOut=type==='dispatch';
 const dock=isOut?[4,0,2.7]:[-4,0,2.7];
 const dest=type==='receipt'?(canPlace?[mapping.position[0],mapping.position[1]+.03,mapping.position[2]]:[0,0,1]):[2,0,-1];
 const first=isOut?dest:dock, last=isOut?dock:dest;
 const reach=.95,home=[first[0]-1.65,0,first[2]], aligned=[first[0]-1.3,0,first[2]], inserted=[first[0]-reach,0,first[2]],
  target=canPlace?[last[0],0,last[2]+reach]:[last[0]-reach,0,last[2]],
  withdrawn=canPlace?[target[0],0,target[2]+.7]:[last[0]-1.65,0,last[2]];
 const fork=p<.24?vectorMix(home,aligned,phase(p,.2,.24)):p<.28?aligned:
  p<.32?vectorMix(aligned,inserted,phase(p,.28,.32)):p<.38?inserted:
  p<.64?vectorMix(inserted,target,phase(p,.38,.64)):p<.79?target:
  p<.87?vectorMix(target,withdrawn,phase(p,.79,.87)):vectorMix(withdrawn,home,phase(p,.87,.98));
 const targetHeight=last[1], high=Math.max(.45,targetHeight+.10);
 const lift=p<.32?0:p<.38?mix(0,.45,phase(p,.32,.38)):p<.64?.45:
  p<.70?mix(.45,high,phase(p,.64,.70)):p<.75?mix(high,targetHeight,phase(p,.70,.75)):
  p<.79?targetHeight:mix(targetHeight,0,phase(p,.79,.87));
 const carried=p>=.32&&p<.79;
 // A short telescoping motion is shown during pickup. It remains illustrative:
 // the receiving and shelf route are not certified by this visual state alone.
 const forkExtension=p<.28?-.4:p<.32?mix(-.4,0,phase(p,.28,.32)):0;
 const forkYaw=canPlace?(p<.52?0:p<.64?mix(0,Math.PI/2,phase(p,.52,.64)):p<.87?Math.PI/2:mix(Math.PI/2,0,phase(p,.87,.98))):0;
 const pallet=carried?[fork[0]+reach*Math.cos(forkYaw),lift,fork[2]-reach*Math.sin(forkYaw)]:p<.32?first:last;
 const truckX=isOut?mix(4,11,phase(p,.85,1)):p<.08?mix(-11,-7,phase(p,0,.08)):mix(-7,-4,phase(p,.12,.18));
 const truckYaw=isOut?0:Math.PI*phase(p,.08,.12);
 const truckPhase=isOut?(p<.76?'LOADING':p<.85?'DOOR_CLOSED':p<1?'DEPART':'DEPARTED'):
   p<.08?'APPROACH':p<.12?'TURN':p<.18?'REVERSE':p<.2?'DOCKED':p<.27?'DOOR_OPEN':p<.8?'UNLOADING':p<.9?'DOOR_CLOSED':'DOCKED';
 const forkliftPhase=p<.24?'APPROACH':p<.28?'ALIGN':p<.32?'INSERT_FORKS':p<.38?'LIFT':p<.64?'TRANSPORT':p<.70?'ALIGN_SLOT':p<.75?'LOWER':p<.79?'RELEASE':'RETURN';
 const door=isOut?1-phase(p,.76,.85):phase(p,.18,.27)*(1-phase(p,.8,.9));
 return {progress:p,fork,forkYaw,forkExtension,lift,pallet,truckX,truckYaw,truckPhase,forkliftPhase,door,held,judgment,shipped,picked,carried};
}
function Block({position,size,color,onClick}) {
 return <mesh position={position} onClick={onClick}><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>;
}
function Truck({x,yaw,door,onSelect}) {
 return <group position={[x,0,4]} rotation={[0,yaw,0]} onClick={e=>{e.stopPropagation();onSelect('Xe tải · chuyển động mô phỏng');}}>
  <Block position={[0,.75,0]} size={[2.4,1.3,1.3]} color="#d4e1e3"/>
  <Block position={[1.83,.85,0]} size={[.04,.35,1]} color="#273d49"/>
  <Block position={[1.45,.55,0]} size={[.75,.9,1.25]} color="#27a59b"/>
  <group position={[-1.2,.75,-.65]} rotation={[0,door*Math.PI/2,0]}><Block position={[0,0,.32]} size={[.08,1.15,.64]} color="#8498a1"/></group>
  {[-.9,.9,1.5].flatMap(w=>[-.65,.65].map(z=><mesh key={w+':'+z} position={[w,.25,z]} rotation={[Math.PI/2,0,x*2]}>
   <cylinderGeometry args={[.24,.24,.18,12]}/><meshStandardMaterial color="#131b25"/></mesh>))}
 </group>;
}
function Forklift({position,yaw,lift,extension,onSelect}) {
 return <group position={position} rotation={[0,yaw,0]} onClick={e=>{e.stopPropagation();onSelect('Xe nâng · tuyến di chuyển mô phỏng');}}>
  <Block position={[0,.35,0]} size={[.95,.55,.8]} color="#efaa37"/>
  <Block position={[-.25,.85,0]} size={[.48,.75,.68]} color="#486170"/>
  <Block position={[.48,.8,0]} size={[.08,1.5,.8]} color="#bac7cb"/>
  <Block position={[.47,.38+lift,0]} size={[.04,.34,.32]} color="#374151"/>
  {[-.09,.09].map(z=><Block key={z} position={[.9+extension/2,.034+lift,z]} size={[.9+extension,.02,.036]} color="#d6dfe0"/>)}
  {[-.3,.3].flatMap(x=>[-.43,.43].map(z=><mesh key={x+':'+z} position={[x,.15,z]} rotation={[Math.PI/2,0,0]}>
   <cylinderGeometry args={[.15,.15,.15,10]}/><meshStandardMaterial color="#17202a"/></mesh>))}
 </group>;
}
function Pallet({position,yaw=0,details,onSelect,isPartialPicking=false,partialProgress=0}) {
 return <group position={position} rotation={[0,yaw,0]} onClick={e=>{e.stopPropagation();onSelect(details);}}>
  {/* Top deck boards */}
  <Block position={[0,.062,0]} size={[.28,.016,.28]} color="#c8a575"/>
  {/* Stringers with 2 fork pocket channels */}
  <Block position={[0,.034,-.1325]} size={[.28,.040,.015]} color="#b59062"/>
  <Block position={[0,.034,0]} size={[.28,.040,.110]} color="#b59062"/>
  <Block position={[0,.034,.1325]} size={[.28,.040,.015]} color="#b59062"/>
  {/* Bottom runner boards */}
  <Block position={[0,.007,-.1325]} size={[.28,.014,.015]} color="#a07a4a"/>
  <Block position={[0,.007,0]} size={[.28,.014,.055]} color="#a07a4a"/>
  <Block position={[0,.007,.1325]} size={[.28,.014,.015]} color="#a07a4a"/>
  {/* Cargo on top of pallet */}
  {isPartialPicking ? (
   <>
    {/* Base 80 units */}
    <Block position={[0,.15,0]} size={[.24,.16,.24]} color="#d9b980"/>
    <Block position={[0,.15,0]} size={[.242,.015,.242]} color="#967240"/>
    <Text position={[0,.15,.125]} fontSize={.04} color="#1e293b">80 PCS</Text>
    {/* Before pick (p < 0.35): show top 20 units stacked forming 100 units */}
    {partialProgress < 0.35 && (
     <group position={[0,.27,0]}>
      <Block position={[0,0,0]} size={[.24,.08,.24]} color="#38bdf8"/>
      <Block position={[0,0,0]} size={[.242,.01,.242]} color="#0284c7"/>
      <Text position={[0,0,.125]} fontSize={.035} color="#0f172a">20 PCS</Text>
      <Text position={[0,.08,0]} fontSize={.05} color="#22c55e">100 PCS</Text>
     </group>
    )}
    {partialProgress >= 0.35 && (
     <Text position={[0,.26,0]} fontSize={.045} color="#fbbf24">80 PCS (TỒN KHO)</Text>
    )}
   </>
  ) : (
   <>
    <Block position={[0,.20,0]} size={[.24,.26,.24]} color="#d9b980"/>
    <Block position={[0,.20,0]} size={[.242,.02,.242]} color="#967240"/>
    <Block position={[0,.331,0]} size={[.12,.002,.08]} color="#ffffff"/>
   </>
  )}
 </group>;
}
function CameraRig({cameraMode,truckX,fork,pallet,mapping,controls}) {
 const {camera}=useThree();
 useFrame(()=>{
  if(cameraMode==='free')return;
  const target=cameraMode==='truck'?[truckX,1,4]:cameraMode==='forklift'?fork:cameraMode==='pallet'?pallet:
   cameraMode==='rack'?(mapping?.position||[0,1,-3]):cameraMode==='dock'?[-4,1,4]:
   cameraMode==='factory'?[-9,1,-3]:cameraMode==='distributor'?[9,1,-3]:[0,0,1];
  const offset=cameraMode==='overview'?[12,13,17]:[5,5,7];
  camera.position.lerp(new THREE.Vector3(target[0]+offset[0],target[1]+offset[1],target[2]+offset[2]),.035);
  if(controls.current){controls.current.target.lerp(new THREE.Vector3(...target),.05);controls.current.update();}
 });
 return null;
}
function World({progress,type,data,partId,statuses,racks,cameraMode,onSelect,quality,showWalls,sandbox,sandboxSlotId,sandboxMode,sandboxOccupied}) {
 const controls=useRef();
 const items=type==='dispatch'?data?.allocations:data?.parts;
 const item=sandbox?null:(items?.find(x=>(x.id||x.part_id)===partId)||(!partId?items?.[0]:undefined));

 const qualityMap = useMemo(() => {
  if (!statuses || !Array.isArray(statuses)) return new Map();
  const m = new Map();
  for (const s of statuses) {
   if (s.qualityScopeId) m.set(s.qualityScopeId, s);
   if (s.lotId) m.set(s.lotId, s);
  }
  return m;
 }, [statuses]);

 const unifiedModel = useMemo(() => {
  const rawRacks = (Array.isArray(racks) && racks.length > 0) ? racks : [
   { id: 'R01', name: 'R01', zoneCode: 'ZONE-A', warehouseCode: 'DENSO-WH' },
   { id: 'R02', name: 'R02', zoneCode: 'ZONE-A', warehouseCode: 'DENSO-WH' },
   { id: 'R03', name: 'R03', zoneCode: 'ZONE-A', warehouseCode: 'DENSO-WH' }
  ];
  const partsList = type === 'dispatch' ? (data?.allocations || []) : (data?.parts || []);
  return buildUnifiedWarehouseModel(rawRacks, partsList, qualityMap, 'ZONE-A');
 }, [racks, data, type, qualityMap]);

 const sandboxTarget=useMemo(()=>{
  const spec=getSlotSpec(sandboxSlotId||'SIM-S01');
  return {
   slotId:spec.slotId,
   slot:spec.index,
   slotIndex:spec.index,
   slotCode:spec.code,
   rackId:spec.rackId,
   rackName:spec.rackName,
   position:spec.position,
   routeVerified:true
  };
 },[sandboxSlotId]);
 const mapping=useMemo(()=>sandbox?sandboxTarget:selectedRackLayout(item,racks),[sandbox,sandboxTarget,item,racks]);
 const state=useMemo(()=>sandbox
  ?sandboxState(progress,{slotId:sandboxSlotId||'SIM-S01',mode:sandboxMode||'putaway',occupied:sandboxOccupied||false})
  :sceneState(progress,type,data,partId,statuses,mapping),
 [sandbox,progress,type,data,partId,statuses,mapping,sandboxSlotId,sandboxMode,sandboxOccupied]);
 const isPartialPicking=sandbox&&sandboxMode==='partial_picking';
 const {fork,forkYaw,forkExtension,truckX,truckYaw,door,lift,pallet,palletYaw=0,held,judgment,pickedCargo,pickedCargoYaw=0}=state;
 const sku=type==='dispatch'?data?.order?.sku:data?.receipt?.product_code;
 const lot=item?.lot_number;
 const palletDetails=sandbox
  ?(isPartialPicking?`Pallet kệ ${mapping?.slotId||'S01'} · Tồn trên kệ: ${state.partialPicking?.shelfQty||80} đơn vị · Đã soạn: ${state.partialPicking?.pickedQty||0} đơn vị`:
    `Pallet thử nghiệm · SIMULATION / NO INVENTORY EFFECT · ${mapping?.slotId||'SIM-S01'}`)
  :item?['Pallet mô phỏng (không khẳng định LPN)',`SKU ${sku||'chưa có'}`,`Lot ${lot||'chưa có'}`,
   `PART ${item.id||item.part_id||'chưa có'}`,`${type==='dispatch'?'Cấp phát':'Tồn PART hiện tại'} ${item.quantity_pcs??item.quantity??'chưa có'} (không xác nhận số kiện trên pallet)`,
   `Kệ ${item.rack||'chưa có'}`,`Ô ${item.preferred_rack_slot==null?'chưa có':item.preferred_rack_slot}`,
   `QC hiện tại ${judgment||'chưa xác định'}`].join(' · '):'Pallet mô phỏng · chưa chọn dữ liệu';
 const guideX=mapping?.position?.[0]??-0.62;
 return <>
  <color attach="background" args={['#101b28']}/><ambientLight intensity={1.5}/><directionalLight position={[5,10,5]} intensity={2}/>
  <gridHelper args={[26,26,'#344d58','#22333e']}/>
  <Block position={[-9,1.3,-3]} size={[3,2.6,3]} color="#58747f" onClick={()=>onSelect('Nhà máy · vị trí minh họa')}/>
  <Block position={[9,1.3,-3]} size={[3,2.6,3]} color="#58747f" onClick={()=>onSelect('Điểm phân phối · vị trí minh họa')}/>
  <Text position={[-9,3,-3]} fontSize={.3}>Nguồn hàng</Text><Text position={[9,3,-3]} fontSize={.3}>Điểm nhận</Text>
  <Block position={[0,-.03,0]} size={[12,.06,6]} color="#243d4a"/>
  <Block position={[0,-.025,4]} size={[23,.05,1.8]} color="#34424a"/>
  {/* Safety aisle lines */}
  <Block position={[-1.62,-.001,.1]} size={[.06,.002,2.6]} color="#eab308"/>
  <Block position={[-1.12,-.001,-1.2]} size={[1.0,.002,.06]} color="#eab308"/>
  <Block position={[guideX,-.001,-2.1]} size={[.06,.002,1.8]} color="#38bdf8"/>
  {[-3,0,3].map((x,i)=><group key={x}>
   <Block position={[x,-.004,1.8]} size={[2.4,.008,1.3]} color={held&&i===1?'#9b6732':'#285664'}/>
   <Text position={[x,.01,1.8]} rotation={[-Math.PI/2,0,0]} fontSize={.17} color="white">{['TIẾP NHẬN HÀNG',held?(judgment?`KIỂM ĐỊNH ${judgment}`:'CHỜ KIỂM ĐỊNH'):'KIỂM ĐỊNH QC','SOẠN & ĐÓNG GÓI'][i]}</Text>
  </group>)}
  {showWalls&&<group><Block position={[0,2,-5]} size={[12,4,.15]} color="#354c59"/>
   <Block position={[-6,2,-1.55]} size={[.15,4,6.9]} color="#354c59"/>
   <Block position={[6,2,-1.55]} size={[.15,4,6.9]} color="#354c59"/></group>}
  {[-4,4].map((x,i)=><group key={x} onClick={e=>{e.stopPropagation();onSelect(i?'Outbound Dock · minh họa':'Inbound Dock · minh họa');}}>
   <Block position={[x,-.02,2.7]} size={[2,.04,1]} color="#547281"/>
   <Text position={[x,.01,2.8]} rotation={[-Math.PI/2,0,0]} fontSize={.2}>{i?'OUT':'IN'}</Text></group>)}
  {/* Unified Warehouse Racks for Zone A (R01, R02, R03) */}
  {unifiedModel.racks.map(rack => {
   const isTargetRack = mapping && (mapping.rackId === rack.rackId || mapping.rackName === rack.name || mapping.rackName?.includes(rack.name));
   const targetSlotIndex = isTargetRack ? (mapping.slotIndex ?? mapping.slot) : null;
   return (
    <group key={rack.rackId}>
     <SharedRackGeometry
      rack={rack}
      position={rack.position}
      selected={isTargetRack}
      highlightSlotIndex={targetSlotIndex}
      onSelect={() => onSelect(`Kệ ${rack.name} · ${rack.zoneCode} · ${rack.usedSlots}/${rack.totalSlots} ô đang dùng · ${rack.label}`)}
     />
     <InventoryVisualization
      rack={rack}
      rackPosition={rack.position}
      selectedSlotIndex={targetSlotIndex}
      onSelectSlot={(rId, sIdx, part) => {
       const slot = rack.slots[sIdx];
       if (part) {
        onSelect(`Kệ ${rack.name} · Ô ${slot?.code || `S${sIdx+1}`} · PART ${part.product_code || part.productCode} · Lô ${part.lot_number || part.lotNumber} · ${part.quantity_pcs || part.quantity} đv`);
       } else {
        onSelect(`Kệ ${rack.name} · Ô ${slot?.code || `S${sIdx+1}`} · Ô trống`);
       }
      }}
     />
    </group>
   );
  })}
  {!sandbox&&<Truck x={truckX} yaw={truckYaw} door={door} onSelect={onSelect}/>}<Forklift position={fork} yaw={forkYaw} lift={lift} extension={forkExtension} onSelect={onSelect}/>
  {(item||sandbox)&&<Pallet position={pallet} yaw={palletYaw} details={palletDetails} onSelect={onSelect} isPartialPicking={isPartialPicking} partialProgress={progress}/>}
  {isPartialPicking && progress >= 0.35 && pickedCargo && (
   <group position={pickedCargo} rotation={[0,pickedCargoYaw,0]} onClick={e=>{e.stopPropagation();onSelect(`Đã lấy 20 đơn vị từ ${mapping?.slotId||'kệ'} · Đang trên càng xe nâng`);}}>
    <Block position={[0,.04,0]} size={[.24,.08,.24]} color="#38bdf8"/>
    <Block position={[0,.04,0]} size={[.242,.015,.242]} color="#0284c7"/>
    <Text position={[0,.12,0]} fontSize={.05} color="#38bdf8">20 PCS (ĐÃ SOẠN)</Text>
   </group>
  )}
  <OrbitControls ref={controls} enableDamping minDistance={5} maxDistance={40} maxPolarAngle={Math.PI/2.05}/>
  <CameraRig cameraMode={cameraMode} truckX={truckX} fork={fork} pallet={pallet} mapping={mapping} controls={controls}/>
 </>;
}
export default function AnimatedSupplyScene({progress,type,data,partId,statuses,racks,cameraMode,onSelect,quality,showWalls,sandbox=false,sandboxSlotId,sandboxMode,sandboxOccupied}) {
 return <Canvas camera={{position:[12,13,17],fov:42}} dpr={quality==='low'?1:[1,1.35]} gl={{antialias:quality!=='low'}}>
  <World progress={progress} type={type} data={data} partId={partId} statuses={statuses} racks={racks} cameraMode={cameraMode} onSelect={onSelect} quality={quality} showWalls={showWalls} sandbox={sandbox} sandboxSlotId={sandboxSlotId} sandboxMode={sandboxMode} sandboxOccupied={sandboxOccupied}/>
 </Canvas>;
}
