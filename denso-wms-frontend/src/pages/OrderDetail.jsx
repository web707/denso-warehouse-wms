import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { calcPartCbm, fmtDec, fmtNum, fmtKg } from '@/lib/calculations';
import PartDialog from '@/components/PartDialog';
import { MASAN_REFERENCE_PRODUCTS } from '@/lib/masanCatalog';
import ImportDialog from '@/components/ImportDialog';
import RackAllocationWizard from '@/components/RackAllocationWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ExpiryBadge from '@/components/ExpiryBadge';
import Pill from '@/components/Pill';
import { JUDGMENT, lotStatusMap, useLotStatus } from '@/lib/supplyChain';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreVertical,
  PackagePlus,
  Search,
  Upload,
  ArrowRight,
  Boxes,
  Layers,
  Scale,
  Package,
} from 'lucide-react';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orders, parts, racks, deletePart, assignPart, deleteOrder } = useStore();
  const { data: lotStatus = [] } = useLotStatus();
  const lotQuality = lotStatusMap(lotStatus);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [suggestedProduct, setSuggestedProduct] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState('');

  const order = orders.find((o) => o.id === orderId);

  const orderRacks = useMemo(() => racks.filter((c) => c.orderId === orderId), [racks, orderId]);
  const orderParts = useMemo(() => parts.filter((p) => p.orderId === orderId), [parts, orderId]);
  const filtered = useMemo(() => {
    if (!search) return orderParts;
    const q = search.toLowerCase();
    return orderParts.filter(
      (p) =>
        p.partName?.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q) ||
        p.lotNumber?.toLowerCase().includes(q) ||
        p.supplierName?.toLowerCase().includes(q) ||
        p.masterPo?.toLowerCase().includes(q),
    );
  }, [orderParts, search]);

  const totalCbm = orderParts.reduce((s, p) => s + calcPartCbm(p), 0);
  const totalWeight = orderParts.reduce((s, p) => s + (p.weight || 0), 0);
  const totalCartons = orderParts.reduce((s, p) => s + (p.cartons || 0), 0);

  useEffect(() => {
    const candidate = searchParams.get('catalog');
    if (!candidate) return;
    if (MASAN_REFERENCE_PRODUCTS.some((p) => p.name === candidate && p.kind === 'stock')) {
      setSuggestedProduct(candidate);
      setEditing(null);
      setDialogOpen(true);
    }
    const updated = new URLSearchParams(searchParams);
    updated.delete('catalog');
    setSearchParams(updated, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleEdit = (part) => {
    setSuggestedProduct('');
    setEditing(part);
    setDialogOpen(true);
  };
  const handleAdd = () => {
    setSuggestedProduct('');
    setEditing(null);
    setDialogOpen(true);
  };

  const handleDeleteOrder = async () => {
    await deleteOrder(orderId);
    navigate('/orders');
  };

  const handleDongHang = () => {
    if (orderRacks.length === 0) {
      setWizardOpen(true);
    } else {
      navigate(`/racks/${orderId}`);
    }
  };

  if (!order) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orders')}
          className="text-masan-muted hover:text-masan-text"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Tất cả đơn hàng
        </Button>
        <p className="text-sm text-masan-muted">Không tìm thấy đơn hàng này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orders')}
          className="-ml-2 text-xs font-semibold text-masan-muted hover:text-masan-emerald"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Quay lại danh sách Lô hàng
        </Button>
      </div>

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-masan-border pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">
              {order.name || order.orderNumber}
            </h1>
            <span className="font-mono text-xs font-bold text-masan-teal bg-masan-teal/10 border border-masan-teal/20 px-2.5 py-0.5 rounded-md">
              {order.orderNumber}
            </span>
          </div>
          <p className="text-xs text-masan-muted mt-1">
            {order.division || 'Kho gốc'} → {order.destination || 'DC-HN-01'} ·{' '}
            <span className="font-mono text-masan-text">{orderParts.length}</span> SKU ·{' '}
            <span className="font-mono text-masan-text">{fmtNum(totalCartons)}</span> thùng ·{' '}
            <span className="font-mono text-masan-text">{fmtDec(totalCbm, 2)}</span> m³ ·{' '}
            <span className="font-mono text-masan-text">{fmtNum(totalWeight)}</span> kg
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-teal hover:text-masan-teal"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-masan-teal" /> Nhập Excel
          </Button>
          <Button
            variant="outline"
            onClick={handleAdd}
            className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-emerald hover:text-masan-emerald"
          >
            <PackagePlus className="w-3.5 h-3.5 mr-1.5" /> Thêm hàng
          </Button>
          <Button
            onClick={handleDongHang}
            className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20 text-xs"
          >
            Phân hàng kệ kho <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-masan-muted hover:text-masan-text border border-masan-border/40"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-masan-surface border-masan-border text-xs">
              <DropdownMenuItem
                className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
                onClick={handleDeleteOrder}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa lô hàng này
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-masan-muted" />
          <Input
            placeholder="Tìm SKU, tên sản phẩm, số lô, Master PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-masan-surface border-masan-border text-masan-text text-xs focus:border-masan-emerald"
          />
        </div>
        <span className="text-xs font-mono text-masan-muted">
          {filtered.length} / {orderParts.length} mục
        </span>
      </div>

      {/* High-density Parts Data Table */}
      <div className="rounded-2xl border border-masan-border bg-masan-surface shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-masan-elevated text-[11px] font-semibold text-masan-muted uppercase tracking-wider border-b border-masan-border z-10">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">SKU / Tên sản phẩm</th>
                <th className="px-4 py-3 whitespace-nowrap">Item Number</th>
                <th className="px-4 py-3 whitespace-nowrap">Lô & QC</th>
                <th className="px-4 py-3 whitespace-nowrap">Division</th>
                <th className="px-4 py-3 whitespace-nowrap">Master PO</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Số lượng</th>
                <th className="px-4 py-3 whitespace-nowrap">Hạn dùng</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Trọng lượng</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Thùng</th>
                <th className="px-4 py-3 whitespace-nowrap">Quy cách (cm)</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">CBM</th>
                <th className="px-4 py-3 whitespace-nowrap">Kệ kho</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-masan-border/40 font-mono text-[11px]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-masan-muted font-sans">
                    Không có hàng hóa nào phù hợp với tìm kiếm.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-masan-elevated/40 transition-colors">
                  <td className="px-4 py-3 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || '#10B981' }} />
                      <span className="font-semibold text-masan-text text-xs">{p.partName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-masan-muted">{p.productCode}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-masan-text font-bold">{p.lotNumber || '—'}</span>
                    {lotQuality.has(p.qualityScopeId ?? p.lotId) ? (
                      <Pill
                        tone={JUDGMENT[lotQuality.get(p.qualityScopeId ?? p.lotId).judgment]?.tone || 'red'}
                        className="ml-2"
                        title={`Kiểm tra ${lotQuality.get(p.qualityScopeId ?? p.lotId).inspectionType}`}
                      >
                        {lotQuality.get(p.qualityScopeId ?? p.lotId).judgment}
                      </Pill>
                    ) : (
                      (p.quantity > 0 || p.cartons > 0 || p.weight > 0) && (
                        <Pill tone="amber" className="ml-2">
                          Chờ QC
                        </Pill>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <span className="rounded bg-masan-elevated border border-masan-border px-1.5 py-0.5 text-[10px] text-masan-muted">
                      {p.divisionCode || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-masan-muted">{p.masterPo || '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-masan-emerald">
                    {fmtNum(p.quantity)} <span className="text-[10px] text-masan-muted font-sans">{p.uomCode}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-sans">
                    <ExpiryBadge date={p.expirationDate} />
                  </td>
                  <td className="px-4 py-3 text-right text-masan-text">{fmtKg(p.weight)}</td>
                  <td className="px-4 py-3 text-right text-masan-text">{p.cartons}</td>
                  <td className="px-4 py-3 text-masan-muted whitespace-nowrap">
                    {p.cartonLength} × {p.cartonWidth} × {p.cartonHeight}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-masan-teal">{fmtDec(calcPartCbm(p), 3)}</td>
                  <td className="px-4 py-3 font-sans">
                    <Select
                      value={p.rackId || '__none__'}
                      onValueChange={(v) => assignPart(p.id, v === '__none__' ? null : v)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[140px] bg-masan-elevated border-masan-border text-masan-text focus:border-masan-emerald">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-masan-surface border-masan-border text-masan-text text-xs">
                        <SelectItem value="__none__">— Chưa phân bổ —</SelectItem>
                        {orderRacks.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.zoneCode} / {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-masan-muted hover:text-masan-text">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-masan-surface border-masan-border text-xs">
                        <DropdownMenuItem onClick={() => handleEdit(p)}>
                          <Pencil className="w-3.5 h-3.5 mr-2 text-masan-teal" /> Sửa thông tin
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-300" onClick={() => deletePart(p.id)}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa SKU
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        part={editing}
        defaultOrderId={orderId}
        suggestedProduct={suggestedProduct}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        targetOrderId={orderId}
        targetOrderLabel={order.name || order.orderNumber}
      />

      <RackAllocationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        presetOrderId={orderId}
        onComplete={(id) => navigate(`/racks/${id}`)}
      />
    </div>
  );
}
