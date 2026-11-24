import { DataSource } from 'typeorm';
import { PackingRule } from '../../packing-rules/entities/packing-rule.entity';

// The 13 rules verbatim from the current frontend's seedData.js (so the
// PackingRules page reads unchanged), plus 5 rules the "Quy ước đóng hàng"
// sheet mandates that the frontend never modelled. All are is_system = true:
// deletable is blocked, but toggling `active` or rewording `text` is fine.
export const PACKING_RULE_SEED = [
  { text: 'Hướng chất hàng: Trong ra ngoài (Front → Door)', category: 'Hướng chất', icon: 'ArrowRight' },
  { text: 'Được phép xoay carton 90° tối ưu diện tích', category: 'Xoay carton', icon: 'RotateCw' },
  { text: 'Không trộn các SKU khác nhau trong cùng 1 Block / Ô chứa', category: 'Phân SKU', icon: 'Ban' },
  { text: 'Mỗi SKU / Lô hàng tạo thành một Block lưu trữ riêng biệt', category: 'Phân Block', icon: 'Box' },
  { text: 'Mỗi Block có 01 màu sắc nhận diện riêng biệt', category: 'Màu sắc', icon: 'Palette' },
  { text: 'Chất hàng từ trong ra ngoài (Front trước)', category: 'Thứ tự chất', icon: 'Layers' },
  { text: 'Phân bổ trọng lượng đều trên sàn kệ (tải đều)', category: 'Phân bổ', icon: 'Weight' },
  {
    text: 'Không xếp quá cao — dưới mức giới hạn trần khoang kệ',
    category: 'Chiều cao',
    icon: 'PackageCheck',
  },
  { text: 'Sử dụng tấm lót / bọc màng co pallet bảo vệ hàng', category: 'Giằng hàng', icon: 'ShieldCheck' },
  { text: 'Kiểm tra quy cách thùng và nhãn tem trước khi nhập', category: 'Kiểm tra', icon: 'Ruler' },
  { text: 'Ghi chú SKU / Lô hàng trên sơ đồ lưu kho WMS', category: 'Ghi chú', icon: 'ClipboardList' },
  {
    text: 'Tổng thể tích CBM không vượt quá thể tích khoang kệ',
    category: 'Giới hạn',
    icon: 'AlertTriangle',
  },
  {
    text: 'Tổng trọng lượng không vượt quá tải trọng khoang kệ',
    category: 'Giới hạn',
    icon: 'AlertTriangle',
  },
  // Masan Consumer FMCG Specific Storage Rules:
  {
    text: 'Tuân thủ nghiêm ngặt nguyên tắc FEFO: Lô có hạn dùng gần xếp ngoài / tầng lấy hàng',
    category: 'Nguyên tắc FEFO',
    icon: 'Clock',
  },
  {
    text: 'Cách ly tuyệt đối ngành hàng hóa mỹ phẩm (Bột giặt NET, Sopa) khỏi thực phẩm & đồ uống',
    category: 'Cách ly an toàn',
    icon: 'ShieldAlert',
  },
  {
    text: 'Thịt mát MEATDeli và sản phẩm chuỗi lạnh phải bảo quản trong Kho Mát 0 - 4°C',
    category: 'Chuỗi nhiệt độ',
    icon: 'ThermometerSnowflake',
  },
  {
    text: 'Tải trọng tối đa mỗi khoang kệ không vượt quá 250 kg hoặc 8 tầng thùng hàng',
    category: 'Tải trọng',
    icon: 'Weight',
  },
  {
    text: 'Chỉ xếp chồng thùng cùng SKU hoặc cùng quy cách (không đè hàng nặng lên hàng dễ vỡ/móp)',
    category: 'Xếp chồng',
    icon: 'Layers3',
  },
];

export async function seedPackingRules(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(PackingRule);
  const existingCount = await repo.count();
  if (existingCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`  packing_rules already seeded (${existingCount} rows) — skipping`);
    return;
  }
  const rows = PACKING_RULE_SEED.map((r, index) =>
    repo.create({ ...r, active: true, isSystem: true, sortOrder: index }),
  );
  await repo.save(rows);
  // eslint-disable-next-line no-console
  console.log(`  packing_rules seeded (${rows.length} rules)`);
}
