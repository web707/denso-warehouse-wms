import { BadRequestException } from '@nestjs/common';

export const STORAGE_CLASSES = [
  'unknown', 'dry_food', 'condiments', 'beverages', 'chilled_food', 'produce', 'household',
] as const;
export const STORAGE_MODES = ['ambient', 'chilled', 'produce', 'household'] as const;
export type StorageClass = typeof STORAGE_CLASSES[number];
export type StorageMode = typeof STORAGE_MODES[number];

/** Hint for catalog examples only. Staff must confirm the real packaging/storage label. */
export function suggestStorageClass(name: string): StorageClass {
  const v = String(name || '').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/(meatdeli|thit mat|thit heo mat|thit lon mat|thit bo mat)/.test(v)) return 'chilled_food';
  if (/(wineco|rau cu|rau mam|nam tuoi|trai cay)/.test(v)) return 'produce';
  if (/(super ?net|\bnet\b|sopa|bot giat|nuoc giat|nuoc lau san|nuoc rua chen|nuoc xa vai|chant[eé]|joins)/.test(v)) return 'household';
  if (/(kokomi|omachi|mi an lien|mi khoai tay|pho an lien|bun an lien|mien an lien|ponnie|heo cao boi|vinacafe|vinacafe|wake.up sai gon|ngu coc|chinsu story|chin.su story|hi.fresh)/.test(v)) return 'dry_food';
  if (/(nuoc mam|nuoc tuong|tuong ot|tuong ca|hat nem|sa te|gia vi|mayonnaise|nam ngu|tam thai tu|chin.su|chinsu)/.test(v)) return 'condiments';
  if (/(wake.up 247|compact|enerz|lemona|bupnon|vinh hao|vivant|quang hanh|nuoc khoang|nuoc tang luc)/.test(v)) return 'beverages';
  return 'unknown';
}

export function requiredStorageMode(storageClass: StorageClass): StorageMode | null {
  if (storageClass === 'chilled_food') return 'chilled';
  if (storageClass === 'produce') return 'produce';
  if (storageClass === 'household') return 'household';
  if (storageClass === 'dry_food' || storageClass === 'condiments' || storageClass === 'beverages') return 'ambient';
  return null;
}

export function assertStoragePlacement(args: {
  productClass: string | null | undefined;
  zoneMode: string | null | undefined;
  rackClasses: (string | null | undefined)[];
  productName?: string;
  rackName?: string;
}): void {
  const type = args.productClass || 'unknown';
  const required = requiredStorageMode(type as StorageClass);
  if (!required) {
    throw new BadRequestException({ code: 'STORAGE_CLASS_REQUIRED', message: `Hàng ${args.productName || ''} chưa xác định nhóm bảo quản. Vui lòng chọn nhóm trước khi xếp kho.` });
  }
  const zoneMode = args.zoneMode || 'ambient';
  if (required !== zoneMode) {
    throw new BadRequestException({ code: 'STORAGE_ZONE_MISMATCH', message: `${args.productName || 'Sản phẩm'} cần khu ${required}; kệ ${args.rackName || ''} thuộc khu ${zoneMode}. Không xếp lẫn thực phẩm, hàng lạnh và hóa phẩm.` });
  }
  if (args.rackClasses.some((existing) => !existing || existing === 'unknown' || existing !== type)) {
    throw new BadRequestException({ code: 'RACK_STORAGE_MIXED', message: `Kệ ${args.rackName || ''} đã có nhóm sản phẩm khác hoặc lô cũ chưa phân loại. Hãy chọn kệ riêng cho ${type}.` });
  }
}

/** Preferred putaway slots for FEFO. The rule is only a suggestion inside a
 * compatible rack; it never overrides weight/volume or operator-selected slot. */
export function preferredSlotsByExpiry(expirationDate: string | null | undefined, now = new Date()): number[] {
  const indices = Array.from({ length: 20 }, (_, i) => i);
  if (!expirationDate) return indices;
  const expiry = Date.parse(`${String(expirationDate).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(expiry)) return indices;
  const days = (expiry - now.getTime()) / 86_400_000;
  // Short-dated: Level 1-2 near picking aisle; long-dated: Level 3-4.
  return days <= 90 ? indices : [...indices.slice(10), ...indices.slice(0, 10)];
}

export function assertExpiryDeclared(storageClass: string | null | undefined, expirationDate: string | null | undefined) {
  if (storageClass && storageClass !== 'household' && storageClass !== 'unknown' && !expirationDate) {
    throw new BadRequestException({ code: 'EXPIRY_DATE_REQUIRED', message: 'Thực phẩm/đồ uống cần khai báo HSD trước khi phân bổ vào kệ. Mở thông tin PART hoặc trang FEFO để nhập HSD.' });
  }
}
