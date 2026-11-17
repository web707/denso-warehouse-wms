import { assertRackProductFamily, familyFromStorageClass, getRackFamilyDisplay } from './rack-product-family.rules';

describe('Rack product family / one rack one theme', () => {
  test('fish sauce & chili sauce share a condiments rack', () => {
    expect(familyFromStorageClass('condiments')).toBe('condiments');
    expect(assertRackProductFamily({
      rackFamily: 'condiments',
      peers: [{ partName:'Nước mắm CHIN-SU', productFamily: 'condiments' }],
      productName: 'Sa tế CHIN-SU', productFamily: 'condiments', rackName:'R01',
    })).toBe('condiments');
  });
  test('different noodles can share R02', () => {
    expect(assertRackProductFamily({ rackFamily:'noodles', peers:[{partName:'Mì Omachi vị bò hầm',productFamily:'noodles'}], productName:'SKU được đổi tên', productFamily:'noodles' })).toBe('noodles');
  });
  test('reject fish sauce into noodle rack, even if both ambient', () => {
    expect(() => assertRackProductFamily({ rackFamily:'noodles', peers:[], productName:'Nước mắm Nam Ngư', productFamily:'condiments' })).toThrow();
  });
  test('coffee does not mix with noodles (both dry_food)', () => {
    expect(familyFromStorageClass('dry_food')).toBeNull();
    expect(() => assertRackProductFamily({ peers:[{ partName:'Mì Omachi', productFamily:'noodles' }], productName:'Vinacafé Gold', productFamily:'coffee' })).toThrow();
  });
  test('reject legacy mixed rack instead of silently changing old locations', () => {
    expect(getRackFamilyDisplay({ peers:[{partName:'Mì Omachi'},{partName:'Nước mắm Nam Ngư'}] })).toBe('mixed');
  });
  test('family of an empty rack is given by its configuration', () => {
    expect(getRackFamilyDisplay({rackFamily:'beverages',peers:[]})).toBe('beverages');
    expect(familyFromStorageClass('beverages')).toBe('beverages');
  });
  test('reject unclassified item for physical rack', () => {
    expect(() => assertRackProductFamily({ peers:[], productName:'Mì Kokomi' })).toThrow();
  });
  test('zone category is enforced even if the target rack is empty and unrestricted', () => {
    expect(() => assertRackProductFamily({ zoneFamily: 'coffee', peers: [], productName: 'SKU 001', productFamily: 'noodles' })).toThrow();
  });
});
