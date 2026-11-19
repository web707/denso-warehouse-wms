// navigationGraph.js
// Industrial Navigation Graph & Smooth Waypoint Interpolator for Warehouse Forklift & AGV.
// Traverses designated safety aisles; never clips through steel racks, walls, or inventory pallets.

export const WAYPOINTS = Object.freeze({
  RECEIVING_DOCK: [-4.0, 0, 1.8],
  RECEIVING_STAGE: [-3.2, 0, 1.8],
  QC_STAGING: [0.0, 0, 1.8],
  PICK_PACK_STAGE: [3.0, 0, 1.8],
  OUTBOUND_DOCK: [4.0, 0, 2.7],
  INBOUND_TRUCK: [-4.0, 0, 3.8],
  OUTBOUND_TRUCK: [4.0, 0, 3.8],
  
  // Main Aisle (z = -1.20)
  AISLE_WEST_ENTRY: [-4.0, 0, -1.2],
  AISLE_R01_INTERSECTION: [-2.8, 0, -1.2],
  AISLE_CENTER: [0.0, 0, -1.2],
  AISLE_R03_INTERSECTION: [2.8, 0, -1.2],
  AISLE_EAST_ENTRY: [4.0, 0, -1.2],

  // Transition Cross-Aisles (connecting Staging z = 1.8 to Main Aisle z = -1.2)
  CROSS_AISLE_WEST: [-4.0, 0, 0.3],
  CROSS_AISLE_CENTER: [0.0, 0, 0.3],
  CROSS_AISLE_EAST: [4.0, 0, 0.3]
});

/**
 * Calculates a collision-free waypoint sequence from a start location to a destination.
 */
export function buildTravelRoute(startPos, endPos) {
  const [sx, sy, sz] = startPos;
  const [ex, ey, ez] = endPos;

  const points = [[sx, sy, sz]];

  // 1. If starting from receiving dock area (z > 0), move to Cross Aisle West
  if (sz > 0.5) {
    if (Math.abs(sx - (-4.0)) < 1.0) {
      points.push([-4.0, 0, 0.3]);
      points.push([-4.0, 0, -1.2]); // Enter main aisle
    } else if (Math.abs(sx - 4.0) < 1.0) {
      points.push([4.0, 0, 0.3]);
      points.push([4.0, 0, -1.2]);
    } else {
      points.push([0.0, 0, 0.3]);
      points.push([0.0, 0, -1.2]);
    }
  }

  // 2. Travel along main aisle (z = -1.2) to target X coordinate
  const currentZ = points[points.length - 1][2];
  if (Math.abs(currentZ - (-1.2)) < 0.1) {
    points.push([ex, 0, -1.2]); // Align with rack bay X
  }

  // 3. Final approach towards rack or destination
  if (ez < -1.5) {
    // Front rack row: approach down from z = -1.2 towards z = -2.1
    points.push([ex, 0, ez + 0.8]); // Approach point
    points.push([ex, 0, ez + 0.15]); // Insert tines
  } else if (ez > 0.0) {
    // Moving towards dock or staging
    points.push([ex, 0, 0.3]);
    points.push([ex, 0, ez]);
  } else {
    points.push([ex, 0, ez]);
  }

  return points;
}

/**
 * Evaluates smooth position [x, y, z] and orientation yaw (radians) along a waypoint path at progress t in [0, 1].
 */
export function sampleRoutePose(waypoints = [], t = 0) {
  if (!waypoints || waypoints.length === 0) {
    return { position: [0, 0, 0], yaw: 0, speed: 0 };
  }
  if (waypoints.length === 1) {
    return { position: waypoints[0], yaw: 0, speed: 0 };
  }

  const clampedT = Math.max(0, Math.min(1, t));
  
  // Calculate segment lengths
  const segLengths = [];
  let totalLength = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const dist = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
    segLengths.push(dist);
    totalLength += dist;
  }

  if (totalLength === 0) {
    return { position: waypoints[0], yaw: 0, speed: 0 };
  }

  const targetDist = clampedT * totalLength;
  let accumDist = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accumDist + segLen >= targetDist || i === segLengths.length - 1) {
      const segT = segLen > 0 ? (targetDist - accumDist) / segLen : 0;
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      // Linear interpolation with slight smooth easing
      const smoothT = segT * segT * (3 - 2 * segT);
      const x = p1[0] + (p2[0] - p1[0]) * smoothT;
      const y = p1[1] + (p2[1] - p1[1]) * smoothT;
      const z = p1[2] + (p2[2] - p1[2]) * smoothT;

      // Heading angle facing travel direction
      const dx = p2[0] - p1[0];
      const dz = p2[2] - p1[2];
      const yaw = Math.atan2(dx, dz);

      return {
        position: [x, y, z],
        yaw,
        speed: segLen > 0 ? 1 : 0
      };
    }
    accumDist += segLen;
  }

  const last = waypoints[waypoints.length - 1];
  return { position: last, yaw: 0, speed: 0 };
}
