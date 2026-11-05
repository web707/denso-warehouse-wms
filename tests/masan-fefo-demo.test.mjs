import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const data = JSON.parse(readFileSync(new URL('../denso-wms-backend/src/database/seeds/masan-fefo-demo.json', import.meta.url), 'utf8'));
const validClasses = new Set(['dry_food','condiments','beverages','chilled_food','produce','household']);
const sku = new Map();
const keys = new Set();
for (const p of data.newParts) {
  assert.ok(validClasses.has(p.storageClass), `class: ${p.partName}`);
  assert.ok(!keys.has(`${p.productCode}|${p.lotNumber}`), `duplicate: ${p.lotNumber}`);
  keys.add(`${p.productCode}|${p.lotNumber}`);
  assert.match(p.expirationDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isNaN(Date.parse(`${p.expirationDate}T00:00:00Z`)),false);
  assert.ok(p.quantityPcs >= p.cartonCount && p.cartonCount > 0 && p.totalWeightKg > 0);
  if (!sku.has(p.productCode)) sku.set(p.productCode,new Set());
  sku.get(p.productCode).add(p.expirationDate);
}
test('Full Masan 61-SKU reference stock catalog included; retail services excluded',()=>{
  assert.equal(sku.size,61);
  assert.equal(data.newParts.length,88);
  assert.ok(data.newParts.every(x=>x.productCode.startsWith('MASAN-TEST-')));
});
test('FEFO prioritization can be tested across multiple lots of same SKU',()=>{
  assert.ok([...sku.values()].filter(s=>s.size>=2).length>=20);
});
test('Expired, near-expiry and good-stock test cases all exist',()=>{
  const d='2026-11-05';
  assert.ok(data.newParts.some(x=>x.expirationDate<d));
  assert.ok(data.newParts.some(x=>x.expirationDate>=d && x.expirationDate<='2026-12-05'));
  assert.ok(data.newParts.some(x=>x.expirationDate>='2027-01-01'));
});
test('Existing 15 demo rows only are whitelisted for repair',()=>{
  assert.equal(data.legacyUpdates.length,15);
  assert.ok(data.legacyUpdates.every(x=>/^MASAN-DEMO-\d{3}$/.test(x.productCode)));
});
test('Each demo lot has an expiry and a confirmed storage class',()=>{
  assert.ok(data.newParts.every(x=>x.expirationDate && validClasses.has(x.storageClass)));
  assert.ok(data.legacyUpdates.every(x=>x.expirationDate && validClasses.has(x.storageClass)));
});
