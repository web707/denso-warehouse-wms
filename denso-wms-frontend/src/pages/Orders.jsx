import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import RackAllocationWizard from '@/components/RackAllocationWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Package, BookOpen, Boxes, ArrowRight, Layers, Warehouse } from 'lucide-react';

export default function Orders() {
  const { orders, parts, addOrder } = useStore();
  const navigate = useNavigate();
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({ orderNumber: '', name: '', division: '', destination: 'DC-HN-01' });

  const handleAddOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.orderNumber) return;
    const order = await addOrder(newOrder);
    setNewOrder({ orderNumber: '', name: '', division: '', destination: 'DC-HN-01' });
    setAddOrderOpen(false);
    navigate(`/orders/${order.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-masan-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">Lô hàng & Danh mục PARTs</h1>
            <span className="rounded-full bg-masan-emerald/10 border border-masan-emerald/20 px-2.5 py-0.5 text-[11px] font-semibold text-masan-emerald">
              Lot Master & Allocation
            </span>
          </div>
          <p className="text-sm text-masan-muted mt-1 max-w-3xl">
            Quản trị các lô sản phẩm FMCG, quy cách đóng gói, theo dõi số lượng PARTs và điều phối phân bổ kệ lưu kho.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            asChild
            className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-teal hover:text-masan-teal"
          >
            <Link to="/catalog">
              <BookOpen className="w-3.5 h-3.5 mr-1.5 text-masan-teal" /> Danh mục Masan
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setAddOrderOpen(true)}
            className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-emerald hover:text-masan-emerald"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Tạo lô mới
          </Button>
          <Button
            onClick={() => setWizardOpen(true)}
            className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20 text-xs"
          >
            <Package className="w-3.5 h-3.5 mr-1.5" /> Bắt đầu phân hàng
          </Button>
        </div>
      </div>

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-masan-border bg-masan-surface p-12 text-center text-xs text-masan-muted">
          <Boxes className="w-8 h-8 mx-auto mb-3 text-masan-muted" />
          <p className="font-semibold text-masan-text text-sm">Chưa có lô hàng nào trong hệ thống</p>
          <p className="mt-1">Nhấn "Tạo lô mới" để bắt đầu thiết lập lô hàng và nhập danh mục sản phẩm.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((o) => {
            const count = parts.filter((p) => p.orderId === o.id).length;
            const totalQty = parts
              .filter((p) => p.orderId === o.id)
              .reduce((sum, p) => sum + Number(p.quantity || 0), 0);
            const totalCartons = parts
              .filter((p) => p.orderId === o.id)
              .reduce((sum, p) => sum + Number(p.cartons || 0), 0);

            return (
              <div
                key={o.id}
                onClick={() => navigate(`/orders/${o.id}`)}
                className="group rounded-2xl border border-masan-border bg-masan-surface p-5 cursor-pointer transition-all hover:border-masan-emerald/50 hover:bg-masan-elevated/40 shadow-lg relative"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-masan-emerald/10 border border-masan-emerald/20 text-masan-emerald flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-masan-teal bg-masan-teal/10 border border-masan-teal/20 px-2 py-0.5 rounded-md">
                    {o.orderNumber}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-masan-text group-hover:text-masan-emerald transition-colors truncate">
                  {o.name || o.orderNumber}
                </h3>

                <p className="text-xs text-masan-muted mt-1 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-masan-muted" />
                  <span>
                    {o.division || 'Kho gốc'} → {o.destination || 'DC-HN-01'}
                  </span>
                </p>

                <div className="mt-4 pt-3 border-t border-masan-border/60 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-masan-elevated/50 p-1.5 rounded-lg border border-masan-border/40">
                    <div className="text-[10px] text-masan-muted font-sans">PARTs</div>
                    <div className="font-mono font-bold text-masan-text">{count}</div>
                  </div>
                  <div className="bg-masan-elevated/50 p-1.5 rounded-lg border border-masan-border/40">
                    <div className="text-[10px] text-masan-muted font-sans">Thùng</div>
                    <div className="font-mono font-bold text-masan-text">{totalCartons}</div>
                  </div>
                  <div className="bg-masan-elevated/50 p-1.5 rounded-lg border border-masan-border/40">
                    <div className="text-[10px] text-masan-muted font-sans">Số lượng</div>
                    <div className="font-mono font-bold text-masan-emerald">{totalQty}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-masan-muted group-hover:text-masan-emerald transition-colors pt-1">
                  <span className="text-[11px]">Xem chi tiết & phân bổ kệ</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RackAllocationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={(orderId) => navigate(`/racks/${orderId}`)}
      />

      {/* Add order dialog */}
      <Dialog open={addOrderOpen} onOpenChange={setAddOrderOpen}>
        <DialogContent className="bg-masan-surface border-masan-border text-masan-text">
          <DialogHeader>
            <DialogTitle className="text-masan-text font-bold text-base">Thêm lô sản phẩm mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddOrder} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-masan-text">Tên lô sản phẩm *</Label>
              <Input
                value={newOrder.name}
                onChange={(e) => setNewOrder({ ...newOrder, name: e.target.value })}
                placeholder="VD: Lô hàng FMCG Tháng 11"
                required
                className="bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-masan-text">Mã lô / Master PO *</Label>
              <Input
                value={newOrder.orderNumber}
                onChange={(e) => setNewOrder({ ...newOrder, orderNumber: e.target.value })}
                placeholder="VD: PO-MSN-2026-01"
                required
                className="bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-masan-text">Điểm xuất (Điểm giao hàng)</Label>
              <Input
                value={newOrder.division}
                onChange={(e) => setNewOrder({ ...newOrder, division: e.target.value })}
                placeholder="VD: Nhà máy Masan Bình Dương"
                required
                className="bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-masan-text">Kho đích lưu trữ</Label>
              <Input
                value={newOrder.destination}
                onChange={(e) => setNewOrder({ ...newOrder, destination: e.target.value })}
                placeholder="VD: DC-HN-01"
                className="bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
              />
            </div>
            <p className="text-[11px] text-masan-muted">
              Lô hàng sẽ được tạo trống. Bạn có thể thêm từng PART thủ công hoặc tải file Excel danh mục tại trang chi tiết.
            </p>
            <DialogFooter className="gap-2 pt-2 border-t border-masan-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOrderOpen(false)}
                className="border-masan-border text-masan-muted text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
              >
                Khởi tạo lô
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
