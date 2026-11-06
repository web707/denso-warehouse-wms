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
  const t = String(part?.partName || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
  if (/(vinacafe|ca phe|coffee|wake.up sai gon|ngu coc|b.fast)/.test(t)) return 'coffee';
  if (/(omachi|kokomi|\bmi\b|\bpho\b|\bbun\b|\bmien\b|banh da|chinsu story|hi.fresh|lau tu soi)/.test(t)) return 'noodles';
  if (/(ponnie|heo cao boi|xuc xich|thit vien snack)/.test(t)) return 'processed_food';
  if (/(nuoc mam|nuoc tuong|tuong ot|tuong ca|hat nem|sa te|gia vi|mayonnaise|nam ngu|tam thai tu|chinsu|chin.su)/.test(t)) return 'condiments';
  if (/(wake.up 247|compact|enerz|lemona|bupnon|vinh hao|vivant|quang hanh|nuoc khoang|nuoc tang luc|nuoc ngot|tra dong chai)/.test(t)) return 'beverages';
  if (/(meatdeli|thit mat|thit heo mat|thit lon mat|thit bo mat)/.test(t)) return 'chilled_food';
  if (/(wineco|rau cu|rau mam|nam tuoi|trai cay)/.test(t)) return 'produce';
  if (/(super ?net|\bnet\b|sopa|bot giat|nuoc giat|nuoc lau san|nuoc rua chen|nuoc xa vai|chante|joins)/.test(t)) return 'household';
  const cls=part?.storageClass;
  return {condiments:'condiments',beverages:'beverages',dry_food:'dry_food_other',chilled_food:'chilled_food',produce:'produce',household:'household'}[cls] || null;
}
export function rackFamily(rack, parts=[]) {
  const occupied=parts.filter(p=>p.rackId===rack?.id);
  const families=[...new Set(occupied.map(getFamily).map(x=>x||'unknown'))];
  if (families.length>1 || families.includes('unknown')) return 'mixed';
  if (rack?.productFamily && families.length && rack.productFamily!==families[0]) return 'mixed';
  return rack?.productFamily || families[0] || null;
}
export function familyLabel(family) { return family==='mixed' ? 'Kệ đang lẫn nhóm · cần kiểm tra' : FAMILY_LABELS[family] || 'Chưa gán chủ đề'; }
