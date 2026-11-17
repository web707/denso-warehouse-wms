export const FAMILY_LABELS = {
  condiments: 'Gia vị & nước chấm', noodles: 'Mì, phở & thực phẩm tiện lợi',
  beverages: 'Đồ uống & nước khoáng', coffee: 'Cà phê & ngũ cốc',
  dry_food_other: 'Thực phẩm khô khác', processed_food: 'Thực phẩm chế biến',
  chilled_food: 'Thịt mát · kho lạnh', produce: 'Rau củ & nông sản',
  household: 'Hóa phẩm & chăm sóc gia đình',
};
export const FAMILY_COLORS = {
  condiments: '#ea580c', noodles: '#eab308', beverages: '#0284c7', coffee: '#854d0e',
  dry_food_other: '#64748b', processed_food: '#d946ef', chilled_food: '#ef4444',
  produce: '#16a34a', household: '#7c3aed',
};
export function getFamily(part) {
  return Object.hasOwn(FAMILY_LABELS, part?.productFamily) ? part.productFamily : null;
}
export function rackFamily(rack, parts=[]) {
  const occupied=parts.filter(p=>p.rackId===rack?.id);
  const families=[...new Set(occupied.map(getFamily).map(x=>x||'unknown'))];
  if (families.length>1 || families.includes('unknown')) return 'mixed';
  if (rack?.productFamily && families.length && rack.productFamily!==families[0]) return 'mixed';
  return rack?.productFamily || families[0] || null;
}
export function familyLabel(family) { return family==='mixed' ? 'Kệ đang lẫn nhóm · cần kiểm tra' : FAMILY_LABELS[family] || 'Chưa gán chủ đề'; }
