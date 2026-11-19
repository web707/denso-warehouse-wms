import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DocumentSourceButton } from './Documents';
import { request } from '@/api/client';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  PackageCheck,
  ShieldAlert,
  Upload,
  Warehouse,
  XCircle,
  FileText,
  Boxes,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { api } from '@/api';
import { useAuth } from '@/lib/auth';
import { canWrite } from '@/lib/access';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { isQcAvailable, lotStatusMap, useLotStatus } from '@/lib/supplyChain';

const TYPES = [
  { value: 'inbound', label: 'Nhập kho', icon: Download, desc: 'Lưu kho thành phẩm & bao bì' },
  { value: 'outbound', label: 'Xuất kho', icon: Upload, desc: 'Xuất hàng theo chuẩn FEFO' },
  { value: 'transfer', label: 'Điều chuyển', icon: ArrowRightLeft, desc: 'Chuyển vị trí kệ & phân lô' },
];

const slotName = (i) => (i === null || i === undefined ? '—' : `S${String(i + 1).padStart(2, '0')}`);

export default function InventoryOperations() {
  const { parts, racks, applyInventorySnapshot, refetchParts } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: lotStatus = [] } = useLotStatus();
  const canEdit = canWrite(user?.role, 'inventory');
  const isManager = user?.role === 'admin' || user?.role === 'warehouse_manager' || user?.role === 'manager';

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'standard');
  const [type, setType] = useState('inbound');
  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState('');
  const [cartons, setCartons] = useState('');
  const [weight, setWeight] = useState('');
  const [toRackId, setToRackId] = useState('');
  const [toSlot, setToSlot] = useState('');
  const [note, setNote] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Receiving Discrepancy & Damaged Goods Form State
  const [poNumber, setPoNumber] = useState('');
  const [receivingSku, setReceivingSku] = useState('');
  const [receivingPartName, setReceivingPartName] = useState('');
  const [receivingLotNumber, setReceivingLotNumber] = useState('');
  const [receivingCartons, setReceivingCartons] = useState('');
  const [receivingWeight, setReceivingWeight] = useState('');
  const [receivingExpiry, setReceivingExpiry] = useState('');
  const [expectedQty, setExpectedQty] = useState('');
  const [receivedQty, setReceivedQty] = useState('');
  const [damagedQty, setDamagedQty] = useState('');
  const [targetRackId, setTargetRackId] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [receivingNote, setReceivingNote] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [receiptSummary, setReceiptSummary] = useState(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const pendingReceipt = useRef(null);
  const [approvingId, setApprovingId] = useState(null);
  const [sourceLine, setSourceLine] = useState(null);
  const sourceId = searchParams.get('document');
  const sourceNumber = Number(searchParams.get('line'));

  useEffect(() => {
    let active = true;
    if (!sourceId || !Number.isSafeInteger(sourceNumber) || sourceNumber < 1) return;
    request('/documents/' + encodeURIComponent(sourceId))
      .then((doc) => {
        if (!active) return;
        const line = doc.fields?.lines?.[sourceNumber - 1];
        if (doc.status !== 'DRAFT' || !line || doc.receipts.some((r) => r.line_number === sourceNumber)) {
          throw Error('Dòng chứng từ chưa duyệt hoặc đã nhận.');
        }
        setSourceLine({ id: sourceId, number: sourceNumber });
        setPoNumber(doc.fields.po || '');
        setReceivingSku(line.sku || '');
        setReceivingPartName(line.name || '');
        setReceivingLotNumber(line.lot || '');
        setExpectedQty(String(line.expected ?? ''));
        setReceivingExpiry(line.expirationDate || '');
        setReceivingNote(doc.fields.note || '');
      })
      .catch((error) => {
        if (active) toast({ variant: 'destructive', title: 'Không mở được bản nháp', description: error.message });
      });
    return () => {
      active = false;
    };
  }, [sourceId, sourceNumber, toast]);

  const selected = useMemo(() => parts.find((p) => p.id === partId), [parts, partId]);
  const qc = lotStatusMap(lotStatus).get(selected?.qualityScopeId ?? selected?.lotId)?.judgment;
  const rackById = useMemo(() => Object.fromEntries(racks.map((r) => [r.id, r])), [racks]);

  const reloadTx = async () => setTransactions(await api.inventory.list({ limit: 100 }));
  const reloadReceipts = async () => {
    try {
      const [list, summ] = await Promise.all([api.receiving.list({ limit: 50 }), api.receiving.summary()]);
      setReceipts(list);
      setReceiptSummary(summ);
    } catch (err) {
      console.error('Failed to load receipts', err);
    }
  };

  useEffect(() => {
    reloadTx().catch(() => {});
    reloadReceipts().catch(() => {});
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'receiving' || tabParam === 'standard') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const quickQuery = searchParams.toString();
  useEffect(() => {
    const mode = searchParams.get('mode');
    const quickPartId = searchParams.get('partId');
    const quickRackId = searchParams.get('rackId');
    const quickSlot = searchParams.get('slot');
    if (['inbound', 'outbound', 'transfer'].includes(mode)) setType(mode);
    if (quickPartId && parts.some((p) => p.id === quickPartId)) setPartId(quickPartId);
    if (quickRackId && racks.some((r) => r.id === quickRackId)) setToRackId(quickRackId);
    if (quickSlot !== null && quickSlot !== '' && Number.isInteger(Number(quickSlot)))
      setToSlot(String(Number(quickSlot)));
  }, [quickQuery, parts, racks]);

  const isTransfer = type === 'transfer';
  const located = !!selected?.rackId;
  const canPickTarget = isTransfer || (type === 'inbound' && !located);
  const where = selected ? `${rackById[selected.rackId]?.name || ''} · ${slotName(selected.preferredRackSlot)}` : '';

  // Real-time calculations for Receiving PO
  const numExpected = Number(expectedQty || 0);
  const numReceived = Number(receivedQty || 0);
  const numDamaged = Number(damagedQty || 0);
  const discrepancy = numReceived - numExpected;
  const goodStock = Math.max(0, numReceived - numDamaged);

  const fillAll = () => {
    if (!selected) return;
    setQty(String(selected.quantity));
    setCartons(String(selected.cartons));
    setWeight(String(selected.weight));
  };

  const requestConfirmation = (e) => {
    e.preventDefault();
    if (!partId || saving || (type === 'outbound' && !isQcAvailable(qc))) return;
    if (selected?.storageClass === 'unknown' && type !== 'outbound') {
      toast({
        variant: 'destructive',
        title: 'Chưa phân loại bảo quản',
        description: 'Hãy mở Sản phẩm để chọn nhóm bảo quản trước khi nhập hoặc điều chuyển.',
      });
      return;
    }
    const numbers = [qty, cartons, weight].map((v) => Number(v || 0));
    if (
      !isTransfer &&
      (!numbers.every(Number.isFinite) ||
        numbers.some((n) => n < 0) ||
        !Number.isInteger(numbers[0]) ||
        !Number.isInteger(numbers[1]) ||
        numbers.every((n) => n === 0))
    ) {
      toast({
        variant: 'destructive',
        title: 'Số liệu không hợp lệ',
        description: 'Nhập số không âm, số cái/thùng là số nguyên và ít nhất một giá trị lớn hơn 0.',
      });
      return;
    }
    setConfirming(true);
  };

  const commit = async () => {
    if (!canEdit || !partId || saving || (type === 'outbound' && !isQcAvailable(qc))) return;
    setSaving(true);
    try {
      const committed = await api.inventory.create(
        {
          type,
          partId,
          quantityPcs: Number(qty || 0),
          cartonCount: Number(cartons || 0),
          weightKg: Number(weight || 0),
          toRackId: canPickTarget ? toRackId || undefined : undefined,
          toSlot: canPickTarget && toSlot !== '' ? Number(toSlot) : undefined,
          expectedFromRackId: isTransfer ? selected?.rackId || undefined : undefined,
          expectedFromSlot: isTransfer ? selected?.preferredRackSlot ?? undefined : undefined,
          note: note || undefined,
        },
        user.id,
      );
      if (!committed.retry) {
        for (const line of committed.allocations || [committed]) {
          if (line.partSnapshot) applyInventorySnapshot(line.partSnapshot);
        }
      }
      try {
        localStorage.setItem('wms_inventory_committed', String(Date.now()));
      } catch {}
      window.dispatchEvent(new Event('wms-inventory-committed'));
      reloadTx().catch(console.error);
      if (committed.destinationPartSnapshot || !committed.partSnapshot || committed.retry)
        refetchParts().catch(console.error);
      toast({
        title: 'Đã ghi nhận nghiệp vụ kho',
        description:
          type === 'inbound'
            ? 'Nhập kho thành công'
            : type === 'outbound'
            ? `Xuất kho qua ${committed.allocations?.length || 1} lô`
            : 'Điều chuyển thành công',
      });
      setQty('');
      setCartons('');
      setWeight('');
      setNote('');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Không thể thực hiện', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Submit Receiving PO / Discrepancy
  const handleReceivingSubmit = async (e) => {
    e.preventDefault();
    if (!poNumber || !receivingSku || !expectedQty || !receivedQty) {
      toast({
        variant: 'destructive',
        title: 'Thiếu thông tin bắt buộc',
        description: 'Vui lòng nhập PO, Mã SKU, Số lượng dự kiến và Thực nhận.',
      });
      return;
    }

    if (numDamaged > numReceived) {
      toast({
        variant: 'destructive',
        title: 'Hàng hỏng không hợp lệ',
        description: 'Số lượng hàng hỏng không thể vượt quá số lượng thực nhận.',
      });
      return;
    }

    if (discrepancy !== 0 && !discrepancyReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Yêu cầu lý do sai lệch',
        description: 'Đơn hàng có chênh lệch thừa/thiếu, bắt buộc ghi rõ nguyên nhân biên bản.',
      });
      return;
    }

    setReceiptSaving(true);
    try {
      const body = {
        poNumber: poNumber.trim(),
        productCode: receivingSku.trim(),
        partName: receivingPartName.trim() || receivingSku.trim(),
        lotNumber: receivingLotNumber.trim() || undefined,
        cartonCount: receivingCartons === '' ? undefined : Number(receivingCartons),
        totalWeightKg: receivingWeight === '' ? undefined : Number(receivingWeight),
        expirationDate: receivingExpiry || undefined,
        expectedQuantityPcs: numExpected,
        receivedQuantityPcs: numReceived,
        damagedQuantityPcs: numDamaged,
        targetRackId: targetRackId || undefined,
        discrepancyReason: discrepancyReason.trim() || undefined,
        note: receivingNote.trim() || undefined,
        sourceDocumentId: sourceLine?.id,
        sourceLineNumber: sourceLine?.number,
      };
      const payload = JSON.stringify(body);
      if (pendingReceipt.current?.payload !== payload)
        pendingReceipt.current = { payload, key: crypto.randomUUID() };
      const res = await api.receiving.create(body, pendingReceipt.current.key);
      pendingReceipt.current = null;
      if (sourceLine) {
        setSourceLine(null);
        setSearchParams({ tab: 'receiving' }, { replace: true });
      }
      const hasDiscrepancy = res.status === 'DISCREPANCY_PENDING';

      toast({
        title: hasDiscrepancy ? 'Đã lập biên bản sai lệch nhận hàng' : 'Nhập kho theo PO thành công',
        description: hasDiscrepancy
          ? `Mã phiếu: ${res.receiptNumber} · Chờ quản lý phê duyệt giải trình.`
          : `Mã phiếu: ${res.receiptNumber} · Hàng tốt đã vào kho an toàn.`,
      });

      // Clear form
      setPoNumber('');
      setReceivingSku('');
      setReceivingPartName('');
      setReceivingLotNumber('');
      setExpectedQty('');
      setReceivingExpiry('');
      setReceivingCartons('');
      setReceivingWeight('');
      setReceivedQty('');
      setDamagedQty('');
      setDiscrepancyReason('');
      setReceivingNote('');

      await Promise.all([reloadReceipts(), refetchParts(), reloadTx()]);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Lỗi nhận hàng',
        description: err.message || 'Không thể tạo phiếu nhận hàng',
      });
    } finally {
      setReceiptSaving(false);
    }
  };

  const handleApproveDiscrepancy = async (id) => {
    if (!isManager) return;
    setApprovingId(id);
    try {
      await api.receiving.approve(id, { approvalNote: 'Đã xác minh thực tế và phê duyệt biên bản.' });
      toast({ title: 'Đã duyệt biên bản sai lệch', description: 'Trạng thái phiếu đã chuyển sang APPROVED.' });
      await reloadReceipts();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Lỗi duyệt biên bản', description: err.message });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-masan-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">
              Vận hành kho & Nhận hàng PO
            </h1>
            <span className="rounded-full bg-masan-emerald/10 border border-masan-emerald/20 px-2.5 py-0.5 text-[11px] font-semibold text-masan-emerald">
              FMCG Hub Operations
            </span>
          </div>
          <p className="text-sm text-masan-muted mt-1 max-w-3xl">
            Quản trị chu trình nhập xuất, đối chiếu thừa thiếu theo PO, tự động cách ly hàng hỏng tại Dock Quarantine
            và điều chuyển vị trí kệ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/documents"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-masan-border bg-masan-elevated text-xs font-medium text-masan-text hover:border-masan-emerald/40 hover:text-masan-emerald transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-masan-teal" />
            <span>Quét chứng từ OCR</span>
          </Link>

          {/* Segmented Tab Controls */}
          <div className="flex rounded-xl border border-masan-border bg-masan-elevated/70 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => {
                setActiveTab('receiving');
                setSearchParams({ tab: 'receiving' });
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'receiving'
                  ? 'bg-masan-surface text-masan-emerald border border-masan-emerald/30 shadow-sm'
                  : 'text-masan-muted hover:text-masan-text'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              <span>Nhận hàng & Sai lệch PO</span>
              {receiptSummary?.pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-bold text-amber-400">
                  {receiptSummary.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('standard');
                setSearchParams({ tab: 'standard' });
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'standard'
                  ? 'bg-masan-surface text-masan-emerald border border-masan-emerald/30 shadow-sm'
                  : 'text-masan-muted hover:text-masan-text'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Nhập · Xuất · Điều chuyển</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'receiving' ? (
        /* RECEIVING & DISCREPANCY MANAGEMENT TAB */
        <div className="space-y-6">
          {/* Top KPI Cards for Receiving Discrepancies */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between text-masan-muted text-xs">
                <span>Biên bản chờ duyệt</span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-amber-400">
                {receiptSummary?.pendingCount ?? 0}
              </p>
              <p className="text-[11px] text-masan-muted mt-1">Cần Quản lý kho phê duyệt</p>
            </div>

            <div className="rounded-xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-masan-emerald/30 transition-all">
              <div className="flex items-center justify-between text-masan-muted text-xs">
                <span>Biên bản đã duyệt</span>
                <span className="p-1.5 rounded-lg bg-masan-emerald/10 text-masan-emerald border border-masan-emerald/20">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-masan-emerald">
                {receiptSummary?.approvedCount ?? 0}
              </p>
              <p className="text-[11px] text-masan-muted mt-1">Hợp lệ & đã lưu sổ cái</p>
            </div>

            <div className="rounded-xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-rose-500/30 transition-all">
              <div className="flex items-center justify-between text-masan-muted text-xs">
                <span>Tổng thiếu hụt (Shortage)</span>
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-rose-400">
                {Number(receiptSummary?.totalShortagePcs ?? 0).toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-masan-muted">cái</span>
              </p>
              <p className="text-[11px] text-masan-muted mt-1">Giao thiếu so với PO</p>
            </div>

            <div className="rounded-xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-purple-500/30 transition-all">
              <div className="flex items-center justify-between text-masan-muted text-xs">
                <span>Hàng cách ly (ZONE-Q)</span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <ShieldAlert className="w-4 h-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-purple-400">
                {Number(receiptSummary?.totalDamagedPcs ?? 0).toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-masan-muted">cái</span>
              </p>
              <p className="text-[11px] text-masan-muted mt-1">Chặn FEFO tại R-QUARANTINE</p>
            </div>
          </div>

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
            {/* Form: Tạo phiếu nhận hàng PO */}
            {canEdit ? (
              <form
                onSubmit={handleReceivingSubmit}
                className="space-y-4 rounded-2xl border border-masan-border bg-masan-surface p-5 shadow-lg"
              >
                <div className="flex items-center gap-2.5 border-b border-masan-border pb-3.5">
                  <div className="p-2 rounded-xl bg-masan-teal/10 border border-masan-teal/20 text-masan-teal">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-masan-text">Tạo Phiếu Nhận Hàng & Đối Chiếu PO</h2>
                    <p className="text-xs text-masan-muted">
                      Tự động tính sai lệch thừa/thiếu và phân luồng hàng lỗi về Dock Quarantine
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-masan-text">Mã PO / Đơn hàng *</label>
                    <Input
                      required
                      placeholder="VD: PO-2026-MS01"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="mt-1 bg-masan-elevated border-masan-border text-masan-text placeholder:text-masan-muted/50 focus:border-masan-emerald"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-masan-text">Mã SKU *</label>
                    <Input
                      required
                      placeholder="VD: CHIN-SU-CHILI-250"
                      value={receivingSku}
                      onChange={(e) => setReceivingSku(e.target.value)}
                      className="mt-1 bg-masan-elevated border-masan-border text-masan-text placeholder:text-masan-muted/50 focus:border-masan-emerald font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-masan-text">Tên sản phẩm</label>
                    <Input
                      placeholder="VD: Tương ớt Chin-su 250g"
                      value={receivingPartName}
                      onChange={(e) => setReceivingPartName(e.target.value)}
                      className="mt-1 bg-masan-elevated border-masan-border text-masan-text placeholder:text-masan-muted/50 focus:border-masan-emerald text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-masan-text">Số lô nhà máy (Lot) *</label>
                    <Input
                      required
                      placeholder="Nhập số lô"
                      value={receivingLotNumber}
                      onChange={(e) => setReceivingLotNumber(e.target.value)}
                      className="mt-1 bg-masan-elevated border-masan-border text-masan-text placeholder:text-masan-muted/50 focus:border-masan-emerald font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-masan-text">
                    Hạn sử dụng (Exp Date)
                    <Input
                      type="date"
                      className="mt-1 bg-masan-elevated border-masan-border text-masan-text focus:border-masan-emerald"
                      value={receivingExpiry}
                      onChange={(e) => setReceivingExpiry(e.target.value)}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-masan-text">
                    Số thùng thực nhận
                    <Input
                      type="number"
                      min="0"
                      className="mt-1 bg-masan-elevated border-masan-border text-masan-text focus:border-masan-emerald"
                      value={receivingCartons}
                      onChange={(e) => setReceivingCartons(e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-medium text-masan-text">
                    Khối lượng (kg)
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 bg-masan-elevated border-masan-border text-masan-text focus:border-masan-emerald"
                      value={receivingWeight}
                      onChange={(e) => setReceivingWeight(e.target.value)}
                    />
                  </label>
                </div>

                {/* Quantities & Discrepancy Real-time Visualizer */}
                <div className="rounded-xl border border-masan-border bg-masan-elevated/80 p-3.5 space-y-3">
                  <div className="text-[11px] font-bold text-masan-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-masan-teal" />
                    Số liệu đối soát & Phân loại chất lượng
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-masan-muted">Dự kiến PO *</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        placeholder="100"
                        value={expectedQty}
                        onChange={(e) => setExpectedQty(e.target.value)}
                        className="mt-1 bg-masan-surface border-masan-border text-masan-text font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-masan-muted">Thực nhận *</label>
                      <Input
                        type="number"
                        min="0"
                        required
                        placeholder="95"
                        value={receivedQty}
                        onChange={(e) => setReceivedQty(e.target.value)}
                        className="mt-1 bg-masan-surface border-masan-border text-masan-emerald font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-rose-400">Hàng hỏng/vỡ</label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={damagedQty}
                        onChange={(e) => setDamagedQty(e.target.value)}
                        className="mt-1 bg-masan-surface border-rose-500/40 text-rose-400 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Real-time Calculation Badge */}
                  {(expectedQty || receivedQty || damagedQty) && (
                    <div className="pt-2.5 border-t border-masan-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        {discrepancy === 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-masan-emerald">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Khớp 100% PO ({numReceived} cái)
                          </span>
                        ) : discrepancy < 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-400">
                            <XCircle className="w-3.5 h-3.5" /> Thiếu {Math.abs(discrepancy)} cái so với PO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-sky-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> Thừa +{discrepancy} cái so với PO
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 text-[11px]">
                        <span className="rounded-md bg-masan-emerald/10 border border-masan-emerald/20 px-2 py-0.5 text-masan-emerald font-mono">
                          Hàng tốt: <b>{goodStock}</b>
                        </span>
                        {numDamaged > 0 && (
                          <span className="rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-rose-400 font-mono">
                            Hỏng: <b>{numDamaged}</b> → ZONE-Q
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-masan-text">Kệ đích lưu kho hàng tốt</label>
                  <select
                    className="mt-1 w-full h-10 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
                    value={targetRackId}
                    onChange={(e) => setTargetRackId(e.target.value)}
                  >
                    <option value="">Chưa xếp kệ (Lưu tại Buffer)</option>
                    {racks
                      .filter((r) => r.zoneCode !== 'ZONE-Q')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.zoneCode} · {r.name}
                        </option>
                      ))}
                  </select>
                </div>

                {discrepancy !== 0 && (
                  <div>
                    <label className="text-xs font-semibold text-rose-400">
                      Lý do sai lệch PO (Bắt buộc lập biên bản giải trình) *
                    </label>
                    <Input
                      required
                      placeholder="VD: Nhà cung cấp thiếu hàng do hết bao bì / Thùng bị rách niêm phong..."
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                      className="mt-1 border-rose-500/40 bg-rose-500/5 text-rose-200 placeholder:text-rose-300/40 focus:border-rose-400 text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-masan-text">Ghi chú nhận hàng</label>
                  <Input
                    placeholder="VD: Xe giao số 29C-12345, nhiệt độ container 4°C..."
                    value={receivingNote}
                    onChange={(e) => setReceivingNote(e.target.value)}
                    className="mt-1 bg-masan-elevated border-masan-border text-masan-text placeholder:text-masan-muted/50 focus:border-masan-emerald text-xs"
                  />
                </div>

                <Button
                  className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20"
                  disabled={receiptSaving}
                >
                  {receiptSaving ? 'Đang ghi sổ biên bản...' : 'Xác nhận nhận hàng & Lưu biên bản'}
                </Button>
              </form>
            ) : (
              <div className="bg-masan-surface border border-masan-border text-masan-muted p-5 rounded-2xl">
                <p className="font-semibold text-masan-text">Chế độ xem thông tin nhận hàng</p>
                <p className="text-sm mt-2">
                  Bạn không có quyền lập phiếu nhận hàng PO. Vui lòng liên hệ Trưởng ca kho hoặc Quản lý kho.
                </p>
              </div>
            )}

            {/* Table: Danh sách phiếu nhận hàng & Biên bản sai lệch */}
            <div className="min-w-0 overflow-hidden rounded-2xl border border-masan-border bg-masan-surface shadow-lg">
              <div className="p-4 border-b border-masan-border flex items-center justify-between bg-masan-elevated/40">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-masan-teal" />
                  <span className="font-bold text-sm text-masan-text">
                    Danh sách Phiếu Nhận Hàng & Biên Bản Sai Lệch
                  </span>
                </div>
                <span className="text-xs font-mono text-masan-muted">{receipts.length} phiếu</span>
              </div>

              <div className="overflow-auto max-h-[640px]">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-masan-elevated text-[11px] font-semibold text-masan-muted uppercase tracking-wider border-b border-masan-border z-10">
                    <tr>
                      <th className="p-3">Số phiếu & PO</th>
                      <th className="p-3">Sản phẩm & Lô</th>
                      <th className="p-3 text-right">Dự kiến / Thực / Hỏng</th>
                      <th className="p-3">Tình trạng đối soát</th>
                      <th className="p-3">Trạng thái & Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-masan-border/40 font-mono text-[11px]">
                    {receipts.map((r) => {
                      const isPending = r.status === 'DISCREPANCY_PENDING';
                      const isApproved = r.status === 'APPROVED';
                      return (
                        <tr key={r.id} className="hover:bg-masan-elevated/40 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-masan-text">{r.receiptNumber}</span>
                            <div className="text-[11px] text-masan-muted font-sans">PO: {r.poNumber}</div>
                            <div className="text-[10px] text-masan-muted/60 font-sans">
                              {new Date(r.createdAt).toLocaleString('vi-VN')}
                            </div>
                            <div className="mt-1 font-sans">
                              <DocumentSourceButton kind="01-VT" reference={r.id}>
                                In phiếu 01-VT
                              </DocumentSourceButton>
                            </div>
                          </td>
                          <td className="p-3 font-sans">
                            <span className="font-semibold text-masan-text text-xs">{r.partName}</span>
                            <div className="text-[11px] text-masan-muted font-mono">{r.productCode}</div>
                            <div className="text-[10px] text-masan-teal font-mono">Lô: {r.lotNumber}</div>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="font-semibold text-masan-text">
                              PO: {r.expectedQuantityPcs} | Nhận: {r.receivedQuantityPcs}
                            </div>
                            <div className="text-[11px] text-masan-muted">
                              Tốt: <b className="text-masan-emerald">{r.goodQuantityPcs}</b>
                              {r.damagedQuantityPcs > 0 && (
                                <span className="ml-1 text-rose-400 font-bold">
                                  · Hỏng: {r.damagedQuantityPcs} (Dock Q)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-sans">
                            {r.discrepancyType === 'MATCH' && r.damagedQuantityPcs === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-masan-emerald/10 border border-masan-emerald/20 px-2 py-0.5 text-xs font-semibold text-masan-emerald">
                                <CheckCircle2 className="w-3 h-3" /> Khớp 100%
                              </span>
                            ) : r.discrepancyType === 'SHORTAGE' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-400">
                                <XCircle className="w-3 h-3" /> Thiếu {Math.abs(r.discrepancyQuantityPcs)} đv
                              </span>
                            ) : r.discrepancyType === 'OVERAGE' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-400">
                                <AlertTriangle className="w-3 h-3" /> Thừa +{r.discrepancyQuantityPcs} đv
                              </span>
                            ) : null}
                            {r.discrepancyReason && (
                              <p className="mt-1 text-[11px] text-masan-muted italic max-w-xs truncate">
                                "{r.discrepancyReason}"
                              </p>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap font-sans">
                            {isPending ? (
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                                  Chờ duyệt biên bản
                                </span>
                                {isManager && (
                                  <div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                      disabled={approvingId === r.id}
                                      onClick={() => handleApproveDiscrepancy(r.id)}
                                    >
                                      {approvingId === r.id ? 'Đang duyệt...' : 'Duyệt biên bản'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : isApproved ? (
                              <div>
                                <span className="inline-flex items-center rounded-full bg-masan-emerald/15 border border-masan-emerald/30 px-2.5 py-0.5 text-[10px] font-bold text-masan-emerald">
                                  Đã duyệt
                                </span>
                                <div className="text-[10px] text-masan-muted mt-0.5">Bởi: {r.approvedBy}</div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-masan-elevated px-2.5 py-0.5 text-[10px] font-medium text-masan-muted">
                                Hoàn tất
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {receipts.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-masan-muted font-sans">
                          Chưa có phiếu nhận hàng nào. Hãy lập phiếu nhận hàng đầu tiên theo PO ở biểu mẫu bên trái.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD INVENTORY OPERATIONS (Nhập/Xuất/Điều chuyển nhanh) */
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
          {canEdit ? (
            <form
              onSubmit={requestConfirmation}
              className="min-w-0 space-y-4 rounded-2xl border border-masan-border bg-masan-surface p-5 shadow-lg"
            >
              <div className="border-b border-masan-border pb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-masan-muted">
                  Nghiệp vụ kho tức thời
                </div>
                <div className="text-sm font-semibold text-masan-text mt-0.5">Chọn loại giao dịch thực hiện</div>
              </div>

              {/* Type Switcher Cards */}
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setType(t.value)}
                    aria-pressed={type === t.value}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      type === t.value
                        ? 'border-masan-emerald bg-masan-emerald/10 text-masan-emerald shadow-sm ring-1 ring-masan-emerald/40'
                        : 'border-masan-border bg-masan-elevated text-masan-muted hover:text-masan-text hover:border-masan-border/80'
                    }`}
                  >
                    <t.icon className="w-4 h-4 mx-auto mb-1.5" />
                    <div className="text-xs font-bold">{t.label}</div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-masan-text">
                  PART / SKU & Lô hàng *
                  <select
                    className="mt-1.5 w-full h-10 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
                    value={partId}
                    onChange={(e) => {
                      setPartId(e.target.value);
                      setToRackId('');
                      setToSlot('');
                    }}
                    required
                  >
                    <option value="">-- Chọn SKU và Lô hàng tồn kho --</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.productCode || p.masterPo} · {p.lotNumber || p.partName} (Tồn: {p.quantity})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selected && (
                <div className="rounded-xl bg-masan-elevated/90 border border-masan-border p-3.5 text-xs text-masan-muted grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-masan-emerald" />
                    <span>
                      Tồn khả dụng:{' '}
                      <b className="text-masan-text font-mono font-bold">{selected.quantity}</b> đv
                    </span>
                  </div>
                  <div>
                    Số thùng: <b className="text-masan-text font-mono">{selected.cartons}</b> thùng
                  </div>
                  <div>
                    Khối lượng:{' '}
                    <b className="text-masan-text font-mono">
                      {Number(selected.weight || 0).toLocaleString('vi-VN')}
                    </b>{' '}
                    kg
                  </div>
                  <div className="flex items-center gap-1">
                    <Warehouse className="w-3.5 h-3.5 text-masan-teal" />
                    <span className="text-masan-text font-semibold">
                      {rackById[selected.rackId]?.name || 'Chưa xếp'} · {slotName(selected.preferredRackSlot)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs font-medium text-masan-text">
                  Số lượng (cái)
                  <Input
                    type="number"
                    min="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder={isTransfer ? 'Tất cả' : '0'}
                    className="mt-1 bg-masan-elevated border-masan-border text-masan-text focus:border-masan-emerald font-mono"
                  />
                </label>
                <label className="text-xs font-medium text-masan-text">
                  Số thùng
                  <Input
                    type="number"
                    min="0"
                    value={cartons}
                    onChange={(e) => setCartons(e.target.value)}
                    placeholder={isTransfer ? 'Tất cả' : '0'}
                    className="mt-1 bg-masan-elevated border-masan-border text-masan-text focus:border-masan-emerald font-mono"
                  />
                </label>
                <label className="text-xs font-medium text-masan-text">
                  Khối lượng kg
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder={isTransfer ? 'Tất cả' : '0'}
                    className="mt-1 bg-masan-elevated border-masan-border text-masan-text focus:border-masan-emerald font-mono"
                  />
                </label>
              </div>

              {type === 'outbound' && selected && (
                <div className="space-y-2 rounded-xl border border-masan-border bg-masan-elevated/60 p-3">
                  <p className="text-xs text-masan-muted">
                    Hệ thống tự động cấp phát lô theo HSD (FEFO) trong cùng kho và tính lại quy cách đóng gói.
                  </p>
                  {!isQcAvailable(qc) && (
                    <p role="alert" className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {qc && qc !== 'REINSPECTION_REQUIRED'
                        ? `QC ${qc} · Lô này đang bị chặn xuất kho.`
                        : 'Lô đang chờ kiểm định QC, không thể xuất.'}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fillAll}
                    className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-emerald hover:text-masan-emerald"
                  >
                    Xuất toàn bộ tồn của lô
                  </Button>
                </div>
              )}

              {isTransfer && selected && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3.5 py-2.5 text-xs text-sky-300">
                  Điều chuyển hỗ trợ <b>toàn bộ hoặc một phần</b>. Để trống số lượng để chuyển trọn gói ({selected.quantity} cái), hoặc nhập số lượng muốn tách sang ô kệ mới.
                </div>
              )}

              {type === 'inbound' && located && (
                <div className="rounded-xl border border-masan-border bg-masan-elevated/60 px-3.5 py-2.5 text-xs text-masan-muted">
                  PART đang ở vị trí <b className="text-masan-text">{where}</b>. Backend kiểm soát tải trọng tự động, chặn vượt quá dung tích cho phép.
                </div>
              )}

              {canPickTarget && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium text-masan-text">
                    Kệ đích
                    <select
                      className="mt-1 w-full h-10 rounded-lg border border-masan-border bg-masan-elevated px-2.5 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
                      value={toRackId}
                      onChange={(e) => setToRackId(e.target.value)}
                    >
                      <option value="">{type === 'inbound' ? 'Tự tìm kệ/ô an toàn' : 'Chọn kệ...'}</option>
                      {racks.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.zoneCode} · {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-masan-text">
                    Ô đích
                    <select
                      className="mt-1 w-full h-10 rounded-lg border border-masan-border bg-masan-elevated px-2.5 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
                      value={toSlot}
                      onChange={(e) => setToSlot(e.target.value)}
                    >
                      <option value="">Tự chọn / chưa chỉ định</option>
                      {Array.from({ length: 20 }, (_, i) => (
                        <option key={i} value={i}>
                          {slotName(i)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-masan-text">
                  Ghi chú nghiệp vụ
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Nhập từ line sản xuất 3, giao kho trung chuyển..."
                    className="mt-1 bg-masan-elevated border-masan-border text-masan-text placeholder:text-masan-muted/50 focus:border-masan-emerald text-xs"
                  />
                </label>
              </div>

              <Button
                className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20"
                disabled={saving || !partId || (type === 'outbound' && !isQcAvailable(qc))}
              >
                {saving ? 'Đang lưu nghiệp vụ...' : 'Kiểm tra & Ghi nhận giao dịch'}
              </Button>
            </form>
          ) : (
            <div className="bg-masan-surface border border-masan-border text-masan-muted p-5 rounded-2xl">
              <p className="font-semibold text-masan-text">Chế độ xem lịch sử</p>
              <p className="text-sm mt-2">
                Vai trò hiện tại không được tạo giao dịch nhập/xuất/điều chuyển. Vui lòng liên hệ quản lý kho khi cần
                thực hiện.
              </p>
            </div>
          )}

          {/* Recent Transactions Table */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-masan-border bg-masan-surface shadow-lg">
            <div className="p-4 border-b border-masan-border flex items-center justify-between bg-masan-elevated/40">
              <div className="flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-masan-teal" />
                <span className="font-bold text-sm text-masan-text">Lịch sử nghiệp vụ gần nhất</span>
              </div>
              <span className="text-xs font-mono text-masan-muted">{transactions.length} giao dịch</span>
            </div>

            <div className="overflow-auto max-h-[620px]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-masan-elevated text-[11px] font-semibold text-masan-muted uppercase tracking-wider border-b border-masan-border z-10">
                  <tr>
                    <th className="p-3">Thời gian</th>
                    <th className="p-3">Loại</th>
                    <th className="p-3">PART / SKU</th>
                    <th className="p-3">Vị trí (Từ → Đến)</th>
                    <th className="p-3 text-right">SL / Thùng / Kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-masan-border/40">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-masan-elevated/40 transition-colors font-mono text-[11px]">
                      <td className="p-3 whitespace-nowrap text-masan-muted">
                        {new Date(t.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            t.type === 'inbound'
                              ? 'bg-masan-emerald/10 text-masan-emerald border border-masan-emerald/20'
                              : t.type === 'outbound'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                          }`}
                        >
                          {t.type === 'inbound' ? 'Nhập kho' : t.type === 'outbound' ? 'Xuất kho' : 'Điều chuyển'}
                        </span>
                      </td>
                      <td className="p-3 font-sans">
                        <span className="font-semibold text-masan-text text-xs">{t.partName}</span>
                        <div className="text-[10px] text-masan-muted font-mono">{t.productCode}</div>
                      </td>
                      <td className="p-3 text-masan-text">
                        <span className="text-masan-muted">
                          {rackById[t.fromRackId]?.name || '—'} {slotName(t.fromSlot)}
                        </span>
                        <span className="text-masan-teal mx-1.5">→</span>
                        <span className="font-semibold text-masan-emerald">
                          {rackById[t.toRackId]?.name || '—'} {slotName(t.toSlot)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-masan-text whitespace-nowrap">
                        {t.quantityPcs} <span className="text-masan-muted font-normal">đv</span> / {t.cartonCount}{' '}
                        <span className="text-masan-muted font-normal">thùng</span> /{' '}
                        {Number(t.weightKg).toLocaleString('vi-VN')}{' '}
                        <span className="text-masan-muted font-normal">kg</span>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-10 text-center text-masan-muted font-sans">
                        Chưa có giao dịch kho gần nhất.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={TYPES.find((entry) => entry.value === type)?.label}
        description={
          isTransfer && !qty && !cartons && !weight
            ? `Chuyển toàn bộ lô ${selected?.lotNumber || selected?.partName}.`
            : `${selected?.productCode || selected?.partName} · ${
                selected?.lotNumber || 'Chưa có số lô'
              } · ${qty || 0} đơn vị · ${cartons || 0} thùng · ${weight || 0} kg.`
        }
        confirmLabel="Xác nhận giao dịch"
        onConfirm={commit}
      />
    </div>
  );
}
