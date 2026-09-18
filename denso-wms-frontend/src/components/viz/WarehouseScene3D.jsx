import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, Text } from '@react-three/drei';

const RACK_W = 2.35;
const RACK_H = 2.1;
const RACK_D = 0.75;
const COL_GAP = 3.05;
const ROW_GAP = 2.55;
const COLS = 5;
const ROWS = 4;

const STATUS_COLORS = {
  empty: '#94a3b8',
  active: '#22c55e',
  near: '#f59e0b',
  full: '#6366f1',
  overload: '#ef4444',
};

function Beam({ position, size, color }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.65} metalness={0.12} /></mesh>;
}

function MiniRackFrame({ status, selected, highlighted }) {
  const post = 0.055;
  const beam = 0.055;
  const accent = selected || highlighted ? '#312e81' : '#1d4ed8';
  const shelf = STATUS_COLORS[status] || STATUS_COLORS.empty;
  const elements = [];
  for (let bay = 0; bay <= 5; bay += 1) {
    const x = -RACK_W / 2 + (RACK_W / 5) * bay;
    elements.push(
      <Beam key={`pf-${bay}`} position={[x, RACK_H / 2, -RACK_D / 2]} size={[post, RACK_H, post]} color={accent} />,
      <Beam key={`pb-${bay}`} position={[x, RACK_H / 2, RACK_D / 2]} size={[post, RACK_H, post]} color={accent} />,
    );
  }
  for (let level = 0; level <= 4; level += 1) {
    const y = (RACK_H / 4) * level;
    elements.push(
      <Beam key={`bf-${level}`} position={[0, y, -RACK_D / 2]} size={[RACK_W, beam, beam]} color={shelf} />,
      <Beam key={`bb-${level}`} position={[0, y, RACK_D / 2]} size={[RACK_W, beam, beam]} color={shelf} />,
    );
  }
  return <group>{elements}</group>;
}

function WarehouseRack({ rack, position, selected, highlighted, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[rack.status] || STATUS_COLORS.empty;
  return <group position={position}>
    <mesh position={[0, RACK_H / 2, 0]} onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)} onClick={(e) => { e.stopPropagation(); onSelect?.(rack.id); }}>
      <boxGeometry args={[RACK_W * 1.04, RACK_H * 1.02, RACK_D * 1.18]} />
      <meshStandardMaterial color={statusColor} transparent opacity={selected ? 0.17 : highlighted ? 0.13 : hovered ? 0.08 : 0.025} depthWrite={false} />
    </mesh>
    <MiniRackFrame status={rack.status} selected={selected} highlighted={highlighted} />
    <Text position={[0, RACK_H + 0.18, 0]} fontSize={0.22} color={highlighted ? '#312e81' : '#0f172a'} anchorX="center" anchorY="middle">{rack.name}</Text>
    {hovered && <Html position={[0, RACK_H + 0.55, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
      <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-[11px] whitespace-nowrap min-w-[160px]">
        <div className="font-bold text-slate-900">{rack.zoneCode} / {rack.name}</div>
        <div className="text-slate-500 mt-0.5">{rack.warehouseCode}</div>
        <div className="mt-1 text-slate-700">{rack.usedSlots}/20 ô · {rack.partCount} PART</div>
        <div className="text-slate-500">{rack.totalWeight.toLocaleString('vi-VN')} kg · {rack.totalCbm.toFixed(2)} m³</div>
      </div>
    </Html>}
  </group>;
}

function WarehouseShell({ warehouseCode, zoneCode }) {
  const floorW = COLS * COL_GAP + 2.4;
  const floorD = ROWS * ROW_GAP + 2.6;
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow><planeGeometry args={[floorW, floorD]} /><meshStandardMaterial color="#e2e8f0" roughness={0.92} /></mesh>
    <gridHelper args={[Math.max(floorW, floorD), 30, '#94a3b8', '#cbd5e1']} position={[0, 0, 0]} />
    <mesh position={[0, 2.4, -floorD / 2]} receiveShadow><boxGeometry args={[floorW, 4.8, 0.08]} /><meshStandardMaterial color="#f8fafc" /></mesh>
    <mesh position={[-floorW / 2, 2.4, 0]} receiveShadow><boxGeometry args={[0.08, 4.8, floorD]} /><meshStandardMaterial color="#f8fafc" /></mesh>
    <Text position={[0, 4.1, -floorD / 2 + 0.09]} fontSize={0.42} color="#334155" anchorX="center">{warehouseCode} · {zoneCode} · 20 RACKS</Text>
  </group>;
}

export default function WarehouseScene3D({ racks, selectedRackId, highlightedRackIds, onSelectRack, warehouseCode = 'DENSO-WH', zoneCode = 'ZONE-A', className }) {
  const layout = useMemo(() => racks.slice(0, 20).map((rack, index) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    const x = (col - (COLS - 1) / 2) * COL_GAP;
    const z = (row - (ROWS - 1) / 2) * ROW_GAP;
    return { ...rack, position: [x, 0, z] };
  }), [racks]);

  return <div className={className} style={{ minHeight: 620, height: 620, width: '100%' }}>
    <Canvas shadows camera={{ position: [12.5, 11.5, 15.5], fov: 43 }}>
      <color attach="background" args={['#f8fafc']} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[8, 13, 8]} intensity={1.2} castShadow />
      <directionalLight position={[-8, 7, -5]} intensity={0.35} />
      <WarehouseShell warehouseCode={warehouseCode} zoneCode={zoneCode} />
      {layout.map((rack) => <WarehouseRack key={rack.id} rack={rack} position={rack.position} selected={rack.id === selectedRackId} highlighted={highlightedRackIds?.has(rack.id)} onSelect={onSelectRack} />)}
      <OrbitControls makeDefault target={[0, 1.1, 0]} minDistance={7} maxDistance={32} maxPolarAngle={Math.PI / 2.04} />
    </Canvas>
  </div>;
}
