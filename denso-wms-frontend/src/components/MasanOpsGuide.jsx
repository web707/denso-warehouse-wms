import { CheckCircle2, ClipboardCheck, PackageCheck, Warehouse, Truck, Snowflake, ArrowRight, ShieldAlert, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MASAN_CATEGORIES } from '@/lib/masanCatalog';

const steps = [
  { icon: Truck, title: '01 · Tiếp nhận', sub: 'Dock nhập → đối chiếu chứng từ & số lô' },
  { icon: ClipboardCheck, title: '02 · Kiểm định', sub: 'Kiểm tra SKU, NSX/HSD & tình trạng kiện' },
  { icon: Warehouse, title: '03 · Lưu kho', sub: 'Phân khu, chọn kệ và vị trí 3D' },
  { icon: PackageCheck, title: '04 · Soạn hàng', sub: 'Ưu tiên lô gần hết hạn (FEFO)' },
  { icon: CheckCircle2, title: '05 · Xuất kho', sub: 'Kiểm tra số lượng, ghi nhận giao dịch' },
];
const categoryColors = [
  'text-emerald-700 bg-emerald-50',
  'text-orange-600 bg-orange-50',
  'text-amber-700 bg-amber-50',
  'text-blue-700 bg-blue-50',
  'text-cyan-700 bg-cyan-50',
  'text-red-700 bg-red-50',
  'text-violet-700 bg-violet-50',
  'text-indigo-700 bg-indigo-50',
];
const categories = MASAN_CATEGORIES.map((category, index) => ({
  title: category.name,
  tags: category.brands.slice(0, 3).map((brand) => brand.name).join(' · '),
  color: categoryColors[index],
  icon: category.kind === 'service' ? Truck : category.id === 'thit-nong-san' ? Snowflake : PackageCheck,
}));
export default function MasanOpsGuide() {
  return <section className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white dark:from-[#10352b] dark:to-[#182435]">
      <div><p className="text-xs tracking-wider uppercase font-bold text-emerald-700 dark:text-emerald-300">Trung tâm phân phối hàng tiêu dùng</p><h2 className="text-lg font-bold mt-1 text-slate-900 dark:text-[#f8fafc]">Luồng vận hành kho Masan Consumer</h2></div>
      <div className="flex items-center gap-2"><Link to="/catalog" className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:bg-[#243449] dark:text-emerald-200 dark:border-emerald-500/50"><BookOpen className="h-3.5 w-3.5" />Danh mục Masan</Link></div>
    </div>
    <div className="px-5 pt-4"><span className="inline-flex text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">Quy trình tham chiếu</span></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 px-5 pb-5 pt-2">
      {steps.map(({ icon: Icon, title, sub },i) => <div key={title} className="relative border border-slate-100 rounded-xl bg-slate-50/80 p-4"><Icon className="w-5 h-5 text-emerald-700" /><p className="mt-3 font-bold text-sm text-slate-800">{title}</p><p className="text-xs text-slate-500 mt-2 leading-relaxed">{sub}</p>{i<steps.length-1&&<ArrowRight className="hidden lg:block absolute right-[-13px] z-10 top-1/2 w-4 h-4 text-emerald-500" />}</div>)}
    </div>
    <div className="px-5 pb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{categories.map(({icon:Icon,title,tags,color})=><div key={title} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${color}`}><Icon className="w-4 h-4 mt-0.5 flex-none" /><div><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[11px] opacity-80">{tags}</p></div></div>)}</div>
    <div className="px-5 pb-4 flex items-start gap-2 text-xs text-slate-500"><ShieldAlert className="h-4 w-4 flex-none text-amber-600" /><span>Danh mục tham chiếu bao gồm các thương hiệu trong hệ sinh thái Masan Group, kể cả bán lẻ/dịch vụ; những nhóm này không tự tạo SKU hoặc tồn kho. FEFO và bảo quản chuyên biệt cần cấu hình nghiệp vụ trước khi tự động hóa.</span></div>
  </section>;
}
