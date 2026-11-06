/** No-dependency regression checks for Test 3 UI occupancy and demo contract.
 * Run: node tests/verify_test3_core.cjs
 * Full NestJS/Postgres/WebGL integration requires deployed dependencies.
 */
const fs = require('fs');
const assert = require('assert');
const path=require('path');
const root=path.join(__dirname,'..');
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const spec={bays:5,levels:4,slotCount:20,bayWidthMm:1300,levelHeightMm:750,depthMm:900,shelfThicknessMm:28};
const source=read('denso-wms-frontend/src/lib/viz/rackInventoryView.js');
const moduleCode=source.replace(/import \{ RACK_SPEC \} from '\.\/rackLayout';/,`const RACK_SPEC=${JSON.stringify(spec)};`).replace(/export function/g,'function');
const {rackInventoryView} = new Function(`${moduleCode}\nreturn {rackInventoryView};`)();
const test=(name,fn)=>{fn();console.log('PASS',name);};
const part=(i,overrides={})=>({id:`part-${i}`,partName:'Mì Omachi',productCode:`SKU-${i}`,quantity:100,cartons:8,weight:12,preferredRackSlot:i,...overrides});
test('R08: 1 PART at S17 -> exactly one occupied physical slot',()=>{
 const r=rackInventoryView([part(16)]);
 assert.strictEqual(r.usedSlots,1);assert.strictEqual(r.placements.length,1);
 assert.strictEqual(r.slots[16].placements[0].rackSlotCode,'S17');
 assert.strictEqual(r.slots[16].placements[0].cartonCount,8);
});
test('R01 R02 R03: all 20 slots occupied with 20 PART each',()=>{
 for(let rack=1;rack<=3;rack++){
  const r=rackInventoryView(Array.from({length:20},(_,i)=>part(i,{id:`r${rack}-p${i}`})));
  assert.strictEqual(r.usedSlots,20);assert.strictEqual(r.placements.length,20);
  assert.strictEqual(r.unassigned.length,0);
 }
});
test('Old PART with no slot must be reported, not placed randomly',()=>{
 const r=rackInventoryView([part(10,{preferredRackSlot:null})]);
 assert.strictEqual(r.usedSlots,0);assert.strictEqual(r.unassigned.length,1);
});
test('Two lots with the same named SKU occupy different assigned slots',()=>{
 const r=rackInventoryView([part(0),part(9)]);assert.strictEqual(r.usedSlots,2);
});
test('The zone renderer uses the shared data model',()=>{
 const f=read('denso-wms-frontend/src/components/viz/WarehouseScene3D.jsx');
 assert(f.includes('rackInventoryView(parts)'));assert(!f.includes('function colorFor'));
});
test('Rack detail uses the same data model, not solver-derived placements',()=>{
 const f=read('denso-wms-frontend/src/pages/RackPlan.jsx');
 assert(f.includes('rackInventoryView(rackParts)'));
});
test('Create PART + requested rack are a database transaction',()=>{
 const f=read('denso-wms-backend/src/parts/parts.service.ts');
 assert(f.includes('this.dataSource.transaction(async (em) => {'));
 assert(f.includes('await em.save(HistoryEvent'));
});
test('One-zone script: 3 groups and 20 slots each',()=>{
 const f=read('denso-wms-backend/src/database/seeds/seed-masan-three-racks.ts');
 assert(f.includes("rack: 'R01'"));assert(f.includes("rack: 'R02'"));assert(f.includes("rack: 'R03'"));
 assert(f.includes('i<20'));assert(f.includes("process.env.MASAN_THREE_RACK_SEED !== 'YES'"));
});
console.log('ALL 8 TEST-3 CORE CHECKS PASSED');
