import { assertRackProductFamily, classifyRackFamily, getRackFamilyDisplay } from './rack-product-family.rules';

describe('Rack product family / one rack one theme', () => {
  test('fish sauce & chili sauce share a condiments rack', () => {
    expect(classifyRackFamily('Nước mắm Nam Ngư', 'condiments')).toBe('condiments');
    expect(assertRackProductFamily({
      rackFamily: 'condiments',
      peers: [{ partName:'Nước mắm CHIN-SU', storageClass: 'condiments' }],
      productName: 'Sa tế CHIN-SU', productClass: 'condiments', rackName:'R01',
    })).toBe('condiments');
  });
  test('different noodles can share R02', () => {
    expect(assertRackProductFamily({ rackFamily:'noodles', peers:[{partName:'Mì Omachi vị bò hầm',storageClass:'dry_food'}], productName:'Mì Kokomi tôm chua cay', productClass:'dry_food' })).toBe('noodles');
  });
  test('reject fish sauce into noodle rack, even if both ambient', () => {
    expect(() => assertRackProductFamily({ rackFamily:'noodles', peers:[], productName:'Nước mắm Nam Ngư', productClass:'condiments' })).toThrow();
  });
  test('coffee does not mix with noodles (both dry_food)', () => {
    expect(classifyRackFamily('Vinacafé Gold', 'dry_food')).toBe('coffee');
    expect(() => assertRackProductFamily({ peers:[{ partName:'Mì Omachi', storageClass:'dry_food' }], productName:'Vinacafé Gold', productClass:'dry_food' })).toThrow();
  });
  test('reject legacy mixed rack instead of silently changing old locations', () => {
    expect(getRackFamilyDisplay({ peers:[{partName:'Mì Omachi'},{partName:'Nước mắm Nam Ngư'}] })).toBe('mixed');
  });
  test('family of an empty rack is given by its configuration', () => {
    expect(getRackFamilyDisplay({rackFamily:'beverages',peers:[]})).toBe('beverages');
    expect(classifyRackFamily('Nước tăng lực Wake-Up 247','beverages')).toBe('beverages');
  });
  test('reject unclassified item for physical rack', () => {
    expect(() => assertRackProductFamily({ peers:[], productName:'Mặt hàng chưa có danh mục', productClass:'unknown' })).toThrow();
  });
});
