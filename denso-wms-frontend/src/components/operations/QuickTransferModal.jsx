// QuickTransferModal.jsx
// Hộp thoại điều chuyển hàng nhanh trực tiếp từ mô hình 3D
import { useState, useMemo, useEffect } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/auth';
import { canWrite } from '@/lib/access';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ArrowRightLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { slotCode, WAREHOUSE_CODE, zoneOf } from '@/lib/warehouse';

export default function QuickTransferModal({
  open,
  onClose,
  sourceRack,
  sourceSlotIndex,
  sourcePart,
  initialTargetRackId = '',
  initialTargetSlot = '',
  onRequest3DSelectTarget,
  onSuccess
}) {
  const { user } = useAuth();
  const { racks, parts, applyInventorySnapshot, refetchParts } = useStore();
  const { toast } = useToast();
  const hasPermission = canWrite(user?.role, 'inventory');

  const [targetRackId, setTargetRackId] = useState(() => initialTargetRackId || '');
  const [targetSlot, setTargetSlot] = useState(() => initialTargetSlot !== undefined ? String(initialTargetSlot) : '');
  const [transferQty, setTransferQty] = useState(() => sourcePart?.quantity || 0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Update default transfer quantity and targets when props change
  useEffect(() => {
    if (sourcePart?.quantity) {
      setTransferQty(sourcePart.quantity);
    }
  }, [sourcePart]);

  useEffect(() => {
    if (initialTargetRackId) {
      setTargetRackId(initialTargetRackId);
    }
  }, [initialTargetRackId]);

  useEffect(() => {
    if (initialTargetSlot !== '' && initialTargetSlot !== null && initialTargetSlot !== undefined) {
      setTargetSlot(String(initialTargetSlot));
    }
  }, [initialTargetSlot]);

  const targetRack = useMemo(() => racks.find(r => r.id === targetRackId), [racks, targetRackId]);

  const usedTargetSlots = useMemo(() => {
    if (!targetRackId) return new Set();
    return new Set(
      parts
        .filter(p => p.rackId === targetRackId && p.id !== sourcePart?.id)
        .map(p => p.preferredRackSlot)
        .filter(Number.isInteger)
    );
  }, [parts, targetRackId, sourcePart]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasPermission) {
      setError('Bạn không có quyền thực hiện điều chuyển tồn kho. Yêu cầu quyền Nhân viên kho hoặc Quản lý kho.');
      return;
    }
    if (!sourcePart || !sourceRack || !targetRackId) {
      setError('Vui lòng chọn kệ và ô nhận hàng hợp lệ.');
      return;
    }
    if (sourceRack.id === targetRackId && targetSlot !== '' && Number(targetSlot) === sourceSlotIndex) {
      setError('Ô đích trùng với ô nguồn. Vui lòng chọn ô khác.');
      return;
    }

    setBusy(true);
    setError('');

    const maxQty = Number(sourcePart.quantity) || 0;
    const qtyToTransfer = Math.max(1, Math.min(Number(transferQty) || maxQty, maxQty));
    const ratio = maxQty > 0 ? (qtyToTransfer / maxQty) : 1;
    const cartonsToTransfer = Math.max(1, Math.round((Number(sourcePart.cartons) || 1) * ratio));
    const weightToTransfer = Number(((Number(sourcePart.weight) || 0) * ratio).toFixed(2));

    try {
      const tx = await api.inventory.create({
        type: 'transfer',
        partId: sourcePart.id,
        quantityPcs: qtyToTransfer,
        cartonCount: cartonsToTransfer,
        weightKg: weightToTransfer,
        toRackId: targetRackId,
        expectedFromRackId: sourceRack.id,
        expectedFromSlot: sourceSlotIndex ?? sourcePart.preferredRackSlot ?? undefined,
        ...(targetSlot !== '' ? { toSlot: Number(targetSlot) } : {}),
        note: note.trim() || `Điều chuyển trực tiếp từ Trung tâm điều hành 3D: ${sourceRack.name}:${slotCode(sourceSlotIndex)} → ${targetRack?.name || 'Kệ đích'}:${targetSlot !== '' ? slotCode(Number(targetSlot)) : 'Ô tự động'} (${qtyToTransfer}/${maxQty} đv)`
      }, user?.id);

      if (tx.partSnapshot && !tx.retry) {
        applyInventorySnapshot(tx.partSnapshot);
      } else {
        await refetchParts();
      }

      try {
        localStorage.setItem('wms_inventory_committed', String(Date.now()));
      } catch {}
      window.dispatchEvent(new Event('wms-inventory-committed'));

      toast({
        title: 'Điều chuyển thành công',
        description: `Đã chuyển ${sourcePart.partName || sourcePart.productCode} sang ${targetRack?.name || 'Kệ đích'} · ${targetSlot !== '' ? slotCode(Number(targetSlot)) : 'Ô tự chọn an toàn'}.`
      });

      onSuccess?.(tx);
      onClose();
    } catch (err) {
      setError(err.message || 'Không thể thực hiện điều chuyển. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md border-[#243449] bg-[#101b2b] text-[#f8fafc]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <ArrowRightLeft className="size-5 text-primary" /> Điều chuyển vị trí hàng hóa 3D
          </DialogTitle>
          <DialogDescription className="text-xs text-[#94a3b8]">
            Lệnh điều chuyển vật lý sẽ cập nhật trực tiếp vị trí lưu trữ trong cơ sở dữ liệu WMS.
          </DialogDescription>
        </DialogHeader>

        {!hasPermission && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertCircle className="size-4 shrink-0" />
            Tài khoản hiện tại có quyền xem, không được cấp quyền ghi nhận điều chuyển.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Vị trí nguồn */}
          <div className="rounded-lg border border-[#243449] bg-[#162338] p-3 space-y-1">
            <p className="font-semibold text-[#94a3b8]">Vị trí nguồn hiện tại:</p>
            <p className="text-sm font-bold text-white">
              {sourceRack?.name || 'Kệ'} · {slotCode(sourceSlotIndex)} ({sourceRack?.zoneCode || 'Zone A'})
            </p>
            <p className="text-primary font-medium">
              {sourcePart?.partName || sourcePart?.productCode || 'Hàng hóa'} · Số lô: {sourcePart?.lotNumber || 'Chưa có'}
            </p>
            <p className="text-[#94a3b8]">
              Số lượng: <strong className="text-white">{sourcePart?.quantity || 0}</strong> đơn vị · {sourcePart?.cartons || 0} thùng · {sourcePart?.weight || 0} kg
            </p>
          </div>

          {/* Số lượng điều chuyển */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="transfer-qty-input" className="font-semibold text-[#94a3b8]">Số lượng điều chuyển (đơn vị):</label>
              <button
                type="button"
                onClick={() => setTransferQty(sourcePart?.quantity || 0)}
                className="text-[10px] text-primary hover:underline"
              >
                Chuyển toàn bộ ({sourcePart?.quantity || 0})
              </button>
            </div>
            <Input
              id="transfer-qty-input"
              type="number"
              min={1}
              max={sourcePart?.quantity || 99999}
              required
              disabled={!hasPermission || busy}
              value={transferQty}
              onChange={e => setTransferQty(Math.max(1, Math.min(Number(sourcePart?.quantity || 99999), Number(e.target.value))))}
              className="h-9 border-[#243449] bg-[#131f33] text-white"
            />
          </div>

          {/* Kệ đích */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[#94a3b8]">Kệ nhận hàng (Kệ đích):</label>
              {onRequest3DSelectTarget && (
                <button
                  type="button"
                  onClick={() => {
                    onRequest3DSelectTarget();
                  }}
                  className="text-[11px] font-semibold text-primary hover:text-teal-300 flex items-center gap-1 transition"
                  title="Nhấp vào ô trống bất kỳ trên không gian 3D để chọn làm đích"
                >
                  🎯 Chọn trực tiếp trên 3D
                </button>
              )}
            </div>
            <select
              required
              disabled={!hasPermission || busy}
              value={targetRackId}
              onChange={e => { setTargetRackId(e.target.value); setTargetSlot(''); }}
              className="h-9 w-full rounded-md border border-[#243449] bg-[#131f33] px-3 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="">-- Chọn kệ đích tiếp nhận --</option>
              {racks.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({zoneOf(r)}) · Sức chứa: {r.usedSlots ?? 0}/20 ô
                </option>
              ))}
            </select>
          </div>

          {/* Ô đích */}
          <div className="space-y-1">
            <label className="font-semibold text-[#94a3b8]">Ô kệ đích:</label>
            <select
              disabled={!hasPermission || busy || !targetRackId}
              value={targetSlot}
              onChange={e => setTargetSlot(e.target.value)}
              className="h-9 w-full rounded-md border border-[#243449] bg-[#131f33] px-3 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="">Tự động chọn ô trống an toàn</option>
              {Array.from({ length: 20 }, (_, i) => i)
                .filter(i => !usedTargetSlots.has(i) && !(sourceRack?.id === targetRackId && sourceSlotIndex === i))
                .map(i => (
                  <option key={i} value={i}>
                    {slotCode(i)} (Bay {(i % 5) + 1} · Tầng {Math.floor(i / 5) + 1}) - Ô TRỐNG
                  </option>
                ))}
            </select>
          </div>

          {/* Ghi chú */}
          <div className="space-y-1">
            <label className="font-semibold text-[#94a3b8]">Ghi chú điều chuyển:</label>
            <Input
              disabled={!hasPermission || busy}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ví dụ: Tối ưu không gian, phân loại theo đơn..."
              className="h-9 border-[#243449] bg-[#131f33] text-sm text-white"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="border-[#243449] bg-transparent text-[#94a3b8]">
              Hủy
            </Button>
            <Button type="submit" disabled={!hasPermission || busy || !targetRackId} className="gap-2">
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Đang điều chuyển...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="size-4" /> Xác nhận điều chuyển
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
