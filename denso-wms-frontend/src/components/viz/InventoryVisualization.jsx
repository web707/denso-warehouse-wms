// InventoryVisualization.jsx
// Visualizes WMS Inventory on Rack Slots with Certified QC / Heatmap / Space Color Coding & 100% Clickable Slots
import React, { useMemo } from 'react';
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

const SKU_PALETTE = ['#c89b60', '#c1a26d', '#ad855f', '#b6a682', '#0f766e', '#2563eb', '#7c3aed'];

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
  tasksBySlot = null
}) {
  const [rx, ry, rz] = rackPosition;
  const { bayPitch, levelPitch, shelfBaseY, shelfThickness } = SHARED_RACK_SPEC;

  const slots = rack?.slots || [];

  return (
    <group>
      {slots.map(slot => {
        const bayIndex = slot.bayIndex ?? (slot.index % 5);
        const levelIndex = slot.levelIndex ?? Math.floor(slot.index / 5);

        const slotX = rx + (bayIndex - 2) * bayPitch;
        const shelfY = shelfBaseY + levelIndex * levelPitch;
        const beamTopY = shelfY + shelfThickness;
        const isSelected = selectedSlotIndex === slot.index;
        const slotKey = `${rack.rackId || rack.id}:${slot.index}`;
        const rawSlotTask = tasksBySlot?.get ? tasksBySlot.get(slotKey) : (tasksBySlot ? tasksBySlot[slotKey] : null);
        const activeTask = Array.isArray(rawSlotTask) ? rawSlotTask[0] : rawSlotTask;

        if (!slot.isOccupied) {
          // Interactive hitbox for empty slot
          return (
            <group key={`slot-empty:${slot.index}`} position={[slotX, beamTopY + 0.08, rz]}>
              <mesh
                onClick={e => {
                  e.stopPropagation();
                  onSelectSlot?.(rack.rackId || rack.id, slot.index, null);
                }}
              >
                <boxGeometry args={[0.26, 0.16, 0.50]} />
                <meshStandardMaterial
                  color={isSelected ? '#38bdf8' : activeTask ? '#a855f7' : '#334155'}
                  wireframe={isSelected || !!activeTask}
                  transparent
                  opacity={isSelected ? 0.85 : activeTask ? 0.6 : 0.04}
                  depthWrite={isSelected || !!activeTask}
                />
              </mesh>
              {isSelected && (
                <Text position={[0, 0.12, 0.26]} fontSize={0.045} color="#38bdf8">
                  {slot.code} (TRỐNG)
                </Text>
              )}
              {activeTask && (
                <group position={[0, 0.14, 0.26]}>
                  <mesh>
                    <boxGeometry args={[0.22, 0.038, 0.02]} />
                    <meshStandardMaterial color="#7c3aed" emissive="#c084fc" emissiveIntensity={0.6} />
                  </mesh>
                  <Text position={[0, 0, 0.012]} fontSize={0.025} color="#ffffff" anchorX="center" anchorY="middle">
                    ĐIỀU CHUYỂN
                  </Text>
                </group>
              )}
            </group>
          );
        }

        // Occupied slot cargo
        const qc = slot.qcStatus || 'AVAILABLE';
        const isBlocked = qc === 'BLOCKED' || qc === 'REJECTED';
        const isHold = qc === 'HOLD' || qc === 'PENDING' || qc === 'REINSPECTION_REQUIRED';

        let color;
        if (viewMode === 'heatmap') {
          color = getHeatmapColor(slot.quantity);
        } else if (viewMode === 'space') {
          color = getSpaceColor(slot.weight || (slot.quantity * 1.0));
        } else {
          // QC mode
          color = isBlocked ? QC_COLORS.BLOCKED : (isHold ? QC_COLORS.HOLD : getSkuColor(slot.primaryPart?.productCode));
        }

        const qty = slot.quantity || 0;
        const cartons = slot.cartons || Math.max(1, Math.round(qty / 10));
        const cargoHeight = Math.min(0.24, 0.08 + Math.min(cartons, 12) * 0.012);

        return (
          <group
            key={`slot-occ:${slot.index}`}
            position={[slotX, beamTopY, rz]}
            onClick={e => {
              e.stopPropagation();
              onSelectSlot?.(rack.rackId || rack.id, slot.index, slot.primaryPart);
            }}
          >
            {/* Wooden Pallet base under cargo */}
            <mesh position={[0, 0.015, 0]}>
              <boxGeometry args={[0.27, 0.03, 0.50]} />
              <meshStandardMaterial color="#c8a575" roughness={0.7} />
            </mesh>

            {/* Cargo Carton Block */}
            <mesh position={[0, 0.03 + cargoHeight / 2, 0]}>
              <boxGeometry args={[0.25, cargoHeight, 0.46]} />
              <meshStandardMaterial color={color} roughness={0.7} />
            </mesh>

            {/* Selection highlight border */}
            {isSelected && (
              <mesh position={[0, 0.03 + cargoHeight / 2, 0]}>
                <boxGeometry args={[0.27, cargoHeight + 0.02, 0.49]} />
                <meshStandardMaterial color="#38bdf8" wireframe />
              </mesh>
            )}

            {/* QC Status Tag Marker */}
            <mesh position={[0, 0.03 + cargoHeight, 0.231]}>
              <planeGeometry args={[0.08, 0.03]} />
              <meshBasicMaterial color={isBlocked ? '#ef4444' : isHold ? '#f59e0b' : '#22c55e'} />
            </mesh>

            {/* 3D Text Label: Slot code + Qty */}
            <Text
              position={[0, 0.03 + cargoHeight + 0.035, 0.232]}
              fontSize={0.035}
              color={isSelected ? '#38bdf8' : '#f8fafc'}
              anchorX="center"
              anchorY="middle"
            >
              {slot.code} · {qty}đv
            </Text>

            {/* 3D Task Badge if slot has active operational task */}
            {activeTask && (
              <group position={[0, 0.03 + cargoHeight + 0.075, 0.233]}>
                <mesh>
                  <boxGeometry args={[0.22, 0.036, 0.02]} />
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
                  fontSize={0.024}
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
