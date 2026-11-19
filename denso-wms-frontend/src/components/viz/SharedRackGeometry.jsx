// SharedRackGeometry.jsx
// MASAN CONSUMER WMS · Standardized Heavy-Duty Industrial Pallet Rack Geometry
import React from 'react';
import { Text } from '@react-three/drei';
import { SHARED_RACK_SPEC } from '@/lib/viz/warehouseLayoutAdapter';

function Block({ position, size, color, roughness = 0.7, metalness = 0.2, onClick }) {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

export default function SharedRackGeometry({
  rack,
  position = [0, 0, 0],
  selected = false,
  muted = false,
  onSelect,
  highlightSlotIndex = null
}) {
  const { width, height, depth, levelPitch, shelfThickness, shelfBaseY, rackPostX, bayPitch } = SHARED_RACK_SPEC;

  // Industrial Palette: Slate posts, Safety Orange beams (Teal/Emerald when selected)
  const postColor = selected ? '#2dd4bf' : (muted ? '#334155' : '#475569');
  const beamColor = selected ? '#38bdf8' : (muted ? '#64748b' : '#ea580c');
  const secondaryBeamColor = selected ? '#0d9488' : (muted ? '#475569' : '#c2410c');

  const name = rack?.name || 'RACK';
  const label = rack?.label || rack?.productFamily || '';

  return (
    <group position={position}>
      {/* Invisible hit box for entire rack selection */}
      <mesh
        position={[0, height / 2, 0]}
        onClick={e => {
          e.stopPropagation();
          onSelect?.(rack.id || rack.rackId || name);
        }}
      >
        <boxGeometry args={[width + 0.1, height + 0.2, depth + 0.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Selected floor halo indicator */}
      {selected && (
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[width + 0.25, 0.01, depth + 0.25]} />
          <meshBasicMaterial color="#2dd4bf" transparent opacity={0.35} />
        </mesh>
      )}

      {/* 4 Upright vertical columns (Front Left, Front Right, Back Left, Back Right) */}
      {[-rackPostX, rackPostX].flatMap(x =>
        [-depth / 2, depth / 2].map(z => (
          <group key={`col:${x}:${z}`}>
            {/* Base mounting footplate at floor */}
            <Block
              position={[x, 0.015, z]}
              size={[0.09, 0.03, 0.09]}
              color="#1e293b"
              metalness={0.5}
            />
            {/* Main vertical steel upright post */}
            <Block
              position={[x, height / 2, z]}
              size={[0.045, height, 0.05]}
              color={postColor}
              metalness={0.4}
              roughness={0.6}
            />
          </group>
        ))
      )}

      {/* Side diagonal cross-bracing struts on Left and Right ends */}
      {[-rackPostX, rackPostX].map(x => (
        <group key={`bracing:${x}`}>
          {Array.from({ length: SHARED_RACK_SPEC.levels }, (_, i) => {
            const y1 = shelfBaseY + i * levelPitch;
            const y2 = y1 + levelPitch * 0.85;
            const midY = (y1 + y2) / 2;
            const angle = Math.atan2(depth, y2 - y1);
            const strutLen = Math.sqrt(depth * depth + (y2 - y1) * (y2 - y1));
            return (
              <mesh key={`strut:${x}:${i}`} position={[x, midY, 0]} rotation={[i % 2 === 0 ? angle : -angle, 0, 0]}>
                <boxGeometry args={[0.015, strutLen, 0.015]} />
                <meshStandardMaterial color={muted ? '#334155' : '#475569'} metalness={0.3} roughness={0.7} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* 4 Horizontal shelf tiers (Load Beams + Mesh/Plates) */}
      {Array.from({ length: SHARED_RACK_SPEC.levels }, (_, levelIdx) => {
        const y = shelfBaseY + levelIdx * levelPitch;
        const isBottom = levelIdx === 0;

        return (
          <group key={`level:${levelIdx}`}>
            {/* Shelf floor deck surface */}
            <Block
              position={[0, y + shelfThickness / 2, 0]}
              size={[width - 0.02, shelfThickness * 0.6, depth - 0.02]}
              color={isBottom ? '#1e293b' : '#334155'}
              roughness={0.8}
            />

            {/* Front load beam (Facing warehouse aisle) */}
            <Block
              position={[0, y + shelfThickness + 0.01, depth / 2]}
              size={[width + 0.02, 0.045, 0.04]}
              color={beamColor}
              metalness={0.3}
            />

            {/* Rear load beam */}
            <Block
              position={[0, y + shelfThickness + 0.01, -depth / 2]}
              size={[width + 0.02, 0.045, 0.04]}
              color={secondaryBeamColor}
              metalness={0.3}
            />

            {/* Bay dividers along the shelf beam (5 bays per level) */}
            {Array.from({ length: 6 }, (_, b) => (b - 2.5) * bayPitch).map((x, b) => (
              <Block
                key={`divider:${levelIdx}:${b}`}
                position={[x, y + shelfThickness + 0.012, 0]}
                size={[0.012, 0.008, depth * 0.95]}
                color="#64748b"
              />
            ))}
          </group>
        );
      })}

      {/* Highlight on selected slot if any */}
      {Number.isInteger(highlightSlotIndex) && highlightSlotIndex >= 0 && highlightSlotIndex < 20 && (
        <group
          position={[
            (highlightSlotIndex % 5 - 2) * bayPitch,
            shelfBaseY + Math.floor(highlightSlotIndex / 5) * levelPitch + 0.042,
            0
          ]}
        >
          <mesh>
            <boxGeometry args={[0.28, 0.01, 0.52]} />
            <meshBasicMaterial color="#2dd4bf" transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Top Signage Badge: Industrial Nameplate */}
      <group position={[0, height + 0.22, depth / 2]}>
        {/* Nameplate backing card */}
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[0.95, 0.26, 0.02]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* Border outline */}
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[0.97, 0.28, 0.01]} />
          <meshBasicMaterial color={selected ? '#2dd4bf' : '#334155'} />
        </mesh>
        <Text
          position={[0, 0.02, 0.01]}
          color={selected ? '#2dd4bf' : '#ffffff'}
          fontSize={0.16}
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
        {label && (
          <Text
            position={[0, -0.07, 0.01]}
            maxWidth={0.9}
            color="#94a3b8"
            fontSize={0.065}
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        )}
      </group>
    </group>
  );
}
