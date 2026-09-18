import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { calcPartCbm, calcRackStats, fmtDec, fmtNum } from '@/lib/calculations';
import StatCard from '@/components/StatCard';
import UtilizationBar from '@/components/UtilizationBar';
import { Package, Warehouse, Layers3, AlertCircle, Weight, Ruler, MapPinned, Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { orders, parts, racks } = useStore();

  const stats = useMemo(() => {
    const totalCbm = parts.reduce((s, p) => s + calcPartCbm(p), 0);
    const totalWeight = parts.reduce((s, p) => s + (p.weight || 0), 0);
    const totalCartons = parts.reduce((s, p) => s + (p.cartons || 0), 0);
    const allocated = parts.filter((p) => p.rackId);
    const unallocated = parts.filter((p) => !p.rackId);
    const preferredSlots = new Set(
      parts
        .filter((p) => p.rackId && Number.isInteger(p.preferredRackSlot))
        .map((p) => `${p.rackId}:${p.preferredRackSlot}`),
    );
    const totalSlots = racks.length * 20;
    return {
      totalCbm,
      totalWeight,
      totalCartons,
      allocatedCount: allocated.length,
      unallocatedCount: unallocated.length,
      unallocatedCbm: unallocated.reduce((s, p) => s + calcPartCbm(p), 0),
      totalSlots,
      usedSlots: Math.max(preferredSlots.size, Math.min(allocated.length, totalSlots)),
    };
  }, [parts, racks]);

  const rackStats = useMemo(
    () => racks.map((r) => ({ rack: r, ...calcRackStats(parts, r) })),
    [racks, parts],
  );

  const zoneStats = useMemo(() => {
    const codes = [...new Set(racks.map((r) => r.zoneCode || 'ZONE-A'))].sort();
    return codes.map((zoneCode) => {
      const zoneRacks = racks.filter((r) => (r.zoneCode || 'ZONE-A') === zoneCode);
      const rackIds = new Set(zoneRacks.map((r) => r.id));
      const zoneParts = parts.filter((p) => rackIds.has(p.rackId));
      const usedRacks = new Set(zoneParts.map((p) => p.rackId).filter(Boolean)).size;
      const usedSlots = new Set(zoneParts.filter((p) => Number.isInteger(p.preferredRackSlot)).map((p) => `${p.rackId}:${p.preferredRackSlot}`)).size;
      const weight = zoneParts.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
      return { zoneCode, rackCount: zoneRacks.length, usedRacks, partCount: zoneParts.length, usedSlots, weight };
    });
  }, [racks, parts]);

  const activeRackStats = useMemo(() => rackStats.filter((s) => s.partCount > 0), [rackStats]);

  const slotPct = stats.totalSlots ? (stats.usedSlots / stats.totalSlots) * 100 : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tổng quan kho linh kiện</h1>
          <p className="text-sm text-slate-500 mt-1">Warehouse → Zone → Rack → Slot · Theo dõi vị trí linh kiện theo thời gian thực</p>
        </div>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3 bg-white">
          <MapPinned className="w-3.5 h-3.5" /> DENSO-WH
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Lô linh kiện" value={fmtNum(orders.length)} accent="indigo" />
        <StatCard icon={Layers3} label="Tổng PART" value={fmtNum(parts.length)} sub={`${fmtNum(stats.totalCartons)} thùng`} accent="emerald" />
        <StatCard icon={Warehouse} label="Kệ kho" value={fmtNum(racks.length)} sub={`${stats.totalSlots} ô lưu trữ`} accent="indigo" />
        <StatCard icon={AlertCircle} label="Chưa phân bổ" value={fmtNum(stats.unallocatedCount)} sub={`${fmtDec(stats.unallocatedCbm, 2)} m³ chờ xếp`} accent={stats.unallocatedCount > 0 ? 'amber' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center"><Ruler className="w-6 h-6 text-indigo-600" /></div>
            <div><p className="text-xs text-slate-500 font-medium">Tổng thể tích</p><p className="text-xl font-bold text-slate-900">{fmtDec(stats.totalCbm, 2)} m³</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center"><Weight className="w-6 h-6 text-emerald-600" /></div>
            <div><p className="text-xs text-slate-500 font-medium">Tổng trọng lượng</p><p className="text-xl font-bold text-slate-900">{fmtNum(stats.totalWeight)} kg</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center"><Boxes className="w-6 h-6 text-violet-600" /></div>
            <div><p className="text-xs text-slate-500 font-medium">Ô đang sử dụng</p><p className="text-xl font-bold text-slate-900">{stats.usedSlots}/{stats.totalSlots || 0}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Mức sử dụng vị trí</span><strong className="text-slate-800">{fmtDec(slotPct, 1)}%</strong></div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(slotPct, 100)}%` }} /></div>
            <p className="text-[11px] text-slate-400">{Math.max(0, stats.totalSlots - stats.usedSlots)} ô còn trống</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tổng quan theo Zone</CardTitle>
          <p className="text-xs text-slate-400 mt-1">Mỗi Zone là một khu kho độc lập, có tối đa 20 kệ và 400 ô riêng.</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {zoneStats.map((z) => (
              <Link key={z.zoneCode} to={`/racks?zone=${encodeURIComponent(z.zoneCode)}`} className="rounded-xl border bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition">
                <div className="flex items-center justify-between"><div className="font-bold text-slate-900">{z.zoneCode}</div><MapPinned className="w-4 h-4 text-indigo-500" /></div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2"><b className="block text-base">{z.rackCount}</b>kệ</div>
                  <div className="rounded-lg bg-slate-50 p-2"><b className="block text-base">{z.usedRacks}</b>có hàng</div>
                  <div className="rounded-lg bg-slate-50 p-2"><b className="block text-base">{z.usedSlots}</b>ô dùng</div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-3"><span>{z.partCount} PART</span><span>{fmtNum(z.weight)} kg</span></div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Kệ đang có hàng</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Chỉ hiển thị kệ đang chứa PART; kệ trống xem trong từng Zone.</p>
          </div>
          <Link to="/zones" className="text-xs font-medium text-indigo-600 hover:underline">Mở quản lý Zone →</Link>
        </CardHeader>
        <CardContent>
          {activeRackStats.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Chưa có kệ nào đang chứa hàng.</div>
          ) : (
            <div className="space-y-4">
              {activeRackStats.map(({ rack, ...st }) => (
                <div key={rack.id} className="grid grid-cols-1 md:grid-cols-[220px_1fr_1fr] gap-4 items-center border-b last:border-0 pb-4 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2"><Warehouse className="w-4 h-4 text-indigo-500" /><span className="font-semibold text-sm text-slate-800">{rack.name}</span></div>
                    <p className="text-[11px] text-slate-400 mt-1">{rack.warehouseCode} / {rack.zoneCode} · {st.partCount} PART</p>
                  </div>
                  <UtilizationBar percent={st.cbmPct} label="Dung lượng" sublabel={`${fmtDec(st.totalCbm, 2)} / ${rack.maxCbm} m³`} />
                  <UtilizationBar percent={st.weightPct} label="Trọng lượng" sublabel={`${fmtNum(st.totalWeight)} / ${fmtNum(rack.maxWeight)} kg`} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
