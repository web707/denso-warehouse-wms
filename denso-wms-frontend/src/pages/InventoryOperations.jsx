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
  { value: 'inbound', label: 'Nhập kho', icon: Download },
  { value: 'outbound', label: 'Xuất kho', icon: Upload },
  { value: 'transfer', label: 'Điều chuyển', icon: ArrowRightLeft },
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
  const [sourceLine,setSourceLine] = useState(null);
  const sourceId=searchParams.get('document');
  const sourceNumber=Number(searchParams.get('line'));
  useEffect(()=>{
    let active=true;
    if (!sourceId || !Number.isSafeInteger(sourceNumber) || sourceNumber<1) return;
    request('/documents/'+encodeURIComponent(sourceId)).then(doc=>{
      if (!active) return;
      const line=doc.fields?.lines?.[sourceNumber-1];
      if (doc.status!=='DRAFT' || !line || doc.receipts.some(r=>r.line_number===sourceNumber)) {
        throw Error('Dòng chứng từ chưa duyệt hoặc đã nhận.');
      }
      setSourceLine({id:sourceId,number:sourceNumber});
      setPoNumber(doc.fields.po||'');
      setReceivingSku(line.sku||'');
      setReceivingPartName(line.name||'');
      setReceivingLotNumber(line.lot||'');
      setExpectedQty(String(line.expected??''));
      setReceivingExpiry(line.expirationDate||'');
      setReceivingNote(doc.fields.note||'');
    }).catch(error=>{if(active)toast({variant:'destructive',title:'Không mở được bản nháp',description:error.message});});
    return ()=>{active=false;};
  },[sourceId,sourceNumber,toast]);

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
    if (quickSlot !== null && quickSlot !== '' && Number.isInteger(Number(quickSlot))) setToSlot(String(Number(quickSlot)));
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
        sourceDocumentId:sourceLine?.id,
        sourceLineNumber:sourceLine?.number,
      };
      const payload = JSON.stringify(body);
      if (pendingReceipt.current?.payload !== payload) pendingReceipt.current = { payload, key: crypto.randomUUID() };
      const res = await api.receiving.create(body, pendingReceipt.current.key);
      pendingReceipt.current = null;
      if (sourceLine) {
        setSourceLine(null);
        setSearchParams({tab:'receiving'},{replace:true});
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Tab Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vận hành kho & Nhận hàng PO</h1>
          <Link to="/documents" className="text-sm font-medium text-primary">Quét chứng từ</Link>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý nhập xuất, đối chiếu thừa/thiếu theo PO, cách ly hàng hỏng tại Dock Quarantine và duyệt biên bản.
          </p>
        </div>
        <div className="flex rounded-lg border bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('receiving');
              setSearchParams({ tab: 'receiving' });
            }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'receiving' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Nhận hàng & Sai lệch PO
            {receiptSummary?.pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
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
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'standard' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Nhập · Xuất · Điều chuyển nhanh
          </button>
        </div>
      </div>

      {activeTab === 'receiving' ? (
        /* RECEIVING & DISCREPANCY MANAGEMENT TAB */
        <div className="space-y-6">
          {/* Top KPI Cards for Receiving Discrepancies */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Biên bản chờ duyệt</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-600">{receiptSummary?.pendingCount ?? 0}</p>
              <p className="text-[11px] text-slate-400 mt-1">Cần Quản lý / Giám sát phê duyệt</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Biên bản đã duyệt</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{receiptSummary?.approvedCount ?? 0}</p>
              <p className="text-[11px] text-slate-400 mt-1">Hợp lệ & đã lưu trữ sổ cái</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Tổng thiếu hụt (Shortage)</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-rose-600">
                {Number(receiptSummary?.totalShortagePcs ?? 0).toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500">cái</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Giao thiếu so với PO</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Hàng hỏng tại Dock (ZONE-Q)</span>
                <ShieldAlert className="w-4 h-4 text-purple-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-purple-600">
                {Number(receiptSummary?.totalDamagedPcs ?? 0).toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500">cái</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Chặn FEFO tự động tại R-QUARANTINE</p>
            </div>
          </div>

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
            {/* Form: Tạo phiếu nhận hàng PO */}
            {canEdit ? (
              <form onSubmit={handleReceivingSubmit} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 border-b pb-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Tạo Phiếu Nhận Hàng & Đối Chiếu PO</h2>
                    <p className="text-xs text-slate-500">Tự động tính thừa/thiếu và phân luồng hàng lỗi về Dock Quarantine</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Mã PO / Đơn đặt hàng *</label>
                    <Input
                      required
                      placeholder="VD: PO-2026-MS01"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Mã SKU *</label>
                    <Input
                      required
                      placeholder="VD: CHIN-SU-CHILI-250"
                      value={receivingSku}
                      onChange={(e) => setReceivingSku(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Tên sản phẩm</label>
                    <Input
                      placeholder="VD: Tương ớt Chin-su 250g"
                      value={receivingPartName}
                      onChange={(e) => setReceivingPartName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Số lô nhà máy (Lot)</label>
                    <Input
                      required placeholder="Nhập số lô nhà máy"
                      value={receivingLotNumber}
                      onChange={(e) => setReceivingLotNumber(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <label className="block text-xs font-semibold text-slate-700">Hạn sử dụng
                  <Input type="date" className="mt-1" value={receivingExpiry} onChange={(e) => setReceivingExpiry(e.target.value)} />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold">Số thùng thực nhận
                    <Input type="number" min="0" className="mt-1" value={receivingCartons} onChange={(e) => setReceivingCartons(e.target.value)} />
                  </label>
                  <label className="text-xs font-semibold">Khối lượng thực nhận (kg)
                    <Input type="number" min="0" step="0.01" className="mt-1" value={receivingWeight} onChange={(e) => setReceivingWeight(e.target.value)} />
                  </label>
                </div>

                {/* Quantities & Discrepancy Real-time Visualizer */}
                <div className="rounded-xl border bg-slate-50 p-3.5 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Số liệu đối soát & Tình trạng hàng
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">Dự kiến PO *</label>
                      <Input
                        type="number"
                        min="1"
                        required
                        placeholder="100"
                        value={expectedQty}
                        onChange={(e) => setExpectedQty(e.target.value)}
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">Thực nhận *</label>
                      <Input
                        type="number"
                        min="0"
                        required
                        placeholder="95"
                        value={receivedQty}
                        onChange={(e) => setReceivedQty(e.target.value)}
                        className="mt-1 bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-rose-600">Hàng hỏng/vỡ</label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={damagedQty}
                        onChange={(e) => setDamagedQty(e.target.value)}
                        className="mt-1 bg-white text-rose-600 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Real-time Calculation Badge */}
                  {(expectedQty || receivedQty || damagedQty) && (
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        {discrepancy === 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Khớp 100% PO ({numReceived} cái)
                          </span>
                        ) : discrepancy < 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                            <XCircle className="w-3.5 h-3.5" /> Thiếu hụt {Math.abs(discrepancy)} cái so với PO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-blue-600">
                            <AlertTriangle className="w-3.5 h-3.5" /> Giao thừa +{discrepancy} cái so với PO
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 text-[11px]">
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                          Hàng tốt: <b>{goodStock}</b>
                        </span>
                        {numDamaged > 0 && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">
                            Hỏng: <b>{numDamaged}</b> → R-QUARANTINE
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Kệ đích lưu kho hàng tốt</label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border px-3 bg-white text-sm"
                    value={targetRackId}
                    onChange={(e) => setTargetRackId(e.target.value)}
                  >
                    <option value="">Chưa xếp kệ</option>
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
                    <label className="text-xs font-semibold text-rose-700">
                      Lý do sai lệch PO (Bắt buộc lập biên bản) *
                    </label>
                    <Input
                      required
                      placeholder="VD: Nhà cung cấp thiếu hàng do hết nguyên liệu / Thùng bị rách niêm phong..."
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                      className="mt-1 border-rose-300 bg-rose-50/50"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700">Ghi chú nhận hàng</label>
                  <Input
                    placeholder="VD: Biển số xe giao 29C-12345, tài xế ký nhận..."
                    value={receivingNote}
                    onChange={(e) => setReceivingNote(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={receiptSaving}>
                  {receiptSaving ? 'Đang xử lý phiếu...' : 'Xác nhận nhận hàng & Lưu biên bản'}
                </Button>
              </form>
            ) : (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 p-5 rounded-2xl">
                <p className="font-semibold">Chế độ xem thông tin nhận hàng</p>
                <p className="text-sm mt-2">
                  Bạn không có quyền lập phiếu nhận hàng PO. Vui lòng liên hệ Trưởng ca kho.
                </p>
              </div>
            )}

            {/* Table: Danh sách phiếu nhận hàng & Biên bản sai lệch */}
            <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">Danh sách Phiếu Nhận Hàng & Biên Bản Sai Lệch</span>
                </div>
                <span className="text-xs text-slate-500">{receipts.length} phiếu</span>
              </div>

              <div className="overflow-auto max-h-[640px]">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase border-b">
                    <tr>
                      <th className="p-3">Số phiếu & PO</th>
                      <th className="p-3">Sản phẩm & Lô</th>
                      <th className="p-3 text-right">Dự kiến / Thực / Hỏng</th>
                      <th className="p-3">Tình trạng</th>
                      <th className="p-3">Trạng thái & Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.map((r) => {
                      const isPending = r.status === 'DISCREPANCY_PENDING';
                      const isApproved = r.status === 'APPROVED';
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <span className="font-mono font-bold text-slate-900">{r.receiptNumber}</span>
                            <div className="text-[11px] text-slate-500 font-mono">PO: {r.poNumber}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(r.createdAt).toLocaleString('vi-VN')}
                            </div>
                            <DocumentSourceButton kind="01-VT" reference={r.id}>In phiếu 01-VT</DocumentSourceButton>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-800">{r.partName}</span>
                            <div className="text-[11px] text-slate-500 font-mono">{r.productCode}</div>
                            <div className="text-[10px] text-slate-400">Lô: {r.lotNumber}</div>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="font-semibold text-slate-900">
                              PO: {r.expectedQuantityPcs} | Nhận: {r.receivedQuantityPcs}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Tốt: <b className="text-emerald-700">{r.goodQuantityPcs}</b>
                              {r.damagedQuantityPcs > 0 && (
                                <span className="ml-1 text-rose-600 font-bold">
                                  · Hỏng: {r.damagedQuantityPcs} (Dock Q)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {r.discrepancyType === 'MATCH' && r.damagedQuantityPcs === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Khớp 100%
                              </span>
                            ) : r.discrepancyType === 'SHORTAGE' ? (
                              <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 font-medium text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" /> Thiếu {Math.abs(r.discrepancyQuantityPcs)} đv
                              </span>
                            ) : r.discrepancyType === 'OVERAGE' ? (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-200">
                                <AlertTriangle className="w-3 h-3" /> Thừa +{r.discrepancyQuantityPcs} đv
                              </span>
                            ) : null}
                            {r.discrepancyReason && (
                              <p className="mt-1 text-[11px] text-slate-600 italic">"{r.discrepancyReason}"</p>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {isPending ? (
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Chờ duyệt biên bản
                                </span>
                                {isManager && (
                                  <div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
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
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Đã duyệt
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5">Bởi: {r.approvedBy}</div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                Hoàn tất
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {receipts.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-400">
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
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          {canEdit ? (
            <form onSubmit={requestConfirmation} className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setType(t.value)}
                    aria-pressed={type === t.value}
                    className={`rounded-md border px-2 py-3 text-xs font-semibold ${
                      type === t.value ? 'border-primary bg-accent text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <t.icon className="w-4 h-4 mx-auto mb-1" />
                    {t.label}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium">
                PART
                <select
                  className="mt-1 w-full h-10 rounded-md border px-3 bg-white"
                  value={partId}
                  onChange={(e) => {
                    setPartId(e.target.value);
                    setToRackId('');
                    setToSlot('');
                  }}
                  required
                >
                  <option value="">Chọn SKU và lô</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productCode || p.masterPo} · {p.lotNumber || p.partName}
                    </option>
                  ))}
                </select>
              </label>

              {selected && (
                <div className="rounded-xl bg-slate-50 border p-3 text-xs text-slate-600 grid grid-cols-2 gap-2">
                  <span>
                    Tồn: <b>{selected.quantity}</b> đơn vị
                  </span>
                  <span>
                    <b>{selected.cartons}</b> thùng
                  </span>
                  <span>{Number(selected.weight || 0).toLocaleString('vi-VN')} kg</span>
                  <span>
                    {rackById[selected.rackId]?.name || 'Chưa xếp'} · {slotName(selected.preferredRackSlot)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs">
                  Số lượng
                  <Input
                    type="number"
                    min="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder={isTransfer ? 'Tất cả' : '0'}
                  />
                </label>
                <label className="text-xs">
                  Số thùng
                  <Input
                    type="number"
                    min="0"
                    value={cartons}
                    onChange={(e) => setCartons(e.target.value)}
                    placeholder={isTransfer ? 'Tất cả' : '0'}
                  />
                </label>
                <label className="text-xs">
                  Khối lượng kg
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder={isTransfer ? 'Tất cả' : '0'}
                  />
                </label>
              </div>

              {type === 'outbound' && selected && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    Hệ thống chọn lô theo HSD trong cùng kho và tính lại số thùng, khối lượng khi cấp phát từ các lô khác.
                  </p>
                  {!isQcAvailable(qc) && (
                    <p role="alert" className="text-sm text-red-700">
                      {qc && qc !== 'REINSPECTION_REQUIRED'
                        ? `QC ${qc} · Lô này đang bị chặn xuất.`
                        : 'Lô đang chờ kiểm định.'}
                    </p>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={fillAll}>
                    Xuất toàn bộ tồn
                  </Button>
                  <p className="text-xs text-slate-500">
                    Số lượng và số thùng phải giảm cùng nhau. Xuất hết cả hai thì PART rời khỏi kệ.
                  </p>
                </div>
              )}

              {isTransfer && selected && (
                <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Điều chuyển hỗ trợ <b>toàn bộ hoặc một phần</b>. Để trống các ô số lượng bên trên để chuyển toàn bộ PART
                  ({selected.quantity} cái, {selected.cartons} thùng,{' '}
                  {Number(selected.weight || 0).toLocaleString('vi-VN')} kg), hoặc nhập số lượng muốn tách sang kệ mới.
                </p>
              )}

              {type === 'inbound' && located && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  PART đang ở <b>{where}</b>. Nếu vượt sức chứa, backend sẽ từ chối thay vì cho quá tải; cần tách lô hoặc
                  điều chuyển có kiểm soát.
                </p>
              )}

              {canPickTarget && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    Kệ đích
                    <select
                      className="mt-1 w-full h-10 rounded-md border px-2 bg-white"
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
                  <label className="text-xs">
                    Ô đích
                    <select
                      className="mt-1 w-full h-10 rounded-md border px-2 bg-white"
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

              <label className="block text-xs">
                Ghi chú
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Nhập từ chuyền A, xuất cho line 2..."
                />
              </label>
              <Button
                className="w-full"
                disabled={saving || !partId || (type === 'outbound' && !isQcAvailable(qc))}
              >
                {saving ? 'Đang lưu...' : 'Kiểm tra giao dịch'}
              </Button>
            </form>
          ) : (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 p-5 rounded-2xl">
              <p className="font-semibold">Chế độ xem lịch sử</p>
              <p className="text-sm mt-2">
                Vai trò hiện tại không được tạo giao dịch nhập/xuất/điều chuyển. Vui lòng liên hệ quản lý kho khi cần
                thực hiện.
              </p>
            </div>
          )}

          <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="p-4 border-b flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              <b>Lịch sử nghiệp vụ gần nhất</b>
            </div>
            <div className="overflow-auto max-h-[620px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Thời gian</th>
                    <th className="p-3 text-left">Loại</th>
                    <th className="p-3 text-left">PART</th>
                    <th className="p-3 text-left">Vị trí</th>
                    <th className="p-3 text-right">SL / Thùng / Kg</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-3 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="p-3 font-semibold">
                        {t.type === 'inbound' ? 'Nhập' : t.type === 'outbound' ? 'Xuất' : 'Điều chuyển'}
                      </td>
                      <td className="p-3">
                        {t.partName}
                        <div className="text-xs text-slate-400">{t.productCode}</div>
                      </td>
                      <td className="p-3 text-xs">
                        {rackById[t.fromRackId]?.name || '—'} {slotName(t.fromSlot)} →{' '}
                        {rackById[t.toRackId]?.name || '—'} {slotName(t.toSlot)}
                      </td>
                      <td className="p-3 text-right">
                        {t.quantityPcs} / {t.cartonCount} / {Number(t.weightKg).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div className="p-10 text-center text-slate-400">Chưa có giao dịch kho.</div>
              )}
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
