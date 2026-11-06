import { BadRequestException } from '@nestjs/common';

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

export function classifyRackFamily(productName: string, storageClass?: string | null): RackProductFamily | null {
  const text = String(productName || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  // Product specific keywords must precede broad category fallbacks.
  if (/(vinacafe|ca phe|coffee|wake.up sai gon|ngu coc|b.fast)/.test(text)) return 'coffee';
  if (/(omachi|kokomi|\bmi\b|\bpho\b|\bbun\b|\bmien\b|banh da|chinsu story|hi.fresh|lau tu soi)/.test(text)) return 'noodles';
  if (/(ponnie|heo cao boi|xuc xich|thit vien snack)/.test(text)) return 'processed_food';
  if (/(nuoc mam|nuoc tuong|tuong ot|tuong ca|hat nem|sa te|gia vi|mayonnaise|nam ngu|tam thai tu|chinsu|chin.su)/.test(text)) return 'condiments';
  if (/(wake.up 247|compact|enerz|lemona|bupnon|vinh hao|vivant|quang hanh|nuoc khoang|nuoc tang luc|nuoc ngot|tra dong chai)/.test(text)) return 'beverages';
  if (/(meatdeli|thit mat|thit heo mat|thit lon mat|thit bo mat)/.test(text)) return 'chilled_food';
  if (/(wineco|rau cu|rau mam|nam tuoi|trai cay)/.test(text)) return 'produce';
  if (/(super ?net|\bnet\b|sopa|bot giat|nuoc giat|nuoc lau san|nuoc rua chen|nuoc xa vai|chante|joins)/.test(text)) return 'household';
  switch (storageClass) {
    case 'condiments': return 'condiments'; case 'beverages': return 'beverages';
    case 'dry_food': return 'dry_food_other'; case 'chilled_food': return 'chilled_food';
    case 'produce': return 'produce'; case 'household': return 'household';
    default: return null;
  }
}

export interface RackPeer { partName: string; storageClass?: string | null; }
export function assertRackProductFamily(args: {
  rackFamily?: string | null;
  peers: RackPeer[];
  productName: string;
  productClass?: string | null;
  rackName?: string;
}): RackProductFamily {
  const incoming = classifyRackFamily(args.productName, args.productClass);
  const rackName = args.rackName || 'kệ';
  if (!incoming) throw new BadRequestException({
    code: 'RACK_FAMILY_UNCLASSIFIED',
    message: `Không xác định được nhóm hàng của ${args.productName}. Hãy kiểm tra tên sản phẩm/nhóm bảo quản trước khi xếp vào ${rackName}.`,
  });
  if (args.rackFamily && args.rackFamily !== incoming) throw new BadRequestException({
    code: 'RACK_FAMILY_MISMATCH',
    message: `${rackName} dành cho “${RACK_FAMILY_LABELS[args.rackFamily as RackProductFamily] || args.rackFamily}”, không thể đưa “${args.productName}” vào. Hãy chọn kệ cùng chủ đề.`,
  });
  const families = new Set(args.peers.map((p) => classifyRackFamily(p.partName, p.storageClass) || 'unknown'));
  if (families.size && (families.size > 1 || !families.has(incoming))) throw new BadRequestException({
    code: 'RACK_FAMILY_MIXED',
    message: `${rackName} đang chứa hàng khác chủ đề hoặc chưa phân loại. Phải điều chuyển/kiểm tra hàng cũ trước khi nhập ${args.productName}.`,
  });
  return incoming;
}

export function getRackFamilyDisplay(args: { rackFamily?: string | null; peers: RackPeer[] }) {
  const family = new Set(args.peers.map((p) => classifyRackFamily(p.partName, p.storageClass) || 'unknown'));
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
