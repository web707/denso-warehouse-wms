/**
 * Reference catalog transcribed from Danh_Muc_San_Pham_Masan.docx (2 pages).
 * This is presentation/sample-name data, NOT product master records or stock.
 * Do not infer internal SKU codes, pack sizes, costs or expiration dates.
 * Retail/services are ecosystem partners, not inventory SKUs.
 */
export const MASAN_CATEGORIES = [
  {
    id: 'gia-vi', name: 'Gia vị & Nước chấm', short: 'Gia vị', kind: 'stock',
    summary: 'Nước mắm, nước tương, tương ớt, hạt nêm và gia vị tẩm ướp',
    brands: [
      { name: 'CHIN-SU', products: ['Nước mắm CHIN-SU', 'Tương ớt CHIN-SU', 'Nước tương CHIN-SU', 'Sa tế CHIN-SU', 'Xốt muối ớt CHIN-SU', 'Hạt nêm CHIN-SU', 'Mayonnaise CHIN-SU', 'Gia vị tẩm ướp CHIN-SU'] },
      { name: 'Nam Ngư', products: ['Nam Ngư Nhãn Vàng', 'Nam Ngư Đệ Nhất', 'Nam Ngư Cá Hồi'] },
      { name: 'Tam Thái Tử', products: ['Nước tương Tam Thái Tử Nhất Ca', 'Nước tương Tam Thái Tử Nhị Ca'] },
    ],
  },
  {
    id: 'thuc-pham-tien-loi', name: 'Thực phẩm tiện lợi', short: 'Thực phẩm tiện lợi', kind: 'stock',
    summary: 'Mì, phở, bún, miến ăn liền và sản phẩm tự sôi',
    brands: [
      { name: 'Omachi', products: ['Mì Omachi xốt bò hầm', 'Mì Omachi sườn hầm', 'Mì Omachi lẩu tôm chua cay', 'Phở Omachi', 'Miến Omachi', 'Lẩu tự sôi Omachi'] },
      { name: 'KOKOMI', products: ['Kokomi Đại 90g', 'Kokomi tôm chua cay', 'Kokomi bò hầm'] },
      { name: 'CHIN-SU Story / Hi-Fresh', products: ['Phở ăn liền CHIN-SU Story / Hi-Fresh', 'Bún ăn liền CHIN-SU Story / Hi-Fresh', 'Bánh đa ăn liền CHIN-SU Story / Hi-Fresh'] },
      { name: 'Gumi', products: [] }, { name: 'Omtomi', products: [] }, { name: 'Tiến Vua', products: [] }, { name: 'Sagami', products: [] },
    ],
  },
  {
    id: 'thuc-pham-che-bien', name: 'Thực phẩm chế biến', short: 'Thực phẩm chế biến', kind: 'stock',
    summary: 'Xúc xích tiệt trùng, xúc xích lắc và đồ ăn nhanh',
    brands: [
      { name: 'Ponnie', products: ['Xúc xích tiệt trùng Ponnie'] },
      { name: 'Heo Cao Bồi', products: ['Xúc xích lắc Heo Cao Bồi', 'Thịt viên snack Heo Cao Bồi'] },
    ],
  },
  {
    id: 'do-uong-ca-phe', name: 'Đồ uống & Cà phê', short: 'Đồ uống', kind: 'stock',
    summary: 'Cà phê hòa tan, thức uống dinh dưỡng và nước tăng lực',
    brands: [
      { name: 'Vinacafé', products: ['Vinacafé Gold', 'Vinacafé Biên Hòa', 'Vinacafé Chất'] },
      { name: 'Wake-Up', products: ['Cà phê Wake-Up Sài Gòn'] },
      { name: 'B’fast', products: ['Ngũ cốc dinh dưỡng B’fast'] },
      { name: 'Wake-Up 247', products: ['Nước tăng lực Wake-Up 247'] },
      { name: 'Compact', products: ['Nước tăng lực Compact'] },
      { name: 'EnerZ', products: ['Nước tăng lực EnerZ'] },
      { name: 'Lemona', products: ['Nước giải khát Lemona'] },
      { name: 'BupnonTEA 365', products: ['Trà đóng chai BupnonTEA 365'] },
    ],
  },
  {
    id: 'nuoc-khoang', name: 'Nước khoáng thiên nhiên', short: 'Nước khoáng', kind: 'stock',
    summary: 'Nước khoáng đóng chai, có ga và chanh muối',
    brands: [
      { name: 'Vĩnh Hảo', products: ['Nước khoáng Vĩnh Hảo', 'Nước khoáng có ga Vĩnh Hảo'] },
      { name: 'Vivant', products: ['Nước khoáng Vivant'] },
      { name: 'Quang Hạnh', products: ['Nước khoáng Quang Hạnh', 'Nước chanh muối Quang Hạnh'] },
    ],
  },
  {
    id: 'thit-nong-san', name: 'Thịt tươi & Nông sản', short: 'Thịt & nông sản', kind: 'stock',
    summary: 'Thịt mát đóng khay và rau củ quả nông nghiệp công nghệ cao',
    brands: [
      { name: 'MEATDeli', products: ['Thịt đùi MEATDeli', 'Ba rọi MEATDeli', 'Sườn non MEATDeli', 'Thịt xay MEATDeli', 'Chả lợn MEATDeli', 'Giò lợn MEATDeli'] },
      { name: 'WinEco', products: ['Rau thủy canh WinEco', 'Rau mầm WinEco', 'Nấm WinEco', 'Trái cây WinEco'] },
    ],
  },
  {
    id: 'cham-soc-gia-dinh', name: 'Chăm sóc gia đình', short: 'Chăm sóc gia đình', kind: 'stock',
    summary: 'Bột giặt, nước giặt, nước xả vải và hóa phẩm gia dụng',
    brands: [
      { name: 'Sopa', products: ['Nước giặt Sopa', 'Nước xả vải Sopa'] },
      { name: 'NET', products: ['Bột giặt NET', 'Nước rửa chén NET', 'Nước lau sàn NET'] },
      { name: 'Super NET', products: ['Bột giặt Super NET', 'Nước rửa chén Super NET', 'Nước lau sàn Super NET'] },
    ],
  },
  {
    id: 'ban-le-dich-vu', name: 'Bán lẻ & Dịch vụ', short: 'Bán lẻ & dịch vụ', kind: 'service',
    summary: 'Kênh siêu thị, cửa hàng tiện lợi và dịch vụ trà/cà phê trong hệ sinh thái',
    brands: [
      { name: 'WinMart', products: [] }, { name: 'WinMart+', products: [] }, { name: 'WIN', products: [] }, { name: 'Phúc Long', products: [] },
    ],
  },
];

export const MASAN_REFERENCE_PRODUCTS = MASAN_CATEGORIES.flatMap((category) =>
  category.brands.flatMap((brand) => brand.products.map((name) => ({ name, brand: brand.name, categoryId: category.id, categoryName: category.name, kind: category.kind }))),
);

export const MASAN_BRAND_COUNT = MASAN_CATEGORIES.reduce((sum, category) => sum + category.brands.length, 0);

export function normalizeCatalogText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Exact product-name matching is intentionally strict: it must not report
// a reference brand or similarly named product as actual stock.
export function countMatchingInventory(parts, productName) {
  const wanted = normalizeCatalogText(productName);
  if (!wanted) return 0;
  return (parts || []).filter((part) => normalizeCatalogText(part.partName) === wanted).length;
}
