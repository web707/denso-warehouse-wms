// SharedRackGeometry.jsx
// Standardized Industrial 20-Slot Rack Structure (5 Bays × 4 Levels)
import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { SHARED_RACK_SPEC } from '@/lib/viz/warehouseLayoutAdapter';

function Block({ position, size, color, onClick }) {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} />
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
  const { width, height, depth, levelPitch, shelfThickness, shelfBaseY, rackPostX } = SHARED_RACK_SPEC;
  const postColor = selected ? '#2dd4bf' : (muted ? '#475569' : '#718c9c');
  const beamColor = selected ? '#38bdf8' : (muted ? '#64748b' : '#d8963e');

  const name = rack?.name || 'RACK';
  const label = rack?.label || rack?.productFamily || '';

  return (
    <group position={position}>
      {/* Invisible click hit box for entire rack */}
      <mesh
        position={[0, height / 2, 0]}
        onClick={e => {
          e.stopPropagation();
          onSelect?.(rack.id || rack.rackId || name);
        }}
      >
        <boxGeometry args={[width + 0.1, height, depth + 0.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Selected floor halo */}
      {selected && (
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[width + 0.2, 0.02, depth + 0.2]} />
          <meshBasicMaterial color="#2dd4bf" />
        </mesh>
      )}

      {/* 4 Upright vertical posts (Front Left, Front Right, Back Left, Back Right) */}
      {[-rackPostX, rackPostX].flatMap(x =>
        [-depth / 2, depth / 2].map(z => (
          <Block
            key={`post:${x}:${z}`}
            position={[x, height / 2, z]}
            size={[0.04, height, 0.045]}
            color={postColor}
          />
        ))
      )}

      {/* 4 Horizontal shelf tier beams */}
      {Array.from({ length: SHARED_RACK_SPEC.levels }, (_, i) => shelfBaseY + i * levelPitch).map((y, levelIdx) => (
        <group key={`level:${levelIdx}`}>
          {/* Main horizontal shelf plane */}
          <Block
            position={[0, y + shelfThickness / 2, 0]}
            size={[width, shelfThickness, depth]}
            color={levelIdx === 0 ? beamColor : '#617184'}
          />
          {/* Front and rear load beams */}
          {[-depth / 2, depth / 2].map(z => (
            <Block
              key={`beam:${levelIdx}:${z}`}
              position={[0, y + shelfThickness + 0.01, z]}
              size={[width, 0.04, 0.04]}
              color={beamColor}
            />
          ))}
        </group>
      ))}

      {/* 5 Bay divider markers on bottom shelf */}
      {Array.from({ length: 6 }, (_, b) => (b - 2.5) * SHARED_RACK_SPEC.bayPitch).map((x, b) => (
        <Block
          key={`divider:${b}`}
          position={[x, shelfBaseY + shelfThickness + 0.005, 0]}
          size={[0.015, 0.01, depth * 0.9]}
          color="#94a3b8"
        />
      ))}

      {/* Highlight on selected slot if any */}
      {Number.isInteger(highlightSlotIndex) && highlightSlotIndex >= 0 && highlightSlotIndex < 20 && (
        <group
          position={[
            (highlightSlotIndex % 5 - 2) * SHARED_RACK_SPEC.bayPitch,
            shelfBaseY + Math.floor(highlightSlotIndex / 5) * levelPitch + 0.045,
            0
          ]}
        >
          <mesh>
            <boxGeometry args={[0.26, 0.015, 0.45]} />
            <meshBasicMaterial color="#40dbcb" />
          </mesh>
        </group>
      )}

      {/* Top signage: Rack Code and SKU summary */}
      <Text
        position={[0, height + 0.22, depth / 2]}
        color={selected ? '#2dd4bf' : '#f3f6fc'}
        fontSize={0.22}
        anchorX="center"
      >
        {name}
      </Text>
      {label && (
        <Text
          position={[0, height + 0.42, depth / 2]}
          maxWidth={width * 1.5}
          color="#9eb4cc"
          fontSize={0.12}
          anchorX="center"
        >
          {label}
        </Text>
      )}
    </group>
  );
}
