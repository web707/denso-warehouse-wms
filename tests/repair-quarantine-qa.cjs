const assert = require('node:assert/strict');
const source = require('../denso-wms-backend/dist/config/data-source').default;
const { Part } = require('../denso-wms-backend/dist/parts/entities/part.entity');
const { Container } = require('../denso-wms-backend/dist/containers/entities/container.entity');
const { HistoryEvent } = require('../denso-wms-backend/dist/history/entities/history-event.entity');
const { assertCapacity, assertRackSlotFits, rackLimits } = require('../denso-wms-backend/dist/inventory/inventory.rules');
const DATABASE = 'wms_historical_repair_test';
const reason = 'QA historical quarantine slot reconciliation';
const apply = process.argv.includes('--apply');

async function run() {
  assert.equal(source.options.database, DATABASE);
  assert.equal(source.options.host, '127.0.0.1');
  await source.initialize();
  try {
    const result = await source.transaction(async em => {
      assert.equal((await em.query('SELECT current_database() AS db'))[0].db, DATABASE);
      await em.query('LOCK TABLE parts, containers IN SHARE ROW EXCLUSIVE MODE');
      const rack = await em.findOneByOrFail(Container, { warehouseCode: 'DENSO-WH', zoneCode: 'ZONE-Q', name: 'R-QUARANTINE' });
      const parts = await em.find(Part, { where: { containerId: rack.id }, order: { createdAt: 'ASC', id: 'ASC' } });
      const repeated = parts.filter(part => part.preferredRackSlot === 0);
      if (repeated.length < 2) return { moves: [], applied: false };
      assert.equal(repeated.length, 12);
      assert.equal(new Set(repeated.map(part => part.productCode)).size, 1);
      assert.equal(new Set(repeated.map(part => part.id)).size, 12);
      const history = await em.query(`
        SELECT p.id, p.quantity_pcs, p.lot_id,
          EXISTS (SELECT 1 FROM receiving_receipts r WHERE r.damaged_part_id=p.id) AS receipt,
          EXISTS (SELECT 1 FROM inspections i WHERE i.lot_id=p.lot_id AND i.judgment='BLOCKED') AS qc,
          (SELECT sum(CASE WHEN t.type='inbound' THEN t.quantity_pcs WHEN t.type='outbound' THEN -t.quantity_pcs ELSE 0 END)
           FROM inventory_transactions t WHERE t.part_id=p.id) AS net
        FROM parts p WHERE p.id = ANY($1::uuid[])
      `, [repeated.map(part => part.id)]);
      for (const row of history) {
        assert(row.receipt && row.qc && row.lot_id);
        assert.equal(Number(row.net), row.quantity_pcs);
      }
      const occupied = new Set(parts.map(part => part.preferredRackSlot));
      const moves = [];
      const load = (part, slot = part.preferredRackSlot) => ({ slot, weightKg: Number(part.totalWeightKg), cbm: Number(part.cbm) });
      for (const part of repeated.slice(1)) {
        let found;
        for (let slot = 1; slot < 20; slot++) {
          if (occupied.has(slot)) continue;
          try {
            assertRackSlotFits(part, part.cartonCount, slot, rack);
            assertCapacity({ rackName: rack.name, partName: part.partName, limits: rackLimits(rack),
              others: parts.filter(peer => peer.id !== part.id).map(peer => load(peer)), before: null, after: load(part, slot) });
            found = slot;
            break;
          } catch (error) {
            if (typeof error.getResponse !== 'function') throw error;
          }
        }
        assert.notEqual(found, undefined, 'No capacity-checked destination available');
        occupied.add(found);
        moves.push({ id: part.id, sku: part.productCode, lotId: part.lotId, quantityPcs: part.quantityPcs, fromSlot: 0, toSlot: found });
        part.preferredRackSlot = found;
      }
      assert.equal(new Set(parts.map(part => part.preferredRackSlot)).size, parts.length);
      if (apply) {
        for (const move of moves) {
          await em.query('UPDATE parts SET preferred_rack_slot=$1 WHERE id=$2 AND container_id=$3', [move.toSlot, move.id, rack.id]);
          await em.save(HistoryEvent, em.create(HistoryEvent, {
            type: 'part_assigned', description: reason, timestamp: new Date(),
            details: { ...move, rackId: rack.id, method: 'QA repair; current position only' },
          }));
        }
      }
      return { rack: rack.name, moves, applied: apply };
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await source.destroy();
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });

