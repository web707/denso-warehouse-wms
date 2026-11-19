import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ChevronRight, Clock3, QrCode, Warehouse,
  Package, AlertTriangle, ShieldAlert, CheckCircle2, TrendingUp, Layers, Activity, Truck, CalendarClock
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { summarizeWarehouse } from '@/lib/warehouse';
import { fmtNum } from '@/lib/calculations';
import { fmtDate } from '@/lib/supplyChain';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const transactionLabel = {
  inbound: 'Nhập kho',
  outbound: 'Xuất kho',
  transfer: 'Điều chuyển',
  adjustment: 'Điều chỉnh tồn'
};

const transactionBadge = {
  inbound: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  outbound: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  transfer: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  adjustment: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const actions = [
  { to: '/inventory?mode=inbound', label: 'Nhập kho hàng', icon: ArrowDownToLine, primary: true },
  { to: '/inventory?mode=outbound', label: 'Soạn & Xuất kho', icon: ArrowUpFromLine },
  { to: '/inventory?mode=transfer', label: 'Điều chuyển vị trí', icon: ArrowLeftRight },
  { to: '/racks', label: 'Điều hành 3D', icon: Warehouse, highlight: true },
  { to: '/qr-labels', label: 'In mã QR / Barcode', icon: QrCode },
];

function metricValue(state, value, empty = 'Chưa có dữ liệu') {
  if (state === 'loading') return 'Đang tải…';
  if (state === 'error') return 'Không tải được';
  if (state === 'unavailable') return 'Chưa có nguồn dữ liệu';
  return value == null ? empty : fmtNum(value);
}

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-[#26374C] bg-[#111E30] p-3 text-xs shadow-xl text-[#F8FAFC]">
      <p className="font-semibold text-white/90 mb-1.5 border-b border-[#26374C] pb-1">Ngày: {label}</p>
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-[#94A3B8]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}:
          </span>
          <span className="font-semibold tabular-nums text-white">{fmtNum(entry.value)} đv</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { racks, parts, racksStatus, partsStatus, refetchParts, refetchRacks } = useStore();

  const summary = useQuery({
    queryKey: ['dashboard', 'stock'],
    queryFn: async () => {
      try {
        return await api.parts.dashboardSummary();
      } catch {
        return null;
      }
    },
  });

  const activity = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      try {
        const res = await api.inventory.transactionSummary(7);
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {}
      try {
        const res = await api.inventory.list({ limit: 100 });
        const items = Array.isArray(res) ? res : (res?.items || []);
        const daysMap = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          daysMap[key] = { date: key, inbound: 0, outbound: 0 };
        }
        for (const tx of items) {
          const date = tx.createdAt ? tx.createdAt.slice(0, 10) : '';
          if (daysMap[date]) {
            const qty = Number(tx.quantityPcs) || 1;
            if (tx.type === 'inbound') daysMap[date].inbound += qty;
            else if (tx.type === 'outbound') daysMap[date].outbound += qty;
            else if (tx.type === 'transfer') daysMap[date].inbound += Math.round(qty / 2);
          }
        }
        return Object.values(daysMap);
      } catch {
        return [];
      }
    },
  });

  const recent = useQuery({ 
    queryKey: ['dashboard', 'recent'], 
    queryFn: () => api.inventory.list({ limit: 8 }) 
  });

  const receivingSummary = useQuery({
    queryKey: ['dashboard', 'receivingSummary'],
    queryFn: async () => {
      try {
        return await api.receiving.summary();
      } catch {
        return { pendingCount: 0, totalDamagedPcs: 0 };
      }
    },
  });

  const warehouse = useMemo(() => summarizeWarehouse(racks, parts), [racks, parts]);

  const computedStock = useMemo(() => {
    if (summary.data) return summary.data;
    if (!parts || parts.length === 0) return null;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    const validParts = parts.filter(p => (Number(p.quantity) || 0) > 0 || (Number(p.cartons) || 0) > 0);
    const uniqueSkus = new Set(validParts.map(p => p.productCode || p.partName).filter(Boolean));
    const totalPhysical = parts.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const expiredCount = parts.filter(p => p.expirationDate && p.expirationDate < todayStr && (Number(p.quantity) || 0) > 0).length;
    const soonExpiringCount = parts.filter(p => p.expirationDate && p.expirationDate >= todayStr && p.expirationDate <= thirtyDaysLater && (Number(p.quantity) || 0) > 0).length;
    const unallocated = parts.filter(p => !p.rackId && (Number(p.quantity) || 0) > 0).length;
    const holdQty = parts.filter(p => p.receivingDamaged).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

    return {
      physicalQuantityPcs: totalPhysical,
      stockedSkuCount: uniqueSkus.size,
      pendingShipmentCount: 0,
      pendingQcQuantityPcs: 0,
      holdQuantityPcs: holdQty,
      soonExpiringPartsCount: soonExpiringCount,
      expiredPartsCount: expiredCount,
      unallocatedCount: unallocated,
    };
  }, [summary.data, parts]);

  const stock = summary.data || computedStock;
  const warehouseStatus = [racksStatus, partsStatus].includes('error') ? 'error'
    : [racksStatus, partsStatus].includes('loading') ? 'loading' : 'ready';
  const stockStatus = stock ? 'ready' : (summary.isPending || partsStatus === 'loading') ? 'loading' : 'ready';
  const capacity = warehouse.totalSlots ? Math.round(100 * warehouse.usedSlots / warehouse.totalSlots) : null;

  // 8 High-Level Industrial KPI Cards
  const kpis = [
    {
      label: 'Tổng tồn kho vật lý',
      value: stock?.physicalQuantityPcs,
      unit: 'đơn vị (PCS)',
      icon: Package,
      tone: 'text-white',
      accentColor: 'from-emerald-500/20 to-teal-500/5',
      iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    {
      label: 'Mặt hàng SKU có tồn',
      value: stock?.stockedSkuCount,
      unit: 'SKU đang quản lý',
      icon: Layers,
      tone: 'text-white',
      accentColor: 'from-blue-500/20 to-indigo-500/5',
      iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      to: '/catalog'
    },
    {
      label: 'Sức chứa kho (Occupancy)',
      value: capacity,
      unit: '% dung lượng',
      icon: Warehouse,
      tone: capacity > 85 ? 'text-amber-400' : 'text-emerald-400',
      hint: warehouseStatus === 'ready' && capacity !== null ? `${fmtNum(warehouse.usedSlots)} / ${fmtNum(warehouse.totalSlots)} ô lưu trữ` : undefined,
      accentColor: 'from-teal-500/20 to-emerald-500/5',
      iconColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      to: '/racks'
    },
    {
      label: 'Lệnh xuất kho đang chờ',
      value: stock?.pendingShipmentCount,
      unit: 'đơn chờ soạn',
      icon: Truck,
      tone: 'text-white',
      accentColor: 'from-indigo-500/20 to-blue-500/5',
      iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      to: '/dispatch-orders'
    },
    {
      label: 'Hàng chờ kiểm định (QC)',
      value: stock?.pendingQcQuantityPcs,
      unit: 'đơn vị chờ duyệt',
      icon: Activity,
      tone: 'text-white',
      accentColor: 'from-cyan-500/20 to-blue-500/5',
      iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      to: '/inspections'
    },
    {
      label: 'Sai lệch nhận hàng (Quarantine)',
      value: receivingSummary.data?.pendingCount ?? 0,
      unit: 'phiếu sai lệch',
      icon: ShieldAlert,
      tone: (receivingSummary.data?.pendingCount > 0 ? 'text-amber-400 font-bold' : 'text-white'),
      hint: receivingSummary.data?.totalDamagedPcs > 0 ? `Hỏng: ${fmtNum(receivingSummary.data.totalDamagedPcs)} đv tại Zone Q` : undefined,
      accentColor: 'from-amber-500/20 to-yellow-500/5',
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      to: '/inventory?tab=receiving'
    },
    {
      label: 'Hàng tạm khóa (HOLD)',
      value: stock?.holdQuantityPcs,
      unit: 'đơn vị cách ly',
      icon: AlertTriangle,
      tone: stock?.holdQuantityPcs > 0 ? 'text-rose-400' : 'text-white',
      accentColor: 'from-rose-500/20 to-red-500/5',
      iconColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      to: '/inspections'
    },
    {
      label: 'Cảnh báo hạn dùng (FEFO)',
      value: stock?.soonExpiringPartsCount,
      unit: 'lô sắp hết hạn',
      icon: CalendarClock,
      tone: stock?.soonExpiringPartsCount > 0 ? 'text-amber-400 font-bold' : 'text-white',
      hint: stock?.expiredPartsCount > 0 ? `${fmtNum(stock.expiredPartsCount)} lô đã quá hạn!` : undefined,
      accentColor: 'from-orange-500/20 to-amber-500/5',
      iconColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      to: '/fefo'
    },
  ];

  // Action Center alerts with priority categorization
  const alerts = [
    {
      type: 'critical',
      label: 'Lô hàng đã quá hạn sử dụng (FEFO)',
      value: stock?.expiredPartsCount || 0,
      unit: 'lô hết hạn',
      to: '/fefo',
      desc: 'Cần lập tức cô lập chuyển sang khu vực kiểm tra không xuất hàng',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40'
    },
    {
      type: 'critical',
      label: 'Kệ quá tải trọng hoặc thể tích',
      value: warehouse.racks.filter(r => r.status === 'overload').length,
      unit: 'kệ vượt ngưỡng',
      to: '/racks',
      desc: 'Nguy cơ mất an toàn kết cấu kệ, cần điều chuyển pallet',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40'
    },
    {
      type: 'warning',
      label: 'Biên bản nhận hàng sai lệch cần duyệt',
      value: receivingSummary.data?.pendingCount || 0,
      unit: 'biên bản',
      to: '/inventory?tab=receiving',
      desc: 'Chờ Quản lý xác nhận số lượng thực nhận và ghi nhận hàng lỗi',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    },
    {
      type: 'warning',
      label: 'PART chưa chỉ định vị trí ô kệ',
      value: stock?.unallocatedCount || 0,
      unit: 'mặt hàng',
      to: '/orders',
      desc: 'Hàng đã nhập nhưng chưa được đưa lên kệ lưu trữ (Putaway)',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] min-w-0 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-[#111E30] via-[#142338] to-[#111E30] border border-[#26374C] p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Trung tâm Điều hành Kho vận
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              MASAN FMCG HUB
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#94A3B8]">
            Giám sát thời gian thực tồn kho, hạn dùng FEFO, hoạt động điều phối và kiểm định chất lượng.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          {actions.map(({ to, label, icon: Icon, primary, highlight }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all duration-150 shadow-sm',
                highlight
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                  : primary
                    ? 'bg-[#17263B] hover:bg-[#26374C] text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#17263B] hover:bg-[#26374C] text-[#F8FAFC] border border-[#26374C]'
              )}
            >
              <Icon className="w-4 h-4 shrink-0 text-inherit" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Error notices if any */}
      {!stock && summary.isError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-400 flex items-center justify-between">
          <span>Không thể tải dữ liệu tồn kho tổng hợp từ máy chủ.</span>
          <button className="underline font-semibold" onClick={() => summary.refetch()}>Thử lại</button>
        </div>
      )}

      {/* 2. Executive KPI Cards Grid */}
      <section aria-label="Chỉ số vận hành cốt lõi" className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, unit, hint, to, tone, icon: Icon, accentColor, iconColor }) => {
          const display = metricValue(stockStatus, value, label.includes('Sức chứa') ? 'Chưa có ô' : undefined);
          const hasNumber = stockStatus === 'ready' && value != null;

          const cardInner = (
            <div className={cn(
              'group relative flex flex-col justify-between h-full p-4 rounded-2xl bg-[#111E30] border border-[#26374C] transition-all duration-200',
              'hover:border-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40',
              'overflow-hidden'
            )}>
              <div className={cn('absolute -top-12 -right-12 w-28 h-28 rounded-full bg-gradient-to-br opacity-50 blur-2xl pointer-events-none', accentColor)} />

              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-medium text-[#94A3B8] leading-tight line-clamp-2">{label}</span>
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border', iconColor)}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4">
                <div className={cn('text-2xl sm:text-3xl font-bold tabular-nums tracking-tight', tone)}>
                  {display}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#94A3B8]/70">
                  <span className="truncate">{hasNumber ? unit : ''}</span>
                  {to && <ChevronRight className="w-3.5 h-3.5 text-[#26374C] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />}
                </div>
                {hint && (
                  <p className="mt-2 text-[11px] font-medium text-amber-400/90 truncate border-t border-[#26374C]/60 pt-1.5">
                    {hint}
                  </p>
                )}
              </div>
            </div>
          );

          return to ? (
            <Link key={label} to={to} className="block min-w-0">
              {cardInner}
            </Link>
          ) : (
            <div key={label} className="min-w-0">
              {cardInner}
            </div>
          );
        })}
      </section>

      {/* 3. Analytics Chart & Action Center Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart Column (2/3 width on desktop) */}
        <section className="lg:col-span-2 rounded-2xl border border-[#26374C] bg-[#111E30] p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26374C]/60 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Lưu lượng Nhập & Xuất kho (7 ngày gần nhất)
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">So sánh khối lượng hàng luân chuyển thực tế</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                Nhập kho
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                Xuất kho
              </span>
              <Link to="/reports" className="text-xs text-[#94A3B8] hover:text-white underline ml-2">
                Chi tiết
              </Link>
            </div>
          </div>

          <div className="h-64 w-full" aria-label="Biểu đồ số giao dịch nhập và xuất theo ngày">
            {activity.isPending ? (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                Đang nạp dữ liệu thống kê…
              </div>
            ) : activity.isError || !activity.data?.length ? (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                Không có dữ liệu giao dịch trong 7 ngày qua.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity.data} barGap={4} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#1C2B40" strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={v => v.slice(5).split('-').reverse().join('/')} 
                    tick={{ fill: '#94A3B8', fontSize: 11 }} 
                    tickLine={false} 
                    axisLine={{ stroke: '#26374C' }} 
                  />
                  <YAxis 
                    width={50} 
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} 
                    allowDecimals={false} 
                    tick={{ fill: '#94A3B8', fontSize: 11 }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Bar dataKey="inbound" name="Nhập kho" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="outbound" name="Xuất kho" fill="#38BDF8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Action Center / Alert Hub (1/3 width on desktop) */}
        <section className="rounded-2xl border border-[#26374C] bg-[#111E30] p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-[#26374C]/60 pb-3 mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Cảnh báo Vận hành (Action Center)
            </h2>
            <span className="text-[11px] text-[#94A3B8]">Thời gian thực</span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {alerts.map((al) => (
              <Link
                key={al.label}
                to={al.to}
                className="group flex flex-col p-3 rounded-xl bg-[#17263B] border border-[#26374C] hover:border-emerald-500/40 hover:bg-[#1A2C44] transition-all duration-150"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    {al.label}
                  </span>
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', al.badgeColor)}>
                    {fmtNum(al.value)}
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1 line-clamp-1">{al.desc}</p>
              </Link>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[#26374C]/60 flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Tổng cảnh báo hoạt động:</span>
            <span className="font-bold text-emerald-400 tabular-nums">
              {alerts.reduce((sum, a) => sum + (a.value || 0), 0)} trường hợp
            </span>
          </div>
        </section>
      </div>

      {/* 4. Recent Transactions Live Feed */}
      <section className="rounded-2xl border border-[#26374C] bg-[#111E30] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26374C]/60 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-emerald-400" />
              Nhật ký Giao dịch Kho Hàng Gần Đây
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Dữ liệu ghi nhận từ các đợt nhập, xuất và luân chuyển</p>
          </div>
          <Link
            to="/history"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Xem toàn bộ nhật ký
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recent.isPending ? (
          <div className="py-8 text-center text-xs text-[#94A3B8]">Đang nạp nhật ký giao dịch…</div>
        ) : recent.isError || !recent.data?.length ? (
          <div className="py-8 text-center text-xs text-[#94A3B8]">Chưa ghi nhận giao dịch nào gần đây.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#26374C] text-[#94A3B8]">
                  <th className="py-2.5 px-3 font-semibold">Loại giao dịch</th>
                  <th className="py-2.5 px-3 font-semibold">Mã SKU / Sản phẩm</th>
                  <th className="py-2.5 px-3 font-semibold">Vị trí (Kệ / Ô)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Số lượng</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Thời gian ghi nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26374C]/50 text-white">
                {recent.data.map((row) => (
                  <tr key={row.id} className="hover:bg-[#17263B]/60 transition-colors">
                    <td className="py-3 px-3">
                      <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-bold', transactionBadge[row.type] || 'bg-slate-500/10 text-slate-300 border-slate-500/30')}>
                        {transactionLabel[row.type] || row.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium">
                      <div className="font-semibold text-white">{row.productCode || row.partName}</div>
                      {row.partName && row.partName !== row.productCode && (
                        <div className="text-[11px] text-[#94A3B8]">{row.partName}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#94A3B8]">
                      {row.toSlot !== undefined ? `Ô S${String(Number(row.toSlot) + 1).padStart(2, '0')}` : 'Vị trí FEFO'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums text-emerald-400">
                      {fmtNum(row.quantityPcs)} <span className="text-[10px] text-[#94A3B8] font-normal">đv</span>
                    </td>
                    <td className="py-3 px-3 text-right text-[11px] text-[#94A3B8]">
                      {fmtDate(row.createdAt, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
