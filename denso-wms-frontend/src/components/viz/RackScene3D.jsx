import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds, Text, Edges } from '@react-three/drei';
import { Layers3, X } from 'lucide-react';
import { mmToM } from '@/lib/viz/projection';
import { RACK_SPEC } from '@/lib/viz/rackLayout';
import { LOAD_STATUS_META } from '@/lib/viz/rackSafety';

function Beam({ position, size, color }) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.44} metalness={0.28} />
  </mesh>;
}

function RackFrame() {
  const bay = mmToM(RACK_SPEC.bayWidthMm);
  const level = mmToM(RACK_SPEC.levelHeightMm);
  const depth = mmToM(RACK_SPEC.depthMm);
  const post = mmToM(RACK_SPEC.frameThicknessMm);
  const deck = mmToM(RACK_SPEC.shelfThicknessMm);
  const width = bay * RACK_SPEC.bays;
  const height = level * RACK_SPEC.levels;
  const beams = [];
  for (let b = 0; b <= RACK_SPEC.bays; b += 1) {
    for (const z of [0, depth]) beams.push(
      <Beam key={`post-${b}-${z}`} position={[b * bay, height / 2, z]} size={[post, height, post]} color="#1d4ed8" />,
    );
  }
  for (let floor = 0; floor <= RACK_SPEC.levels; floor += 1) {
    for (const z of [0, depth]) beams.push(
      <Beam key={`beam-${floor}-${z}`} position={[width / 2, floor * level, z]} size={[width, post, post]} color="#e56a23" />,
    );
    if (floor < RACK_SPEC.levels) beams.push(
      <Beam key={`shelf-${floor}`} position={[width / 2, floor * level + deck / 2, depth / 2]} size={[width, deck, depth]} color="#9baec5" />,
    );
  }
  return <group>{beams}</group>;
}

function Carton({ placement, color, isSelected, isFaded, onSelectSlot }) {
  const p = placement;
  const position = [mmToM(p.xMm + p.dxMm / 2), mmToM(p.zMm + p.dzMm / 2), mmToM(p.yMm + p.dyMm / 2)];
  const size = [mmToM(p.dxMm), mmToM(p.dzMm), mmToM(p.dyMm)];
  return <mesh
    position={position}
    castShadow={!isFaded}
    receiveShadow
    onClick={(event) => { event.stopPropagation(); onSelectSlot?.(p.rackSlotCode); }}
  >
    <boxGeometry args={size} />
    <meshStandardMaterial
      color={isSelected ? (color || p.colorHex || '#0f766e') : color || p.colorHex || '#0f766e'}
      transparent={isFaded}
      opacity={isFaded ? 0.11 : 1}
      depthWrite={!isFaded}
      metalness={isSelected ? 0.09 : 0.025}
      roughness={isSelected ? 0.52 : 0.75}
    />
    {(!isFaded || isSelected) && <Edges color={isSelected ? '#0f172a' : '#334155'} threshold={24} />}
  </mesh>;
}

function SlotCell({ slot, metric, selected, onSelect, onHover, hasSelection }) {
  const [hovered, setHovered] = useState(false);
  const bay = mmToM(RACK_SPEC.bayWidthMm);
  const level = mmToM(RACK_SPEC.levelHeightMm);
  const depth = mmToM(RACK_SPEC.depthMm);
  const x = (slot.bay - 1) * bay + bay / 2;
  const y = (slot.level - 0.5) * level;
  const occupied = slot.placements.length > 0;
  const status = metric?.status || (occupied ? 'active' : 'empty');
  const meta = LOAD_STATUS_META[status] || LOAD_STATUS_META.empty;
  const color = selected ? '#4338ca' : meta.color;
  return <group>
    <mesh
      position={[x, y, depth / 2]}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); onHover?.(slot.code); }}
      onPointerOut={(event) => { event.stopPropagation(); setHovered(false); onHover?.(null); }}
      onClick={(event) => { event.stopPropagation(); onSelect?.(slot.code); }}
    >
      <boxGeometry args={[bay * 0.96, level * 0.91, depth * 0.95]} />
      <meshStandardMaterial color={color} transparent opacity={selected ? 0.115 : hovered ? 0.075 : 0.004} depthWrite={false} />
      {(selected || hovered || status === 'overload') && <Edges color={selected ? '#4f46e5' : color} />}
    </mesh>
    <Text
      position={[x, (slot.level - 1) * level + 0.105, -0.08]}
      fontSize={0.12}
      anchorX="center"
      color={selected ? '#4338ca' : hasSelection ? '#94a3b8' : occupied ? '#166534' : '#475569'}
    >{slot.code}</Text>
  </group>;
}

export default function RackScene3D({
  placements = [], slots = [], slotMetrics = {}, visibleLevel = 'all', className = '',
  getColor, isDimmed, highlightedPartIds, selectedSlotCode, onSelectSlot,
}) {
  const [hoveredSlotCode, setHoveredSlotCode] = useState(null);
  const visible = useMemo(
    () => visibleLevel === 'all' ? placements : placements.filter((p) => p.rackLevel <= visibleLevel),
    [placements, visibleLevel],
  );
  const width = mmToM(RACK_SPEC.bayWidthMm * RACK_SPEC.bays);
  const height = mmToM(RACK_SPEC.levelHeightMm * RACK_SPEC.levels);
  const depth = mmToM(RACK_SPEC.depthMm);
  const searching = highlightedPartIds?.size > 0;
  const hasSelection = Boolean(selectedSlotCode);
  const displayedHover = hoveredSlotCode && hoveredSlotCode !== selectedSlotCode ? hoveredSlotCode : null;
  const hoverMetric = displayedHover ? slotMetrics[displayedHover] : null;

  return <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${className}`} style={{ minHeight: 545, height: 545, width: '100%' }}>
    <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 shadow-sm px-3 py-2 text-xs text-slate-700">
      <Layers3 className="w-4 h-4 text-indigo-600" /><b>Vị trí kệ S01–S20</b>
    </div>
    {hasSelection ? (
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg border border-indigo-200 bg-white/95 shadow-sm px-2.5 py-2 text-xs text-indigo-700">
        <span className="font-semibold">Đang chọn {selectedSlotCode}</span>
        <button type="button" onClick={() => onSelectSlot?.(null)} className="rounded p-0.5 hover:bg-indigo-100" aria-label="Bỏ chọn ô" title="Bỏ chọn"><X className="w-3.5 h-3.5" /></button>
      </div>
    ) : displayedHover ? (
      <div className="absolute top-3 right-3 z-10 pointer-events-none max-w-[190px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm">
        <b>{displayedHover}</b><span className="ml-1.5 text-slate-500">{hoverMetric?.cartonCount || 0} thùng</span>
      </div>
    ) : null}

    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [width * 1.16, height * 0.98, depth * 3.15], fov: 39 }}>
      <color attach="background" args={['#f2f6ff']} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#fff', '#dbeafe', 0.45]} />
      <directionalLight position={[8, 12, 8]} intensity={1.15} castShadow />
      <directionalLight position={[-5, 6, -4]} intensity={0.35} />
      <Bounds fit clip observe margin={1.08}>
        <RackFrame />
        {slots.map((slot) => <SlotCell
          key={slot.code} slot={slot} metric={slotMetrics?.[slot.code]}
          selected={slot.code === selectedSlotCode}
          hasSelection={hasSelection}
          onHover={setHoveredSlotCode}
          onSelect={(code) => onSelectSlot?.(selectedSlotCode === code ? null : code)}
        />)}
        {visible.map((p, i) => {
          const isSelected = hasSelection && p.rackSlotCode === selectedSlotCode;
          const isFaded = hasSelection ? !isSelected : (Boolean(isDimmed?.(p)) || (searching && !highlightedPartIds.has(p.partId)));
          return <Carton
            key={`${p.partId}-${p.rackSlotIndex}-${i}`}
            placement={p} color={getColor?.(p)}
            isSelected={isSelected} isFaded={isFaded}
            onSelectSlot={(code) => onSelectSlot?.(selectedSlotCode === code ? null : code)}
          />;
        })}
      </Bounds>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.028, depth / 2]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.94} />
      </mesh>
      <gridHelper args={[14, 28, '#94a3b8', '#cbd5e1']} position={[width / 2, -0.019, depth / 2]} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.07} target={[width / 2, height / 2, depth / 2]} minDistance={2.5} maxDistance={23} />
    </Canvas>
    <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-lg border border-slate-200 bg-white/95 text-slate-600 text-[11px] px-3 py-2 shadow-sm">
      Chọn ô để làm nổi bật · Thông tin hiển thị bên phải
    </div>
  </div>;
}
