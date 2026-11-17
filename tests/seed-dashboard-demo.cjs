const assert = require('node:assert/strict');
const path = require('node:path');
const backend = path.join(__dirname, '../denso-wms-backend');
const { config } = require(path.join(backend, 'node_modules/dotenv'));
const { Client } = require(path.join(backend, 'node_modules/pg'));
const env = config({ path: path.join(backend, '.env') }).parsed;
const database = 'wms_dashboard_demo_test';
const api = 'http://127.0.0.1:5032/api';
const orderNumber = 'QA-DASHBOARD-DEMO';
const warehouseCode = 'DENSO-WH';
const db = new Client({ host: '127.0.0.1', port: 55432, user: env.DB_USERNAME, password: env.DB_PASSWORD, database });

const zones = [
  { code: 'ZONE-A', name: 'Nước mắm và gia vị', family: 'condiments', storage: 'condiments', products: [
    ['DQA-NAMNGU-VANG', 'Nam Ngư Nhãn Vàng'], ['DQA-CHINSU-NM', 'Nước mắm CHIN-SU'],
  ] },
  { code: 'ZONE-B', name: 'Mì ăn liền', family: 'noodles', storage: 'dry_food', products: [
    ['DQA-OMACHI-BO', 'Mì Omachi xốt bò hầm'], ['DQA-KOKOMI-90', 'Kokomi Đại 90g'],
  ] },
  { code: 'ZONE-C', name: 'Cà phê', family: 'coffee', storage: 'dry_food', products: [
    ['DQA-VINACAFE-GOLD', 'Vinacafé Gold'],
  ] },
  { code: 'ZONE-D', name: 'Nước giải khát', family: 'beverages', storage: 'beverages', products: [
    ['DQA-WAKEUP-247', 'Nước tăng lực Wake-Up 247'],
  ] },
  { code: 'ZONE-E', name: 'Trà đóng chai', family: 'beverages', storage: 'beverages', products: [
    ['DQA-BUPNONTEA-365', 'Trà đóng chai BupnonTEA 365'],
  ] },
];
let token;

async function request(route, method = 'GET', body, key, expected = method === 'GET' || method === 'PATCH' ? 200 : 201) {
  const response = await fetch(api + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  assert.equal(response.status, expected, method + ' ' + route + ' · ' + (payload.code || '') + ' · ' + (payload.message || ''));
  return payload;
}

const create = (route, body, key) => request(route, 'POST', body, key);
const dateFrom = (today, days) => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

async function seed() {
  const health = await request('/health');
  assert.equal(health.mode, 'demo');
  const { rows: [target] } = await db.query("SELECT current_database() AS db, to_regclass('inventory_lots') AS lots, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today");
  assert.equal(target.db, database);
  assert.equal(target.lots, 'inventory_lots');
  await db.query("SELECT pg_advisory_lock(hashtext('MASAN_DASHBOARD_DEMO_SEED_V1'))");
  const session = await request('/auth/login', 'POST', { username: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD }, undefined, 200);
  token = session.accessToken;

  if (!(await request('/divisions')).length || !(await request('/rack-types')).length) {
    process.env.DB_NAME = database;
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '55432';
    process.env.DB_USERNAME = env.DB_USERNAME;
    process.env.DB_PASSWORD = env.DB_PASSWORD;
    const source = require(path.join(backend, 'dist/config/data-source')).default;
    await source.initialize();
    try {
      assert.equal((await source.query('SELECT current_database() AS db'))[0].db, database);
      const seedPath = name => path.join(backend, 'dist/database/seeds', name);
      await require(seedPath('divisions.seed')).seedDivisions(source);
      await require(seedPath('container-types.seed')).seedContainerTypes(source);
      await require(seedPath('packing-rules.seed')).seedPackingRules(source);
    } finally {
      await source.destroy();
    }
  }
  const division = (await request('/divisions')).find(row => row.code === 'HG');
  const rackType = (await request('/rack-types')).find(row => row.sourceCode === 'RACK20-A');
  assert(division && rackType, 'Reference data must be initialized on the isolated demo DB.');
  const divisionId = division.id;
  const dcPrefixId = division.dcPrefixes.find(row => row.code === '10').id;
  const orders = await request('/orders');
  const order = orders.find(row => row.orderNumber === orderNumber) ?? await create('/orders', { orderNumber, division: 'HG' });
  const existingZones = await request('/warehouse-zones?warehouseCode=' + warehouseCode);
  const existingRacks = await request('/racks');
  const existingParts = await request('/parts?orderId=' + order.id);
  const partByMarker = new Map();
  // The API returns oldest PARTs first. A split inherits the marker but has a later creation time.
  for (const part of existingParts) {
    if (!partByMarker.has(part.masterPo)) partByMarker.set(part.masterPo, part);
  }
  const createPart = async (marker, fields) => {
    const existing = partByMarker.get(marker);
    if (existing) return existing;
    const part = await create('/parts', {
      orderId: order.id, divisionId, dcPrefixId, masterPo: marker,
      cartonLengthMm: 230, cartonWidthMm: 160, cartonHeightMm: 140, ...fields,
    });
    partByMarker.set(marker, part);
    return part;
  };
  const seedQc = async (part, inspectionId, judgment) => {
    const { rows } = await db.query('SELECT lot_id FROM inspections WHERE inspection_id=$1', [inspectionId]);
    if (rows.length) {
      assert.equal(rows[0].lot_id, part.lotId);
      return;
    }
    await create('/inspections', {
      inspectionId, productCode: part.productCode, lotNumber: part.lotNumber, judgment, sampleSize: 3, passQuantity: 3, failQuantity: 0,
    });
  };

  const fixtures = new Map();
  for (const zone of zones) {
    const zoneData = { name: zone.name, productFamily: zone.family, storageMode: 'ambient' };
    const existingZone = existingZones.find(row => row.code === zone.code);
    if (!existingZone) await create('/warehouse-zones', { ...zoneData, code: zone.code, warehouseCode });
    else if (existingZone.productFamily !== zone.family || existingZone.name !== zone.name) {
      await request('/warehouse-zones/' + existingZone.id, 'PATCH', zoneData);
    }

    for (let index = 0; index <= zone.products.length; index++) {
      const name = 'R0' + (index + 1);
      const rack = existingRacks.find(row => row.zoneCode === zone.code && row.name === name) ?? await create('/racks', {
        name, rackTypeId: rackType.id, orderId: order.id, zoneCode: zone.code, productFamily: zone.family,
      });
      if (index === zone.products.length) {
        fixtures.set(zone.code + ':spare', rack);
        continue;
      }
      const [productCode, partName] = zone.products[index];
      const parts = [];
      for (let slot = 0; slot < 14; slot++) {
        const lotIndex = Math.floor(slot / 5);
        const lotNumber = lotIndex === 0 ? 'DQA-COMMON-01' : productCode + '-L' + (lotIndex + 1);
        const days = zone.code === 'ZONE-E' && lotIndex === 0 ? -3 : [14, 52, 96][lotIndex];
        const cartonCount = 6 + slot % 4;
        const part = await createPart('DQA-' + zone.code.slice(-1) + (index + 1) + '-' + String(slot).padStart(2, '0'), {
          productCode, partName, lotNumber, expirationDate: dateFrom(target.today, days), rackId: rack.id, slotIndex: slot,
          productFamily: zone.family, storageClass: zone.storage, quantityPcs: cartonCount * 10, cartonCount, totalWeightKg: cartonCount * 2,
        });
        assert(part.lotId);
        parts.push(part);
        if (slot % 5 === 0 && !(zone.code === 'ZONE-C' && lotIndex === 2)) {
          const judgment = zone.code === 'ZONE-B' && lotIndex === 0 ? 'HOLD' : 'AVAILABLE';
          await seedQc(part, 'QC-' + productCode + '-' + lotIndex, judgment);
        }
      }
      fixtures.set(productCode, { rack, parts });
    }
  }

  await createPart('DQA-UNASSIGNED', {
    productCode: 'DQA-NAMNGU-VANG', partName: 'Nam Ngư Nhãn Vàng', lotNumber: 'DQA-CHO-XEP',
    productFamily: 'condiments', storageClass: 'condiments', expirationDate: dateFrom(target.today, 44),
    quantityPcs: 20, cartonCount: 2, totalWeightKg: 4,
  });
  const a = fixtures.get('DQA-NAMNGU-VANG');
  const b = fixtures.get('DQA-OMACHI-BO');
  assert.notEqual(a.parts[0].lotId, b.parts[0].lotId);
  for (const [key, fixture] of [['namngu', a], ['wake', fixtures.get('DQA-WAKEUP-247')]]) {
    await create('/inventory/transactions', { type: 'inbound', partId: fixture.parts[6].id, quantityPcs: 20, cartonCount: 2, weightKg: 4 }, 'dashboard-demo-v1-in-' + key);
    await create('/inventory/transactions', { type: 'outbound', partId: fixture.parts[6].id, quantityPcs: 10, cartonCount: 1, weightKg: 2 }, 'dashboard-demo-v1-out-' + key);
  }
  await create('/inventory/transactions', {
    type: 'transfer', partId: a.parts[8].id, quantityPcs: 10, cartonCount: 1, weightKg: 2, toRackId: fixtures.get('ZONE-A:spare').id, toSlot: 0,
  }, 'dashboard-demo-v1-transfer');

  const shipments = await request('/shipments');
  for (const [index, fixture] of [a, b].entries()) {
    const shipmentNumber = 'DQA-OUT-' + (index + 1);
    if (shipments.some(shipment => shipment.shipmentNumber === shipmentNumber)) continue;
    await create('/shipments', {
      shipmentNumber, customerName: 'Điểm nhận hàng QA', itemNumber: fixture.parts[6].productCode,
      lotNumber: fixture.parts[6].lotNumber, shipmentStatus: 'RELEASED', shippedQuantity: 40, requestedShipDate: dateFrom(target.today, 3),
    });
  }

  console.log(JSON.stringify(await request('/parts/dashboard-summary'), null, 2));
}

(async () => {
  await db.connect();
  try { await seed(); } finally { await db.end(); }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
