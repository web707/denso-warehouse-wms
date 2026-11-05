import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Text } from '@react-three/drei';
import { ArrowRight, CheckCircle2, Play, RotateCcw, Truck } from 'lucide-react';

// Illustrative workflow only: positions are not read from a real forklift/GPS/TMS.
const STOPS = [
  { name: 'Dock nhập', info: 'Tiếp nhận container', pos: [-5.4, 0, 2] },
  { name: 'Staging', info: 'Dỡ pallet & đối chiếu', pos: [-3.0, 0, 0.4] },
  { name: 'QC / Quét mã', info: 'Kiểm tra lô và HSD', pos: [-0.7, 0, -1.1] },
  { name: 'Kệ lưu kho', info: 'Putaway đúng Zone, ô', pos: [2.3, 0, -1.0] },
  { name: 'Dock xuất', info: 'FEFO / Pick & Pack', pos: [5.3, 0, 1.9] },
];

function MetalBox({ position, size, color = '#64748b' }) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.6} metalness={0.25} />
  </mesh>;
}

function TruckModel({ position, heading = 0, color = '#0891b2' }) {
  return <group position={position} rotation={[0, heading, 0]}>
    <MetalBox position={[0, 0.5, 0]} size={[1.35, 0.78, 1.55]} color="#f8fafc" />
    <MetalBox position={[0, 0.36, 1.13]} size={[1.25, 0.7, 0.75]} color={color} />
    <MetalBox position={[0, 0.68, 1.53]} size={[0.89, 0.3, 0.02]} color="#1e293b" />
    {[-0.5, 0.5].map((x) => [-0.57, 1.04].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.22, z]} rotation={[0, 0, Math.PI/2]}>
      <cylinderGeometry args={[0.2, 0.2, 0.13, 12]}/><meshStandardMaterial color="#0f172a" roughness={0.9}/>
    </mesh>))}
  </group>;
}

function MiniRacking({ position }) {
  const bars = [];
  for (let bay=0;bay<=3;bay++) for (const z of [-0.35,0.35]) bars.push(<MetalBox key={`p-${bay}-${z}`} position={[(bay-1.5)*0.65,1.12,z]} size={[0.055,2.2,0.055]} color="#1d4ed8"/>);
  for (let level=0;level<=3;level++) for(const z of [-0.35,0.35]) bars.push(<MetalBox key={`b-${level}-${z}`} position={[0,level*0.7+0.02,z]} size={[2.0,0.07,0.07]} color="#f97316"/>);
  return <group position={position}>{bars}
    {[[-0.65,0.38,0.4], [0.05,0.37,0.4], [0.69,1.08,0.4]].map((p,i)=><MetalBox key={i} position={p} size={[0.46,0.45,0.5]} color={['#34d399','#a78bfa','#fbbf24'][i]} />)}
  </group>;
}

function MovingPallet({ playing, revision, onStep, onFinish }) {
  const group = useRef();
  const progress = useRef(0);
  const lastStage = useRef(0);
  const completed = useRef(false);
  useEffect(() => {
    progress.current = 0;
    lastStage.current = 0;
    completed.current = false;
    onStep(0);
  }, [revision]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, delta) => {
    if (playing && progress.current < STOPS.length - 1) {
      progress.current = Math.min(STOPS.length - 1, progress.current + Math.min(delta, 0.05) * 0.42);
    }
    const t = progress.current;
    const stage = Math.min(STOPS.length - 2, Math.floor(t));
    const phase = Math.min(1, t-stage);
    const smooth = phase * phase * (3 - 2*phase);
    const from = STOPS[stage].pos;
    const to = STOPS[stage+1].pos;
    if (group.current) {
      group.current.position.set(from[0]+(to[0]-from[0])*smooth,0.16,from[2]+(to[2]-from[2])*smooth);
    }
    const currentStep = Math.min(STOPS.length-1, Math.floor(t));
    if (currentStep !== lastStage.current) {
      lastStage.current = currentStep;
      onStep(currentStep);
    }
    if (t >= STOPS.length-1 && !completed.current) {
      completed.current = true;
      onFinish();
    }
  });
  return <group ref={group} position={STOPS[0].pos}>
    <MetalBox position={[0,0.04,0]} size={[0.85,0.1,0.7]} color="#a16207"/>
    <MetalBox position={[0,0.34,0]} size={[0.7,0.47,0.62]} color="#10b981"/>
    <Text position={[0,0.38,0.325]} fontSize={0.12} color="#fff" anchorX="center">SKU</Text>
  </group>;
}

function ZoneMarker({ stop, i, active }) {
  const isDock = i === 0 || i === 4;
  return <group position={stop.pos}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.012,0]}>
      <planeGeometry args={[i===3?2.9:2.1,2.1]}/>
      <meshStandardMaterial color={active ? '#bbf7d0' : isDock ? '#bae6fd' : '#e2e8f0'} />
    </mesh>
    <Html position={[0,2.8,0]} center distanceFactor={9} style={{pointerEvents:'none'}}>
      <div className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold shadow-sm ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>{String(i+1).padStart(2,'0')} · {stop.name}</div>
    </Html>
    {i === 0 && <TruckModel position={[0,0,-0.4]} />}
    {i === 1 && <MetalBox position={[0,0.16,-0.6]} size={[1.4,0.3,0.75]} color="#d97706"/>}
    {i === 2 && <group><MetalBox position={[0,0.45,-0.65]} size={[1.25,0.75,0.35]} color="#334155"/><MetalBox position={[0,0.88,-0.41]} size={[0.7,0.35,0.06]} color="#34d399"/></group>}
    {i === 3 && <MiniRacking position={[0,0,-0.65]}/>}
    {i === 4 && <TruckModel position={[0,0,-0.5]} color="#059669"/>}
  </group>;
}

export default function InboundJourney3D() {
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [revision, setRevision] = useState(0);
  const [step, setStep] = useState(0);
  const restart = () => { setCompleted(false); setStep(0); setRevision((n)=>n+1); setPlaying(true); };
  return <section className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap gap-3 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
      <div>
        <h2 className="font-bold text-slate-900 text-lg flex gap-2 items-center"><Truck className="w-5 h-5 text-emerald-600"/> Luồng hàng 3D · Xe vào kho → Xuất hàng</h2>
        <p className="text-sm text-slate-500 mt-1">Mô phỏng quy trình tham khảo Masan: tiếp nhận, kiểm tra, định vị kệ và soạn xuất.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => (completed || (!playing && step === 0)) ? restart() : setPlaying((x)=>!x)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex gap-2 items-center">
          <Play className="w-4 h-4"/>{completed ? 'Phát lại' : playing ? 'Tạm dừng' : 'Phát mô phỏng'}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setCompleted(false); setRevision((n)=>n+1); }} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600"><RotateCcw className="w-4 h-4"/></button>
      </div>
    </div>
    <div className="relative w-full h-[440px] bg-[#eff6ff]">
      <Canvas shadows dpr={[1,1.5]} camera={{position:[9.2,9.8,12.5],fov:40}}>
        <color attach="background" args={['#eaf2ff']}/>
        <ambientLight intensity={1.05}/>
        <directionalLight position={[5,10,5]} intensity={1.15} castShadow/>
        <mesh rotation={[-Math.PI/2,0,0]} receiveShadow position={[0,-0.04,0]}><planeGeometry args={[16,10]}/><meshStandardMaterial color="#f8fafc"/></mesh>
        <gridHelper args={[16,32,'#cbd5e1','#e2e8f0']} position={[0,-0.018,0]}/>
        {STOPS.map((stop,i)=><ZoneMarker key={stop.name} stop={stop} i={i} active={step===i}/>) }
        <MovingPallet playing={playing} revision={revision} onStep={setStep} onFinish={() => {setCompleted(true);setPlaying(false);setStep(STOPS.length-1);}} />
        <OrbitControls makeDefault enableDamping minDistance={6} maxDistance={27} maxPolarAngle={Math.PI/2.08} target={[0,0.7,0]}/>
      </Canvas>
      <div className="absolute left-3 bottom-3 right-3 rounded-lg bg-white/95 border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm flex flex-wrap gap-2 justify-between items-center">
        <strong className="flex gap-2 items-center">{completed ? <CheckCircle2 className="w-4 h-4 text-emerald-600"/> : <ArrowRight className="w-4 h-4 text-emerald-600"/>} {STOPS[step].name}</strong>
        <span className="text-slate-500">{STOPS[step].info}</span>
      </div>
    </div>
    <div className="p-3 sm:px-6 text-xs text-slate-500">Đây là mô hình minh họa 3D, <b>không phải dữ liệu GPS / camera / cảm biến hoặc xác nhận vận chuyển thực tế</b>. Vị trí tồn kho thật vẫn được quản lý ở sơ đồ kệ phía trên.</div>
  </section>;
}
