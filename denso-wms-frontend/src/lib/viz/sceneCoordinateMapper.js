// Scene Coordinate Mapper
// Bidirectional mapping between WMS Business IDs (Warehouse/Zone/Rack/Slot) and 3D Scene Transforms.
import {
  SHARED_RACK_SPEC,
  SHARED_WAREHOUSE_COORDINATES,
  getRackPosition,
  getSlotCoordinates,
  buildRackSlots
} from './warehouseLayoutAdapter';

/**
 * Maps a WMS part or rack+slot reference to exact 3D scene coordinates.
 * @param {Object|string} rackRef - Rack object, rack ID, or rack name (e.g. 'R01')
 * @param {number} slotIndex - 0 to 19
 * @param {Array<Object>} allRacks - Array of all racks from WMS API
 * @param {string} zoneCode - e.g. 'ZONE-A'
 */
export function mapBusinessSlotToScene(rackRef, slotIndex = 0, allRacks = [], zoneCode = 'ZONE-A') {
  const rack = typeof rackRef === 'object' && rackRef !== null
    ? rackRef
    : (allRacks.find(r => r.id === rackRef || r.name === rackRef || r.code === rackRef) || { name: String(rackRef || 'R01') });

  const activeRacks = allRacks.filter(r => !zoneCode || (r.zoneCode || r.zone_code) === zoneCode);
  let rackIndex = activeRacks.findIndex(r => r.id === rack.id || r.name === rack.name);
  if (rackIndex < 0) {
    const num = parseInt(String(rack.name || rack.id || '1').replace(/\D/g, ''), 10);
    rackIndex = Math.max(0, (num || 1) - 1);
  }

  const totalRacks = activeRacks.length || 3;
  const rackPosition = getRackPosition(rack, rackIndex, totalRacks, zoneCode);

  const safeSlotIdx = Math.max(0, Math.min(SHARED_RACK_SPEC.slotCount - 1, Number(slotIndex) || 0));
  const bayIndex = safeSlotIdx % SHARED_RACK_SPEC.bays;
  const levelIndex = Math.floor(safeSlotIdx / SHARED_RACK_SPEC.bays);
  const slotCoords = getSlotCoordinates(rackPosition, bayIndex, levelIndex);

  const slotCode = `S${String(safeSlotIdx + 1).padStart(2, '0')}`;
  const rackName = rack.name || `R${String(rackIndex + 1).padStart(2, '0')}`;

  return {
    rackId: rack.id || `RACK-${rackIndex + 1}`,
    rackName,
    zoneCode: rack.zoneCode || rack.zone_code || zoneCode,
    warehouseCode: rack.warehouseCode || rack.warehouse_code || 'DENSO-WH',
    slotIndex: safeSlotIdx,
    slotCode,
    slotId: `${rackName}:${slotCode}`,
    businessSlotId: `${rack.id || rackName}:${safeSlotIdx}`,
    bay: bayIndex + 1,
    level: levelIndex + 1,
    rackPosition,
    ...slotCoords,
    targetShelfId: `shelf:${rackPosition[0].toFixed(2)}:${rackPosition[2].toFixed(2)}:${slotCoords.shelfY.toFixed(2)}`,
    routeVerified: true
  };
}

/**
 * Maps a WMS Part object to its 3D slot layout in the scene.
 */
export function mapPartToSceneLayout(part, racks = [], zoneCode = 'ZONE-A') {
  if (!part) return undefined;
  const rackId = part.container_id || part.containerId || part.rackId || part.rack_id;
  const slotIdx = part.preferred_rack_slot ?? part.preferredRackSlot;
  if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= SHARED_RACK_SPEC.slotCount) {
    return undefined;
  }
  return mapBusinessSlotToScene(rackId, slotIdx, racks, zoneCode);
}

/**
 * Retrieves full business and QC details for a given rack and slot.
 */
export function getBusinessSlotDetail(rackId, slotIndex, parts = [], qualityMap = new Map()) {
  const matchingParts = parts.filter(p =>
    ((p.container_id || p.rackId) === rackId) &&
    (p.preferred_rack_slot === slotIndex || p.preferredRackSlot === slotIndex)
  );

  const isOccupied = matchingParts.length > 0;
  const primary = matchingParts[0] || null;

  let qcStatus = 'AVAILABLE';
  if (primary) {
    const scope = primary.qualityScopeId ?? primary.quality_scope_id;
    const lot = primary.lotId ?? primary.lot_id;
    const qEntry = qualityMap.get(scope ?? lot);
    qcStatus = qEntry?.judgment || (primary.receiving_damaged ? 'BLOCKED' : 'AVAILABLE');
  }

  return {
    isOccupied,
    parts: matchingParts,
    primaryPart: primary,
    partName: primary?.part_name || primary?.partName || (isOccupied ? 'Hàng hóa' : 'Ô trống'),
    productCode: primary?.product_code || primary?.productCode || '',
    lotNumber: primary?.lot_number || primary?.lotNumber || '',
    quantity: matchingParts.reduce((s, p) => s + (p.quantity_pcs ?? p.quantity ?? 0), 0),
    cartons: matchingParts.reduce((s, p) => s + (p.carton_count ?? p.cartons ?? 0), 0),
    weight: matchingParts.reduce((s, p) => s + Number(p.total_weight_kg ?? p.weight ?? 0), 0),
    qcStatus,
    expirationDate: primary?.expiration_date || primary?.expirationDate || null
  };
}
