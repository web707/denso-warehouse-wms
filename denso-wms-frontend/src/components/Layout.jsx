import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Warehouse, ClipboardList, RotateCcw, History as HistoryIcon, ArrowRightLeft, QrCode, MapPinned, BarChart3 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const navItems = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Lô linh kiện', icon: Package },
  { to: '/racks', label: 'Sơ đồ kho theo Zone', icon: Warehouse },
  { to: '/inventory', label: 'Nhập · Xuất · Điều chuyển', icon: ArrowRightLeft },
  { to: '/qr-labels', label: 'QR & Barcode kho', icon: QrCode },
  { to: '/zones', label: 'Quản lý Zone', icon: MapPinned },
  { to: '/reports', label: 'Báo cáo kho', icon: BarChart3 },
  { to: '/history', label: 'Lịch sử kho', icon: HistoryIcon },
  { to: '/packing-rules', label: 'Quy ước lưu kho', icon: ClipboardList },
];

export default function Layout() {
  const { resetData } = useStore();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">DENSO Warehouse WMS</p>
            <p className="text-[11px] text-slate-500">Kho linh kiện ô tô · 3D Rack</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Cấu trúc mặc định</p>
            <p className="text-xs font-semibold text-slate-700 mt-1">5 khoang × 4 tầng</p>
            <p className="text-[11px] text-slate-500">20 kệ / Zone · 400 ô / Zone</p>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-slate-500 hover:text-slate-900">
                <RotateCcw className="w-4 h-4 mr-2" />
                Làm mới dữ liệu
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tải lại dữ liệu từ máy chủ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Hệ thống sẽ tải lại dữ liệu hiện tại từ cơ sở dữ liệu. Không xóa dữ liệu.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={resetData}>Tải lại</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-slate-200 z-30 flex items-center px-4 gap-2 overflow-x-auto">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Warehouse className="w-4 h-4 text-white" />
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`
            }
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <main className="flex-1 md:ml-64 pt-14 md:pt-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
