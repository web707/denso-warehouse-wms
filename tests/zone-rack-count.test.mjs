import assert from 'node:assert/strict';
import { inspectZoneRacks } from '../denso-wms-frontend/src/lib/zoneRackInventory.js';

const racks = Array.from({ length: 20 }, (_, index) => ({
  id: `physical-${index + 1}`,
  name: `R${String(index + 1).padStart(2, '0')}`,
  createdAt: '2026-01-01T00:00:00Z',
}));
const normal = inspectZoneRacks(racks);
assert.equal(normal.physicalCount, 20);
assert.equal(normal.hasSurplus, false);
assert.equal(normal.surplusRacks.length, 0);

const overflow = inspectZoneRacks([
  ...racks,
  { id: 'dup-1', name: 'R01' },
  { id: 'dup-2', name: 'R02' },
  { id: 'outside-21', name: 'R21' },
  { id: 'outside-22', name: 'R22' },
], [
  { rackId: 'dup-1', id: 'stock-a' },
  { rackId: 'outside-22', id: 'stock-b' },
]);
assert.equal(overflow.totalRecords, 24);
assert.equal(overflow.physicalCount, 20);
assert.equal(overflow.surplusRacks.length, 4);
assert.equal(overflow.physicalRacks.find((row) => row.name === 'R01')?.id, 'dup-1');
assert.equal(overflow.surplusWithStock.length, 1);

const duplicates = inspectZoneRacks([
  { id: 'a', name: 'R01' },
  { id: 'b', name: 'R01' },
]);
assert.equal(duplicates.physicalCount, 1);
assert.equal(duplicates.surplusRacks.length, 1);

const legacy = inspectZoneRacks([...racks.slice(0, 19), { id: 'legacy', name: 'Kệ số 20' }]);
assert.equal(legacy.physicalCount, 20);
assert.equal(legacy.hasSurplus, false);

console.log('PASS: maximum 20 physical positions; additional records remain auditable, including those with stock.');
