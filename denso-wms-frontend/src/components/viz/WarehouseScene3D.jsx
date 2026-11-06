import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Edges } from '@react-three/drei';
import { Boxes, CheckCircle2, MousePointerClick } from 'lucide-react';
import { rackInventoryView, partDisplayColor } from '@/lib/viz/rackInventoryView';
import { familyLabel, FAMILY_COLORS } from '@/lib/rackProductFamily';

const W=2.32, H=2.15, D=0.8;
const COLS=5, COL_GAP=3.1, ROW_GAP=2.8;
const statusColors={empty:'#94a3b8',active:'#10b981',near:'#f59e0b',full:'#6366f1',overload:'#ef4444'};
const statusLabels={empty:'Kệ trống',active:'Đang sử dụng',near:'Gần đầy',full:'Đầy',overload:'Quá tải thực tế'};
function Beam({pos,size,color='#1d4ed8',dimmed=false}) {return <mesh position={pos} castShadow={!dimmed} receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.42} metalness={0.35} transparent={dimmed} opacity={dimmed ? 0.22 : 1} depthWrite={!dimmed}/></mesh>;}
function occupiedPositions(parts=[]) {
  const { slots } = rackInventoryView(parts);
  return slots.filter((s)=>s.placements.length).map((s)=>({ slot:s.index,part:parts.find((p)=>p.id===s.placements[0].partId) }));
}
function RackVisual({rack,position,selected,highlighted,dimmed,onSelect,onHover}) {
  const [hovered,setHovered]=useState(false);
  const busy=occupiedPositions(rack.rackParts);
  const frameColor=selected?'#4338ca':highlighted?'#0891b2':'#1d4ed8';
  const familyColor=FAMILY_COLORS[rack.family]||'#64748b';
  const statusColor=statusColors[rack.status]||statusColors.empty;
  const beams=[];
  for(let b=0;b<=5;b++)for(const z of [-D/2,D/2])beams.push(<Beam key={`post${b}${z}`} pos={[-W/2+b*W/5,H/2,z]} size={[0.047,H,0.047]} color={frameColor} dimmed={dimmed}/>);
  for(let l=0;l<=4;l++)for(const z of [-D/2,D/2])beams.push(<Beam key={`front${l}${z}`} pos={[0,l*H/4,z]} size={[W,0.057,0.055]} color={l%2?'#f97316':'#fb923c'} dimmed={dimmed}/>);
  return <group position={position}>
    <mesh position={[0,H/2,0]} onPointerOver={(e)=>{e.stopPropagation();setHovered(true);onHover?.(rack.id);}} onPointerOut={(e)=>{e.stopPropagation();setHovered(false);onHover?.(null);}} onClick={(e)=>{e.stopPropagation();onSelect?.(rack.id);}}>
      <boxGeometry args={[W*1.05,H*1.04,D*1.2]}/>
      <meshStandardMaterial color={selected?'#6366f1':statusColor} transparent opacity={dimmed?0.012:selected?0.18:hovered?0.10:0.025} depthWrite={false}/>
    </mesh>
    {beams}
    {Array.from({length:4},(_,l)=><Beam key={`shelf${l}`} pos={[0,l*H/4+0.03,0]} size={[W,0.035,D]} color="#64748b" dimmed={dimmed}/>)}
    {busy.map(({slot,part})=>{
      const bay=slot%5,level=Math.floor(slot/5);
      const x=-W/2+(bay+.5)*W/5,y=(level+.52)*H/4;
      return <group key={`${slot}-${part.id}`}>
        <mesh castShadow receiveShadow position={[x,y,0]} onClick={(e)=>{e.stopPropagation();onSelect?.(rack.id);}}>
          <boxGeometry args={[W/5*.80,H/4*.72,D*.72]}/>
          <meshStandardMaterial color={FAMILY_COLORS[rack.family] || partDisplayColor(part)} roughness={0.68} transparent={dimmed} opacity={dimmed?0.13:1} depthWrite={!dimmed}/>{!dimmed&&<Edges scale={1.005} color="#1e293b" threshold={30}/>}
        </mesh>
        <mesh position={[x,y-H/4*.33,0]} receiveShadow><boxGeometry args={[W/5*.84,.025,D*.78]}/><meshStandardMaterial color="#d6b98c" roughness={.95} transparent={dimmed} opacity={dimmed?0.2:1}/></mesh>
      </group>;
    })}
    <Text position={[0,H+.22,0]} color={dimmed?'#94a3b8':selected?'#4338ca':'#0f172a'} fontSize={.23} anchorX="center" anchorY="middle">{rack.name}</Text>
    <Text position={[0,H+.43,0]} color={dimmed?'#94a3b8':familyColor} fontSize={.12} maxWidth={W*1.4} anchorX="center" anchorY="middle">{familyLabel(rack.family)}</Text>
    <Text position={[0,H+.58,0]} color={dimmed?'#94a3b8':rack.status==='overload'?'#dc2626':'#0f766e'} fontSize={.105} anchorX="center" anchorY="middle">{`${busy.length}/20 ô · ${rack.partCount||0} PART`}</Text>
    {/* Details use a fixed top-right HUD instead of covering rack geometry. */}
  </group>;
}
function WarehouseShell({zoneCode}) {
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.035,0]} receiveShadow><planeGeometry args={[19,15]}/><meshStandardMaterial color="#edf2fc" roughness={.92}/></mesh>
    <gridHelper args={[19,38,'#cbd5e1','#e2e8f0']} position={[0,0,0]}/>
    <mesh position={[0,2.5,-7.2]} receiveShadow><boxGeometry args={[19,5,.08]}/><meshStandardMaterial color="#f8fafc" roughness={.8}/></mesh>
    <mesh position={[-9.4,2.5,0]} receiveShadow><boxGeometry args={[.08,5,15]}/><meshStandardMaterial color="#f8fafc" roughness={.8}/></mesh>
    <Text position={[0,4.25,-7.1]} fontSize={.38} anchorX="center" color="#0f766e">MASAN CONSUMER · {zoneCode}</Text>
  </group>;
}

export default function WarehouseScene3D({racks=[],selectedRackId,highlightedRackIds,onSelectRack,zoneCode='ZONE-A',className=''}) {
  const [recent,setRecent]=useState(null);
  const [hoveredRackId,setHoveredRackId]=useState(null);
  const summary=useMemo(()=>({used:racks.reduce((n,r)=>n+(r.usedSlots||0),0),overloaded:racks.filter((r)=>r.status==='overload').length}),[racks]);
  useEffect(()=>{
    let timer;
    const onCommit=()=>{setRecent(Date.now());clearTimeout(timer);timer=setTimeout(()=>setRecent(null),2800);};
    window.addEventListener('wms-inventory-committed',onCommit);
    return ()=>{window.removeEventListener('wms-inventory-committed',onCommit);clearTimeout(timer);};
  },[]);
  const layout=useMemo(()=>racks.slice(0,20).map((rack,i)=>({...rack,position:[(i%COLS-2)*COL_GAP,0,(Math.floor(i/COLS)-1.5)*ROW_GAP]})),[racks]);
  const focusRack=layout.find((rack)=>rack.id===(selectedRackId||hoveredRackId));
  return <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 ${className}`} style={{minHeight:610,height:610}}>
    <div className="absolute left-3 top-3 z-10 flex items-center gap-2 bg-white/95 border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs text-slate-700">
      <Boxes className="w-4 h-4 text-indigo-600"/><b>{racks.length} kệ · {summary.used} ô có vị trí</b>
      {recent && <span className="ml-2 flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4"/> Đã đồng bộ</span>}
    </div>
    {focusRack && <div className="pointer-events-none absolute top-3 right-3 z-10 max-w-[210px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs text-slate-700 shadow-sm">
      <p className="font-bold text-sm">{focusRack.zoneCode} · {focusRack.name}</p>
      <p className="font-semibold mt-1 text-indigo-700">{familyLabel(focusRack.family)}</p>
      <p className="text-slate-500 mt-1">{focusRack.usedSlots || 0}/20 ô · {focusRack.partCount || 0} PART</p>
      <p className="mt-0.5">{Number(focusRack.totalWeight || 0).toLocaleString('vi-VN')} kg</p>
    </div>}
    <Canvas shadows dpr={[1,1.5]} camera={{position:[12,10.7,16],fov:40}}>
      <color attach="background" args={['#f2f6ff']}/>
      <ambientLight intensity={.86}/><hemisphereLight args={['#fff','#dbeafe',.6]}/>
      <directionalLight position={[9,13,9]} intensity={1.18} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <directionalLight position={[-8,8,-5]} intensity={.35}/>
      <WarehouseShell zoneCode={zoneCode}/>
      {layout.map((rack)=><RackVisual key={rack.id} rack={rack} position={rack.position} selected={rack.id===selectedRackId} highlighted={highlightedRackIds?.has(rack.id)} dimmed={Boolean(selectedRackId&&rack.id!==selectedRackId)} onHover={setHoveredRackId} onSelect={onSelectRack}/>) }
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0,1.3,0]} minDistance={7} maxDistance={31} maxPolarAngle={Math.PI/2.05}/>
    </Canvas>
    <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap justify-between items-center gap-2 rounded-lg bg-white/95 border border-slate-200 px-3 py-2 text-[11px] text-slate-600 shadow-sm">
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
        {Object.entries(statusLabels).filter(([key])=>key!=='overload'||summary.overloaded>0).map(([key,label])=><span key={key} className="inline-flex gap-1.5 items-center"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{background:statusColors[key]}}/>{label}</span>)}
      </div>
      <span className="hidden sm:flex items-center gap-1 text-slate-500"><MousePointerClick className="w-3.5 h-3.5"/> Click kệ · kéo xoay · cuộn zoom</span>
    </div>
  </div>;
}
