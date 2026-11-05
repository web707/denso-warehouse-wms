import { MASAN_REFERENCE_PRODUCTS, normalizeCatalogText } from './masanCatalog';

export const STORAGE_CLASSES = [
  { value: 'unknown', label: 'Chưa phân loại – cần xác nhận', description: 'Không tự phân bổ vào kệ' },
  { value: 'dry_food', label: 'Thực phẩm khô / tiện lợi', description: 'Nhiệt độ phòng, kệ thực phẩm khô' },
  { value: 'condiments', label: 'Gia vị / nước chấm', description: 'Kệ riêng; tránh lẫn với hóa phẩm' },
  { value: 'beverages', label: 'Đồ uống / nước khoáng', description: 'Kệ riêng, kiểm tra tải trọng chất lỏng' },
  { value: 'chilled_food', label: 'Thực phẩm mát (MEATDeli)', description: 'Chỉ Zone bảo quản mát' },
  { value: 'produce', label: 'Rau củ / nông sản', description: 'Zone nông sản theo yêu cầu nhiệt độ của sản phẩm' },
  { value: 'household', label: 'Hóa phẩm / chăm sóc nhà cửa', description: 'Zone hóa phẩm tách biệt tuyệt đối' },
];
export const STORAGE_MODES = [
  { value: 'ambient', label: 'Kho thường – thực phẩm khô, gia vị, đồ uống' },
  { value: 'chilled', label: 'Kho mát – thịt mát / thực phẩm lạnh' },
  { value: 'produce', label: 'Khu nông sản – điều kiện riêng' },
  { value: 'household', label: 'Khu hóa phẩm – cách ly thực phẩm' },
];
const CATEGORY_TO_CLASS = {
  'gia-vi':'condiments', 'thuc-pham-tien-loi':'dry_food',
  'thuc-pham-che-bien':'dry_food', 'nuoc-khoang':'beverages',
  'thit-nong-san':'produce', 'cham-soc-gia-dinh':'household',
};
export function suggestMasanStorageClass(name) {
  const ref = MASAN_REFERENCE_PRODUCTS.find((p) => normalizeCatalogText(p.name) === normalizeCatalogText(name));
  if (!ref) return 'unknown';
  if (ref.categoryId === 'thit-nong-san') return ref.brand === 'MEATDeli' ? 'chilled_food' : 'produce';
  if (ref.categoryId === 'do-uong-ca-phe') {
    return /(Vinacaf|Cà phê|Ngũ cốc)/i.test(ref.name) ? 'dry_food' : 'beverages';
  }
  return CATEGORY_TO_CLASS[ref.categoryId] || 'unknown';
}
export const storageLabel = (value) => STORAGE_CLASSES.find((item) => item.value === value)?.label || 'Chưa phân loại';
export const modeLabel = (value) => STORAGE_MODES.find((item) => item.value === value)?.label || 'Kho thường';
