const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { Client, Pool } = require('../denso-wms-backend/node_modules/pg');
const { config } = require('../denso-wms-backend/node_modules/dotenv');

const env = config({ path: path.resolve(__dirname, '../denso-wms-backend/.env') }).parsed;
const dbName = process.env.WMS_QA_DATABASE;
const apiBase = new URL(process.env.WMS_QA_API || 'http://127.0.0.1:5010/api');
if (!dbName?.endsWith('_test') || apiBase.hostname !== '127.0.0.1' || apiBase.port === '5001') {
  throw new Error('Set WMS_QA_DATABASE to an isolated *_test database and WMS_QA_API to its loopback QA backend.');
}
const connection = { host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: dbName };
const db = new Pool(connection);
const run = randomUUID().slice(0, 8);
const results = [];
let admin;
let staff;
let template;
let rackType;
let testZone;
let testRack;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function api(route, { method = 'GET', body, key, token = admin } = {}) {
  const url = apiBase.href + route;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (key) headers['Idempotency-Key'] = key;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 429 && attempt === 0) {
      const seconds = Number(response.headers.get('Retry-After')) || 60;
      await delay(Math.min(seconds + 1, 61) * 1000);
      continue;
    }
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
}

function expectStatus(response, status) {
  assert.equal(response.status, status, 'HTTP ' + response.status + ' · ' + (response.data?.code || 'no code'));
  return response.data;
}

async function check(id, title, fn) {
  try {
    const detail = await fn();
    results.push({ id, title, status: 'PASS', detail });
  } catch (error) {
    results.push({ id, title, status: 'FAIL', detail: error.message });
  }
  console.log(id, results.at(-1).status, results.at(-1).detail || title);
  if (process.env.WMS_QA_RESULT) fs.writeFileSync(process.env.WMS_QA_RESULT, JSON.stringify(results, null, 2));
}

async function login(username, password) {
  return expectStatus(await api('/auth/login', { method: 'POST', token: null, body: { username, password } }), 200).accessToken;
}
const write = (route, body, options = {}) => api(route, { method: 'POST', body, ...options });
const transaction = (body, key = randomUUID(), token = admin) => write('/inventory/transactions', body, { key, token });
const quantity = async id => (await db.query('SELECT quantity_pcs FROM parts WHERE id=$1', [id])).rows[0].quantity_pcs;
const ledgerCount = async id => (await db.query('SELECT count(*)::int AS n FROM inventory_transactions WHERE part_id=$1', [id])).rows[0].n;
const location = async id => (await db.query('SELECT container_id AS rack, preferred_rack_slot AS slot FROM parts WHERE id=$1', [id])).rows[0];
const outbound = (partId, quantityPcs) => ({ type: 'outbound', partId, quantityPcs });
const inbound = (partId, quantityPcs) => ({ type: 'inbound', partId, quantityPcs });
const fixtureSku = new Map();
const qc = (lotNumber, judgment, token = admin) => write('/inspections', { productCode: fixtureSku.get(lotNumber), lotNumber, judgment, sampleSize: 1, passQuantity: 1, failQuantity: 0 }, { token });

async function fixture(sku, lot, quantityPcs, days, rack = null, slot = null, category = 'noodles', createdAt, available = true) {
  const id = randomUUID();
  const expires = (await db.query("SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+$1::int)::text AS date", [days])).rows[0].date;
  const row = {
    ...template, id, created_at: createdAt || new Date().toISOString(), updated_at: new Date().toISOString(),
    part_name: 'SKU thử nghiệm ' + sku, product_code: run + '-' + sku, lot_number: run + '-' + lot,
    product_family: category, storage_class: 'dry_food', quantity_pcs: quantityPcs,
    carton_count: Math.ceil(quantityPcs / 10), total_weight_kg: quantityPcs,
    carton_length_mm: 100, carton_width_mm: 100, carton_height_mm: 100, cbm: Math.ceil(quantityPcs / 10) / 1000,
    expiration_date: expires, container_id: rack, preferred_rack_slot: slot,
  };
  await db.query('INSERT INTO parts SELECT (jsonb_populate_record(NULL::parts, $1::jsonb)).*', [JSON.stringify(row)]);
  fixtureSku.set(row.lot_number, row.product_code);
  if (available) {
    await db.query("INSERT INTO inspections (inspection_id, lot_number, lot_id, judgment, inspection_date) SELECT $1,$2,lot_id,'AVAILABLE',now() - interval '1 day' FROM parts WHERE id=$3",
      ['QA-FIXTURE-' + id, row.lot_number, id]);
  }
  return { id, lot: row.lot_number, sku: row.product_code };
}

function dropResponseAfterCommit(body, key) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request(apiBase.href + '/inventory/transactions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + admin, 'Idempotency-Key': key, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload) },
    }, response => {
      response.destroy();
      if (response.statusCode === 201) resolve();
      else reject(new Error('Expected committed HTTP 201 before dropping response, got ' + response.statusCode));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

async function runTests() {
  try {
    template = (await db.query('SELECT * FROM parts ORDER BY created_at LIMIT 1')).rows[0];
    rackType = (await db.query("SELECT id FROM container_types WHERE code='RACK20-A'")).rows[0].id;
    admin = await login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
    const staffEmail = 'qa-staff-' + run + '@example.invalid';
    const staffPassword = randomUUID();
    expectStatus(await write('/auth/users', { email: staffEmail, password: staffPassword, role: 'warehouse_staff' }), 201);
    staff = await login(staffEmail, staffPassword);
    const newZone = async (suffix, productFamily) => expectStatus(await write('/warehouse-zones', {
      warehouseCode: 'DENSO-WH', code: 'QA-' + run + '-' + suffix, name: 'QA ' + suffix, storageMode: 'ambient', productFamily,
    }), 201);
    const newRack = async (zone, name = 'R01') => expectStatus(await write('/racks', {
      rackTypeId: rackType, orderId: template.order_id, name, zoneCode: zone.code,
    }), 201);
    testZone = await newZone('NOODLES', 'noodles');
    testRack = await newRack(testZone);
    const part = await fixture('IDEMP', 'IDEMP', 100, 120, testRack.id, 0);
    for (const [count, parallel, type] of [[2, false, 'inbound'], [5, false, 'outbound'], [10, false, 'inbound'], [10, true, 'outbound']]) {
      await check('IDEMP-' + count + (parallel ? '-PAR' : ''), count + ' retries · ' + type, async () => {
        const before = await quantity(part.id);
        const logs = await ledgerCount(part.id);
        const body = { type, partId: part.id, quantityPcs: 2 };
        const key = randomUUID();
        const responses = [];
        if (parallel) responses.push(...await Promise.all(Array.from({ length: count }, () => transaction(body, key))));
        else for (let i = 0; i < count; i++) responses.push(await transaction(body, key));
        const records = responses.map(r => expectStatus(r, 201));
        for (const result of records) assert.deepEqual(result, records[0]);
        assert.equal(await quantity(part.id), before + (type === 'inbound' ? 2 : -2));
        assert.equal(await ledgerCount(part.id), logs + 1);
        return 'Một thay đổi tồn và một dòng sổ';
      });
    }
    await check('IDEMP-DIFFERENT', 'Hai key khác nhau và conflict payload cùng key', async () => {
      const old = await quantity(part.id);
      const key = randomUUID();
      const before = await ledgerCount(part.id);
      expectStatus(await transaction(inbound(part.id, 2), key), 201);
      expectStatus(await transaction(inbound(part.id, 2)), 201);
      assert.equal(expectStatus(await transaction(inbound(part.id, 3), key), 409).code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
      assert.equal(await quantity(part.id), old + 4);
      assert.equal(await ledgerCount(part.id), before + 2);
    });
    await check('IDEMP-DROP', 'Mất phản hồi sau commit', async () => {
      const old = await quantity(part.id);
      const before = await ledgerCount(part.id);
      const key = randomUUID();
      const body = inbound(part.id, 3);
      await dropResponseAfterCommit(body, key);
      assert.equal(await quantity(part.id), old + 3);
      expectStatus(await transaction(body, key), 201);
      assert.equal(await quantity(part.id), old + 3);
      assert.equal(await ledgerCount(part.id), before + 1);
    });
    await check('IDEMP-ROLLBACK', 'Rollback cả tồn, sổ và claim key khi vượt tải', async () => {
      const old = await quantity(part.id);
      const before = await ledgerCount(part.id);
      const key = randomUUID();
      expectStatus(await transaction({ ...inbound(part.id, 2), weightKg: 50_000 }, key), 400);
      assert.equal(await quantity(part.id), old);
      assert.equal(await ledgerCount(part.id), before);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM inventory_idempotency WHERE request_key=$1', [key])).rows[0].n, 0);
      expectStatus(await transaction(inbound(part.id, 2), key), 201);
    });

    const a = await fixture('FEFO', 'A', 30, 19, testRack.id, 1);
    const b = await fixture('FEFO', 'B', 50, 33, testRack.id, 2);
    const c = await fixture('FEFO', 'C', 100, 48, testRack.id, 3);
    const d = await fixture('FEFO', 'D', 40, 8, testRack.id, 4);
    const expired = await fixture('FEFO', 'EXPIRED', 25, -1, testRack.id, 5);
    expectStatus(await qc(d.lot, 'HOLD'), 201);
    expectStatus(await qc(a.lot, 'AVAILABLE'), 201);
    await check('FEFO-MULTI', 'Yêu cầu lô C, cấp phát A 30 + B 30 và bỏ qua HOLD/quá hạn', async () => {
      const key = randomUUID();
      const first = expectStatus(await transaction(outbound(c.id, 60), key), 201);
      assert.deepEqual(first.allocations.map(row => [row.partId, row.quantityPcs]), [[a.id, 30], [b.id, 30]]);
      assert.deepEqual(await Promise.all([a,b,c,d,expired].map(p => quantity(p.id))), [0,20,100,40,25]);
      assert.equal((await location(a.id)).rack, null);
      assert.deepEqual(expectStatus(await transaction(outbound(c.id, 60), key), 201), first);
      assert.deepEqual(await Promise.all([a,b,c,d,expired].map(p => ledgerCount(p.id))), [1,1,0,0,0]);
      return 'A 30, B 30; C 100, HOLD 40, quá hạn 25 giữ nguyên';
    });
    await check('FEFO-ROLLBACK', 'Tồn đủ điều kiện thiếu, từ chối toàn bộ', async () => {
      expectStatus(await transaction(outbound(c.id, 121)), 400);
      assert.deepEqual(await Promise.all([b,c].map(p => quantity(p.id))), [20,100]);
      assert.deepEqual(await Promise.all([b,c].map(p => ledgerCount(p.id))), [1,0]);
    });
    await check('FEFO-LEDGER-ROLLBACK', 'Lỗi ở dòng sổ thứ hai rollback cả hai lô và key', async () => {
      const key = randomUUID();
      const marker = 'QA-FAIL-' + run;
      const constraint = 'phase2_ledger_' + run;
      await db.query("ALTER TABLE inventory_transactions ADD CONSTRAINT " + constraint +
        " CHECK (part_id IS DISTINCT FROM '" + c.id + "'::uuid OR note IS DISTINCT FROM '" + marker + "') NOT VALID");
      try {
        expectStatus(await transaction({ ...outbound(c.id, 21), note: marker }, key), 500);
        assert.deepEqual(await Promise.all([b,c].map(p => quantity(p.id))), [20,100]);
        assert.deepEqual(await Promise.all([b,c].map(p => ledgerCount(p.id))), [1,0]);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM inventory_idempotency WHERE request_key=$1', [key])).rows[0].n, 0);
      } finally {
        await db.query('ALTER TABLE inventory_transactions DROP CONSTRAINT ' + constraint);
      }
    });
    await check('FEFO-TIE', 'Cùng HSD ưu tiên createdAt rồi ID', async () => {
      const older = await fixture('TIE', 'OLDER', 30, 21, testRack.id, 6, 'noodles', '2026-10-01T00:00:00Z');
      const newer = await fixture('TIE', 'NEWER', 30, 21, testRack.id, 7, 'noodles', '2026-10-02T00:00:00Z');
      assert.equal(expectStatus(await transaction(outbound(newer.id, 5)), 201).allocations[0].partId, older.id);
    });
    await check('FEFO-RACE', 'Hai tài khoản nhìn cùng tồn, không xuất vượt tồn', async () => {
      const first = await fixture('RACE', 'RACE-A', 10, 11, testRack.id, 8);
      const second = await fixture('RACE', 'RACE-B', 10, 12, testRack.id, 9);
      const responses = await Promise.all([
        transaction(outbound(first.id, 15)), transaction(outbound(second.id, 15), randomUUID(), staff),
      ]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201,400]);
      assert.equal((await quantity(first.id)) + (await quantity(second.id)), 5);
    });
    await check('QC-DIRECT', 'API chặn HOLD, BLOCKED, NG, REJECTED, EXPIRED và HSD quá hạn', async () => {
      const expected = [d, expired];
      for (const judgment of ['BLOCKED', 'NG', 'REJECTED', 'EXPIRED']) {
        const item = await fixture(judgment, 'QC-' + judgment, 15, 50);
        expectStatus(await qc(item.lot, judgment), 201);
        expected.push(item);
      }
      for (const item of expected) {
        const old = await quantity(item.id);
        const result = expectStatus(await transaction(outbound(item.id, 1)), 400);
        assert.equal(result.code, item.id === expired.id ? 'OUTBOUND_LOT_EXPIRED' : 'OUTBOUND_LOT_QC_BLOCKED');
        assert.equal(await quantity(item.id), old);
        assert.equal(await ledgerCount(item.id), 0);
      }
    });
    await check('QC-RELEASE', 'Nhân viên không thể release HOLD bằng phiếu mới hoặc PATCH, quản lý có audit', async () => {
      const hold = expectStatus(await qc(d.lot, 'HOLD'), 201);
      assert.equal(expectStatus(await qc(d.lot, 'AVAILABLE', staff), 403).code, 'QC_RELEASE_FORBIDDEN');
      expectStatus(await api('/inspections/' + hold.id, { method: 'PATCH', body: { judgment: 'AVAILABLE' }, token: staff }), 403);
      expectStatus(await api('/inspections/' + hold.id, { method: 'DELETE' }), 400);
      expectStatus(await qc(d.lot, 'AVAILABLE'), 201);
      const audit = await db.query("SELECT details FROM history_events WHERE type='inspection_changed' AND details->>'lotNumber'=$1", [d.lot]);
      assert(audit.rows.some(row => row.details.before === 'HOLD' && row.details.after === 'AVAILABLE' && row.details.actorId));
    });
    await check('QC-PENDING', 'Chờ QC bị chặn và HSD đúng ngày vẫn được xuất sau khi QC đạt', async () => {
      const pending = await fixture('PENDING', 'PENDING', 15, 0, null, null, 'noodles', undefined, false);
      assert.equal(expectStatus(await transaction(outbound(pending.id, 1)), 400).code, 'OUTBOUND_LOT_QC_PENDING');
      assert.equal(await quantity(pending.id), 15);
      expectStatus(await qc(pending.lot, 'OK', staff), 201);
      expectStatus(await transaction(outbound(pending.id, 1)), 201);
      assert.equal(await quantity(pending.id), 14);
    });
    await check('QC-DISPATCH', 'Phiếu giao không thể chuyển SHIPPED với lô BLOCKED', async () => {
      const target = await fixture('DISPATCH', 'DISPATCH', 15, 50);
      expectStatus(await qc(target.lot, 'BLOCKED'), 201);
      const draft = expectStatus(await write('/shipments', { shipmentNumber: 'QA-' + run, customerName: 'QA', itemNumber: target.sku,
        lotNumber: target.lot, shippedQuantity: 1, shipmentStatus: 'RELEASED' }), 201);
      assert.equal(expectStatus(await api('/shipments/' + draft.id, { method: 'PATCH', body: { shipmentStatus: 'SHIPPED' } }), 400).code,
        'SHIPMENT_LOT_QC_BLOCKED');
      assert.equal(expectStatus(await api('/shipments/' + draft.id), 200).shipmentStatus, 'RELEASED');
    });
    await check('QC-RACE', 'HOLD commit khi xuất đang chờ khóa, tồn không đổi', async () => {
      const target = await fixture('QC-RACE', 'QC-RACE', 15, 50);
      const blocker = new Client(connection);
      await blocker.connect();
      let pending;
      try {
        await blocker.query('BEGIN');
        await blocker.query("SELECT pg_advisory_xact_lock(hashtext('MASAN_WMS_LOT_QUALITY'), 0)");
        await blocker.query("INSERT INTO inspections (inspection_id, lot_number, lot_id, judgment) SELECT $1,$2,lot_id,'HOLD' FROM parts WHERE id=$3", ['QA-' + run, target.lot, target.id]);
        pending = transaction(outbound(target.id, 5));
        for (let i = 0; i < 100; i++) {
          const waiting = (await db.query("SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted AND mode='ShareLock' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) AS waiting")).rows[0].waiting;
          if (waiting) break;
          if (i === 99) throw new Error('Outbound did not wait for QC lock');
          await delay(100);
        }
        await blocker.query('COMMIT');
        assert.equal(expectStatus(await pending, 400).code, 'OUTBOUND_LOT_QC_BLOCKED');
        assert.equal(await quantity(target.id), 15);
      } finally {
        await blocker.end();
        await pending?.catch(() => {});
      }
    });
    await check('CATEGORY-RENAME', 'Đổi tên sản phẩm và Zone, SKU vẫn nhập được vào kệ cũ', async () => {
      const updated = expectStatus(await api('/parts/' + part.id, { method: 'PATCH', body: { partName: 'QA tên mới không chứa từ khóa' } }), 200);
      assert.equal(updated.productFamily, 'noodles');
      const zone = expectStatus(await api('/warehouse-zones/' + testZone.id, { method: 'PATCH', body: { name: 'QA tên Zone mới' } }), 200);
      assert.equal(zone.productFamily, 'noodles');
      expectStatus(await transaction(inbound(part.id, 1)), 201);
    });
    await check('CATEGORY-ZONE', 'Kệ trống sai nhóm, sản phẩm chưa phân loại và đổi zone đang có hàng', async () => {
      const coffeeZone = await newZone('COFFEE', 'coffee');
      const coffeeRack = await newRack(coffeeZone);
      const response = expectStatus(await transaction({ type: 'transfer', partId: part.id, toRackId: coffeeRack.id, toSlot: 0 }), 400);
      assert.equal(response.code, 'ZONE_PRODUCT_FAMILY_MISMATCH');
      const unknown = await fixture('UNKNOWN', 'UNKNOWN', 10, 20, null, null, null);
      assert.equal(expectStatus(await transaction({ ...inbound(unknown.id, 2), toRackId: testRack.id, toSlot: 10 }), 400).code, 'RACK_FAMILY_UNCLASSIFIED');
      expectStatus(await api('/warehouse-zones/' + testZone.id, { method: 'PATCH', body: { productFamily: 'coffee' } }), 400);
      assert.equal((await location(part.id)).rack, testRack.id);
    });
    await check('MOVE-RACE', 'Hai người chuyển cùng nguồn, một phiếu giữ nguyên tổng', async () => {
      const otherRack = await newRack(testZone, 'R02');
      const otherZone = await newZone('SAME-FAMILY', 'noodles');
      const thirdRack = await newRack(otherZone);
      const initial = await location(part.id);
      const qty = await quantity(part.id);
      const logs = await ledgerCount(part.id);
      const move = toRackId => ({ type: 'transfer', partId: part.id, toRackId, toSlot: 0, expectedFromRackId: initial.rack, expectedFromSlot: initial.slot });
      const responses = await Promise.all([transaction(move(otherRack.id)), transaction(move(thirdRack.id), randomUUID(), staff)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201,409]);
      assert.equal(await quantity(part.id), qty);
      assert.equal(await ledgerCount(part.id), logs + 1);
      const after = await location(part.id);
      assert.notEqual(after.rack, initial.rack);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM parts WHERE container_id=$1 AND preferred_rack_slot=$2', [initial.rack, initial.slot])).rows[0].n, 0);
      const key = randomUUID();
      const next = { ...move(after.rack === otherRack.id ? thirdRack.id : otherRack.id), expectedFromRackId: after.rack, expectedFromSlot: after.slot };
      const committed = expectStatus(await transaction(next, key), 201);
      assert.deepEqual(expectStatus(await transaction(next, key), 201), committed);
      assert.equal(await quantity(part.id), qty);
      assert.equal(await ledgerCount(part.id), logs + 2);
    });
    await check('MOVE-EMPTY', 'Lô đã xuất hết không điều chuyển được', async () => {
      expectStatus(await transaction({ type: 'transfer', partId: a.id, toRackId: testRack.id, toSlot: 15 }), 400);
      assert.equal(await quantity(a.id), 0);
    });
    await check('MOVE-CAPACITY', 'Điều chuyển vượt tải kệ đích rollback', async () => {
      const target = expectStatus(await write('/racks', {
        rackTypeId: rackType, orderId: template.order_id, name: 'R19', zoneCode: testZone.code, maxPayloadKgOverride: 1,
      }), 201);
      const old = await location(part.id);
      const logs = await ledgerCount(part.id);
      expectStatus(await transaction({ type: 'transfer', partId: part.id, toRackId: target.id, toSlot: 0 }), 400);
      assert.deepEqual(await location(part.id), old);
      assert.equal(await ledgerCount(part.id), logs);
    });
    await check('MOVE-GEOMETRY', 'Không chuyển carton lớn hơn ô 1 mm', async () => {
      const oversized = await fixture('OVERSIZED', 'OVERSIZED', 10, 120, testRack.id, 16);
      await db.query('UPDATE parts SET carton_length_mm=1301,carton_width_mm=900,carton_height_mm=722 WHERE id=$1', [oversized.id]);
      const response = expectStatus(await transaction({ type: 'transfer', partId: oversized.id, toRackId: testRack.id, toSlot: 17 }), 400);
      assert.equal(response.code, 'RACK_SLOT_CARTON_CAPACITY');
      assert.equal((await location(oversized.id)).slot, 16);
      assert.equal(await ledgerCount(oversized.id), 0);
    });
    await check('REG-RACK-INPUT', 'Thiếu và sai rackTypeId vẫn bị từ chối ở controller', async () => {
      const before = (await db.query('SELECT count(*)::int AS n FROM containers')).rows[0].n;
      const body = { orderId: template.order_id, name: 'R18', zoneCode: testZone.code };
      expectStatus(await write('/racks', body), 400);
      expectStatus(await write('/racks', { ...body, rackTypeId: 'invalid' }), 400);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM containers')).rows[0].n, before);
    });
    await check('REG-XLSX', 'Import có category ổn định, đổi cm thành mm và không nhân đôi khi gửi lại', async () => {
      const ExcelJS = require('../denso-wms-backend/node_modules/exceljs');
      const headers = { Authorization: 'Bearer ' + admin };
      const templateResponse = await fetch(apiBase.href + '/imports/template', { headers });
      assert.equal(templateResponse.status, 200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await templateResponse.arrayBuffer());
      const row = workbook.worksheets[0].getRow(2);
      row.getCell(1).value = 'QA-IMPORT-' + run;
      row.getCell(5).value = 'QA-SKU-IMPORT-' + run;
      const bytes = await workbook.xlsx.writeBuffer();
      const importFile = async dryRun => {
        const form = new FormData();
        form.append('file', new Blob([bytes]), 'phase2.xlsx');
        const response = await fetch(apiBase.href + '/imports/xlsx?dryRun=' + dryRun, { method: 'POST', headers, body: form });
        return { status: response.status, data: await response.json() };
      };
      const preview = expectStatus(await importFile(true), 201).orders[0].parts[0];
      assert.deepEqual([preview.cartonLengthMm, preview.cartonWidthMm, preview.cartonHeightMm, preview.productFamily], [450,380,160,'dry_food_other']);
      assert.equal(expectStatus(await importFile(false), 201).insertedPartCount, 1);
      assert.equal(expectStatus(await importFile(false), 201).duplicatePartsSkipped, 1);
    });
    await check('SOLVE-API', 'Solver kệ đang chứa hàng trả placement trong biên', async () => {
      const plan = expectStatus(await write('/storage/racks/' + testRack.id + '/solve', {}), 201);
      assert(plan.placements.length > 0);
      for (const p of plan.placements) {
        assert(p.xMm >= 0 && p.xMm + p.dxMm <= 6500);
        assert(p.yMm >= 0 && p.yMm + p.dyMm <= 900);
        assert(p.zMm >= 0 && p.zMm + p.dzMm <= 3000);
      }
      return plan.placements.length + ' placement hợp lệ theo kích thước';
    });
    await check('SOLVE-AUTOASSIGN', 'Tự phân bổ đồng thời giữ một PART mỗi ô và đúng nhóm', async () => {
      const order = expectStatus(await write('/orders', { orderNumber: 'QA-AUTO-' + run, division: 'PAV' }), 201);
      const rack = expectStatus(await write('/racks', { rackTypeId: rackType, orderId: order.id, name: 'R17', zoneCode: testZone.code }), 201);
      const matching = await fixture('AUTO-MATCH', 'AUTO-MATCH', 10, 20);
      const wrong = await fixture('AUTO-WRONG', 'AUTO-WRONG', 10, 20, null, null, 'coffee');
      await db.query('UPDATE parts SET order_id=$1 WHERE id IN ($2,$3)', [order.id, matching.id, wrong.id]);
      const results = await Promise.all(Array.from({ length: 2 }, () => write('/storage/racks/' + rack.id + '/auto-assign', {})));
      assert.deepEqual(results.map(result => expectStatus(result, 201).assignedCount).sort(), [0,1]);
      assert.equal((await location(matching.id)).rack, rack.id);
      assert.equal((await location(wrong.id)).rack, null);
    });
    await check('LIVE-DB-INVARIANTS', 'Không có tồn âm hoặc hai PART trong cùng ô', async () => {
      const result = await db.query('SELECT count(*)::int AS n FROM parts WHERE quantity_pcs<0 OR carton_count<0 OR total_weight_kg<0');
      assert.equal(result.rows[0].n, 0);
      const duplicates = await db.query('SELECT count(*)::int AS n FROM (SELECT 1 FROM parts WHERE container_id IS NOT NULL AND preferred_rack_slot IS NOT NULL GROUP BY container_id,preferred_rack_slot HAVING count(*)>1) d');
      assert.equal(duplicates.rows[0].n, 0);
    });
  } finally {
    await db.end();
  }
}

runTests().then(() => {
  if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
}).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
