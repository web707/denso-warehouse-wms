import { RACK_SPEC } from './rackLayout';

const colors = ['#0f766e','#2563eb','#7c3aed','#0284c7','#15803d','#b45309','#a21caf'];
export function partDisplayColor(part) {
  if (part?.color && /^#[a-fA-F0-9]{6}$/.test(part.color)) return part.color;
  const id = `${part?.productCode || ''}|${part?.partName || ''}`;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

/** Stock placement is the source of truth. A single colored block denotes one occupied
 * physical slot, NOT one carton. Missing/invalid slots are counted separately.
 * The 3D view must never invent coordinates from a solver-generated carton packing.
 */
export function rackInventoryView(parts = []) {
  const slots = Array.from({length:RACK_SPEC.slotCount}, (_, index) => ({
    index, code: `S${String(index + 1).padStart(2,'0')}`,
    bay: index % RACK_SPEC.bays + 1,
    level: Math.floor(index / RACK_SPEC.bays) + 1,
    placements: [],
  }));
  const unassigned = [];
  for (const part of parts) {
    if (Number(part.quantity || 0) <= 0 && Number(part.cartons || 0) <= 0) continue;
    const i = part.preferredRackSlot;
    if (!Number.isInteger(i) || i < 0 || i >= slots.length) {
      unassigned.push(part);
      continue;
    }
    const s = slots[i];
    const place = {
      partId: part.id, rackSlotIndex: i, rackSlotCode:s.code,
      rackBay:s.bay, rackLevel:s.level,
      cartonCount: Number(part.cartons || 0),
      colorHex:partDisplayColor(part),
      xMm: (s.bay-1)*RACK_SPEC.bayWidthMm + RACK_SPEC.bayWidthMm*0.1,
      yMm: RACK_SPEC.depthMm*0.18,
      zMm: (s.level-1)*RACK_SPEC.levelHeightMm + RACK_SPEC.shelfThicknessMm + RACK_SPEC.levelHeightMm*0.08,
      dxMm:RACK_SPEC.bayWidthMm*0.8,
      dyMm:RACK_SPEC.depthMm*0.64,
      dzMm:RACK_SPEC.levelHeightMm*0.70,
    };
    s.placements.push(place);
  }
  const placements = slots.flatMap((slot)=>slot.placements);
  return { placements, slots,
    usedSlots:slots.filter((s)=>s.placements.length).length,
    unassigned, spec:RACK_SPEC,
  };
}
