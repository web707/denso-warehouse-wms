// OperationalRack3D.jsx
// Industrial 20-Slot Warehouse Rack (5 Bays × 4 Levels) with 100% Clickable Interactive Slots & Real Inventory Mapping.
import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import PalletUnit3D from './PalletUnit3D';
import { SHARED_RACK_SPEC } from '@/lib/viz/warehouseLayoutAdapter';

export default function OperationalRack3D({
  rack,
  position = [0, 0, 0],
  activeLayer = 'qc',
  selectedSlotKey = null,
  highlightSlotKey = null,
  onSelectSlot,
  onSelectRack
}) {
  const { bays, levels, width, height, depth, levelPitch, shelfThickness, shelfBaseY, rackPostX, bayPitch } = SHARED_RACK_SPEC;
  const rackName = rack?.name || 'R01';
  const zoneCode = rack?.zoneCode || 'ZONE-A';
  const slots = rack?.slots || [];

  return (
    <group position={position}>
      {/* 4 Corner Upright Steel Columns (Teal/Steel #475569) */}
      {[-rackPostX, rackPostX].map((x, xi) =>
        [-depth / 2, depth / 2].map((z, zi) => (
          <mesh key={`post-${xi}-${zi}`} position={[x, height / 2, z]}>
            <boxGeometry args={[0.04, height, 0.04]} />
            <meshStandardMaterial color="#50677B" metalness={0.7} roughness={0.4} />
          </mesh>
        ))
      )}

      {/* Center upright support posts */}
      {[-depth / 2, depth / 2].map((z, zi) => (
        <mesh key={`center-post-${zi}`} position={[0, height / 2, z]}>
          <boxGeometry args={[0.04, height, 0.04]} />
          <meshStandardMaterial color="#50677B" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* 4 Shelf Horizontal Load Beams (Masan Safety Amber #E7A83E) */}
      {Array.from({ length: levels }).map((_, lv) => {
        const shelfY = shelfBaseY + lv * levelPitch;
        return (
          <group key={`shelf-${lv}`} position={[0, shelfY, 0]}>
            {/* Front & Rear Beams */}
            <mesh position={[0, shelfThickness / 2, depth / 2]}>
              <boxGeometry args={[width + 0.06, shelfThickness * 1.5, 0.04]} />
              <meshStandardMaterial color="#E7A83E" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, shelfThickness / 2, -depth / 2]}>
              <boxGeometry args={[width + 0.06, shelfThickness * 1.5, 0.04]} />
              <meshStandardMaterial color="#E7A83E" metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Wire Mesh / Shelf Surface */}
            <mesh position={[0, shelfThickness, 0]}>
              <boxGeometry args={[width, 0.015, depth]} />
              <meshStandardMaterial color="#2E4457" roughness={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* Top Rack Header Signboard */}
      <group position={[0, height + 0.16, 0]} onClick={(e) => { e.stopPropagation(); onSelectRack?.(rack); }}>
        <mesh position={[0, 0, depth / 2 + 0.02]}>
          <boxGeometry args={[width, 0.22, 0.04]} />
          <meshStandardMaterial color="#0C1625" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.08, depth / 2 + 0.045]}>
          <boxGeometry args={[width * 0.95, 0.02, 0.01]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
        <Text
          position={[0, -0.01, depth / 2 + 0.05]}
          fontSize={0.09}
          color="#F8FAFC"
          anchorX="center"
          anchorY="middle"
        >
          {`KỆ ${rackName} · ${zoneCode}`}
        </Text>
      </group>

      {/* 20 Interactive Slot Positions (5 Bays × 4 Levels) */}
      {Array.from({ length: 20 }).map((_, slotIndex) => {
        const bayIdx = slotIndex % bays;
        const levelIdx = Math.floor(slotIndex / bays);
        const slotX = (bayIdx - 2) * bayPitch;
        const shelfY = shelfBaseY + levelIdx * levelPitch;
        const restY = shelfY + shelfThickness + 0.02;

        const slotCode = `S${String(slotIndex + 1).padStart(2, '0')}`;
        const slotKey = `${rackName}:${slotCode}`;
        const isSelected = selectedSlotKey === slotKey;
        const isHighlighted = highlightSlotKey === slotKey;

        const slotData = slots[slotIndex];
        const isOccupied = slotData?.occupied && slotData?.part;

        return (
          <group key={slotKey} position={[slotX, restY, 0]}>
            {/* Clickable Hitbox for Raycasting Selection */}
            <mesh
              position={[0, 0.12, 0]}
              visible={false}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSlot?.({
                  rack,
                  slotIndex,
                  slotCode,
                  slotKey,
                  level: levelIdx + 1,
                  bay: bayIdx + 1,
                  isOccupied,
                  part: slotData?.part || null
                });
              }}
            >
              <boxGeometry args={[bayPitch * 0.95, levelPitch * 0.9, depth * 0.95]} />
              <meshBasicMaterial color="red" wireframe />
            </mesh>

            {/* If Occupied: Render Pallet & Cargo Unit */}
            {isOccupied && (
              <PalletUnit3D
                position={[0, 0, 0]}
                part={slotData.part}
                activeLayer={activeLayer}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSlot?.({
                    rack,
                    slotIndex,
                    slotCode,
                    slotKey,
                    level: levelIdx + 1,
                    bay: bayIdx + 1,
                    isOccupied: true,
                    part: slotData.part
                  });
                }}
              />
            )}

            {/* Empty Slot Label / Wireframe when Selected or Highlighted */}
            {!isOccupied && (isSelected || isHighlighted) && (
              <mesh position={[0, 0.12, 0]}>
                <boxGeometry args={[0.26, 0.22, 0.26]} />
                <meshBasicMaterial
                  color={isHighlighted ? '#10b981' : '#38bdf8'}
                  wireframe
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}

            {/* Small Slot Code Label below beam */}
            <Text
              position={[0, -0.04, depth / 2 + 0.025]}
              fontSize={0.032}
              color={isSelected ? '#38bdf8' : isHighlighted ? '#10b981' : '#94A3B8'}
              anchorX="center"
              anchorY="middle"
            >
              {slotCode}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
