import { ContainerDims, SolverPart } from '../domain/types';
import { solve } from './solve';

const container: ContainerDims = {
  internalLengthMm: 100,
  internalWidthMm: 100,
  internalHeightMm: 100,
  doorHeightMm: null,
  maxCbm: 1,
  maxPayloadKg: 1000,
};

const part: SolverPart = {
  id: 'part-1',
  partName: 'PART 1',
  masterPo: '1',
  divisionSortOrder: 1,
  dcPrefixSortOrder: 1,
  dcPrefixCode: 'DC',
  divisionCode: 'D1',
  cartonCount: 1,
  cartonLengthMm: 100,
  cartonWidthMm: 100,
  cartonHeightMm: 100,
  totalWeightKg: 12,
  colorHex: '#000000',
};

describe('solve', () => {
  const rack: ContainerDims = {
    ...container, internalLengthMm: 6500, internalWidthMm: 900, internalHeightMm: 3000,
    maxCbm: 17.55, maxPayloadKg: 10000,
  };

  it.each([
    [1299, 899, 721, 1],
    [1300, 900, 722, 1],
    [1301, 900, 722, 0],
  ])('bounds the carton %i×%i×%i mm to one physical slot', (cartonLengthMm, cartonWidthMm, cartonHeightMm, placements) => {
    const result = solve([{ ...part, cartonLengthMm, cartonWidthMm, cartonHeightMm }], rack);
    expect(result.placements).toHaveLength(placements);
    if (!placements) expect(result.violations.some(v => v.severity === 'error')).toBe(true);
  });

  it.each([[500, 1], [500.01, 0]])('checks %s kg against the slot limit', (totalWeightKg, placements) => {
    expect(solve([{ ...part, totalWeightKg }], rack).placements).toHaveLength(placements);
  });

  it('counts only placed cartons when multiple parts compete for the configured weight/volume', () => {
    const result = solve([{ ...part, totalWeightKg: 0.1 }, { ...part, id: 'part-2', totalWeightKg: 0.2 },
      { ...part, id: 'part-3', totalWeightKg: 0.1 }], { ...rack, maxPayloadKg: 0.3, maxCbm: 0.002 });
    expect(result.placements).toHaveLength(2);
    expect(result.cbmUsed).toBeCloseTo(0.002, 9); // Two 100 mm cubes.
    expect(result.weightUsedKg).toBeCloseTo(0.3, 9);
    expect(result.violations.some(v => v.severity === 'error')).toBe(true);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid carton dimensions %s', cartonLengthMm => {
    const result = solve([{ ...part, cartonLengthMm }], rack);
    expect(result.placements).toHaveLength(0);
    expect(result.weightUsedKg).toBe(0);
    expect(result.violations[0].code).toBe('CARTON_INVALID');
  });

  it('does not allow rotation to bypass configured geometry', () => {
    const result = solve([{ ...part, cartonLengthMm: 46, cartonWidthMm: 38, cartonHeightMm: 21 }], {
      ...container, internalLengthMm: 50, internalWidthMm: 20, internalHeightMm: 40,
    });
    expect(result.placements).toHaveLength(0);
    expect(result.violations[0].code).toBe('CARTON_TOO_LARGE');
  });

  it('reports an invalid rack configuration instead of returning a successful empty plan', () => {
    const result = solve([part], { ...rack, maxPayloadKg: NaN });
    expect(result.placements).toHaveLength(0);
    expect(result.violations[0].code).toBe('RACK_CONFIGURATION_INVALID');
  });
  it('ch? b�o CBM v� tr?ng lu?ng c?a carton d� du?c x?p', () => {
    const tooShort: ContainerDims = { ...container, internalLengthMm: 99 };

    const result = solve([part], tooShort);

    expect(result.placements).toHaveLength(0);
    expect(result.cbmUsed).toBe(0);
    expect(result.weightUsedKg).toBe(0);
    expect(result.violations[0]).toMatchObject({ code: 'CARTON_TOO_LARGE', partId: part.id });
  });

  it('v?n nh?n carton ch? fit du?c khi ho�n v? d? 3 chi?u', () => {
    const result = solve([{ ...part, cartonLengthMm: 45, cartonWidthMm: 38, cartonHeightMm: 16 }], {
      ...container,
      internalLengthMm: 50,
      internalWidthMm: 20,
      internalHeightMm: 40,
    });

    expect(result.placements).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });
});
