// QuickPickingModal.jsx
// Hộp thoại tạo yêu cầu soạn hàng / xuất kho (Picking & Dispatch) trực tiếp từ mô hình 3D
import { useState } from 'react';
import { request } from '@/api/client';
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
import { Truck, Loader2, AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';
import { slotCode } from '@/lib/warehouse';

export default function QuickPickingModal({
  open,
  onClose,
  part,
  rack,
  slotIndex,
  onSuccess
}) {
  const { user } = useAuth();
  const { refetchParts } = useStore();
  const { toast } = useToast();
  const hasPermission = canWrite(user?.role, 'inventory');

  const [reference, setReference] = useState(() => `DISP-3D-${Date.now().toString().slice(-6)}`);
  const [quantity, setQuantity] = useState(() => Math.min(20, part?.quantity || 20));
  const [autoPick, setAutoPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sku = part?.productCode || '';
  const maxAvailable = part?.quantity || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasPermission) {
      setError('Bạn không có quyền tạo đơn xuất kho / soạn hàng. Yêu cầu quyền Nhân viên kho hoặc Quản lý kho.');
      return;
    }
    if (!sku) {
      setError('Mặt hàng không có mã SKU hợp lệ để soạn hàng.');
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('Số lượng yêu cầu phải lớn hơn 0.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      // 1. Tạo đơn xuất và cấp phát mềm FEFO
      const idempotencyKey = crypto.randomUUID();
      const order = await request('/inventory/dispatches', {
        method: 'POST',
        body: {
          reference: reference.trim(),
          sku: sku.trim(),
          quantity: qty
        },
        headers: { 'Idempotency-Key': idempotencyKey }
      });

      // 2. Tùy chọn: Tự động xác nhận soạn hàng (Pick) ngay lập tức nếu chọn autoPick
      if (autoPick && order?.id) {
        try {
          await request(`/inventory/dispatches/${order.id}/pick`, { method: 'POST' });
        } catch (pickErr) {
          console.warn('Auto-pick notice:', pickErr);
        }
      }

      await refetchParts();
      try {
        localStorage.setItem('wms_inventory_committed', String(Date.now()));
      } catch {}
      window.dispatchEvent(new Event('wms-inventory-committed'));

      toast({
        title: autoPick ? 'Soạn hàng thành công' : 'Đã lập đơn xuất kho',
        description: `Mã đơn: ${reference} · SKU: ${sku} · Đã cấp phát ${qty} đơn vị từ ${rack?.name || 'Kệ'}:${slotCode(slotIndex)}.`
      });

      onSuccess?.(order);
      onClose();
    } catch (err) {
      setError(err.message || 'Không thể tạo đơn xuất kho. Vui lòng kiểm tra tồn khả dụng.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md border-[#243449] bg-[#101b2b] text-[#f8fafc]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Truck className="size-5 text-sky-400" /> Tạo yêu cầu soạn hàng / Picking 3D
          </DialogTitle>
          <DialogDescription className="text-xs text-[#94a3b8]">
            Khởi tạo phiếu xuất kho và phân bổ chỉ định vị trí lấy hàng theo nguyên tắc FEFO.
          </DialogDescription>
        </DialogHeader>

        {!hasPermission && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertCircle className="size-4 shrink-0" />
            Tài khoản hiện tại có quyền xem, không được cấp quyền xuất kho.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Thông tin vị trí & mặt hàng */}
          <div className="rounded-lg border border-[#243449] bg-[#162338] p-3 space-y-1">
            <p className="font-semibold text-[#94a3b8]">Vị trí chỉ định lấy hàng:</p>
            <p className="text-sm font-bold text-white">
              {rack?.name || 'Kệ'} · {slotCode(slotIndex)} ({rack?.zoneCode || 'Zone A'})
            </p>
            <p className="text-sky-300 font-medium">
              {part?.partName || part?.productCode} · Lô: {part?.lotNumber || 'Chưa có'}
            </p>
            <p className="text-[#94a3b8]">
              Tồn kho hiện hữu: <strong className="text-white">{maxAvailable}</strong> đơn vị · Trạng thái QC: <strong className="text-emerald-400">{part?.qcStatus || 'Đạt chuẩn'}</strong>
            </p>
          </div>

          {/* Mã đơn xuất */}
          <div className="space-y-1">
            <label className="font-semibold text-[#94a3b8]">Mã đơn xuất kho (Reference):</label>
            <Input
              required
              disabled={!hasPermission || busy}
              value={reference}
              onChange={e => setReference(e.target.value)}
              className="h-9 border-[#243449] bg-[#131f33] text-sm text-white font-mono"
            />
          </div>

          {/* Số lượng lấy */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="font-semibold text-[#94a3b8]">Số lượng soạn (Đơn vị PCS):</label>
              <span className="text-xs text-[#94a3b8]">Tối đa khả dụng: {maxAvailable} đv</span>
            </div>
            <Input
              required
              type="number"
              min={1}
              max={maxAvailable || undefined}
              disabled={!hasPermission || busy}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="h-9 border-[#243449] bg-[#131f33] text-sm text-white"
            />
          </div>

          {/* Tùy chọn xác nhận soạn luôn */}
          <label className="flex items-center gap-2 cursor-pointer pt-1 text-[#94a3b8] hover:text-white">
            <input
              type="checkbox"
              checked={autoPick}
              onChange={e => setAutoPick(e.target.checked)}
              disabled={!hasPermission || busy}
              className="rounded border-[#243449] bg-[#131f33] text-primary"
            />
            <span>Xác nhận hoàn thành soạn hàng (Picked) và chuyển sang đóng gói</span>
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="border-[#243449] bg-transparent text-[#94a3b8]">
              Hủy
            </Button>
            <Button type="submit" disabled={!hasPermission || busy || !maxAvailable} className="gap-2 bg-sky-600 hover:bg-sky-500 text-white">
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Đang tạo đơn...
                </>
              ) : (
                <>
                  <PackageCheck className="size-4" /> Xác nhận soạn hàng
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
