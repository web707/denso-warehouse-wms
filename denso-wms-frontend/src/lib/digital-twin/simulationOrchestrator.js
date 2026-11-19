// simulationOrchestrator.js
// Simulation Engine: Decoupled orchestration of vehicle physics, mast kinematics, pallet states, and timeline.
import { buildTravelRoute, sampleRoutePose, WAYPOINTS } from './navigationGraph';
import { DOMAIN_EVENT_TYPES } from './eventNormalizer';

/**
 * Calculates forklift and pallet states given an active event, progress t (0 to 1), and target slot coordinate.
 */
export function evaluateSimulationFrame(activeEvent, progress = 0, targetSlotCoords = null) {
  const p = Math.max(0, Math.min(1, progress));

  // Default start & target positions
  const startPos = activeEvent?.type === DOMAIN_EVENT_TYPES.PICK_STARTED || activeEvent?.type === DOMAIN_EVENT_TYPES.STOCK_TRANSFERRED
    ? (targetSlotCoords?.position || [-2.8, 0, -2.1])
    : WAYPOINTS.RECEIVING_DOCK;

  const targetRackX = targetSlotCoords?.position?.[0] ?? -2.8;
  const targetRackZ = targetSlotCoords?.position?.[2] ?? -3.0;
  const targetShelfY = targetSlotCoords?.shelfY ?? 0.34;
  const targetRestY = targetSlotCoords?.restY ?? 0.50;

  const endPos = activeEvent?.type === DOMAIN_EVENT_TYPES.PICK_STARTED || activeEvent?.type === DOMAIN_EVENT_TYPES.GOODS_DISPATCHED
    ? WAYPOINTS.PICK_PACK_STAGE
    : [targetRackX, 0, targetRackZ];

  const waypoints = buildTravelRoute(startPos, endPos);

  // 1. Phase-based Forklift Motion along Waypoints
  // p: 0.00 -> 0.15: Forklift approaches source pallet
  // p: 0.15 -> 0.30: Insert tines & lift pallet
  // p: 0.30 -> 0.80: Travel along aisles to target
  // p: 0.80 -> 0.95: Align, lift mast to shelf level, place pallet
  // p: 0.95 -> 1.00: Retract tines & step back
  
  let travelT = 0;
  let liftHeight = 0.10;
  let forkExtension = 0;
  let isCarryingPallet = false;
  let palletPos = [...startPos];
  let palletYaw = 0;

  if (p < 0.15) {
    // Approach phase
    const sample = sampleRoutePose(waypoints.slice(0, 2), p / 0.15);
    forkExtension = 0;
    liftHeight = 0.05;
    palletPos = [startPos[0], 0.10, startPos[2]];
    return {
      forklift: { position: sample.position, yaw: sample.yaw, lift: liftHeight, extension: forkExtension },
      pallet: { position: palletPos, yaw: 0, attached: false, visible: true },
      phaseText: 'Xe nâng tiếp cận kiện hàng tại khu vực nhận'
    };
  }

  if (p >= 0.15 && p < 0.30) {
    // Engagement & Lift phase
    const localP = (p - 0.15) / 0.15;
    forkExtension = Math.min(0.5, localP * 0.5);
    liftHeight = 0.05 + localP * 0.40; // Lift off floor to 0.45m
    isCarryingPallet = localP > 0.4;
    const pose = sampleRoutePose(waypoints, 0.1);
    palletPos = isCarryingPallet
      ? [pose.position[0], liftHeight + 0.10, pose.position[2] + 0.6 * Math.cos(pose.yaw)]
      : [startPos[0], 0.10, startPos[2]];

    return {
      forklift: { position: pose.position, yaw: pose.yaw, lift: liftHeight, extension: forkExtension },
      pallet: { position: palletPos, yaw: pose.yaw, attached: isCarryingPallet, visible: true },
      phaseText: 'Gài càng nâng & nhấc pallet lên khỏi mặt sàn (0.45m)'
    };
  }

  if (p >= 0.30 && p < 0.80) {
    // Main Travel phase along aisle
    const travelP = (p - 0.30) / 0.50;
    const sample = sampleRoutePose(waypoints, travelP);
    liftHeight = 0.45; // Safe travel height
    forkExtension = 0;
    isCarryingPallet = true;
    palletPos = [sample.position[0], liftHeight + 0.12, sample.position[2] + 0.55 * Math.sin(sample.yaw)];

    return {
      forklift: { position: sample.position, yaw: sample.yaw, lift: liftHeight, extension: 0 },
      pallet: { position: palletPos, yaw: sample.yaw, attached: true, visible: true },
      phaseText: `Vận chuyển qua hành lang an toàn tới kệ ${targetSlotCoords?.rackName || 'R01'}`
    };
  }

  if (p >= 0.80 && p < 0.95) {
    // Shelf Alignment, Mast Elevation & Deposit phase
    const placeP = (p - 0.80) / 0.15;
    const finalWaypoints = waypoints.slice(-2);
    const sample = sampleRoutePose(finalWaypoints, Math.min(1, placeP * 1.5));
    // Lift from travel height (0.45m) to target shelf height
    liftHeight = 0.45 + placeP * Math.max(0, targetRestY - 0.45);
    forkExtension = placeP > 0.5 ? (placeP - 0.5) * 2 * 0.4 : 0;
    isCarryingPallet = placeP < 0.85;

    palletPos = isCarryingPallet
      ? [targetRackX, liftHeight + 0.05, targetRackZ + 0.3]
      : [targetRackX, targetRestY, targetRackZ];

    return {
      forklift: { position: sample.position, yaw: Math.PI, lift: liftHeight, extension: forkExtension },
      pallet: { position: palletPos, yaw: 0, attached: isCarryingPallet, visible: true },
      phaseText: `Nâng trụ càng tầng ${targetSlotCoords?.level || 1} & đặt pallet vào ô ${targetSlotCoords?.slotCode || 'S01'}`
    };
  }

  // Final Rest & Retract (p >= 0.95)
  const lastPose = waypoints[waypoints.length - 1];
  return {
    forklift: { position: [targetRackX, 0, -1.6], yaw: Math.PI, lift: 0.10, extension: 0 },
    pallet: { position: [targetRackX, targetRestY, targetRackZ], yaw: 0, attached: false, visible: true },
    phaseText: `Hoàn tất lưu kho tại ô ${targetSlotCoords?.slotCode || 'S01'} · Tồn kho đồng bộ CSDL`
  };
}

/**
 * Evaluates periodic AGV movement carrying pallets along the staging loop.
 */
export function evaluateAGVFrame(time = 0) {
  // Loop path between Receiving Dock (-4, 0, 1.8) and Inspection Area (0, 0, 1.8)
  const cycleTime = 12; // 12 seconds per full loop
  const t = (time % cycleTime) / cycleTime;
  
  let x = 0;
  let z = 1.8;
  let yaw = 0;

  if (t < 0.45) {
    // Moving from Dock to Inspection (Eastbound)
    const legT = t / 0.45;
    x = -4.0 + legT * 4.0;
    z = 1.8;
    yaw = Math.PI / 2;
  } else if (t < 0.55) {
    // Pause / Unload at Inspection
    x = 0.0;
    z = 1.8;
    yaw = Math.PI / 2;
  } else if (t < 0.95) {
    // Return to Dock (Westbound)
    const legT = (t - 0.55) / 0.40;
    x = 0.0 - legT * 4.0;
    z = 1.8;
    yaw = -Math.PI / 2;
  } else {
    // Pause at Dock
    x = -4.0;
    z = 1.8;
    yaw = -Math.PI / 2;
  }

  return {
    position: [x, 0.05, z],
    yaw,
    cargoVisible: t < 0.50
  };
}
