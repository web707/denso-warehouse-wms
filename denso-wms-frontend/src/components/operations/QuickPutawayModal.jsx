// QuickPutawayModal.jsx
// MASAN CONSUMER WMS · Hộp thoại Xếp dỡ & Nhập hàng vào ô kệ 3D (Putaway & Direct Inbound)
import { useState, useMemo, useEffect } from 'react';
import { api } from '@/api';
import { request } from '@/api/client';
import { useAuth } from '@/lib/auth';
import { canWrite } from '@/lib/access';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  PackagePlus,
  Box,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Calendar,
  Sparkles,
  ShieldCheck,
  ArrowDownToLine,
  Search
} from 'lucide-react';
import { slotCode, WAREHOUSE_CODE } from '@/lib/warehouse';

const MASAN_FMCG_PRESETS = [
  {
    sku: 'MSN-CHINSU-CHILI-250',
    name: 'Tương ớt Chin-su 250g',
    family: 'condiments',
    storageClass: 'condiments',
    defaultQty: 500,
    cartons: 50,
    weight: 125,
    uom: 'CHAI'
  },
  {
    sku: 'MSN-NAMNGU-DE-NHI-500',
    name: 'Nước mắm Nam Ngư Đệ Nhị 500ml',
    family: 'condiments',
    storageClass: 'condiments',
    defaultQty: 850,
    cartons: 85,
    weight: 425,
    uom: 'CHAI'
  },
  {
    sku: 'MSN-OMACHI-SPECIAL-BEEF',
    name: 'Mì Omachi Xốt bò hầm 80g',
    family: 'noodles',
    storageClass: 'dry_food',
    defaultQty: 600,
    cartons: 20,
    weight: 48,
    uom: 'GÓI'
  },
  {
    sku: 'MSN-KOKOMI-TOM-CHUA-CAY',
    name: 'Mì Kokomi Đại 90 Tôm chua cay',
    family: 'noodles',
    storageClass: 'dry_food',
    defaultQty: 560,
    cartons: 19,
    weight: 50,
    uom: 'GÓI'
  },
  {
    sku: 'MSN-VINTAGE-VODKA-500',
    name: 'Rượu Vodka Men 500ml',
    family: 'beverages',
    storageClass: 'beverages',
    defaultQty: 240,
    cartons: 20,
    weight: 120,
    uom: 'CHAI'
  }
];

export default function QuickPutawayModal({
  open,
  onClose,
  targetRack,
  targetSlotIndex,
  onSuccess
}) {
  const { user } = useAuth();
  const { parts, refetchParts, refetchRacks, applyInventorySnapshot } = useStore();
  const { toast } = useToast();
  const hasPermission = canWrite(user?.role, 'inventory');

  // Mode: 'unslotted' (xếp dỡ hàng chờ) hoặc 'direct' (tạo lô nhập mới)
  const [activeTab, setActiveTab] = useState('unslotted');
  const [unslottedSearch, setUnslottedSearch] = useState('');
  const [selectedUnslottedId, setSelectedUnslottedId] = useState('');

  // Direct Inbound State
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [directSku, setDirectSku] = useState(MASAN_FMCG_PRESETS[0].sku);
  const [directName, setDirectName] = useState(MASAN_FMCG_PRESETS[0].name);
  const [directLot, setDirectLot] = useState(() => `LOT-INB-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`);
  const [directExpiry, setDirectExpiry] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [directQty, setDirectQty] = useState(MASAN_FMCG_PRESETS[0].defaultQty);
  const [directCartons, setDirectCartons] = useState(MASAN_FMCG_PRESETS[0].cartons);
  const [directWeight, setDirectWeight] = useState(MASAN_FMCG_PRESETS[0].weight);

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Lọc danh sách PART đang chờ xếp dỡ (chưa gán rackId hoặc preferredRackSlot = null)
  const unslottedParts = useMemo(() => {
    return parts.filter(p => !p.rackId || p.preferredRackSlot === null || p.preferredRackSlot === undefined);
  }, [parts]);

  const filteredUnslotted = useMemo(() => {
    if (!unslottedSearch.trim()) return unslottedParts;
    const q = unslottedSearch.toLowerCase();
    return unslottedParts.filter(p =>
      p.productCode?.toLowerCase().includes(q) ||
      p.partName?.toLowerCase().includes(q) ||
      p.lotNumber?.toLowerCase().includes(q)
    );
  }, [unslottedParts, unslottedSearch]);

  // Tự động chọn item đầu tiên nếu chưa chọn
  useEffect(() => {
    if (unslottedParts.length > 0 && !selectedUnslottedId) {
      setSelectedUnslottedId(unslottedParts[0].id);
    }
  }, [unslottedParts, selectedUnslottedId]);

  const selectedUnslottedPart = useMemo(() => {
    return unslottedParts.find(p => p.id === selectedUnslottedId) || null;
  }, [unslottedParts, selectedUnslottedId]);

  // Cập nhật preset
  const handleSelectPreset = (index) => {
    const preset = MASAN_FMCG_PRESETS[index];
    setSelectedPresetIndex(index);
    setDirectSku(preset.sku);
    setDirectName(preset.name);
    setDirectQty(preset.defaultQty);
    setDirectCartons(preset.cartons);
    setDirectWeight(preset.weight);
  };

  const handlePutawayUnslotted = async () => {
    if (!selectedUnslottedPart) {
      setError('Vui lòng chọn một mặt hàng từ danh sách chờ xếp dỡ.');
      return;
    }
    if (!targetRack || targetSlotIndex === null || targetSlotIndex === undefined) {
      setError('Vị trí ô kệ đích không hợp lệ.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      // Gán vị trí cho PART vào ô đích
      const assigned = await api.parts.assignRack(
        selectedUnslottedPart.id,
        targetRack.id,
        targetSlotIndex
      );

      // Ghi nhận giao dịch Inbound Placement
      try {
        await api.inventory.create({
          type: 'inbound',
          partId: selectedUnslottedPart.id,
          toRackId: targetRack.id,
          toSlot: targetSlotIndex,
          quantityPcs: Number(selectedUnslottedPart.quantity || selectedUnslottedPart.quantityPcs || 0),
          cartonCount: Number(selectedUnslottedPart.cartons || selectedUnslottedPart.cartonCount || 1),
          weightKg: Number(selectedUnslottedPart.weight || selectedUnslottedPart.totalWeightKg || 0),
          note: note.trim() || `Xếp dỡ hàng từ khu tiếp nhận vào kệ ${targetRack.name} : ${slotCode(targetSlotIndex)}`
        }, user?.id);
      } catch (txErr) {
        console.warn('Inbound transaction log notice:', txErr);
      }

      await Promise.allSettled([refetchParts(), refetchRacks()]);
      try {
        localStorage.setItem('wms_inventory_committed', String(Date.now()));
      } catch {}
      window.dispatchEvent(new Event('wms-inventory-committed'));

      toast({
        title: 'Xếp dỡ hàng thành công',
        description: `Đã đưa ${selectedUnslottedPart.partName || selectedUnslottedPart.productCode} vào Kệ ${targetRack.name} · ${slotCode(targetSlotIndex)}.`
      });

      onSuccess?.(assigned);
      onClose();
    } catch (err) {
      setError(err.message || 'Không thể xếp dỡ hàng vào ô này. Kiểm tra dung lượng hoặc nhóm bảo quản.');
    } finally {
      setBusy(false);
    }
  };

  const handleDirectInbound = async () => {
    if (!directSku || !directName || directQty <= 0) {
      setError('Vui lòng nhập đầy đủ SKU, Tên hàng và Số lượng hợp lệ.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      // Lấy danh sách division và order sẵn có trong hệ thống để gán liên kết hợp lệ
      const orders = await api.orders.list().catch(() => []);
      const divisions = await api.divisions.list().catch(() => []);

      const fallbackOrderId = orders[0]?.id;
      const fallbackDivisionId = divisions[0]?.id;

      if (!fallbackOrderId || !fallbackDivisionId) {
        throw new Error('Chưa có cấu hình Đơn hàng hoặc Ngành hàng trong cơ sở dữ liệu WMS.');
      }

      // Tạo Part mới và đặt trực tiếp vào rack + slot
      const preset = MASAN_FMCG_PRESETS[selectedPresetIndex] || MASAN_FMCG_PRESETS[0];
      const newPart = await request('/parts', {
        method: 'POST',
        body: {
          partName: directName.trim(),
          productCode: directSku.trim(),
          productFamily: preset.family,
          storageClass: preset.storageClass,
          orderId: fallbackOrderId,
          divisionId: fallbackDivisionId,
          dcPrefixId: divisions[0]?.dcPrefixId || 'd09a43d8-a160-459b-97aa-eec480720d31',
          masterPo: `PO-3D-${Date.now().toString().slice(-6)}`,
          quantityPcs: Number(directQty),
          cartonCount: Number(directCartons),
          totalWeightKg: Number(directWeight),
          cartonLengthMm: 380,
          cartonWidthMm: 280,
          cartonHeightMm: 220,
          lotNumber: directLot.trim(),
          expirationDate: directExpiry,
          rackId: targetRack.id,
          slotIndex: targetSlotIndex
        }
      });

      // Ghi nhận transaction Inbound
      if (newPart?.id) {
        try {
          await api.inventory.create({
            type: 'inbound',
            partId: newPart.id,
            toRackId: targetRack.id,
            toSlot: targetSlotIndex,
            quantityPcs: Number(directQty),
            cartonCount: Number(directCartons),
            weightKg: Number(directWeight),
            note: note.trim() || `Nhập trực tiếp từ 3D Control Center: ${directSku} vào ${targetRack.name}:${slotCode(targetSlotIndex)}`
          }, user?.id);
        } catch (txErr) {
          console.warn('Inbound transaction log notice:', txErr);
        }
      }

      await Promise.allSettled([refetchParts(), refetchRacks()]);
      try {
        localStorage.setItem('wms_inventory_committed', String(Date.now()));
      } catch {}
      window.dispatchEvent(new Event('wms-inventory-committed'));

      toast({
        title: 'Nhập kho thành công',
        description: `Đã nhập mới lô hàng ${directSku} (${directQty} đv) vào Kệ ${targetRack.name} · ${slotCode(targetSlotIndex)}.`
      });

      onSuccess?.(newPart);
      onClose();
    } catch (err) {
      setError(err.message || 'Không thể tạo mới lô hàng vào ô này. Kiểm tra các trường thông tin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-lg border-[#243449] bg-[#101b2b] text-[#f8fafc]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <PackagePlus className="size-5 text-emerald-400" /> Xếp dỡ & Nhập hàng vào ô lưu trữ 3D
          </DialogTitle>
          <DialogDescription className="text-xs text-[#94a3b8]">
            Chỉ định hàng hóa vào vị trí ô kệ trống. Dữ liệu sẽ lưu trữ vào PostgreSQL và hiển thị tức thì trên 3D.
          </DialogDescription>
        </DialogHeader>

        {/* Vị trí ô đích */}
        <div className="flex items-center justify-between rounded-lg border border-[#243449] bg-[#162338] p-3 text-xs">
          <div>
            <span className="text-[#94a3b8] block text-[11px]">Vị trí ô tiếp nhận:</span>
            <span className="font-bold text-white text-sm">
              Kệ {targetRack?.name} · {slotCode(targetSlotIndex)}
            </span>
          </div>
          <div className="text-right">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
              Ô TRỐNG KHẢ DỤNG
            </Badge>
            <p className="text-[10px] text-[#94a3b8] mt-0.5">
              Bay {(targetSlotIndex % 5) + 1} · Tầng {Math.floor(targetSlotIndex / 5) + 1}
            </p>
          </div>
        </div>

        {!hasPermission && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertCircle className="size-4 shrink-0" />
            Tài khoản hiện tại có quyền xem, không được cấp quyền nhập/xếp dỡ hàng.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex border-b border-[#243449] bg-[#0c1626] rounded-t-lg">
          <button
            type="button"
            onClick={() => { setActiveTab('unslotted'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'unslotted'
                ? 'border-emerald-500 text-emerald-400 bg-[#142338]'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <ArrowDownToLine className="size-3.5" />
            Hàng chờ xếp dỡ ({unslottedParts.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('direct'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'direct'
                ? 'border-emerald-500 text-emerald-400 bg-[#142338]'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <Sparkles className="size-3.5" />
            Nhập lô hàng mới
          </button>
        </div>

        {/* TAB 1: XẾP DỠ HÀNG CHỜ NHẬP */}
        {activeTab === 'unslotted' && (
          <div className="space-y-3 pt-1 text-xs">
            {unslottedParts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#243449] p-6 text-center text-[#94a3b8] space-y-1">
                <Box className="size-6 mx-auto text-[#64748b]" />
                <p className="font-semibold text-white">Không có hàng chờ xếp dỡ</p>
                <p className="text-[11px]">Toàn bộ hàng đã có vị trí hoặc hãy dùng tab "Nhập lô hàng mới" bên cạnh.</p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-[#64748b]" />
                  <Input
                    value={unslottedSearch}
                    onChange={e => setUnslottedSearch(e.target.value)}
                    placeholder="Tìm theo SKU, tên sản phẩm hoặc số lô..."
                    className="h-8 pl-8 text-xs border-[#243449] bg-[#121f33] text-white"
                  />
                </div>

                {/* Dropdown / list of unslotted parts */}
                <div className="space-y-1">
                  <label className="font-semibold text-[#94a3b8] block">Chọn hàng hóa cần xếp vào ô:</label>
                  <select
                    value={selectedUnslottedId}
                    onChange={e => setSelectedUnslottedId(e.target.value)}
                    className="h-9 w-full rounded-md border border-[#243449] bg-[#121f33] px-3 text-xs text-white focus:outline-none"
                  >
                    {filteredUnslotted.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.productCode || p.partName} · Lô: {p.lotNumber || 'N/A'} ({p.quantity || p.quantityPcs || 0} đv · {p.cartons || p.cartonCount || 0} thùng)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected item preview */}
                {selectedUnslottedPart && (
                  <div className="rounded-lg border border-[#243449] bg-[#0e192a] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{selectedUnslottedPart.partName || selectedUnslottedPart.productCode}</span>
                      <span className="font-mono text-emerald-400 font-bold">{selectedUnslottedPart.productCode}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#94a3b8]">
                      <div>Số lô: <strong className="text-white">{selectedUnslottedPart.lotNumber || 'Chưa có'}</strong></div>
                      <div>Hạn dùng: <strong className="text-white">{selectedUnslottedPart.expirationDate ? new Date(selectedUnslottedPart.expirationDate).toLocaleDateString('vi-VN') : 'Tiêu chuẩn'}</strong></div>
                      <div>Số lượng: <strong className="text-white">{selectedUnslottedPart.quantity || selectedUnslottedPart.quantityPcs || 0}</strong> đơn vị</div>
                      <div>Quy cách: <strong className="text-white">{selectedUnslottedPart.cartons || selectedUnslottedPart.cartonCount || 1}</strong> thùng ({selectedUnslottedPart.weight || selectedUnslottedPart.totalWeightKg || 0} kg)</div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Ghi chú */}
            <div className="space-y-1">
              <label className="font-semibold text-[#94a3b8] block">Ghi chú nghiệp vụ:</label>
              <Input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ghi chú điều phối..."
                className="h-8 text-xs border-[#243449] bg-[#121f33] text-white"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="border-[#243449] bg-transparent text-[#94a3b8]">
                Hủy
              </Button>
              <Button
                type="button"
                onClick={handlePutawayUnslotted}
                disabled={!hasPermission || busy || !selectedUnslottedPart}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Xác nhận xếp vào ô này
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* TAB 2: NHẬP LÔ HÀNG MỚI */}
        {activeTab === 'direct' && (
          <div className="space-y-3 pt-1 text-xs">
            {/* Quick Presets */}
            <div className="space-y-1">
              <span className="font-semibold text-[#94a3b8] block">Chọn nhanh danh mục sản phẩm Masan FMCG:</span>
              <div className="flex flex-wrap gap-1.5">
                {MASAN_FMCG_PRESETS.map((p, idx) => (
                  <button
                    key={p.sku}
                    type="button"
                    onClick={() => handleSelectPreset(idx)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                      selectedPresetIndex === idx
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#142338] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {p.name.split(' ')[0]} {p.name.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="font-semibold text-[#94a3b8]">Mã SKU:</label>
                <Input
                  value={directSku}
                  onChange={e => setDirectSku(e.target.value)}
                  className="h-8 border-[#243449] bg-[#121f33] text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#94a3b8]">Tên mặt hàng:</label>
                <Input
                  value={directName}
                  onChange={e => setDirectName(e.target.value)}
                  className="h-8 border-[#243449] bg-[#121f33] text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#94a3b8]">Số lô (Lot number):</label>
                <Input
                  value={directLot}
                  onChange={e => setDirectLot(e.target.value)}
                  className="h-8 border-[#243449] bg-[#121f33] text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#94a3b8]">Hạn sử dụng (Expiry):</label>
                <Input
                  type="date"
                  value={directExpiry}
                  onChange={e => setDirectExpiry(e.target.value)}
                  className="h-8 border-[#243449] bg-[#121f33] text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#94a3b8]">Số lượng (PCS):</label>
                <Input
                  type="number"
                  min={1}
                  value={directQty}
                  onChange={e => setDirectQty(Number(e.target.value))}
                  className="h-8 border-[#243449] bg-[#121f33] text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#94a3b8]">Số thùng / Tải trọng (kg):</label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    value={directCartons}
                    onChange={e => setDirectCartons(Number(e.target.value))}
                    placeholder="Thùng"
                    className="h-8 w-1/2 border-[#243449] bg-[#121f33] text-white"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={directWeight}
                    onChange={e => setDirectWeight(Number(e.target.value))}
                    placeholder="kg"
                    className="h-8 w-1/2 border-[#243449] bg-[#121f33] text-white"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="border-[#243449] bg-transparent text-[#94a3b8]">
                Hủy
              </Button>
              <Button
                type="button"
                onClick={handleDirectInbound}
                disabled={!hasPermission || busy || !directSku || directQty <= 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
                Xác nhận tạo & nhập kho
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
