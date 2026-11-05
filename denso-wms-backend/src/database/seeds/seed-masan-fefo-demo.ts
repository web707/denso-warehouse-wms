/**
 * Optional, idempotent FEFO demo data for local/staging only.
 * It never deletes existing records, never resets tables, and never changes
 * non-MASAN-DEMO entries. Requires --apply-demo AND MASAN_DEMO_SEED=YES.
 * Product names are reference catalog examples; dates, weights and lots are fictitious.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import AppDataSource from '../../config/data-source';
import { Order } from '../../orders/entities/order.entity';
import { Part } from '../../parts/entities/part.entity';
import { Division } from '../../divisions/entities/division.entity';
import { DcPrefix } from '../../divisions/entities/dc-prefix.entity';
import { Container } from '../../containers/entities/container.entity';
import { ContainerType } from '../../container-types/entities/container-type.entity';
import { WarehouseZone } from '../../warehouse-zones/entities/warehouse-zone.entity';
import { nextPartColor } from '../../parts/constants/part-colors';

loadEnv();
const BASE_WAREHOUSE_CODE = 'DENSO-WH'; // Compatibility with the existing warehouse key.
const DEMO_ORDER_NUMBER = 'MASAN-FEFO-TEST-2026';
const MAX_RACKS_PER_ZONE = 20;
const ROWS_PER_RACK = 10; // Deliberate breathing room; avoid 20 full slots immediately.
const ZONES: Record<string, { code: string; name: string; storageMode: string }> = {
  dry_food: { code: 'ZONE-TEST-DRY', name: '[TEST] Thực phẩm khô', storageMode: 'ambient' },
  condiments: { code: 'ZONE-TEST-SPICE', name: '[TEST] Gia vị & nước chấm', storageMode: 'ambient' },
  beverages: { code: 'ZONE-TEST-DRINK', name: '[TEST] Nước giải khát', storageMode: 'ambient' },
  chilled_food: { code: 'ZONE-TEST-CHILL', name: '[TEST] Thịt mát', storageMode: 'chilled' },
  produce: { code: 'ZONE-TEST-FRESH', name: '[TEST] Nông sản', storageMode: 'produce' },
  household: { code: 'ZONE-TEST-HOUSE', name: '[TEST] Hóa phẩm gia dụng', storageMode: 'household' },
  qc_condiments: { code: 'ZONE-TEST-QC-SPICE', name: '[TEST] Cách ly gia vị quá HSD', storageMode: 'ambient' },
  qc_dry_food: { code: 'ZONE-TEST-QC-DRY', name: '[TEST] Cách ly thực phẩm khô quá HSD', storageMode: 'ambient' },
};

type DemoRow = {
  orderNumber: string; partName: string; productCode: string;
  divisionCode: string; dcPrefix: string; masterPo: string;
  quantityPcs: number; totalWeightKg: number; cartonCount: number; cartonSizeCm: string;
  storageClass: string; lotNumber: string; uomCode: string;
  expirationDate: string; supplierName: string; supplierSiteCode: string; scenario: string;
};
type DemoPayload = {
  asOf: string;
  legacyUpdates: Array<{ productCode: string; lotNumber: string; expirationDate: string; storageClass: string }>;
  newParts: DemoRow[];
};

function mustReadPayload(): DemoPayload {
  const data = JSON.parse(readFileSync(join(__dirname, 'masan-fefo-demo.json'), 'utf8')) as DemoPayload;
  const ids = new Set<string>();
  for (const row of data.newParts) {
    const key = `${row.productCode}|${row.lotNumber}`;
    if (!row.productCode.startsWith('MASAN-TEST-') || ids.has(key)) throw new Error(`Invalid/duplicate demo key ${key}`);
    ids.add(key);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.expirationDate) || !ZONES[row.storageClass]) {
      throw new Error(`Invalid expiry/class for ${key}`);
    }
    if (row.cartonCount <= 0 || row.quantityPcs < row.cartonCount || row.totalWeightKg <= 0) {
      throw new Error(`Invalid quantity for ${key}`);
    }
  }
  if (!data.legacyUpdates.every((x) => /^MASAN-DEMO-\d{3}$/.test(x.productCode))) {
    throw new Error('Unsafe legacy update scope');
  }
  return data;
}

function preference(date: string): number[] {
  const expiry = Date.parse(`${date}T00:00:00Z`);
  const days = (expiry - Date.now()) / 86_400_000;
  const low = Array.from({ length: 10 }, (_, i) => i);
  const high = Array.from({ length: 10 }, (_, i) => i + 10);
  return days <= 90 ? [...low, ...high] : [...high, ...low];
}

function targetGroup(row: DemoRow) {
  if (row.scenario.startsWith('HẾT HẠN')) return `qc_${row.storageClass}`;
  return row.storageClass;
}

async function main() {
  const payload = mustReadPayload();
  const shouldApply = process.argv.includes('--apply-demo');
  const allow = process.env.MASAN_DEMO_SEED === 'YES';
  const distribution: Record<string, number> = {};
  for (const row of payload.newParts) distribution[targetGroup(row)] = (distribution[targetGroup(row)] || 0) + 1;
  console.log(`MASAN FEFO demo | Base test date: ${payload.asOf}`);
  console.log(`Legacy demo updates: ${payload.legacyUpdates.length}; catalog lots: ${payload.newParts.length}`);
  console.log('Demo zone distribution:', JSON.stringify(distribution));
  if (!shouldApply) {
    console.log('PREVIEW ONLY: no database connection, no data written.');
    console.log('To apply on a local TEST database: set MASAN_DEMO_SEED=YES; npm run seed:masan-demo -- --apply-demo');
    return;
  }
  if (!allow) throw new Error('Refusing to write: set MASAN_DEMO_SEED=YES after verifying a TEST PostgreSQL database and backup.');

  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (em) => {
      const orders = em.getRepository(Order);
      const parts = em.getRepository(Part);
      const racks = em.getRepository(Container);
      const zones = em.getRepository(WarehouseZone);
      let order = await orders.findOne({ where: { orderNumber: DEMO_ORDER_NUMBER } });
      if (order && order.division !== 'MASAN DEMO - KHÔNG DÙNG SẢN XUẤT') {
        throw new Error(`Order ${DEMO_ORDER_NUMBER} exists but is not the known demo order. Aborting.`);
      }
      if (!order) order = await orders.save(orders.create({
        orderNumber: DEMO_ORDER_NUMBER, name: '[TEST] Lô FEFO Masan đầy đủ',
        division: 'MASAN DEMO - KHÔNG DÙNG SẢN XUẤT', destination: 'DEMO-ONLY',
      }));
      const division = await em.getRepository(Division).findOne({ where: { code: 'HG' } });
      if (!division) throw new Error('Missing HG division; run standard non-reset seed first.');
      const prefix = await em.getRepository(DcPrefix).findOne({ where: { divisionId: division.id, code: '10' } });
      if (!prefix) throw new Error('Missing HG/10 prefix; run standard non-reset seed first.');
      const rackType = await em.getRepository(ContainerType).findOne({ where: { code: 'RACK20-A' } });
      if (!rackType) throw new Error('Missing RACK20-A rack type; run standard non-reset seed first.');

      const usedGroups = new Set(payload.newParts.map(targetGroup));
      for (const group of usedGroups) {
        const spec = ZONES[group];
        const existing = await zones.findOne({ where: { warehouseCode: BASE_WAREHOUSE_CODE, code: spec.code } });
        if (existing && (existing.storageMode !== spec.storageMode || !existing.name.startsWith('[TEST]'))) {
          throw new Error(`Zone ${spec.code} has a non-demo configuration. Aborting.`);
        }
        if (!existing) await zones.save(zones.create({
          warehouseCode: BASE_WAREHOUSE_CODE, code: spec.code,
          name: spec.name, storageMode: spec.storageMode, description: 'DỮ LIỆU DEMO - không phải kho vận hành thực tế',
          active: true,
        }));
      }

      // Existing MASAN-DEMO rows: never touch real product codes or overwrite
      // manually entered valid expiry dates. Correct only missing/2021 test typo.
      let patchedLegacy = 0;
      for (const fix of payload.legacyUpdates) {
        const matched = await parts.find({ where: { productCode: fix.productCode, lotNumber: fix.lotNumber } });
        for (const part of matched) {
          let dirty = false;
          if (!part.expirationDate || String(part.expirationDate).startsWith('2021-')) {
            part.expirationDate = fix.expirationDate;
            dirty = true;
          }
          if (!part.storageClass || part.storageClass === 'unknown') {
            part.storageClass = fix.storageClass;
            dirty = true;
          }
          if (dirty) { await parts.save(part); patchedLegacy++; }
        }
      }

      // All new stock is only in dedicated [TEST] zones and [TEST] racks.
      // First 10 positions per rack are intentionally kept free of crowding.
      const existing = await parts.find({ where: { orderId: order.id } });
      const existingByKey = new Map(existing.map((p) => [`${p.productCode}|${p.lotNumber}`, p]));
      const busyByRack = new Map<string, Set<number>>();
      const usageByRack = new Map<string, { weight: number; cbm: number }>();
      const groupRacks = new Map<string, Container[]>();
      let inserted = 0; let skipped = 0; let repaired = 0;
      let colorIndex = await parts.count();

      async function rackFor(group: string, idx: number): Promise<Container> {
        const key = `${group}`;
        const list = groupRacks.get(key) || [];
        if (list[idx]) return list[idx];
        const spec = ZONES[group];
        const name = `R${String(idx + 1).padStart(2, '0')}`;
        if (idx >= MAX_RACKS_PER_ZONE) throw new Error(`More than 20 demo racks in ${spec.code}`);
        const matches = await racks.find({ where: { warehouseCode: BASE_WAREHOUSE_CODE, zoneCode: spec.code, name } });
        if (matches.length > 1) throw new Error(`Duplicate rack ${spec.code}/${name}; stop before writing.`);
        let rack = matches[0];
        if (rack && rack.orderId !== order!.id) throw new Error(`Non-demo rack ${spec.code}/${name}; refusing to overwrite.`);
        if (!rack) rack = await racks.save(racks.create({
          orderId: order!.id, name, warehouseCode: BASE_WAREHOUSE_CODE, zoneCode: spec.code,
          containerTypeId: rackType!.id, maxCbmOverride: '17.550', maxPayloadKgOverride: '2000',
        }));
        list[idx] = rack;
        groupRacks.set(key, list);
        return rack;
      }

      const assignedByGroup: Record<string, number> = {};
      for (const row of payload.newParts) {
        const key = `${row.productCode}|${row.lotNumber}`;
        const prev = existingByKey.get(key);
        if (prev) {
          // Idempotency: preserve user edits, including manual relocation.
          if ((!prev.expirationDate || prev.storageClass === 'unknown') && prev.partName === row.partName) {
            if (!prev.expirationDate) prev.expirationDate = row.expirationDate;
            if (prev.storageClass === 'unknown') prev.storageClass = row.storageClass;
            await parts.save(prev); repaired++;
          } else skipped++;
          continue;
        }
        const group = targetGroup(row);
        let rack: Container | undefined;
        let slot: number | undefined;
        const targetWeight = Number(row.totalWeightKg);
        const [len, width, height] = row.cartonSizeCm.split(' x ').map(Number);
        const cbm = len * width * height * row.cartonCount / 1_000_000;
        for (let i = 0; i < MAX_RACKS_PER_ZONE; i++) {
          const tryRack = await rackFor(group, i);
          if (!busyByRack.has(tryRack.id)) {
            const current = await parts.find({ where: { containerId: tryRack.id } });
            if (current.some((p) => p.orderId !== order!.id || p.storageClass !== row.storageClass)) {
              throw new Error(`Demo rack ${group}/${tryRack.name} contains unexpected stock/class; stop.`);
            }
            busyByRack.set(tryRack.id, new Set(current.map((p) => p.preferredRackSlot).filter((n): n is number => n !== null)));
            usageByRack.set(tryRack.id, { weight: current.reduce((s,p)=>s+Number(p.totalWeightKg),0), cbm: current.reduce((s,p)=>s+Number(p.cbm),0) });
          }
          const busy = busyByRack.get(tryRack.id)!;
          const usage = usageByRack.get(tryRack.id)!;
          if (busy.size >= ROWS_PER_RACK || usage.weight + targetWeight > 2000 || usage.cbm + cbm > 17.55) continue;
          const freeSlot = preference(row.expirationDate).find((candidate) => !busy.has(candidate));
          if (freeSlot === undefined) continue;
          rack = tryRack; slot = freeSlot;
          break;
        }
        if (!rack || slot === undefined) throw new Error(`No valid demo slot for ${key}; transaction rolled back.`);
        const fresh = await parts.save(parts.create({
          orderId: order!.id, partName: row.partName, productCode: row.productCode,
          divisionId: division!.id, dcPrefixId: prefix!.id, masterPo: row.masterPo,
          quantityPcs: row.quantityPcs, totalWeightKg: row.totalWeightKg.toFixed(2), cartonCount: row.cartonCount,
          cartonLengthMm: Math.round(len * 10), cartonWidthMm: Math.round(width * 10), cartonHeightMm: Math.round(height * 10),
          cbm: cbm.toFixed(6), containerId: rack.id, preferredRackSlot: slot,
          colorHex: nextPartColor(colorIndex++), storageClass: row.storageClass,
          lotNumber: row.lotNumber, uomCode: 'EA', expirationDate: row.expirationDate,
          supplierName: row.supplierName, supplierSiteCode: row.supplierSiteCode,
          supplierId: null, unitCost: null,
        }));
        existingByKey.set(key, fresh);
        busyByRack.get(rack.id)!.add(slot);
        const usage = usageByRack.get(rack.id)!;
        usage.weight += targetWeight; usage.cbm += cbm;
        assignedByGroup[group] = (assignedByGroup[group] || 0) + 1;
        inserted++;
      }
      console.log(`SUCCESS: patched ${patchedLegacy} existing MASAN-DEMO entries; created ${inserted} demo lots; skipped ${skipped}; repaired ${repaired}`);
      console.log('New demo stock by group:', JSON.stringify(assignedByGroup));
      console.warn('QC caution: [TEST] quarantine zone is a VISUAL demo location, not a real shipment block. Do not use demo stock as actual inventory.');
    });
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Masan FEFO demo seed failed (transaction rolled back):', error?.message || error);
  process.exitCode = 1;
});
