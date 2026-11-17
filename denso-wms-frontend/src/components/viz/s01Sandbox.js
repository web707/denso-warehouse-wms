// S01 & 20-Slot Physical Simulation Sandbox Engine.
// Dedicated physics simulation environment completely isolated from Operational Replay.
// Contains 0 WMS write APIs, 0 PART mutations, 0 inventory effect.

export const SIM_LAYOUT = Object.freeze({
  frontRackZ: -3,
  rackDepth: 0.8,
  rackPostX: 0.85,
  shelfWidth: 1.75,
  levelPitch: 0.52,
  clearance: 0.05
});

export const ZONE_A_RACK_CONFIG = Object.freeze({
  R01: { id: 'R01', name: 'R01', label: 'Kệ R01 (Trái - Khu A)', x: -2.80, z: -3.00 },
  R02: { id: 'R02', name: 'R02', label: 'Kệ R02 (Giữa - Khu A)', x: 0.00, z: -3.00 },
  R03: { id: 'R03', name: 'R03', label: 'Kệ R03 (Phải - Khu A)', x: 2.80, z: -3.00 }
});

export function buildRackSlots(rackKey = 'R01') {
  const rack = ZONE_A_RACK_CONFIG[rackKey] || ZONE_A_RACK_CONFIG.R01;
  return Object.freeze(
    Array.from({ length: 20 }, (_, index) => {
      const bayIndex = index % 5;
      const levelIndex = Math.floor(index / 5);
      const code = `S${String(index + 1).padStart(2, '0')}`;
      const slotX = rack.x + (bayIndex - 2) * 0.31;
      const shelfY = 0.30 + levelIndex * SIM_LAYOUT.levelPitch;
      const beamTopY = shelfY + 0.04;
      const restY = beamTopY + 0.165;
      return Object.freeze({
        index,
        slotId: `${rack.name}:${code}`,
        code,
        bay: bayIndex + 1,
        level: levelIndex + 1,
        bayIndex,
        levelIndex,
        rackId: rack.id,
        rackName: rack.label,
        position: [slotX, shelfY + 0.01, -3.00],
        restPosition: [slotX, restY, -3.00],
        shelfY,
        beamTopY,
        restY,
        approachPose: { x: slotX, z: -1.20, yaw: Math.PI / 2 },
        targetShelfId: `shelf:${Number(rack.x)}:-3:${shelfY}`,
        routeVerified: true
      });
    })
  );
}

// Specification of all 20 slots across 5 bays and 4 levels in front rack (R01 / default sandbox)
export const SANDBOX_SLOTS = Object.freeze(
  Array.from({ length: 20 }, (_, index) => {
    const bayIndex = index % 5;
    const levelIndex = Math.floor(index / 5);
    const code = `S${String(index + 1).padStart(2, '0')}`;
    const slotX = (bayIndex - 2) * 0.31;
    const shelfY = 0.30 + levelIndex * SIM_LAYOUT.levelPitch;
    const beamTopY = shelfY + 0.04;
    const restY = beamTopY + 0.165;
    return Object.freeze({
      index,
      slotId: `SIM-${code}`,
      code,
      bay: bayIndex + 1,
      level: levelIndex + 1,
      bayIndex,
      levelIndex,
      rackId: 'R01',
      rackName: 'Kệ công nghiệp 20 ô - Khu A (R01)',
      position: [slotX, shelfY + 0.01, -3.00],
      restPosition: [slotX, restY, -3.00],
      shelfY,
      beamTopY,
      restY,
      approachPose: { x: slotX, z: -1.20, yaw: Math.PI / 2 },
      targetShelfId: `shelf:0:-3:${shelfY}`,
      routeVerified: true
    });
  })
);

export function getSlotSpec(slotRef, rackKey = null) {
  if (slotRef && typeof slotRef === 'object') {
    if (slotRef.slotId) return getSlotSpec(slotRef.slotId, rackKey || slotRef.rackId);
    if (slotRef.code) return getSlotSpec(slotRef.code, rackKey || slotRef.rackId);
    if (typeof slotRef.slot === 'number') return getSlotSpec(slotRef.slot, rackKey || slotRef.rackId);
    if (typeof slotRef.index === 'number') return getSlotSpec(slotRef.index, rackKey || slotRef.rackId);
  }

  let targetRack = rackKey || null;
  let cleanCode = typeof slotRef === 'string' ? slotRef.trim() : '';

  if (typeof slotRef === 'string' && slotRef.includes(':')) {
    const parts = slotRef.split(':');
    const candidateRack = parts[0].toUpperCase();
    if (ZONE_A_RACK_CONFIG[candidateRack]) {
      targetRack = candidateRack;
      cleanCode = parts[1];
    }
  }

  if (targetRack && ZONE_A_RACK_CONFIG[targetRack]) {
    const rackSlots = buildRackSlots(targetRack);
    let idx = 0;
    if (typeof slotRef === 'number') {
      idx = Math.max(0, Math.min(19, slotRef));
    } else {
      const pure = cleanCode.replace(/^SIM-/, '').replace(/^S/, '');
      const num = parseInt(pure, 10);
      idx = Number.isInteger(num) && num >= 1 && num <= 20 ? (num - 1) : 0;
    }
    return rackSlots[idx] || rackSlots[0];
  }

  if (typeof slotRef === 'number') {
    return SANDBOX_SLOTS[Math.max(0, Math.min(19, slotRef))] || SANDBOX_SLOTS[0];
  }
  if (typeof slotRef === 'string') {
    const clean = slotRef.replace('SIM-', '').toUpperCase();
    const found = SANDBOX_SLOTS.find(s => s.code === clean || s.slotId === slotRef);
    if (found) return found;
  }
  return SANDBOX_SLOTS[0];
}

export const SANDBOX_TARGET = Object.freeze({
  slotId: 'SIM-S01',
  slot: 0,
  position: [-.62, .31, -3],
  rackName: 'Kệ mô phỏng R01',
  routeVerified: true
});

// Verified path waypoints from Receiving to rack S01 aisle staging
export const VERIFIED_S01_PATH = Object.freeze([
  { x: -4.95, z: 1.4, yaw: 0 },
  { x: -1.62, z: 1.4, yaw: 0 },
  { x: -1.62, z: 1.4, yaw: -Math.PI / 2 },
  { x: -1.62, z: -1.2, yaw: -Math.PI / 2 },
  { x: -1.62, z: -1.2, yaw: 0 },
  { x: -0.62, z: -1.2, yaw: 0 },
  { x: -0.62, z: -1.2, yaw: Math.PI / 2 }
]);

export function sampleTransportRouteToSlot(t, slotX) {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.35) {
    const u = clamped / 0.35;
    return { x: -4.95 + (-1.62 - -4.95) * u, z: 1.4, yaw: 0 };
  } else if (clamped <= 0.45) {
    const u = (clamped - 0.35) / 0.10;
    return { x: -1.62, z: 1.4, yaw: -Math.PI / 2 * u };
  } else if (clamped <= 0.65) {
    const u = (clamped - 0.45) / 0.20;
    return { x: -1.62, z: 1.4 + (-1.2 - 1.4) * u, yaw: -Math.PI / 2 };
  } else if (clamped <= 0.75) {
    const u = (clamped - 0.65) / 0.10;
    return { x: -1.62, z: -1.2, yaw: -Math.PI / 2 + (Math.PI / 2) * u };
  } else if (clamped <= 0.90) {
    const u = (clamped - 0.75) / 0.15;
    return { x: -1.62 + (slotX - -1.62) * u, z: -1.2, yaw: 0 };
  } else {
    const u = (clamped - 0.90) / 0.10;
    return { x: slotX, z: -1.2, yaw: (Math.PI / 2) * u };
  }
}

export function sampleTransportRoute(t) {
  return sampleTransportRouteToSlot(t, -0.62);
}

export function sandboxState(progress, options = {}) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const opts = typeof options === 'string' ? { slotId: options } : (options || {});
  const slotSpec = getSlotSpec(opts.slotId ?? opts.slot ?? 'SIM-S01', opts.rackId ?? opts.rack);
  const mode = opts.mode === 'partial_picking' ? 'partial_picking' : 'putaway';
  const occupied = opts.occupied === true || opts.slotOccupancy === 'OCCUPIED_OTHER';

  // -------------------------------------------------------------
  // MODE 1: PARTIAL PICKING 20/100
  // -------------------------------------------------------------
  if (mode === 'partial_picking') {
    const slotX = slotSpec.position[0];
    const shelfRestY = slotSpec.restY; // pallet rest height on shelf
    const level = slotSpec.levelIndex;
    const initialQty = 100;
    const pickRequestQty = 20;

    // Pallet base + 80 units cargo stays permanently positioned at the shelf slot
    const shelfPalletPos = [slotX, shelfRestY, -3.00];

    // Phase 1: APPROACH & ALIGN (0.00 -> 0.20)
    // Vehicle travels from aisle staging towards slot aisle staging
    if (p < 0.20) {
      const t = p / 0.20;
      const vx = -1.62 + (slotX - -1.62) * t;
      const lift = (0.50 + level * 0.52) * t;
      return {
        progress: p,
        requestedProgress: progress,
        mode: 'partial_picking',
        slotId: slotSpec.slotId,
        slotSpec,
        fork: [vx, 0, -1.20],
        forkYaw: Math.PI / 2,
        forkExtension: -0.2 * (1 - t),
        lift,
        pallet: shelfPalletPos,
        palletYaw: Math.PI / 2,
        pickedCargo: [shelfPalletPos[0], shelfPalletPos[1] + 0.25, shelfPalletPos[2]],
        pickedCargoYaw: Math.PI / 2,
        held: false,
        carried: false,
        attachment: 'ON_SHELF',
        slotOccupancy: 'OCCUPIED_SIMULATED',
        forkliftPhase: 'APPROACH',
        collisionStatus: 'CLEAR',
        blockedReason: null,
        partialPicking: {
          initialQty,
          shelfQty: 100,
          pickedQty: 0,
          orderQty: pickRequestQty,
          status: 'CHỜ SOẠN 20/100'
        }
      };
    }

    // Phase 2: INSERT_FORKS (0.20 -> 0.35)
    // Vehicle aligns in front of slot at z = -1.20; tines extend under top 20-unit layer
    if (p < 0.35) {
      const t = (p - 0.20) / 0.15;
      const extension = 0.85 * t;
      const lift = 0.50 + level * 0.52;
      return {
        progress: p,
        requestedProgress: progress,
        mode: 'partial_picking',
        slotId: slotSpec.slotId,
        slotSpec,
        fork: [slotX, 0, -1.20],
        forkYaw: Math.PI / 2,
        forkExtension: extension,
        lift,
        pallet: shelfPalletPos,
        palletYaw: Math.PI / 2,
        pickedCargo: [shelfPalletPos[0], shelfPalletPos[1] + 0.25, shelfPalletPos[2]],
        pickedCargoYaw: Math.PI / 2,
        held: false,
        carried: false,
        attachment: 'TINES_ENGAGED_20_UNITS',
        slotOccupancy: 'OCCUPIED_SIMULATED',
        forkliftPhase: 'INSERT_FORKS',
        collisionStatus: 'FORKS_INSERTED',
        blockedReason: null,
        partialPicking: {
          initialQty,
          shelfQty: 100,
          pickedQty: 0,
          orderQty: pickRequestQty,
          status: 'CÀNG ĐÃ VÀO LỚP 20 ĐƠN VỊ'
        }
      };
    }

    // Phase 3: PICK_PARTIAL (0.35 -> 0.45)
    // Forks lift slightly (+0.02) lifting the top 20 units; 80 units remain on shelf
    if (p < 0.45) {
      const t = (p - 0.35) / 0.10;
      const lift = 0.50 + level * 0.52 + 0.02 * t;
      const pickedY = shelfPalletPos[1] + 0.25 + 0.02 * t;
      return {
        progress: p,
        requestedProgress: progress,
        mode: 'partial_picking',
        slotId: slotSpec.slotId,
        slotSpec,
        fork: [slotX, 0, -1.20],
        forkYaw: Math.PI / 2,
        forkExtension: 0.85,
        lift,
        pallet: shelfPalletPos,
        palletYaw: Math.PI / 2,
        pickedCargo: [shelfPalletPos[0], pickedY, shelfPalletPos[2]],
        pickedCargoYaw: Math.PI / 2,
        held: true,
        carried: true,
        attachment: 'SEPARATED_20_UNITS',
        slotOccupancy: 'PARTIALLY_PICKED_80_REMAINING',
        forkliftPhase: 'PICK_PARTIAL',
        collisionStatus: 'VALID_PICKUP_CONTACT',
        blockedReason: null,
        partialPicking: {
          initialQty,
          shelfQty: 80,
          pickedQty: 20,
          orderQty: pickRequestQty,
          status: 'TÁCH 20 ĐƠN VỊ · 80 ĐƠN VỊ GIỮ TRÊN KỆ'
        }
      };
    }

    // Phase 4: RETRACT (0.45 -> 0.60)
    // Forks retract with the 20 units onto forklift carriage
    if (p < 0.60) {
      const t = (p - 0.45) / 0.15;
      const extension = 0.85 * (1 - t);
      const lift = 0.52 + level * 0.52;
      const cargoZ = -3.00 + 1.00 * t; // moves towards aisle carriage at z = -2.00
      return {
        progress: p,
        requestedProgress: progress,
        mode: 'partial_picking',
        slotId: slotSpec.slotId,
        slotSpec,
        fork: [slotX, 0, -1.20],
        forkYaw: Math.PI / 2,
        forkExtension: extension,
        lift,
        pallet: shelfPalletPos,
        palletYaw: Math.PI / 2,
        pickedCargo: [slotX, shelfPalletPos[1] + 0.27, cargoZ],
        pickedCargoYaw: Math.PI / 2,
        held: true,
        carried: true,
        attachment: 'CARRIED_ON_FORKS',
        slotOccupancy: 'PARTIALLY_PICKED_80_REMAINING',
        forkliftPhase: 'RETRACT',
        collisionStatus: 'VALID_RETREAT',
        blockedReason: null,
        partialPicking: {
          initialQty,
          shelfQty: 80,
          pickedQty: 20,
          orderQty: pickRequestQty,
          status: 'RÚT CÀNG MANG 20 ĐƠN VỊ · 80 ĐƠN VỊ YÊN VỊ'
        }
      };
    }

    // Phase 5: LOWER & RETREAT TO AISLE (0.60 -> 0.75)
    // Forks lower to transport height (0.35) and vehicle backs up to aisle center
    if (p < 0.75) {
      const t = (p - 0.60) / 0.15;
      const currentLift = 0.52 + level * 0.52;
      const lift = currentLift + (0.35 - currentLift) * t;
      const vz = -1.20 + 0.20 * t; // backs up safely into aisle center z = -1.00
      const reach = 0.80;
      const cargoZ = vz - reach;
      return {
        progress: p,
        requestedProgress: progress,
        mode: 'partial_picking',
        slotId: slotSpec.slotId,
        slotSpec,
        fork: [slotX, 0, vz],
        forkYaw: Math.PI / 2,
        forkExtension: 0,
        lift,
        pallet: shelfPalletPos,
        palletYaw: Math.PI / 2,
        pickedCargo: [slotX, 0.45, cargoZ],
        pickedCargoYaw: Math.PI / 2,
        held: true,
        carried: true,
        attachment: 'CARRIED_ON_FORKS',
        slotOccupancy: 'PARTIALLY_PICKED_80_REMAINING',
        forkliftPhase: 'LOWER_AND_RETREAT',
        collisionStatus: 'CLEAR',
        blockedReason: null,
        partialPicking: {
          initialQty,
          shelfQty: 80,
          pickedQty: 20,
          orderQty: pickRequestQty,
          status: 'HẠ ĐỘ CAO VẬN CHUYỂN · 80 ĐƠN VỊ TRÊN KỆ'
        }
      };
    }

    // Phase 6: TRANSPORT_TO_STAGING (0.75 -> 0.90)
    // Vehicle travels along safe aisle to outbound staging (x = -1.62, z = -1.00)
    if (p < 0.90) {
      const t = (p - 0.75) / 0.15;
      const vx = slotX + (-1.62 - slotX) * t;
      const reach = 0.80;
      return {
        progress: p,
        requestedProgress: progress,
        mode: 'partial_picking',
        slotId: slotSpec.slotId,
        slotSpec,
        fork: [vx, 0, -1.00],
        forkYaw: Math.PI / 2,
        forkExtension: 0,
        lift: 0.35,
        pallet: shelfPalletPos,
        palletYaw: Math.PI / 2,
        pickedCargo: [vx, 0.45, -1.00 - reach],
        pickedCargoYaw: Math.PI / 2,
        held: true,
        carried: true,
        attachment: 'CARRIED_ON_FORKS',
        slotOccupancy: 'PARTIALLY_PICKED_80_REMAINING',
        forkliftPhase: 'TRANSPORT_TO_STAGING',
        collisionStatus: 'CLEAR',
        blockedReason: null,
        partialPicking: {
          initialQty,
          shelfQty: 80,
          pickedQty: 20,
          orderQty: pickRequestQty,
          status: 'CHUYỂN 20 ĐƠN VỊ VỀ ĐIỂM TẬP KẾT XUẤT'
        }
      };
    }

    // Phase 7: COMPLETED_20_OF_100 (0.90 -> 1.00)
    // Vehicle stages 20 units at outbound aisle staging. 80 units remain preserved on shelf slot
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'partial_picking',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [-1.62, 0, -1.00],
      forkYaw: Math.PI / 2,
      forkExtension: 0,
      lift: 0.35,
      pallet: shelfPalletPos,
      palletYaw: Math.PI / 2,
      pickedCargo: [-1.62, 0.45, -1.00 - 0.80],
      pickedCargoYaw: Math.PI / 2,
      held: true,
      carried: true,
      attachment: 'STAGED_FOR_OUTBOUND',
      slotOccupancy: 'PARTIALLY_PICKED_80_REMAINING',
      forkliftPhase: 'COMPLETED_20_OF_100',
      collisionStatus: 'CLEAR',
      blockedReason: null,
      partialPicking: {
        initialQty,
        shelfQty: 80,
        pickedQty: 20,
        orderQty: pickRequestQty,
        status: 'HOÀN THÀNH SOẠN 20/100 · 80 ĐƠN VỊ GIỮ TẠI KỆ · 20 ĐƠN VỊ TẬP KẾT'
      }
    };
  }

  // -------------------------------------------------------------
  // MODE 2: PUTAWAY TO ANY OF 20 SLOTS (S01 - S20)
  // -------------------------------------------------------------
  const slotX = slotSpec.position[0];
  const level = slotSpec.levelIndex;
  const targetShelfY = slotSpec.shelfY;
  const targetRestY = slotSpec.restY; // rest height on shelf beam

  // Check for Occupied Slot simulation
  if (occupied && p >= 0.68) {
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [slotX, 0, -1.20],
      forkYaw: Math.PI / 2,
      forkExtension: 0,
      lift: 0.45,
      pallet: [slotX, 0.605, -2.00],
      palletYaw: Math.PI / 2,
      held: true,
      carried: true,
      attachment: 'ATTACHED',
      slotOccupancy: 'OCCUPIED_OTHER',
      forkliftPhase: 'BLOCKED',
      collisionStatus: 'FORBIDDEN_OVERLAP: ô mô phỏng đã có pallet khác',
      blockedReason: 'SLOT_OCCUPIED_BY_ANOTHER_PALLET'
    };
  }

  // Phase 1: APPROACH (0.00 -> 0.12)
  if (p < 0.12) {
    const t = p / 0.12;
    const x = -5.30 + (-4.95 - -5.30) * t;
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [x, 0, 1.4],
      forkYaw: 0,
      forkExtension: -0.4,
      lift: 0,
      pallet: [-4.15, 0.165, 1.4],
      palletYaw: 0,
      held: false,
      carried: false,
      attachment: 'DETACHED',
      slotOccupancy: 'EMPTY_SIMULATED',
      forkliftPhase: 'APPROACH',
      collisionStatus: 'CLEAR',
      blockedReason: null
    };
  }

  // Phase 2: ALIGN (0.12 -> 0.18)
  if (p < 0.18) {
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [-4.95, 0, 1.4],
      forkYaw: 0,
      forkExtension: -0.4,
      lift: 0,
      pallet: [-4.15, 0.165, 1.4],
      palletYaw: 0,
      held: false,
      carried: false,
      attachment: 'DETACHED',
      slotOccupancy: 'EMPTY_SIMULATED',
      forkliftPhase: 'ALIGN',
      collisionStatus: 'CLEAR',
      blockedReason: null
    };
  }

  // Phase 3: INSERT_FORKS (0.18 -> 0.28)
  if (p < 0.28) {
    const t = (p - 0.18) / 0.10;
    const extension = -0.4 + 0.4 * t;
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [-4.95, 0, 1.4],
      forkYaw: 0,
      forkExtension: extension,
      lift: 0,
      pallet: [-4.15, 0.165, 1.4],
      palletYaw: 0,
      held: false,
      carried: false,
      attachment: 'DETACHED',
      slotOccupancy: 'EMPTY_SIMULATED',
      forkliftPhase: 'INSERT_FORKS',
      collisionStatus: 'FORKS_INSERTED',
      blockedReason: null
    };
  }

  // Phase 4: LIFT (0.28 -> 0.36)
  if (p < 0.36) {
    const t = (p - 0.28) / 0.08;
    const lift = 0.45 * t;
    const palletY = 0.165 + Math.max(0, lift - 0.01);
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [-4.95, 0, 1.4],
      forkYaw: 0,
      forkExtension: 0,
      lift,
      pallet: [-4.15, palletY, 1.4],
      palletYaw: 0,
      held: true,
      carried: true,
      attachment: 'ATTACHED',
      slotOccupancy: 'EMPTY_SIMULATED',
      forkliftPhase: 'LIFT',
      collisionStatus: 'VALID_PICKUP_CONTACT',
      blockedReason: null
    };
  }

  // Phase 5: TRANSPORT (0.36 -> 0.68)
  if (p < 0.68) {
    const t = (p - 0.36) / 0.32;
    const pose = sampleTransportRouteToSlot(t, slotX);
    const reach = 0.80;
    const palletX = pose.x + reach * Math.cos(pose.yaw);
    const palletZ = pose.z - reach * Math.sin(pose.yaw);
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [pose.x, 0, pose.z],
      forkYaw: pose.yaw,
      forkExtension: 0,
      lift: 0.45,
      pallet: [palletX, 0.605, palletZ],
      palletYaw: pose.yaw,
      held: true,
      carried: true,
      attachment: 'ATTACHED',
      slotOccupancy: 'EMPTY_SIMULATED',
      forkliftPhase: 'TRANSPORT',
      collisionStatus: 'CLEAR',
      blockedReason: null
    };
  }

  // Target heights for level l
  const approachLift = 0.39 + level * 0.52;
  const approachPalletY = targetRestY + 0.04; // 0.04 above resting beam
  const contactLift = 0.34 + level * 0.52;
  const releaseLift = 0.32 + level * 0.52;

  // Phase 6: POSITION (0.68 -> 0.76)
  if (p < 0.76) {
    const t = (p - 0.68) / 0.08;
    const lift = 0.45 + (approachLift - 0.45) * t;
    const extension = 0.85 * t;
    const palletZ = -1.2 - (0.80 + (1.80 - 0.80) * t);
    const palletY = 0.605 + (approachPalletY - 0.605) * t;
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [slotX, 0, -1.2],
      forkYaw: Math.PI / 2,
      forkExtension: extension,
      lift,
      pallet: [slotX, palletY, palletZ],
      palletYaw: Math.PI / 2,
      held: true,
      carried: true,
      attachment: 'ATTACHED',
      slotOccupancy: 'EMPTY_SIMULATED',
      forkliftPhase: 'POSITION',
      collisionStatus: 'CLEAR',
      blockedReason: null
    };
  }

  // Phase 7: LOWER (0.76 -> 0.82)
  if (p < 0.82) {
    const t = (p - 0.76) / 0.06;
    const lift = approachLift + (contactLift - approachLift) * t;
    const palletY = approachPalletY + (targetRestY - approachPalletY) * t;
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [slotX, 0, -1.2],
      forkYaw: Math.PI / 2,
      forkExtension: 0.85,
      lift,
      pallet: [slotX, palletY, -3.0],
      palletYaw: Math.PI / 2,
      held: true,
      carried: true,
      attachment: 'ATTACHED',
      slotOccupancy: 'EMPTY_SIMULATED',
      forkliftPhase: 'LOWER',
      collisionStatus: 'VALID_SUPPORT_CONTACT',
      blockedReason: null
    };
  }

  // Phase 8: RELEASE (0.82 -> 0.88)
  if (p < 0.88) {
    const t = (p - 0.82) / 0.06;
    const lift = contactLift + (releaseLift - contactLift) * t;
    return {
      progress: p,
      requestedProgress: progress,
      mode: 'putaway',
      slotId: slotSpec.slotId,
      slotSpec,
      fork: [slotX, 0, -1.2],
      forkYaw: Math.PI / 2,
      forkExtension: 0.85,
      lift,
      pallet: [slotX, targetRestY, -3.0],
      palletYaw: Math.PI / 2,
      held: false,
      carried: false,
      attachment: 'RELEASED',
      slotOccupancy: 'OCCUPIED_SIMULATED',
      forkliftPhase: 'RELEASE',
      collisionStatus: 'VALID_RELEASE_CONTACT',
      blockedReason: null
    };
  }

  // Phase 9: RETREAT (0.88 -> 1.00)
  const t = (p - 0.88) / 0.12;
  const extension = 0.85 * (1 - t);
  const vehicleZ = -1.2 + 0.20 * t; // backs up safely into aisle center
  return {
    progress: p,
    requestedProgress: progress,
    mode: 'putaway',
    slotId: slotSpec.slotId,
    slotSpec,
    fork: [slotX, 0, vehicleZ],
    forkYaw: Math.PI / 2,
    forkExtension: extension,
    lift: releaseLift,
    pallet: [slotX, targetRestY, -3.0],
    palletYaw: Math.PI / 2,
    held: false,
    carried: false,
    attachment: 'RELEASED',
    slotOccupancy: 'OCCUPIED_SIMULATED',
    forkliftPhase: 'RETREAT',
    collisionStatus: 'CLEAR',
    blockedReason: null
  };
}
