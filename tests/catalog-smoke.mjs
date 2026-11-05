import assert from 'node:assert/strict';
import {
  MASAN_CATEGORIES, MASAN_BRAND_COUNT, MASAN_REFERENCE_PRODUCTS,
  normalizeCatalogText, countMatchingInventory,
} from '../denso-wms-frontend/src/lib/masanCatalog.js';

assert.equal(MASAN_CATEGORIES.length, 8, 'must have eight categories from the provided doc');
assert.equal(MASAN_BRAND_COUNT, 32, 'should list 32 brand entries');
assert.equal(MASAN_REFERENCE_PRODUCTS.length, 61, 'should have 61 reference product examples');
assert(MASAN_REFERENCE_PRODUCTS.every((p) => p.kind === 'stock'), 'service brands must never be warehouse SKUs');
assert(MASAN_CATEGORIES.find((cat) => cat.id === 'ban-le-dich-vu').brands.every((brand) => brand.products.length === 0));
assert.equal(normalizeCatalogText('Mì Kokomi Đại 90g'), 'mi kokomi dai 90g');
assert.equal(countMatchingInventory([{ partName: 'Mì Kokomi Đại 90g' }, { partName: 'Mì khác' }], 'Mi Kokomi Dai 90g'), 1);
console.log('Catalog smoke test: PASS (8 groups, 32 brand entries, 61 reference examples)');
