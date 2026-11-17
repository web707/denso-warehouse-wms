import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';


/** Business families are separate from STORAGE classes: coffee and noodles are both ambient/dry, but not the same rack. */
export const RACK_PRODUCT_FAMILIES = [
  'condiments', 'noodles', 'beverages', 'coffee', 'dry_food_other',
  'processed_food', 'chilled_food', 'produce', 'household',
] as const;
export type RackProductFamily = typeof RACK_PRODUCT_FAMILIES[number];

export const RACK_FAMILY_LABELS: Record<RackProductFamily, string> = {
  condiments: 'Gia vị & nước chấm', noodles: 'Mì, phở & thực phẩm tiện lợi',
  beverages: 'Đồ uống & nước khoáng', coffee: 'Cà phê & ngũ cốc',
  dry_food_other: 'Thực phẩm khô khác', processed_food: 'Thực phẩm chế biến',
  chilled_food: 'Thịt mát - kho lạnh', produce: 'Rau củ & nông sản',
  household: 'Hóa phẩm & chăm sóc gia đình',
};

export function familyFromStorageClass(value?: string | null): RackProductFamily | null {
  if (value === 'condiments' || value === 'beverages' || value === 'chilled_food' || value === 'produce' || value === 'household') return value;
  return null;
}

export async function lockSkuCategory(em: EntityManager, sku?: string | null): Promise<void> {
  const code = sku?.trim();
  if (code) await em.query("SELECT pg_advisory_xact_lock(hashtext('MASAN_WMS_SKU_CATEGORY'), hashtext($1))", [code]);
}

export async function resolveProductFamily(
  em: EntityManager, sku: string | null | undefined, requested: string | null | undefined, storageClass?: string, excludeId?: string,
): Promise<string | null> {
  if (!sku?.trim()) return requested || familyFromStorageClass(storageClass);
  await lockSkuCategory(em, sku);
  const rows: { product_family: string }[] = await em.query(
    `SELECT DISTINCT product_family FROM parts WHERE product_code = $1 AND product_family IS NOT NULL
     AND ($2::uuid IS NULL OR id <> $2)`, [sku.trim(), excludeId ?? null],
  );
  if (rows.length > 1 || (requested && rows.length && rows[0].product_family !== requested)) {
    throw new BadRequestException({ code: 'SKU_CATEGORY_CONFLICT', message: 'SKU đã có nhóm hàng khác. Hãy đối chiếu danh mục trước khi lưu.' });
  }
  return requested || rows[0]?.product_family || familyFromStorageClass(storageClass);
}

export interface RackPeer {
  partName: string;
  storageClass?: string | null;
  productFamily?: string | null;
  productCode?: string | null;
  quantityPcs?: number;
  cartonCount?: number;
  totalWeightKg?: string | number;
}

export function assertSingleRackSku(productCode: string | null | undefined, peers: RackPeer[], rackName: string): void {
  if (process.env.WMS_ONE_SKU_PER_RACK !== 'true') return;
  const sku = productCode?.trim();
  if (!sku) throw new BadRequestException({ code: 'RACK_SKU_REQUIRED', message: 'Cần mã SKU trước khi xếp vào kệ.' });
  const conflict = peers.some(part =>
    (Number(part.quantityPcs) > 0 || Number(part.cartonCount) > 0 || Number(part.totalWeightKg) > 0)
    && part.productCode?.trim() !== sku);
  if (conflict) throw new BadRequestException({
    code: 'RACK_SKU_MISMATCH', message: `${rackName} đang chứa SKU khác hoặc hàng chưa có mã SKU. Hãy chọn kệ trống hoặc kệ cùng SKU.`,
  });
}
export function assertRackProductFamily(args: {
  rackFamily?: string | null;
  peers: RackPeer[];
  productName: string;
  productCode?: string | null;
  productFamily?: string | null;
  zoneFamily?: string | null;
  rackName?: string;
}): RackProductFamily {
  const incoming = args.productFamily as RackProductFamily | null | undefined;
  const rackName = args.rackName || 'kệ';
  if (!incoming || !RACK_PRODUCT_FAMILIES.includes(incoming)) throw new BadRequestException({
    code: 'RACK_FAMILY_UNCLASSIFIED',
    message: `Không xác định được nhóm hàng của ${args.productName}. Hãy xác nhận nhóm hàng của SKU trước khi xếp vào ${rackName}.`,
  });
  if (args.zoneFamily && args.zoneFamily !== incoming) throw new BadRequestException({
    code: 'ZONE_PRODUCT_FAMILY_MISMATCH',
    message: `Nhóm hàng của ${args.productName} không được phép lưu trong Zone đích.`,
  });
  if (args.rackFamily && args.rackFamily !== incoming) throw new BadRequestException({
    code: 'RACK_FAMILY_MISMATCH',
    message: `${rackName} dành cho “${RACK_FAMILY_LABELS[args.rackFamily as RackProductFamily] || args.rackFamily}”, không thể đưa “${args.productName}” vào. Hãy chọn kệ cùng chủ đề.`,
  });
  const families = new Set(args.peers.map((p) => p.productFamily || 'unknown'));
  if (families.size && (families.size > 1 || !families.has(incoming))) throw new BadRequestException({
    code: 'RACK_FAMILY_MIXED',
    message: `${rackName} đang chứa hàng khác chủ đề hoặc chưa phân loại. Phải điều chuyển/kiểm tra hàng cũ trước khi nhập ${args.productName}.`,
  });
  if ('productCode' in args) assertSingleRackSku(args.productCode, args.peers, rackName);
  return incoming;
}

export function getRackFamilyDisplay(args: { rackFamily?: string | null; peers: RackPeer[] }) {
  const family = new Set(args.peers.map((p) => p.productFamily || 'unknown'));
  if (family.size > 1 || family.has('unknown')) return 'mixed';
  return args.rackFamily || (family.size === 1 ? [...family][0] : null);
}

/** Keeping family labels and zone storage modes separate prevents cold/chemical families in an ambient food zone. */
export function rackFamilyStorageMode(family: string | null | undefined): 'ambient' | 'chilled' | 'produce' | 'household' | null {
  if (!family) return null;
  if (family === 'chilled_food') return 'chilled';
  if (family === 'produce') return 'produce';
  if (family === 'household') return 'household';
  return 'ambient';
}
