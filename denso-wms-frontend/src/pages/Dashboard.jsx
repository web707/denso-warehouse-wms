import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ChevronRight, Clock3, QrCode, Warehouse } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { summarizeWarehouse } from '@/lib/warehouse';
import { fmtNum } from '@/lib/calculations';
import { fmtDate } from '@/lib/supplyChain';
import { Button } from '@/components/ui/button';

const transactionLabel = { inbound: 'Nhập kho', outbound: 'Xuất kho', transfer: 'Điều chuyển', adjustment: 'Điều chỉnh tồn' };
const actions = [
  { to: '/inventory?mode=inbound', label: 'Nhập kho', icon: ArrowDownToLine },
  { to: '/inventory?mode=outbound', label: 'Xuất kho', icon: ArrowUpFromLine },
  { to: '/inventory?mode=transfer', label: 'Điều chuyển', icon: ArrowLeftRight },
  { to: '/qr-labels', label: 'QR & Barcode', icon: QrCode },
];

function metricValue(state, value, empty = 'Chưa có dữ liệu') {
  if (state === 'loading') return 'Đang tải…';
  if (state === 'error') return 'Không tải được';
  if (state === 'unavailable') return 'Chưa có nguồn dữ liệu';
  return value == null ? empty : fmtNum(value);
}

function SectionHeading({ title, action, to }) {
  return <div className="flex flex-wrap items-center justify-between gap-2">
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    {to && <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" to={to}>{action}<ChevronRight size={14} /></Link>}
  </div>;
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
  const recent = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: () => api.inventory.list({ limit: 7 }) });
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
  const kpis = [
    { label: 'Tổng tồn kho', value: stock?.physicalQuantityPcs, unit: 'đơn vị' },
    { label: 'SKU có tồn', value: stock?.stockedSkuCount, unit: 'SKU' },
    { label: 'Sai lệch nhận hàng', value: receivingSummary.data?.pendingCount ?? 0, unit: 'phiếu chờ duyệt', tone: (receivingSummary.data?.pendingCount > 0 ? 'text-amber-500 font-bold' : 'text-foreground'), to: '/inventory?tab=receiving', hint: receivingSummary.data?.totalDamagedPcs > 0 ? `Hỏng: ${fmtNum(receivingSummary.data.totalDamagedPcs)} đv trong ZONE-Q` : undefined },
    { label: 'Phiếu xuất chờ', value: stock?.pendingShipmentCount, unit: 'phiếu', to: '/shipments' },
    { label: 'Hàng chờ QC', value: stock?.pendingQcQuantityPcs, unit: 'đơn vị', to: '/inspections' },
    { label: 'Hàng HOLD', value: stock?.holdQuantityPcs, unit: 'đơn vị', tone: 'text-red-500', to: '/inspections' },
    { label: 'Sắp hết hạn', value: stock?.soonExpiringPartsCount, unit: 'PART', tone: 'text-amber-500', to: '/fefo' },
    { label: 'Sử dụng sức chứa', value: capacity, state: warehouseStatus, unit: '%', hint: warehouseStatus === 'ready' && capacity !== null ? `${fmtNum(warehouse.usedSlots)} / ${fmtNum(warehouse.totalSlots)} ô` : undefined, to: '/racks' },
  ];
  const alerts = [
    { label: 'Biên bản sai lệch cần duyệt', value: receivingSummary.data?.pendingCount || 0, to: '/inventory?tab=receiving', color: 'text-amber-500 font-bold' },
    { label: 'PART đã hết hạn', value: stock?.expiredPartsCount, to: '/fefo', color: 'text-red-500' },
    { label: 'PART chưa xếp kệ', value: stock?.unallocatedCount, to: '/orders', color: 'text-amber-500' },
    { label: 'Kệ quá tải', value: warehouse.racks.filter(r => r.status === 'overload').length, state: warehouseStatus, to: '/racks', color: 'text-red-500' },
  ];
  return <div className="mx-auto max-w-[1500px] min-w-0 space-y-5 px-4 py-5 md:px-7 md:py-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tổng quan kho</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tồn kho, chất lượng và hoạt động vận hành</p>
      </div>
      <Button variant="outline" asChild><Link to="/racks"><Warehouse className="mr-2 size-4" />Sơ đồ kho</Link></Button>
    </div>
    <nav aria-label="Thao tác nhanh" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {actions.map(({ to, label, icon: Icon }, index) => <Button key={to} asChild variant={index === 0 ? 'default' : 'outline'} className="min-h-10 justify-start"><Link to={to}><Icon className="mr-2 size-4" />{label}</Link></Button>)}
    </nav>
    {!stock && summary.isError && <p role="status" className="text-sm text-amber-500">Không tải được số liệu tồn kho. <button className="underline" onClick={() => summary.refetch()}>Thử lại</button></p>}
    {warehouseStatus === 'error' && <p role="status" className="text-sm text-amber-500">Không tải được vị trí kho. <button className="underline" onClick={() => { void Promise.allSettled([refetchParts(), refetchRacks()]); }}>Thử lại</button></p>}
    <section aria-label="Chỉ số vận hành" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {kpis.map(({ label, value, unit, hint, to, tone, state = stockStatus }) => {
        const display = metricValue(state, value, label === 'Sử dụng sức chứa' ? 'Chưa có ô lưu trữ' : undefined);
        const hasNumber = state === 'ready' && value != null;
        const content = <><p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1 break-words font-semibold tabular-nums ${hasNumber ? `text-xl sm:text-2xl ${tone || 'text-foreground'}` : 'text-sm text-muted-foreground'}`}>{display} {hasNumber && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</>;
        const style = 'min-w-0 bg-card px-3 py-3 sm:px-4';
        return to ? <Link key={label} to={to} className={`${style} hover:bg-accent`}>{content}</Link> : <div key={label} className={style}>{content}</div>;
      })}
    </section>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(265px,1fr)]">
      <section className="min-w-0 rounded-xl border bg-card p-4">
        <SectionHeading title="Hoạt động 7 ngày" action="Báo cáo" to="/reports" />
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#2DD4BF]" />Nhập</span><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#60A5FA]" />Xuất</span></div>
        {activity.isPending || activity.isError || !activity.data?.some(day => day.inbound || day.outbound) ? <p className="py-10 text-sm text-muted-foreground">{activity.isPending ? 'Đang tải hoạt động…' : activity.isError ? 'Không tải được hoạt động.' : 'Không có giao dịch nhập hoặc xuất trong 7 ngày.'}</p> :
          <div className="mt-3 h-48 w-full" aria-label="Biểu đồ số giao dịch nhập và xuất theo ngày">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity.data} barGap={3} margin={{ left: 0, right: 5, top: 5 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={v => v.slice(5).split('-').reverse().join('/')} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} />
                <YAxis width={43} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v} allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="inbound" name="Nhập" fill="#2DD4BF" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                <Bar dataKey="outbound" name="Xuất" fill="#60A5FA" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
      </section>
      <section className="rounded-xl border bg-card p-4">
        <SectionHeading title="Cần xử lý" />
        <ul className="mt-3 divide-y divide-border">
          {alerts.map(({ label, value, to, color, state = stockStatus }) => <li key={label}><Link to={to} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary">
            <span>{label}</span><span className={value > 0 ? color : 'text-muted-foreground'}>{metricValue(state, value)}</span>
          </Link></li>)}
        </ul>
      </section>
    </div>
    <section className="rounded-xl border bg-card p-4">
      <SectionHeading title="Giao dịch gần đây" action="Lịch sử kho" to="/history" />
      {recent.isPending || recent.isError || recent.data?.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{recent.isPending ? 'Đang tải giao dịch…' : recent.isError ? 'Không tải được giao dịch.' : 'Chưa có giao dịch.'}</p> :
        <ul className="mt-2 divide-y divide-border">
          {recent.data.map(row => <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2.5 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_auto_10rem]">
            <span className="text-xs text-muted-foreground">{transactionLabel[row.type] || row.type}</span>
            <span className="order-3 break-words sm:order-none">{row.productCode && row.productCode !== row.partName ? `${row.productCode} · ` : ''}{row.partName}</span>
            <span className="justify-self-end tabular-nums">{fmtNum(row.quantityPcs)} đv</span>
            <span className="order-4 flex items-center justify-self-end gap-1 text-xs text-muted-foreground"><Clock3 size={13} />{fmtDate(row.createdAt, true)}</span>
          </li>)}
        </ul>}
    </section>
  </div>;
}
