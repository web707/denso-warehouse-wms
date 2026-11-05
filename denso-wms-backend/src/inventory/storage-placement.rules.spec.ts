import { assertStoragePlacement, requiredStorageMode, suggestStorageClass } from './storage-placement.rules';

describe('Masan storage segregation', () => {
  it('recognises examples without confusing ready-to-eat sausage with chilled meat', () => {
    expect(suggestStorageClass('Mì Omachi Xốt bò hầm')).toBe('dry_food');
    expect(suggestStorageClass('Nước mắm Nam Ngư')).toBe('condiments');
    expect(suggestStorageClass('Nước lau sàn NET')).toBe('household');
    expect(suggestStorageClass('MEATDeli thịt heo mát')).toBe('chilled_food');
    expect(suggestStorageClass('Xúc xích Ponnie')).toBe('dry_food');
    expect(suggestStorageClass('Hàng lạ chưa rõ')).toBe('unknown');
  });
  it('requires the right zone', () => {
    expect(requiredStorageMode('chilled_food')).toBe('chilled');
    expect(() => assertStoragePlacement({ productClass: 'chilled_food', zoneMode: 'ambient', rackClasses: [] })).toThrow();
    expect(() => assertStoragePlacement({ productClass: 'household', zoneMode: 'ambient', rackClasses: [] })).toThrow();
    expect(() => assertStoragePlacement({ productClass: 'condiments', zoneMode: 'ambient', rackClasses: ['dry_food'] })).toThrow();
    expect(() => assertStoragePlacement({ productClass: 'condiments', zoneMode: 'ambient', rackClasses: ['condiments'] })).not.toThrow();
    expect(() => assertStoragePlacement({ productClass: 'unknown', zoneMode: 'ambient', rackClasses: [] })).toThrow();
  });
});
