import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Warehouse, ClipboardList, RotateCcw, History as HistoryIcon,
  ArrowRightLeft, QrCode, MapPinned, BarChart3, Factory, ShieldCheck, Truck, GitBranch, Menu, PanelLeftClose, PanelLeftOpen,
  Sun, Moon, Monitor, LogOut, CalendarClock, UsersRound, Eye, BookOpen, Layers, Activity, ChevronRight
} from 'lucide-react';
import { isDemoMode } from '@/lib/environment';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { ROLE_LABELS, isReadOnly, canAccessRoute } from '@/lib/access';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const navGroups = [
  {
    label: 'Vận hành cốt lõi',
    items: [
      { to: '/', label: 'Tổng quan điều hành', short: 'Tổng quan', icon: LayoutDashboard, end: true },
      { to: '/inventory', label: 'Giao dịch kho', short: 'Nhập · Xuất', icon: ArrowRightLeft },
      { to: '/cycle-counts', label: 'Kiểm kê định kỳ (SoD)', short: 'Kiểm kê', icon: ClipboardList },
      { to: '/dispatch-orders', label: 'Đơn xuất kho (FEFO)', short: 'Xuất kho', icon: Truck },
      { to: '/documents', label: 'Chứng từ kho hàng', short: 'Chứng từ', icon: Layers },
      { to: '/orders', label: 'Lô hàng & Mã SKU', short: 'Lô · SKU', icon: Package },
      { to: '/catalog', label: 'Danh mục sản phẩm', short: 'Danh mục', icon: BookOpen },
      { to: '/fefo', label: 'Hạn dùng & FEFO', short: 'FEFO', icon: CalendarClock },
      { to: '/qr-labels', label: 'In mã QR & Barcode', short: 'QR Code', icon: QrCode },
    ],
  },
  {
    label: 'Không gian kho 3D',
    items: [
      { to: '/racks', label: 'Trung tâm điều hành 3D', short: 'Điều hành 3D', icon: Warehouse },
      { to: '/supply-chain-3d', label: 'Hành trình 3D (Mô phỏng)', short: 'Mô phỏng', icon: GitBranch },
      { to: '/zones', label: 'Quản lý khu vực (Zone)', short: 'Zone', icon: MapPinned },
      { to: '/packing-rules', label: 'Quy ước đóng gói & kệ', short: 'Quy ước', icon: ClipboardList },
    ],
  },
  {
    label: 'Chuỗi cung ứng & Kiểm định',
    items: [
      { to: '/work-orders', label: 'Kế hoạch sản xuất', short: 'Sản xuất', icon: Factory },
      { to: '/inspections', label: 'Kiểm tra chất lượng (QC)', short: 'Chất lượng', icon: ShieldCheck },
      { to: '/shipments', label: 'Vận chuyển & Giao nhận', short: 'Giao nhận', icon: Truck },
      { to: '/trace', label: 'Truy vết lô hàng', short: 'Truy vết', icon: GitBranch },
    ],
  },
  {
    label: 'Báo cáo & Quản trị',
    items: [
      { to: '/reports', label: 'Báo cáo thông kê WMS', short: 'Báo cáo', icon: BarChart3 },
      { to: '/history', label: 'Nhật ký kiểm toán', short: 'Nhật ký', icon: HistoryIcon },
      { to: '/users', label: 'Phân quyền & Tài khoản', short: 'Tài khoản', icon: UsersRound, adminOnly: true },
    ],
  },
];

const bottomTabs = ['/', '/inventory', '/racks', '/qr-labels'];
const allItems = navGroups.flatMap((g) => g.items);

const THEME_CYCLE = { light: 'dark', dark: 'system', system: 'light' };
const THEME_META = {
  light: { icon: Sun, label: 'Giao diện sáng' },
  dark: { icon: Moon, label: 'Giao diện tối' },
  system: { icon: Monitor, label: 'Theo hệ thống' },
};

function WithTip({ enabled, label, children }) {
  if (!enabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="bg-[#17263B] text-[#F8FAFC] border-[#26374C] text-xs font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarBody({ collapsed = false, onNavigate, onToggleCollapse }) {
  const { resetData } = useStore();
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_META[theme].icon;

  const footBtn =
    'flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:bg-[#17263B] hover:text-[#F8FAFC] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500';

  return (
    <div className="flex h-full flex-col bg-[#0C1625] text-[#94A3B8] select-none border-r border-[#26374C]">
      {/* Brand Header */}
      <div className={cn('flex items-center h-16 shrink-0 border-b border-[#26374C]/80 px-4 transition-all', collapsed ? 'justify-center px-2' : 'gap-3')}>
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40 border border-emerald-400/30">
          <Warehouse className="w-5 h-5 text-white" />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0C1625] animate-pulse" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-white">MASAN WMS</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">2026</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] truncate tracking-wide">Industrial Command Center</p>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5 scrollbar-thin scrollbar-thumb-[#26374C]" aria-label="Điều hướng chính">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {collapsed ? (
              <div className="mx-2 mb-2 border-t border-[#26374C]/60 first:hidden" aria-hidden="true" />
            ) : (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]/60">
                {group.label}
              </p>
            )}
            {group.items.filter((item) => canAccessRoute(user, item.to)).map((item) => (
              <WithTip key={item.to} enabled={collapsed} label={item.label}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center h-9 rounded-lg text-xs font-medium transition-all duration-150',
                      collapsed ? 'justify-center w-9 mx-auto' : 'gap-2.5 px-3',
                      isActive
                        ? 'bg-[#17263B] text-emerald-400 font-semibold shadow-sm border border-emerald-500/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-emerald-400'
                        : 'text-[#94A3B8] hover:bg-[#111E30] hover:text-[#F8FAFC]',
                    )
                  }
                >
                  <item.icon className={cn(
                    'w-4 h-4 shrink-0 transition-transform group-hover:scale-110',
                    'text-inherit'
                  )} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </WithTip>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom User & System Controls */}
      <div className="shrink-0 border-t border-[#26374C]/80 p-2.5 space-y-1 bg-[#0A121F]">
        {!collapsed && user && (
          <div className="rounded-xl bg-[#111E30] border border-[#26374C] p-2.5 mb-2 shadow-sm flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
              {(user.fullName || user.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-[#F8FAFC] leading-none mb-1">
                {user.fullName || user.email}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-400/90 font-medium truncate">
                  {ROLE_LABELS[user.role] || 'Nhân sự kho'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1">
          <WithTip enabled={collapsed} label={THEME_META[theme].label}>
            <button
              type="button"
              onClick={() => setTheme(THEME_CYCLE[theme])}
              aria-label={`${THEME_META[theme].label}. Bấm để đổi`}
              className={cn(footBtn, collapsed ? 'w-full justify-center' : 'w-full')}
            >
              <ThemeIcon className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="truncate">{THEME_META[theme].label}</span>}
            </button>
          </WithTip>

          <AlertDialog>
            <WithTip enabled={collapsed} label="Làm mới dữ liệu">
              <AlertDialogTrigger asChild>
                <button type="button" aria-label="Làm mới dữ liệu" className={cn(footBtn, collapsed ? 'w-full justify-center' : 'w-full')}>
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  {!collapsed && <span className="truncate">Làm mới</span>}
                </button>
              </AlertDialogTrigger>
            </WithTip>
            <AlertDialogContent className="bg-[#111E30] border-[#26374C] text-[#F8FAFC]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white text-base">Tải lại dữ liệu hệ thống?</AlertDialogTitle>
                <AlertDialogDescription className="text-[#94A3B8] text-sm">
                  Hệ thống sẽ đồng bộ lại toàn bộ danh mục sản phẩm và trạng thái ô kệ mới nhất từ máy chủ PostgreSQL.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-[#17263B] border-[#26374C] text-[#F8FAFC] hover:bg-[#26374C]">Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={resetData} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Đồng ý</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <button 
          type="button" 
          onClick={logout} 
          className={cn(footBtn, 'w-full hover:bg-red-950/40 hover:text-red-400 transition-colors', collapsed ? 'justify-center' : '')}
        >
          <LogOut className="w-3.5 h-3.5 text-inherit shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>

        {onToggleCollapse && (
          <WithTip enabled={collapsed} label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}>
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
              className={cn(footBtn, 'w-full justify-center border-t border-[#26374C]/60 pt-1.5')}
            >
              {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
              {!collapsed && <span>Thu gọn thanh bên</span>}
            </button>
          </WithTip>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('wms-sidebar-collapsed') === '1'; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('wms-sidebar-collapsed', collapsed ? '1' : '0'); } catch { /* bỏ qua */ }
  }, [collapsed]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const current = allItems.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));
  const currentGroup = navGroups.find(g => g.items.some(i => i.to === current?.to));
  const tabs = bottomTabs.map((to) => allItems.find((i) => i.to === to));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-[#080F1C] text-[#F8FAFC]">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={cn(
            'hidden md:block fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ease-in-out',
            collapsed ? 'w-[68px]' : 'w-64',
          )}
        >
          <SidebarBody collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
        </aside>

        {/* Mobile Header */}
        <header className="md:hidden fixed top-0 inset-x-0 h-14 z-30 flex items-center justify-between px-4 bg-[#0C1625] text-white border-b border-[#26374C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold tracking-tight truncate">{current?.label || 'MASAN WMS'}</p>
          </div>
          {isDemoMode && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              DEMO / QA
            </span>
          )}
        </header>

        {/* Mobile Bottom Tab Bar */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 bg-[#0C1625] border-t border-[#26374C] pb-[env(safe-area-inset-bottom)] shadow-xl"
          aria-label="Điều hướng nhanh"
        >
          {tabs.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 h-14 text-[10px] font-medium transition-colors',
                  isActive ? 'text-emerald-400 font-semibold' : 'text-[#94A3B8]',
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="truncate max-w-full px-1">{item.short || item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 h-14 text-[10px] font-medium text-[#94A3B8]"
          >
            <Menu className="w-4 h-4" />
            <span>Tất cả</span>
          </button>
        </nav>

        {/* Mobile Navigation Sheet Drawer */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="p-0 w-72 border-[#26374C] bg-[#0C1625] [&>button]:text-white">
            <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
            <SheetDescription className="sr-only">Danh sách các trang của hệ thống kho</SheetDescription>
            <SidebarBody onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <main
          className={cn(
            'min-h-screen pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0 transition-[margin] duration-200 ease-in-out',
            collapsed ? 'md:ml-[68px]' : 'md:ml-64',
          )}
        >
          {/* Executive Topbar */}
          <div className="sticky top-0 z-20 hidden h-13 items-center justify-between border-b border-[#26374C] bg-[#0C1625]/90 backdrop-blur-md px-6 md:flex">
            {/* Breadcrumb path */}
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <span className="font-semibold text-white/80">MASAN WMS</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#26374C]" />
              <span>{currentGroup?.label || 'Vận hành'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#26374C]" />
              <span className="font-semibold text-emerald-400">{current?.label || 'Tổng quan'}</span>
            </div>

            {/* Right Status Badges */}
            <div className="flex items-center gap-3">
              {/* Live Connectivity HUD Indicator */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111E30] border border-[#26374C] text-[11px] font-medium text-[#94A3B8]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>HỆ THỐNG TRỰC TUYẾN</span>
              </div>

              {isDemoMode && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                  DEMO / QA
                </span>
              )}

              <div className="flex items-center gap-2 pl-2 border-l border-[#26374C]">
                <span className="text-xs text-[#94A3B8]">Vai trò:</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#17263B] text-emerald-300 border border-[#26374C]">
                  {ROLE_LABELS[user?.role] || 'Nhân sự'}
                </span>
              </div>
            </div>
          </div>

          {/* Role notices if staff / read-only */}
          {user?.role === 'warehouse_staff' && (
            <div className="mx-4 mt-3 sm:mx-6 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-300 shadow-sm">
              <Eye className="w-4 h-4 text-emerald-400 shrink-0"/>
              <span><strong>Quyền thao tác:</strong> Nhân viên kho được thực hiện quét mã, ghi nhận nhập/xuất/điều chuyển và kiểm kê thực địa. Thao tác điều chỉnh cấu hình cần quyền Quản lý.</span>
            </div>
          )}
          {isReadOnly(user?.role) && (
            <div className="mx-4 mt-3 sm:mx-6 flex items-center gap-2.5 rounded-xl border border-blue-500/30 bg-blue-950/30 px-4 py-2.5 text-xs text-blue-300 shadow-sm">
              <Eye className="w-4 h-4 text-blue-400 shrink-0"/>
              <span>Tài khoản <strong>{ROLE_LABELS[user?.role] || 'hiện tại'}</strong> có quyền xem; các thao tác ghi dữ liệu nhạy cảm được bảo vệ nghiêm ngặt.</span>
            </div>
          )}

          <div className={cn(
            "w-full",
            location.pathname.startsWith('/racks') || location.pathname.startsWith('/supply-chain-3d')
              ? "p-0"
              : "p-4 sm:p-6 lg:p-8"
          )}>
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
