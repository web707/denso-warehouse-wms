// Unified Warehouse Layout Adapter
// Single source of truth for 3D warehouse layout, rack positioning, slot geometry, and WMS inventory mapping.
// Shared by both Sơ đồ kho 3D (Racks.jsx / WarehouseScene3D.jsx) and Hành trình 3D (SupplyChain3D.jsx / AnimatedSupplyScene.jsx).

export const SHARED_RACK_SPEC = Object.freeze({
  bays: 5,
  levels: 4,
  slotCount: 20,
  width: 1.75,
  depth: 0.80,
  height: 2.15,
  levelPitch: 0.52,
  shelfThickness: 0.04,
  shelfBaseY: 0.30,
  postThickness: 0.04,
  rackPostX: 0.85,
  bayPitch: 0.31,
  clearance: 0.05
});

// Standard aisle and warehouse coordinates
export const SHARED_WAREHOUSE_COORDINATES = Object.freeze({
  frontRackZ: -3.00,
  rearRackZ: 0.6098,
  mainAisleZ: -1.20,
  receivingDock: [-4.00, 0, 1.80],
  qcStaging: [0.00, 0, 1.80],
  pickPackStaging: [3.00, 0, 1.80],
  outboundDock: [4.00, 0, 2.70],
  inboundTruck: [-4.00, 0, 4.00],
  outboundTruck: [4.00, 0, 4.00],
  floorSize: [14.0, 0.06, 8.0],
  backWallZ: -5.00,
  leftWallX: -6.50,
  rightWallX: 6.50
});

/**
 * Calculates 3D scene positions for racks in a zone.
 * For Zone A (R01, R02, R03), arranges 3 racks along the front storage row:
 * R01: x = -2.80, z = -3.00 (Left rack)
 * R02: x =  0.00, z = -3.00 (Center rack)
 * R03: x = +2.80, z = -3.00 (Right rack)
 */
export function getRackPosition(rack, index = 0, totalRacks = 3, zoneCode = 'ZONE-A') {
  // Normalize rack code/name
  const name = rack?.name || rack?.code || `R${String(index + 1).padStart(2, '0')}`;
  const rackNum = parseInt(name.replace(/\D/g, ''), 10) || (index + 1);

  // If 3 racks in Zone A
  if (totalRacks <= 3) {
    const xOffsets = [-2.80, 0.00, +2.80];
    const x = xOffsets[index % 3];
    return [x, 0, SHARED_WAREHOUSE_COORDINATES.frontRackZ];
  }

  // General grid layout for larger zones (up to 4 racks per row)
  const cols = Math.min(totalRacks, 4);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = (col - (cols - 1) / 2) * 2.80;
  const z = SHARED_WAREHOUSE_COORDINATES.frontRackZ + row * 3.60;
  return [x, 0, z];
}

/**
 * Calculates 3D coordinates for a specific slot within a rack.
 * @param {Array<number>} rackPos - [x, y, z] of rack center
 * @param {number} bayIndex - 0 to 4 (Bay 1 to 5)
 * @param {number} levelIndex - 0 to 3 (Level 1 to 4)
 */
export function getSlotCoordinates(rackPos, bayIndex, levelIndex) {
  const [rx, ry, rz] = rackPos;
  const slotX = rx + (bayIndex - 2) * SHARED_RACK_SPEC.bayPitch;
  const shelfY = SHARED_RACK_SPEC.shelfBaseY + levelIndex * SHARED_RACK_SPEC.levelPitch;
  const beamTopY = shelfY + SHARED_RACK_SPEC.shelfThickness;
  const restY = beamTopY + 0.165; // Pallet rest center height
  return {
    position: [slotX, shelfY + 0.01, rz],
    restPosition: [slotX, restY, rz],
    shelfY,
    beamTopY,
    restY,
    approachPose: { x: slotX, z: SHARED_WAREHOUSE_COORDINATES.mainAisleZ, yaw: Math.PI / 2 }
  };
}

export const getShelfId = (x, z, y) => `shelf:${Number(x)}:${Number(z)}:${Number(y)}`;

/**
 * Builds slot specification for all 20 slots of a given rack.
 */
export function buildRackSlots(rack, rackIndex = 0, totalRacks = 3, zoneCode = 'ZONE-A') {
  const rackPos = getRackPosition(rack, rackIndex, totalRacks, zoneCode);
  const rackId = rack?.id || `RACK-${rackIndex + 1}`;
  const rackName = rack?.name || `R${String(rackIndex + 1).padStart(2, '0')}`;

  return Array.from({ length: SHARED_RACK_SPEC.slotCount }, (_, index) => {
    const bayIndex = index % SHARED_RACK_SPEC.bays;
    const levelIndex = Math.floor(index / SHARED_RACK_SPEC.bays);
    const code = `S${String(index + 1).padStart(2, '0')}`;
    const slotCoords = getSlotCoordinates(rackPos, bayIndex, levelIndex);

    return {
      index,
      code,
      slotId: `${rackName}:${code}`,
      businessSlotId: `${rackId}:${index}`,
      rackId,
      rackName,
      zoneCode: rack?.zoneCode || rack?.zone_code || zoneCode,
      warehouseCode: rack?.warehouseCode || rack?.warehouse_code || 'DENSO-WH',
      bay: bayIndex + 1,
      level: levelIndex + 1,
      bayIndex,
      levelIndex,
      ...slotCoords,
      targetShelfId: getShelfId(rackPos[0], rackPos[2], slotCoords.shelfY)
    };
  });
}

/**
 * Builds the complete unified warehouse model for a list of racks and inventory parts.
 */
export function buildUnifiedWarehouseModel(racks = [], parts = [], qualityMap = new Map(), zoneCode = 'ZONE-A') {
  const activeRacks = racks.filter(r => !zoneCode || (r.zoneCode || r.zone_code) === zoneCode);
  const totalRacks = activeRacks.length || 3;

  const rackModels = activeRacks.map((rack, index) => {
    const position = getRackPosition(rack, index, totalRacks, zoneCode);
    const slots = buildRackSlots(rack, index, totalRacks, zoneCode);

    // Map parts belonging to this rack
    const rackParts = parts.filter(p => (p.rackId || p.container_id) === rack.id);
    const partsBySlot = new Map();
    for (const p of rackParts) {
      const slotIdx = p.preferredRackSlot ?? p.preferred_rack_slot;
      if (Number.isInteger(slotIdx) && slotIdx >= 0 && slotIdx < SHARED_RACK_SPEC.slotCount) {
        if (!partsBySlot.has(slotIdx)) partsBySlot.set(slotIdx, []);
        partsBySlot.get(slotIdx).push(p);
      }
    }

    const slotModels = slots.map(slot => {
      const slotParts = partsBySlot.get(slot.index) || [];
      const isOccupied = slotParts.length > 0;
      const primaryPart = slotParts[0] || null;

      // QC judgment for slot
      let qcStatus = 'AVAILABLE';
      if (primaryPart) {
        const scope = primaryPart.qualityScopeId ?? primaryPart.quality_scope_id;
        const lot = primaryPart.lotId ?? primaryPart.lot_id;
        const qEntry = qualityMap.get(scope ?? lot);
        qcStatus = qEntry?.judgment || (primaryPart.receiving_damaged ? 'BLOCKED' : 'AVAILABLE');
      }

      return {
        ...slot,
        isOccupied,
        parts: slotParts,
        primaryPart,
        qcStatus,
        quantity: slotParts.reduce((sum, p) => sum + (p.quantity_pcs ?? p.quantity ?? 0), 0),
        cartons: slotParts.reduce((sum, p) => sum + (p.carton_count ?? p.cartons ?? 0), 0),
        weight: slotParts.reduce((sum, p) => sum + Number(p.total_weight_kg ?? p.weight ?? 0), 0)
      };
    });

    const usedSlots = slotModels.filter(s => s.isOccupied).length;
    const skus = [...new Set(rackParts.map(p => p.productCode || p.product_code || 'Chưa có SKU'))];

    return {
      rackId: rack.id,
      name: rack.name,
      zoneCode: rack.zoneCode || rack.zone_code || zoneCode,
      warehouseCode: rack.warehouseCode || rack.warehouse_code || 'DENSO-WH',
      productFamily: rack.productFamily || rack.product_family || 'condiments',
      position,
      slots: slotModels,
      usedSlots,
      totalSlots: SHARED_RACK_SPEC.slotCount,
      partCount: rackParts.length,
      skus,
      label: skus.length > 1 ? `${skus.length} SKU` : (skus[0] || 'Kệ trống')
    };
  });

  const totalSlots = rackModels.reduce((sum, r) => sum + r.totalSlots, 0);
  const totalUsedSlots = rackModels.reduce((sum, r) => sum + r.usedSlots, 0);

  return {
    zoneCode,
    totalRacks: rackModels.length,
    totalSlots,
    totalUsedSlots,
    racks: rackModels
  };
}
