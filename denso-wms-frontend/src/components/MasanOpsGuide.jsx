import { CheckCircle2, ClipboardCheck, PackageCheck, Warehouse, Truck, Snowflake, ArrowRight, ShieldAlert } from 'lucide-react';

const steps = [
  { icon: Truck, title: '01 · Tiếp nhận', sub: 'Dock nhập → đối chiếu chứng từ & số lô' },
  { icon: ClipboardCheck, title: '02 · Kiểm định', sub: 'Kiểm tra SKU, NSX/HSD & tình trạng kiện' },
  { icon: Warehouse, title: '03 · Lưu kho', sub: 'Phân khu, chọn kệ và vị trí 3D' },
  { icon: PackageCheck, title: '04 · Soạn hàng', sub: 'Ưu tiên lô gần hết hạn (FEFO)' },
  { icon: CheckCircle2, title: '05 · Xuất kho', sub: 'Kiểm tra số lượng, ghi nhận giao dịch' },
];
const categories = [
  { title: 'Thực phẩm khô', tags: 'Omachi · Kokomi · Vinacafé', color: 'text-orange-600 bg-orange-50', icon: PackageCheck },
  { title: 'Gia vị & nước chấm', tags: 'CHIN-SU · Nam Ngư', color: 'text-emerald-700 bg-emerald-50', icon: Warehouse },
  { title: 'Đồ uống', tags: 'Wake-up 247', color: 'text-blue-700 bg-blue-50', icon: Truck },
  { title: 'Khu bảo quản riêng', tags: 'Hàng lạnh và hóa phẩm: cần tách biệt', color: 'text-violet-700 bg-violet-50', icon: Snowflake },
];
export default function MasanOpsGuide() {
  return <section className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white dark:from-[#10352b] dark:to-[#182435]">
      <div><p className="text-xs tracking-wider uppercase font-bold text-emerald-700 dark:text-emerald-300">Trung tâm phân phối hàng tiêu dùng</p><h2 className="text-lg font-bold mt-1 text-slate-900 dark:text-[#f8fafc]">Luồng vận hành kho Masan Consumer</h2></div>
      <span className="text-xs text-slate-500 rounded-full px-3 py-1.5 bg-white border border-slate-200 dark:bg-[#243449] dark:text-[#cbd5e1] dark:border-[#475569]">Quy trình tham chiếu</span>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 p-5">
      {steps.map(({ icon: Icon, title, sub },i) => <div key={title} className="relative border border-slate-100 rounded-xl bg-slate-50/80 p-4"><Icon className="w-5 h-5 text-emerald-700" /><p className="mt-3 font-bold text-sm text-slate-800">{title}</p><p className="text-xs text-slate-500 mt-2 leading-relaxed">{sub}</p>{i<steps.length-1&&<ArrowRight className="hidden lg:block absolute right-[-13px] z-10 top-1/2 w-4 h-4 text-emerald-500" />}</div>)}
    </div>
    <div className="px-5 pb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{categories.map(({icon:Icon,title,tags,color})=><div key={title} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${color}`}><Icon className="w-4 h-4 mt-0.5 flex-none" /><div><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[11px] opacity-80">{tags}</p></div></div>)}</div>
    <div className="px-5 pb-4 flex items-start gap-2 text-xs text-slate-500"><ShieldAlert className="h-4 w-4 flex-none text-amber-600" /><span>FEFO và bảo quản chuyên biệt là định hướng vận hành từ tài liệu tham khảo. Hãy xác minh quy tắc thực tế và cấu hình điều kiện kho trước khi tự động hóa.</span></div>
  </section>;
}
