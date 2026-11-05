/**
 * A Zone is designed for 20 physical positions (R01–R20).
 * Older databases may contain extra container rows after initialization per order.
 * Group records for display only. NEVER delete or reassign stock automatically.
 */
export const MAX_PHYSICAL_RACKS = 20;

const positionOf = (rack) => {
  const match = String(rack?.name || '').trim().toUpperCase().match(/^R0?([1-9]|1\d|20)$/);
  if (!match) return null;
  const index = Number(match[1]);
  return index >= 1 && index <= MAX_PHYSICAL_RACKS ? index : null;
};

export function inspectZoneRacks(racks = [], parts = []) {
  const partCounts = new Map();
  for (const part of parts) {
    if (!part.rackId) continue;
    partCounts.set(part.rackId, (partCounts.get(part.rackId) || 0) + 1);
  }
  const grouped = new Map();
  const legacy = [];
  for (const rack of racks) {
    const position = positionOf(rack);
    if (position === null) legacy.push(rack);
    else {
      if (!grouped.has(position)) grouped.set(position, []);
      grouped.get(position).push(rack);
    }
  }
  // Prefer the occupied record if historic data contains two IDs for the same Rxx.
  const preference = (a, b) => (partCounts.get(b.id) || 0) - (partCounts.get(a.id) || 0)
    || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    || String(a.id).localeCompare(String(b.id));
  const physicalRacks = [];
  const surplusRacks = [];
  for (let position = 1; position <= MAX_PHYSICAL_RACKS; position += 1) {
    const records = (grouped.get(position) || []).sort(preference);
    if (records.length) {
      physicalRacks.push(records[0]);
      surplusRacks.push(...records.slice(1));
    }
  }
  // Preserve legacy rows as visible physical shelves where there are still spare positions.
  legacy.sort(preference);
  const room = MAX_PHYSICAL_RACKS - physicalRacks.length;
  physicalRacks.push(...legacy.slice(0, room));
  surplusRacks.push(...legacy.slice(room));
  const surplusWithStock = surplusRacks.filter((rack) => (partCounts.get(rack.id) || 0) > 0);
  return {
    physicalRacks,
    surplusRacks,
    surplusWithStock,
    physicalCount: physicalRacks.length,
    totalRecords: racks.length,
    hasSurplus: surplusRacks.length > 0,
  };
}
