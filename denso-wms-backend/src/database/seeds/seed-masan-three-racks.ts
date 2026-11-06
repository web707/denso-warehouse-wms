/**
 * Minimal one-zone UI demo: R01 fish sauce & condiments, R02 noodles, R03 soft drinks.
 * It is additive & idempotent: no deletes, no resets, no updates to real stock.
 * Requires separate TEST DB name + explicit two-step confirmation.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import AppDataSource from '../../config/data-source';
import { Order } from '../../orders/entities/order.entity';
import { Part } from '../../parts/entities/part.entity';
import { Division } from '../../divisions/entities/division.entity';
import { DcPrefix } from '../../divisions/entities/dc-prefix.entity';
import { Container } from '../../containers/entities/container.entity';
import { ContainerType } from '../../container-types/entities/container-type.entity';
import { WarehouseZone } from '../../warehouse-zones/entities/warehouse-zone.entity';
import { nextPartColor } from '../../parts/constants/part-colors';
import { classifyRackFamily } from '../../inventory/rack-product-family.rules';

loadEnv();
const DEMO_ZONE = 'ZONE-TEST-3R';
const DEMO_ORDER = 'MASAN-TEST-3RACKS-2026';
const WAREHOUSE_CODE = 'DENSO-WH'; // Existing relational DB key, not displayed branding.
const GROUPS = [
  { rack: 'R01', group: 'condiments', family: 'condiments', names: ['Nước mắm Nam Ngư', 'Nước mắm CHIN-SU', 'Nam Ngư Nhãn Vàng', 'Nam Ngư Đệ Nhất'] },
  { rack: 'R02', group: 'dry_food', family: 'noodles', names: ['Mì Omachi xốt bò hầm','Mì Omachi sườn hầm','Mì Kokomi vị tôm chua cay','Kokomi Đại 90g'] },
  { rack: 'R03', group: 'beverages', family: 'beverages', names: ['Nước tăng lực Wake-Up 247', 'Nước giải khát Lemona', 'Nước tăng lực Compact','Nước khoáng Vĩnh Hảo'] },
] as const;

const preview = () => {
  console.log('ONE ZONE / THREE RACKS DEMO (NO DB WRITE IN PREVIEW)');
  console.log('Zone:', DEMO_ZONE, '| R01: 20 lots nước mắm | R02: 20 lots mì tôm | R03: 20 lots đồ uống');
  console.log('60 PART / 60 occupied slots. Each lot has a fake 2027-2028 expiration date.');
  console.log('NO deletion, NO modification of existing stock; refuse collisions.');
  console.log('To write: use the interactive SEED_MASAN_1_ZONE_3_RACKS.bat on a TEST DB only.');
};

async function main() {
  preview();
  if (!process.argv.includes('--apply-three-racks')) return;
  const db = String(process.env.DB_NAME || '').toLowerCase();
  if (process.env.NODE_ENV === 'production' || !/(test|demo)/.test(db)
      || process.env.MASAN_THREE_RACK_SEED !== 'YES') {
    throw new Error('REFUSED: DB_NAME must contain test/demo, NODE_ENV must not be production, and MASAN_THREE_RACK_SEED=YES is required.');
  }
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (em) => {
      const orders=em.getRepository(Order), parts=em.getRepository(Part), racks=em.getRepository(Container), zones=em.getRepository(WarehouseZone);
      let order=await orders.findOne({where:{orderNumber:DEMO_ORDER}});
      if(order && order.division !== 'MASAN-DEMO-ONLY') throw new Error('Order ID collision with non-demo row');
      if(!order) order=await orders.save(orders.create({orderNumber:DEMO_ORDER,name:'[TEST] 1 Zone · 3 kệ đầy',division:'MASAN-DEMO-ONLY',destination:'TEST-ONLY'}));
      const division=await em.getRepository(Division).findOne({where:{code:'HG'}});
      const dc=division && await em.getRepository(DcPrefix).findOne({where:{divisionId:division.id,code:'10'}});
      const rackType=await em.getRepository(ContainerType).findOne({where:{code:'RACK20-A'}});
      if(!division||!dc||!rackType) throw new Error('Missing HG/10 or RACK20-A; seed base configuration first.');
      let zone=await zones.findOne({where:{warehouseCode:WAREHOUSE_CODE,code:DEMO_ZONE}});
      if(zone && (!zone.name.startsWith('[TEST]')||zone.storageMode!=='ambient')) throw new Error('Zone exists but is not our ambient [TEST] zone');
      if(!zone) zone=await zones.save(zones.create({warehouseCode:WAREHOUSE_CODE,code:DEMO_ZONE,name:'[TEST] Một Zone · 3 kệ mẫu',storageMode:'ambient',description:'KHÔNG PHẢI TỒN KHO THẬT',active:true}));
      let created=0, skipped=0;
      for(const group of GROUPS){
        const found=await racks.find({where:{warehouseCode:WAREHOUSE_CODE,zoneCode:DEMO_ZONE,name:group.rack}});
        if(found.length>1) throw new Error(`${group.rack} duplicated; abort`);
        let rack=found[0];
        if(rack && rack.orderId!==order.id) throw new Error(`${group.rack} belongs to other order; abort`);
        if(rack && rack.productFamily && rack.productFamily !== group.family) throw new Error(`${group.rack} already assigned to another product family; refuse to overwrite`);
        if(!rack) rack=await racks.save(racks.create({orderId:order.id,name:group.rack,warehouseCode:WAREHOUSE_CODE,zoneCode:DEMO_ZONE,productFamily:group.family,containerTypeId:rackType.id,maxCbmOverride:'17.550',maxPayloadKgOverride:'2000'}));
        const current=await parts.find({where:{containerId:rack.id}});
        if(current.some(p=>classifyRackFamily(p.partName,p.storageClass)!==group.family)) throw new Error(`${group.rack} has old/mixed product groups: refuse to rewrite stock`);
        const occupied=new Map(current.filter((part)=>part.preferredRackSlot!==null).map((part)=>[part.preferredRackSlot,part]));
        for(let i=0;i<20;i++){
          const productCode=`MASAN-TEST-3R-${group.rack}-${String(i+1).padStart(2,'0')}`;
          const lotNumber=`TEST-3R-${group.rack}-${String(i+1).padStart(2,'0')}`;
          const existing=await parts.findOne({where:{productCode,lotNumber}});
          if(existing){
            if(classifyRackFamily(existing.partName, existing.storageClass)!==group.family) throw new Error(`Old demo layout found (${group.rack}): seed will not overwrite old inventory. Use a fresh TEST database or manually migrate old demo racks.`);
            if(existing.containerId!==rack.id || existing.preferredRackSlot!==i || existing.orderId!==order.id) throw new Error(`Existing demo product moved: ${productCode}; refuse to overwrite`);
            skipped++;continue;
          }
          if(occupied.has(i)) throw new Error(`${group.rack}/S${i+1} occupied by other product; abort`);
          const name=group.names[i % group.names.length];
          const cartonCount=8, quantityPcs=cartonCount*24, totalWeightKg=12.0;
          // Deterministic fictional HSD; multiple lots allow FEFO sorting.
          const month=String(1+(i%12)).padStart(2,'0'); const year=i<12?2027:2028;
          const createdPart = await parts.save(parts.create({
            orderId:order.id,partName:name,productCode,divisionId:division.id,dcPrefixId:dc.id,
            masterPo:`MASAN-3R-PO-${group.rack}`,quantityPcs,totalWeightKg:totalWeightKg.toFixed(2),cartonCount,
            cartonLengthMm:350,cartonWidthMm:260,cartonHeightMm:230,cbm:(.35*.26*.23*cartonCount).toFixed(6),
            containerId:rack.id,preferredRackSlot:i,colorHex:nextPartColor(i+created),
            storageClass:group.group,lotNumber,expirationDate:`${year}-${month}-15`,uomCode:'EA',
            unitCost:null,supplierName:'[TEST] NCC minh họa',supplierId:null,supplierSiteCode:'DEMO',
          }));
          occupied.set(i,createdPart);created++;
        }
      }
      const allDemo=await parts.find({where:{orderId:order.id}});
      if(allDemo.length!==60) throw new Error(`Unexpected lot count ${allDemo.length} in dedicated demo order (expected 60).`);
      console.log(`SUCCESS: ${created} PART inserted, ${skipped} already present. Zone ${DEMO_ZONE} has 3 physical racks × 20 slots.`);
    });
  } finally {await AppDataSource.destroy();}
}
main().catch((err)=>{console.error('TEST DEMO ERROR / TRANSACTION ROLLBACK:',err?.message||err);process.exitCode=1;});
