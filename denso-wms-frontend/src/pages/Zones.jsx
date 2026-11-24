import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Eye, Layers3, Loader2, MapPinned, Plus, Sparkles, Warehouse } from 'lucide-react';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { RACKS_PER_ZONE, WAREHOUSE_CODE, summarizeZone } from '@/lib/warehouse';
import { STORAGE_MODES, modeLabel } from '@/lib/masanStorage';
import { inspectZoneRacks } from '@/lib/zoneRackInventory';
import { FAMILY_LABELS } from '@/lib/rackProductFamily';

const TARGET_RACKS = RACKS_PER_ZONE;

export default function Zones() {
  const { orders, parts, racks, rackTypes, currentOrderId, initializeWarehouse } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [code, setCode] = useState('ZONE-D');
  const [name, setName] = useState('Khu D');
  const [storageMode, setStorageMode] = useState('ambient');
  const [productFamily, setProductFamily] = useState('');
  const [savingMode, setSavingMode] = useState(null);
  const [creating, setCreating] = useState(false);
  const [initializingCode, setInitializingCode] = useState(null);

  const load = async () => setZones(await api.zones.list({ warehouseCode: 'DENSO-WH' }));
  useEffect(() => { load().catch(() => {}); }, []);

  const anchorOrderId = useMemo(
    () => racks.find((r) => r.orderId)?.orderId || currentOrderId || orders[0]?.id || null,
    [racks, currentOrderId, orders],
  );

  const summaries = useMemo(() => zones.map((zone) => {
    const sum = summarizeZone(zone.code, racks.filter((r) => (r.warehouseCode || WAREHOUSE_CODE) === zone.warehouseCode), parts);
    const records = sum.racks.map((r) => r.rack);
    const zoneParts = sum.racks.flatMap((r) => r.parts);
    const inspection = inspectZoneRacks(records, parts);
    const shownIds = new Set(inspection.physicalRacks.map((rack) => rack.id));
    const shown = sum.racks.filter((item) => shownIds.has(item.rack.id));
    return {
      zone, zoneRacks: inspection.physicalRacks, zoneParts,
      usedRacks: shown.filter((item) => item.usedSlots > 0).length,
      usedSlots: shown.reduce((total, item) => total + item.usedSlots, 0),
      weight: sum.totalWeight, inspection,
    };
  }), [zones, racks, parts]);

  const createZone = async () => {
    if (!code.trim() || !name.trim()) return;
    setCreating(true);
    try {
      const created = await api.zones.create({ warehouseCode: 'DENSO-WH', code: code.trim().toUpperCase(), name: name.trim(), storageMode, productFamily: productFamily || null });
      await load();
      toast({ title: 'Đã tạo Zone mới', description: `${created.code} được tạo độc lập và hiện chưa có kệ.` });
      setCode('ZONE-D');
      setName('Khu D');
      setStorageMode('ambient');
      setProductFamily('');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không tạo được Zone', description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const changeStorageMode = async (zone, newMode) => {
    if (zone.storageMode === newMode) return;
    setSavingMode(zone.id);
    try {
      await api.zones.update(zone.id, { storageMode: newMode });
      await load();
      toast({ title: `Đã cập nhật khu ${zone.code}`, description: modeLabel(newMode) });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Không thể đổi kiểu kho', description: error.message });
    } finally { setSavingMode(null); }
  };

  const changeProductFamily = async (zone, value) => {
    setSavingMode(zone.id);
    try {
      await api.zones.update(zone.id, { productFamily: value || null });
      await load();
      toast({ title: 'Đã cập nhật nhóm hàng của Zone' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Không thể đổi nhóm hàng', description: error.message });
    } finally { setSavingMode(null); }
  };

  const initializeZone = async (zoneCode) => {
    if (!anchorOrderId) {
      toast({ variant: 'destructive', title: 'Chưa có lô sản phẩm', description: 'Cần có ít nhất một lô sản phẩm để khởi tạo kệ cho Zone mới.' });
      return;
    }
    setInitializingCode(zoneCode);
    try {
      const currentZoneRack = racks.find((r) => r.zoneCode === zoneCode);
      const rackTypeId = currentZoneRack?.rackTypeId || racks[0]?.rackTypeId || rackTypes[0]?.id;
      const result = await initializeWarehouse({
        orderId: anchorOrderId,
        warehouseCode: 'DENSO-WH',
        zoneCode,
        rackCount: TARGET_RACKS,
        rackTypeId,
      });
      toast({
        title: `Đã khởi tạo ${zoneCode}`,
        description: result.extraCount > 0
          ? `Có ${result.extraCount} bản ghi dư/trùng cần đối chiếu. Không tạo kệ mới.`
          : result.createdCount > 0
            ? `Đã tạo ${result.createdCount} kệ mới trong ${zoneCode}.`
            : `${zoneCode} đã đủ 20 kệ, không tạo thêm.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: `Không khởi tạo được ${zoneCode}`, description: e.message });
    } finally {
      setInitializingCode(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-masan-text">Quản lý Zone & Điều kiện bảo quản</h1>
          <p className="text-sm text-masan-muted mt-1">Mỗi Zone có điều kiện bảo quản riêng biệt (Kho mát MEATDeli 0-4°C, Thực phẩm khô, Nông sản, Hóa phẩm riêng biệt & Khu cách ly ZONE-Q).</p>
        </div>
        <Badge variant="outline" className="bg-masan-surface border-masan-border text-masan-text gap-1.5"><Warehouse className="w-3.5 h-3.5 text-masan-teal" /> DC-HN-01 (Masan FMCG Hub)</Badge>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {summaries.map(({ zone, zoneRacks, zoneParts, usedRacks, usedSlots, weight, inspection }) => {
          const rackPct = Math.min(100, (zoneRacks.length / TARGET_RACKS) * 100);
          const isInitializing = initializingCode === zone.code;
          const hasActualStock = zoneParts.some((p) => Number(p.cartons || 0) > 0 || Number(p.quantity || 0) > 0);

          return (
            <div key={zone.id} className="bg-masan-surface border border-masan-border rounded-2xl p-5 shadow-lg text-masan-text">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-masan-muted font-mono">{zone.warehouseCode || 'MASAN-HN-01'}</div>
                  <div className="font-bold text-xl text-masan-text">{zone.code}</div>
                  <div className="text-sm text-masan-teal font-medium">{zone.name}</div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-masan-emerald/10 border border-masan-emerald/20 flex items-center justify-center">
                  <MapPinned className="w-5 h-5 text-masan-emerald" />
                </div>
              </div>

              <label className="mt-4 block text-xs font-semibold text-masan-muted">
                Điều kiện bảo quản của Zone
                <select
                  aria-label={`Nhóm hàng ${zone.code}`}
                  className="mt-1 h-9 w-full rounded-lg border border-masan-border bg-masan-elevated px-2 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
                  value={zone.productFamily || ''}
                  disabled={savingMode === zone.id}
                  onChange={(e) => changeProductFamily(zone, e.target.value)}
                >
                  <option value="">Mọi nhóm phù hợp</option>
                  {Object.entries(FAMILY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Loại kho ${zone.code}`}
                  className="mt-1 h-9 w-full rounded-lg border border-masan-border bg-masan-elevated px-2 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
                  value={zone.storageMode || 'ambient'}
                  disabled={savingMode === zone.id || hasActualStock}
                  onChange={(e) => changeStorageMode(zone, e.target.value)}
                >
                  {STORAGE_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
                {hasActualStock && (
                  <span className="block font-normal text-amber-400 mt-1.5 text-[11px]">
                    Zone đang có tồn kho thực tế. Vui lòng điều chuyển hết hàng trước khi thay đổi chế độ bảo quản.
                  </span>
                )}
              </label>

              <div className="grid grid-cols-3 gap-2 mt-5 text-center">
                <div className="rounded-xl bg-masan-elevated/70 border border-masan-border p-2">
                  <div className="font-bold text-lg font-mono text-masan-text">
                    {inspection.physicalCount}/{TARGET_RACKS}
                  </div>
                  <div className="text-[10px] text-masan-muted">Kệ vật lý</div>
                </div>
                <div className="rounded-xl bg-masan-elevated/70 border border-masan-border p-2">
                  <div className="font-bold text-lg font-mono text-masan-text">{usedRacks}</div>
                  <div className="text-[10px] text-masan-muted">Kệ có hàng</div>
                </div>
                <div className="rounded-xl bg-masan-elevated/70 border border-masan-border p-2">
                  <div className="font-bold text-lg font-mono text-masan-emerald">{usedSlots}</div>
                  <div className="text-[10px] text-masan-muted">Ô đang dùng</div>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-masan-muted">Mức khởi tạo kệ</span>
                  <strong className="text-masan-text font-mono">
                    {inspection.physicalCount}/{TARGET_RACKS}
                  </strong>
                </div>
                <Progress value={rackPct} className="h-1.5" />
                <div className="flex justify-between text-[11px] text-masan-muted font-mono">
                  <span>{zoneParts.length} SKU</span>
                  <span>{weight.toLocaleString('vi-VN')} kg</span>
                </div>
              </div>

              {inspection.hasSurplus && (
                <div role="alert" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  <b>{inspection.surplusRacks.length} bản ghi kệ dư hoặc trùng</b> ngoài 20 vị trí trên sơ đồ.
                  {inspection.surplusWithStock.length > 0 && (
                    <span> Có {inspection.surplusWithStock.length} bản ghi đang gắn hàng, phải kiểm tra và điều chuyển trước khi dọn dữ liệu.</span>
                  )}
                  <p className="mt-1 text-[11px] text-amber-300/80">Không xóa tự động để tránh mất vị trí hàng; tổng khối lượng vẫn tính cả hàng ở bản ghi dư.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-5">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/racks?zone=${encodeURIComponent(zone.code)}`)}
                  className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-teal hover:text-masan-teal"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5 text-masan-teal" /> Mở mô hình
                </Button>
                <Button
                  onClick={() => initializeZone(zone.code)}
                  disabled={isInitializing || zoneRacks.length >= TARGET_RACKS || inspection.hasSurplus || !anchorOrderId}
                  className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
                >
                  {isInitializing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {zoneRacks.length >= TARGET_RACKS ? 'Đã đủ 20 kệ' : 'Khởi tạo 20 kệ'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-masan-surface border border-masan-border rounded-2xl p-5 shadow-lg text-masan-text">
        <div className="flex items-center gap-2 font-bold mb-1 text-sm text-masan-text">
          <Plus className="w-4 h-4 text-masan-teal" /> Tạo Zone hoàn toàn mới
        </div>
        <p className="text-xs text-masan-muted mb-4">
          Tạo Zone phân luồng kho. Sau đó nhấn “Khởi tạo 20 kệ” trên thẻ Zone để tạo R01–R20 riêng cho khu đó.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Input
            className="max-w-40 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ZONE-D"
          />
          <Input
            className="max-w-64 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Khu D"
          />
          <select
            aria-label="Nhóm hàng zone mới"
            className="h-10 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
            value={productFamily}
            onChange={(e) => setProductFamily(e.target.value)}
          >
            <option value="">Mọi nhóm phù hợp</option>
            {Object.entries(FAMILY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Điều kiện bảo quản zone mới"
            className="h-10 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
            value={storageMode}
            onChange={(e) => setStorageMode(e.target.value)}
          >
            {STORAGE_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          <Button
            onClick={createZone}
            disabled={creating}
            className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            Tạo Zone
          </Button>
        </div>
      </div>

      <div className="bg-masan-surface border border-masan-border rounded-2xl p-5 text-masan-text">
        <div className="font-bold text-sm text-masan-teal flex items-center gap-2">
          <Layers3 className="w-4 h-4" /> Cấu trúc Multi-Zone Masan FMCG
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-3 text-xs text-masan-muted">
          <div className="bg-masan-elevated/60 rounded-xl p-3 border border-masan-border/60">
            <b className="text-masan-text">ZONE-A · Tiêu dùng khô</b>
            <div className="mt-1">R01–R20 riêng · Nhiệt độ phòng (Ambient)</div>
          </div>
          <div className="bg-masan-elevated/60 rounded-xl p-3 border border-masan-border/60">
            <b className="text-masan-text">ZONE-B · Đồ uống & Gia vị</b>
            <div className="mt-1">R01–R20 riêng · Nước mắm, nước tương, cà phê</div>
          </div>
          <div className="bg-masan-elevated/60 rounded-xl p-3 border border-masan-border/60">
            <b className="text-masan-text">ZONE-C · Thịt mát MEATDeli</b>
            <div className="mt-1">R01–R20 riêng · Kho lạnh / Chilled 0 - 4°C</div>
          </div>
        </div>
        <p className="text-[11px] text-masan-muted mt-3 flex items-center gap-1.5">
          <Boxes className="w-3.5 h-3.5 text-masan-emerald" /> Mỗi Zone chứa 20 kệ (400 ô lưu trữ). Tách biệt hoàn toàn hóa phẩm tẩy rửa NET/Sopa và khu thực phẩm theo tiêu chuẩn HACCP.
        </p>
      </div>
    </div>
  );
}
