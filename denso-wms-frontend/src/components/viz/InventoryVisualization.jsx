// InventoryVisualization.jsx
// MASAN CONSUMER WMS · Precision Industrial Pallet & Cargo Visualization on Racks
import React from 'react';
import { Text } from '@react-three/drei';
import { SHARED_RACK_SPEC } from '@/lib/viz/warehouseLayoutAdapter';

const QC_COLORS = Object.freeze({
  AVAILABLE: '#22c55e',
  OK: '#22c55e',
  HOLD: '#f59e0b',
  PENDING: '#f59e0b',
  REINSPECTION_REQUIRED: '#f59e0b',
  BLOCKED: '#ef4444',
  REJECTED: '#ef4444'
});

const SKU_PALETTE = ['#b88a44', '#ca8a04', '#0d9488', '#0284c7', '#7c3aed', '#c05621'];

function getSkuColor(sku = '') {
  if (!sku) return SKU_PALETTE[0];
  const hash = Array.from(sku).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  return SKU_PALETTE[hash % SKU_PALETTE.length];
}

function getHeatmapColor(qty = 0) {
  if (qty <= 0) return '#475569';
  if (qty < 200) return '#06b6d4'; // Cyan - mức thấp
  if (qty <= 500) return '#10b981'; // Xanh lá - mức vừa
  return '#a855f7'; // Tím - mật độ cao
}

function getSpaceColor(weight = 0, maxWeight = 500) {
  const ratio = maxWeight > 0 ? weight / maxWeight : 0.5;
  if (ratio < 0.4) return '#3b82f6'; // Xanh dương - tải nhẹ
  if (ratio < 0.75) return '#f59e0b'; // Vàng cam - tải trung bình
  return '#ef4444'; // Đỏ - tải nặng / gần đầy
}

export default function InventoryVisualization({
  rack,
  rackPosition = [0, 0, 0],
  onSelectSlot,
  selectedSlotIndex = null,
  viewMode = 'qc',
  tasksBySlot = null,
  isTransferMode = false,
  sourceTransferSlot = null,
  onSelectTransferTarget = null
}) {
  const [rx, ry, rz] = rackPosition;
  const { bayPitch, levelPitch, shelfBaseY, shelfThickness } = SHARED_RACK_SPEC;

  const slots = rack?.slots || [];
  const currentRackId = rack.rackId || rack.id;
  const isSourceRack = sourceTransferSlot && (sourceTransferSlot.rackId === currentRackId || sourceTransferSlot.rackId === rack.name);

  return (
    <group>
      {slots.map(slot => {
        const bayIndex = slot.bayIndex ?? (slot.index % 5);
        const levelIndex = slot.levelIndex ?? Math.floor(slot.index / 5);

        const slotX = rx + (bayIndex - 2) * bayPitch;
        const shelfY = shelfBaseY + levelIndex * levelPitch;
        const beamTopY = shelfY + shelfThickness;
        const isSelected = selectedSlotIndex === slot.index;
        const isSourceSlot = isSourceRack && sourceTransferSlot.slotIndex === slot.index;
        const slotKey = `${currentRackId}:${slot.index}`;
        const rawSlotTask = tasksBySlot?.get ? tasksBySlot.get(slotKey) : (tasksBySlot ? tasksBySlot[slotKey] : null);
        const activeTask = Array.isArray(rawSlotTask) ? rawSlotTask[0] : rawSlotTask;

        if (!slot.isOccupied) {
          // Empty slot representation
          const canBeTransferTarget = isTransferMode && !isSourceSlot;

          return (
            <group key={`slot-empty:${slot.index}`} position={[slotX, beamTopY, rz]}>
              {/* Subtle slot guide pad on shelf deck */}
              <mesh position={[0, 0.003, 0]}>
                <boxGeometry args={[0.26, 0.004, 0.46]} />
                <meshStandardMaterial
                  color={canBeTransferTarget ? '#0f766e' : (isSelected ? '#0369a1' : '#1e293b')}
                  roughness={0.9}
                />
              </mesh>

              {/* Slot Code text along front shelf beam */}
              <Text
                position={[0, 0.02, 0.245]}
                fontSize={0.028}
                color={canBeTransferTarget ? '#2dd4bf' : (isSelected ? '#38bdf8' : '#64748b')}
                anchorX="center"
                anchorY="middle"
              >
                {slot.code}
              </Text>

              {/* Interactive click hitbox */}
              <mesh
                position={[0, 0.08, 0]}
                onClick={e => {
                  e.stopPropagation();
                  if (canBeTransferTarget && onSelectTransferTarget) {
                    onSelectTransferTarget(currentRackId, slot.index);
                  } else {
                    onSelectSlot?.(currentRackId, slot.index, null);
                  }
                }}
              >
                <boxGeometry args={[0.28, 0.16, 0.50]} />
                <meshStandardMaterial
                  color={canBeTransferTarget ? '#2dd4bf' : (isSelected ? '#38bdf8' : '#334155')}
                  wireframe={canBeTransferTarget || isSelected || !!activeTask}
                  transparent
                  opacity={canBeTransferTarget ? 0.8 : (isSelected ? 0.85 : 0.02)}
                  depthWrite={canBeTransferTarget || isSelected}
                />
              </mesh>

              {/* Transfer Target Badge */}
              {canBeTransferTarget && (
                <group position={[0, 0.12, 0.25]}>
                  <mesh>
                    <boxGeometry args={[0.24, 0.038, 0.02]} />
                    <meshStandardMaterial color="#0f766e" emissive="#2dd4bf" emissiveIntensity={0.6} />
                  </mesh>
                  <Text position={[0, 0, 0.012]} fontSize={0.024} color="#ffffff" anchorX="center" anchorY="middle">
                    CHỌN LÀM ĐÍCH
                  </Text>
                </group>
              )}

              {/* Selected Empty Slot Text */}
              {!canBeTransferTarget && isSelected && (
                <Text position={[0, 0.10, 0.25]} fontSize={0.04} color="#38bdf8">
                  {slot.code} (TRỐNG)
                </Text>
              )}

              {/* Active task badge if any */}
              {activeTask && !canBeTransferTarget && (
                <group position={[0, 0.12, 0.25]}>
                  <mesh>
                    <boxGeometry args={[0.22, 0.036, 0.02]} />
                    <meshStandardMaterial color="#7c3aed" emissive="#c084fc" emissiveIntensity={0.6} />
                  </mesh>
                  <Text position={[0, 0, 0.012]} fontSize={0.024} color="#ffffff" anchorX="center" anchorY="middle">
                    ĐIỀU CHUYỂN
                  </Text>
                </group>
              )}
            </group>
          );
        }

        // Occupied Slot Cargo Representation
        const qc = slot.qcStatus || 'AVAILABLE';
        const isBlocked = qc === 'BLOCKED' || qc === 'REJECTED';
        const isHold = qc === 'HOLD' || qc === 'PENDING' || qc === 'REINSPECTION_REQUIRED';

        let cargoColor;
        if (viewMode === 'heatmap') {
          cargoColor = getHeatmapColor(slot.quantity);
        } else if (viewMode === 'space') {
          cargoColor = getSpaceColor(slot.weight || (slot.quantity * 1.0));
        } else {
          // QC mode
          cargoColor = isBlocked ? QC_COLORS.BLOCKED : (isHold ? QC_COLORS.HOLD : getSkuColor(slot.primaryPart?.productCode));
        }

        const qty = slot.quantity || 0;
        const cartons = slot.cartons || Math.max(1, Math.round(qty / 10));
        // Carefully proportioned carton height so it never intersects shelf above (height 0.12 - 0.22)
        const cargoHeight = Math.min(0.22, 0.12 + Math.min(cartons, 10) * 0.01);

        return (
          <group
            key={`slot-occ:${slot.index}`}
            position={[slotX, beamTopY, rz]}
            onClick={e => {
              e.stopPropagation();
              onSelectSlot?.(currentRackId, slot.index, slot.primaryPart);
            }}
          >
            {/* Real Industrial Wooden Pallet */}
            <group position={[0, 0, 0]}>
              {/* 3 bottom wooden stringers / runners along Z */}
              {[-0.105, 0, 0.105].map(px => (
                <mesh key={`runner:${px}`} position={[px, 0.01, 0]}>
                  <boxGeometry args={[0.024, 0.02, 0.48]} />
                  <meshStandardMaterial color="#a16207" roughness={0.8} />
                </mesh>
              ))}
              {/* Top wooden deck board */}
              <mesh position={[0, 0.026, 0]}>
                <boxGeometry args={[0.27, 0.012, 0.48]} />
                <meshStandardMaterial color="#c49a62" roughness={0.75} />
              </mesh>
            </group>

            {/* Industrial Corrugated Carton Cargo Box */}
            <group position={[0, 0.032 + cargoHeight / 2, 0]}>
              <mesh>
                <boxGeometry args={[0.25, cargoHeight, 0.46]} />
                <meshStandardMaterial color={cargoColor} roughness={0.7} metalness={0.1} />
              </mesh>

              {/* Top Sealing Tape Strip down center */}
              <mesh position={[0, cargoHeight / 2 + 0.001, 0]}>
                <boxGeometry args={[0.035, 0.001, 0.44]} />
                <meshStandardMaterial color="#854d0e" roughness={0.5} />
              </mesh>

              {/* Front Shipping / Barcode Label */}
              <mesh position={[0.05, 0, 0.231]}>
                <planeGeometry args={[0.07, 0.04]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>

            {/* Selection / Source Slot Highlight Halo */}
            {(isSelected || isSourceSlot) && (
              <mesh position={[0, 0.032 + cargoHeight / 2, 0]}>
                <boxGeometry args={[0.27, cargoHeight + 0.015, 0.48]} />
                <meshStandardMaterial color={isSourceSlot ? '#f59e0b' : '#38bdf8'} wireframe />
              </mesh>
            )}

            {/* Source slot badge */}
            {isSourceSlot && (
              <group position={[0, 0.032 + cargoHeight + 0.065, 0.233]}>
                <mesh>
                  <boxGeometry args={[0.20, 0.032, 0.02]} />
                  <meshStandardMaterial color="#b45309" emissive="#f59e0b" emissiveIntensity={0.6} />
                </mesh>
                <Text position={[0, 0, 0.012]} fontSize={0.022} color="#ffffff" anchorX="center" anchorY="middle">
                  Ô NGUỒN
                </Text>
              </group>
            )}

            {/* Front QC Status Tag Plate */}
            <mesh position={[-0.06, 0.032 + cargoHeight * 0.6, 0.2315]}>
              <planeGeometry args={[0.065, 0.025]} />
              <meshBasicMaterial color={isBlocked ? '#ef4444' : isHold ? '#f59e0b' : '#22c55e'} />
            </mesh>

            {/* 3D Text Label: Slot code + Qty */}
            <Text
              position={[0, 0.032 + cargoHeight + 0.028, 0.232]}
              fontSize={0.032}
              color={isSelected ? '#38bdf8' : '#f8fafc'}
              anchorX="center"
              anchorY="middle"
            >
              {slot.code} · {qty}đv
            </Text>

            {/* 3D Task Badge if slot has active operational task */}
            {activeTask && (
              <group position={[0, 0.032 + cargoHeight + 0.068, 0.233]}>
                <mesh>
                  <boxGeometry args={[0.22, 0.034, 0.02]} />
                  <meshStandardMaterial
                    color={
                      activeTask.type === 'picking' ? '#0284c7' :
                      activeTask.type === 'count' ? '#d97706' : '#7c3aed'
                    }
                    emissive={
                      activeTask.type === 'picking' ? '#38bdf8' :
                      activeTask.type === 'count' ? '#fbbf24' : '#c084fc'
                    }
                    emissiveIntensity={0.6}
                  />
                </mesh>
                <Text
                  position={[0, 0, 0.012]}
                  fontSize={0.022}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                >
                  {activeTask.type === 'picking' ? 'SOẠN HÀNG' :
                   activeTask.type === 'count' ? 'KIỂM KÊ' : 'ĐIỀU CHUYỂN'}
                </Text>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
