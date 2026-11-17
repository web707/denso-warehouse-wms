import { ContainerDims, PlacementDraft, SolverPart } from '../domain/types';

export const WAREHOUSE_RACK = {
  bays: 5,
  levels: 4,
  slotCount: 20,
  bayWidthMm: 1300,
  depthMm: 900,
  levelHeightMm: 750,
  shelfThicknessMm: 28,
  maxWeightPerSlotKg: 500,
  maxWeightPerLevelKg: 2000,
  maxWeightRackKg: 10000,
  nearFullRatio: 0.8,
} as const;

interface Orientation {
  dxMm: number;
  dyMm: number;
  dzMm: number;
  nx: number;
  ny: number;
  nz: number;
  capacity: number;
  rotated: boolean;
}

export interface RackPackResult {
  placements: PlacementDraft[];
  unplacedByPart: Record<string, number>;
  usedSlots: number;
  slotWeightsKg: number[];
  levelWeightsKg: number[];
  rackWeightKg: number;
}

const EPSILON = 1e-9;
type CartonGeometry = Pick<SolverPart, 'cartonLengthMm' | 'cartonWidthMm' | 'cartonHeightMm'>;

export function validRackDimensions(dims: ContainerDims): boolean {
  return [dims.internalLengthMm, dims.internalWidthMm, dims.internalHeightMm, dims.doorHeightMm ?? 1]
    .every(n => Number.isFinite(n) && n > 0)
    && [dims.maxCbm, dims.maxPayloadKg].every(n => Number.isFinite(n) && n >= 0);
}

function slotGeometry(slotIndex: number, dims?: ContainerDims) {
  const x = (slotIndex % WAREHOUSE_RACK.bays) * WAREHOUSE_RACK.bayWidthMm;
  const levelBase = Math.floor(slotIndex / WAREHOUSE_RACK.bays) * WAREHOUSE_RACK.levelHeightMm;
  const height = dims?.internalHeightMm ?? WAREHOUSE_RACK.levels * WAREHOUSE_RACK.levelHeightMm;
  // A compact single compartment declares its clear opening directly.
  const shelf = height < WAREHOUSE_RACK.levelHeightMm ? 0 : WAREHOUSE_RACK.shelfThicknessMm;
  const z = levelBase + shelf;
  return {
    x, z,
    length: Math.min(WAREHOUSE_RACK.bayWidthMm, (dims?.internalLengthMm ?? Infinity) - x),
    depth: Math.min(WAREHOUSE_RACK.depthMm, dims?.internalWidthMm ?? Infinity),
    height: Math.min(WAREHOUSE_RACK.levelHeightMm - shelf, height - z, dims?.doorHeightMm ?? Infinity),
  };
}

export function validSolverPart(part: SolverPart): boolean {
  return validCartonGeometry(part)
    && Number.isInteger(part.cartonCount) && part.cartonCount >= 0
    && Number.isFinite(part.totalWeightKg) && part.totalWeightKg >= 0;
}

function validCartonGeometry(part: CartonGeometry): boolean {
  return [part.cartonLengthMm, part.cartonWidthMm, part.cartonHeightMm].every(n => Number.isFinite(n) && n > 0);
}

function bestOrientation(part: CartonGeometry, slot: ReturnType<typeof slotGeometry>): Orientation | null {
  if (!validCartonGeometry(part) || !(slot.length > 0 && slot.depth > 0 && slot.height > 0)) return null;
  const { cartonLengthMm: l, cartonWidthMm: w, cartonHeightMm: h } = part;
  const rotations = [[l,w,h], [w,l,h], [l,h,w], [h,l,w], [w,h,l], [h,w,l]];
  const candidates = rotations.map(([dxMm, dyMm, dzMm], index) => {
    const nx = Math.floor(slot.length / dxMm);
    const ny = Math.floor(slot.depth / dyMm);
    const nz = Math.floor(slot.height / dzMm);
    return { dxMm, dyMm, dzMm, nx, ny, nz, capacity: nx * ny * nz, rotated: index !== 0 };
  });
  candidates.sort((a, b) => b.capacity - a.capacity);
  return candidates[0].capacity > 0 ? candidates[0] : null;
}

export function cartonFitsRackSlot(part: SolverPart, dims?: ContainerDims, slotIndex = 0): boolean {
  return rackSlotCartonCapacity(part, dims, slotIndex) > 0;
}

export function rackSlotCartonCapacity(part: CartonGeometry, dims: ContainerDims | undefined, slotIndex: number): number {
  return bestOrientation(part, slotGeometry(slotIndex, dims))?.capacity ?? 0;
}

function perCartonWeight(part: SolverPart): number {
  return part.cartonCount > 0 ? part.totalWeightKg / part.cartonCount : 0;
}

function slotCode(index: number): string {
  return `S${String(index + 1).padStart(2, '0')}`;
}

/**
 * Fixed industrial rack: 5 bays × 4 levels = 20 storage locations.
 *
 * Safety rules for the WMS demo:
 * - one PART owns one slot at a time (a PART may span adjacent slots);
 * - heavy PARTs are sorted first, therefore lower levels are filled first;
 * - a user-selected preferred slot is honoured when it is available;
 * - max 500 kg per slot;
 * - max 2,000 kg per level;
 * - max 10,000 kg for the whole rack.
 */
export function packWarehouseRack(parts: SolverPart[], dims?: ContainerDims): RackPackResult {
  const placements: PlacementDraft[] = [];
  const unplacedByPart: Record<string, number> = {};
  const used = new Set<number>();
  const validDimensions = !dims || validRackDimensions(dims);
  const slotWeightsKg = Array.from({ length: WAREHOUSE_RACK.slotCount }, () => 0);
  const levelWeightsKg = Array.from({ length: WAREHOUSE_RACK.levels }, () => 0);
  let rackWeightKg = 0;
  let rackCbm = 0;

  const ordered = parts
    .map((part, originalIndex) => ({ part, originalIndex }))
    .sort(
      (a, b) =>
        perCartonWeight(b.part) - perCartonWeight(a.part) ||
        b.part.totalWeightKg - a.part.totalWeightKg ||
        a.originalIndex - b.originalIndex,
    );

  for (const { part, originalIndex } of ordered) {
    if (!validDimensions || !validSolverPart(part) || !cartonFitsRackSlot(part, dims)) {
      unplacedByPart[part.id] = part.cartonCount;
      continue;
    }

    const cartonWeightKg = perCartonWeight(part);
    const cartonCbm = part.cartonLengthMm * part.cartonWidthMm * part.cartonHeightMm / 1_000_000_000;
    let remaining = part.cartonCount;
    let cartonSeq = 1;
    const preferred = part.preferredRackSlot;
    const candidates: number[] = [];

    if (
      preferred !== null &&
      preferred !== undefined &&
      preferred >= 0 &&
      preferred < WAREHOUSE_RACK.slotCount &&
      !used.has(preferred)
    ) {
      candidates.push(preferred);
    }
    for (let slot = 0; slot < WAREHOUSE_RACK.slotCount; slot += 1) {
      if (!used.has(slot) && slot !== preferred) candidates.push(slot);
    }

    for (const slotIndex of candidates) {
      if (remaining <= 0) break;

      const geometry = slotGeometry(slotIndex, dims);
      const orientation = bestOrientation(part, geometry);
      if (!orientation) continue;
      const levelIndex = Math.floor(slotIndex / WAREHOUSE_RACK.bays);
      const remainingLevelKg = WAREHOUSE_RACK.maxWeightPerLevelKg - levelWeightsKg[levelIndex];
      const remainingRackKg = Math.min(WAREHOUSE_RACK.maxWeightRackKg, dims?.maxPayloadKg ?? Infinity) - rackWeightKg;
      const permittedWeightKg = Math.max(
        0,
        Math.min(WAREHOUSE_RACK.maxWeightPerSlotKg, remainingLevelKg, remainingRackKg),
      );

      const weightCapacity = cartonWeightKg > 0
        ? Math.floor((permittedWeightKg + EPSILON) / cartonWeightKg)
        : orientation.capacity;
      const volumeCapacity = Math.floor(((dims?.maxCbm ?? Infinity) - rackCbm + EPSILON) / cartonCbm);
      const slotCapacity = Math.min(orientation.capacity, weightCapacity, volumeCapacity);
      if (slotCapacity < 1) continue;

      const take = Math.min(remaining, slotCapacity);
      const bay = (slotIndex % WAREHOUSE_RACK.bays) + 1;
      const level = levelIndex + 1;

      for (let i = 0; i < take; i += 1) {
        const ix = i % orientation.nx;
        const iy = Math.floor(i / orientation.nx) % orientation.ny;
        const iz = Math.floor(i / (orientation.nx * orientation.ny));

        placements.push({
          partId: part.id,
          blockIndex: originalIndex + 1,
          cartonSeq,
          // Persistence fields are reused as warehouse coordinates:
          // wallIndex = bay, layer = rack level, column = carton sequence within slot.
          wallIndex: bay,
          layer: level,
          column: i + 1,
          xMm: geometry.x + ix * orientation.dxMm,
          yMm: iy * orientation.dyMm,
          zMm: geometry.z + iz * orientation.dzMm,
          dxMm: orientation.dxMm,
          dyMm: orientation.dyMm,
          dzMm: orientation.dzMm,
          rotated: orientation.rotated,
          colorHex: part.colorHex,
        });
        cartonSeq += 1;
      }

      const loadedKg = cartonWeightKg * take;
      slotWeightsKg[slotIndex] += loadedKg;
      levelWeightsKg[levelIndex] += loadedKg;
      rackWeightKg += loadedKg;
      rackCbm += cartonCbm * take;
      remaining -= take;
      used.add(slotIndex);
    }

    unplacedByPart[part.id] = remaining;

    if (remaining > 0 && preferred !== null && preferred !== undefined) {
      // Keeping this branch explicit makes debugging a user-requested slot easy.
      void slotCode(preferred);
    }
  }

  return {
    placements,
    unplacedByPart,
    usedSlots: used.size,
    slotWeightsKg,
    levelWeightsKg,
    rackWeightKg,
  };
}
