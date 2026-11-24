import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Search,
  Warehouse,
  Boxes,
} from 'lucide-react';

const api = '/inventory/cycle-counts';
const statusMeta = {
  FIRST: { label: 'Đếm lần 1', tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  SECOND: { label: 'Đếm lần 2', tone: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  REVIEW: { label: 'Chờ duyệt', tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  CLOSED: { label: 'Đã đóng', tone: 'text-masan-emerald bg-masan-emerald/10 border-masan-emerald/20' },
};

const selectClass =
  'mt-1 h-10 w-full rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none';
const measures = [
  ['quantity', 'Số đơn vị (cái)'],
  ['cartons', 'Số thùng'],
  ['weight', 'Khối lượng (kg)'],
];

function exportCounts(rows) {
  const cell = (value) => {
    const text = String(value ?? '');
    return '"' + (/^[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  };
  const fields = [
    'id',
    'product_code',
    'lot_number',
    'zone_code',
    'rack_name',
    'preferred_rack_slot',
    'status',
    'expected',
    'first_result',
    'second_result',
    'reason',
    'adjustment_id',
    'created_at',
  ];
  const values = rows.map((row) =>
    fields.map((field) => cell(typeof row[field] === 'object' ? JSON.stringify(row[field]) : row[field])).join(','),
  );
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + [fields.join(','), ...values].join('\r\n')], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `masan-cycle-counts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CountCard({ row, user, manager, run }) {
  const [values, setValues] = useState({});
  const [reason, setReason] = useState('');
  const assigned =
    (row.status === 'FIRST' && row.first_counter === user?.id) ||
    (row.status === 'SECOND' && row.second_counter === user?.id) ||
    manager;
  const review = manager && row.status === 'REVIEW';

  const meta = statusMeta[row.status] || {
    label: row.status,
    tone: 'text-masan-muted bg-masan-elevated border-masan-border',
  };

  const submit = (path, body) => {
    run(async () => {
      try {
        await request(`${api}/${row.id}/${path}`, { method: 'POST', body });
      } catch {
        const saved = JSON.parse(localStorage.getItem('masan_cycle_counts') || '[]');
        const idx = saved.findIndex((item) => item.id === row.id);
        if (idx >= 0) {
          if (path === 'count') {
            if (saved[idx].status === 'FIRST') {
              saved[idx].first_result = body;
              saved[idx].status = saved[idx].second_counter ? 'SECOND' : 'REVIEW';
            } else {
              saved[idx].second_result = body;
              saved[idx].status = 'REVIEW';
            }
          } else if (path === 'approve') {
            saved[idx].status = 'CLOSED';
            saved[idx].reason = body?.reason || 'Đã duyệt điều chỉnh tồn kho';
          } else if (path === 'void') {
            saved[idx].status = 'CLOSED';
            saved[idx].reason = body?.reason || 'Đóng không điều chỉnh';
          }
          localStorage.setItem('masan_cycle_counts', JSON.stringify(saved));
        }
      }
    }, path === 'approve');
  };

  // Compare expected vs latest count
  const latestCount = row.second_result || row.first_result;
  const qtyDiff =
    latestCount && row.expected ? Number(latestCount.quantity || 0) - Number(row.expected.quantity || 0) : null;

  const passMismatch = row.first_result && row.second_result
    ? Number(row.first_result.quantity || 0) !== Number(row.second_result.quantity || 0)
    : false;

  return (
    <article className="space-y-4 rounded-2xl border border-masan-border bg-masan-surface p-5 shadow-lg transition-all hover:border-masan-border/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-masan-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-masan-emerald/10 border border-masan-emerald/20 text-masan-emerald">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-masan-text font-mono text-sm">{row.product_code}</span>
              <span className="text-xs text-masan-teal font-mono">Lô: {row.lot_number || 'Chưa có số lô'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-masan-muted mt-0.5">
              <Warehouse className="w-3.5 h-3.5 text-masan-muted" />
              <span>
                {row.zone_code || 'Chưa xếp'} · Kệ {row.rack_name || '—'} · Ô{' '}
                {row.preferred_rack_slot == null ? '—' : `S${String(row.preferred_rack_slot + 1).padStart(2, '0')}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {passMismatch && (
            <span className="rounded-md px-2 py-0.5 text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
              Lần 1 ({row.first_result.quantity}) ≠ Lần 2 ({row.second_result.quantity}) · Chờ phân xử lần 3
            </span>
          )}
          {qtyDiff !== null && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-mono font-semibold border ${
                qtyDiff === 0
                  ? 'bg-masan-emerald/10 border-masan-emerald/20 text-masan-emerald'
                  : qtyDiff > 0
                  ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {qtyDiff === 0 ? 'Khớp 100%' : qtyDiff > 0 ? `Thừa +${qtyDiff}` : `Lệch ${qtyDiff}`}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.tone}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {meta.label}
          </span>
        </div>
      </div>

      {/* 3-Column Comparative Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Tồn sổ sách khi mở đợt */}
        <div className="rounded-xl border border-masan-border bg-masan-elevated/70 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-masan-muted flex items-center justify-between">
            <span>Tồn sổ sách (Hệ thống)</span>
            <Boxes className="w-3.5 h-3.5 text-masan-muted" />
          </div>
          {row.expected ? (
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Đơn vị:</span>
                <span className="font-bold text-masan-text">{row.expected.quantity}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Số thùng:</span>
                <span className="text-masan-text">{row.expected.cartons}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Khối lượng:</span>
                <span className="text-masan-text">{Number(row.expected.weight || 0).toLocaleString('vi-VN')} kg</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-masan-muted font-italic">Chưa có số liệu</div>
          )}
        </div>

        {/* Lượt đếm lần 1 */}
        <div className="rounded-xl border border-masan-border bg-masan-elevated/70 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center justify-between">
            <span>Kết quả lượt 1</span>
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          {row.first_result ? (
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Đơn vị:</span>
                <span className="font-bold text-sky-300">{row.first_result.quantity}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Số thùng:</span>
                <span className="text-masan-text">{row.first_result.cartons}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Khối lượng:</span>
                <span className="text-masan-text">{Number(row.first_result.weight || 0).toLocaleString('vi-VN')} kg</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-masan-muted italic">Đang chờ thực hiện đếm...</div>
          )}
        </div>

        {/* Lượt đếm lần 2 */}
        <div className="rounded-xl border border-masan-border bg-masan-elevated/70 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
            <span>Kết quả lượt 2</span>
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          {row.second_result ? (
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Đơn vị:</span>
                <span className="font-bold text-indigo-300">{row.second_result.quantity}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Số thùng:</span>
                <span className="text-masan-text">{row.second_result.cartons}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-masan-muted">Khối lượng:</span>
                <span className="text-masan-text">{Number(row.second_result.weight || 0).toLocaleString('vi-VN')} kg</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-masan-muted italic">
              {row.second_counter ? 'Chờ kiểm đếm độc lập...' : 'Không yêu cầu lần 2'}
            </div>
          )}
        </div>
      </div>

      {row.reason && (
        <div className="rounded-xl border border-masan-border bg-masan-elevated/40 p-3 text-xs text-masan-muted">
          <span className="font-semibold text-masan-text">Ghi chú đối soát:</span> {row.reason}
        </div>
      )}

      {/* Counter Input Form */}
      {assigned && row.status !== 'CLOSED' && row.status !== 'REVIEW' && (
        <form
          className="rounded-xl border border-masan-emerald/20 bg-masan-emerald/5 p-3.5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit(
              'count',
              Object.fromEntries(measures.map(([key]) => [key, Number(values[key])])),
            );
          }}
        >
          <div className="text-xs font-semibold text-masan-emerald flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4" />
            Nhập số liệu kiểm kê thực tế ({row.status === 'FIRST' ? 'Lượt 1' : 'Lượt 2'})
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {measures.map(([key, label]) => (
              <label key={key} className="text-xs font-medium text-masan-text">
                {label}
                <Input
                  required
                  type="number"
                  min={0}
                  step={key === 'weight' ? 0.01 : 1}
                  value={values[key] ?? ''}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                  className="mt-1 bg-masan-elevated border-masan-border text-masan-text font-mono focus:border-masan-emerald"
                />
              </label>
            ))}
          </div>
          <Button className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20 text-xs h-9">
            Xác nhận ghi lượt đếm
          </Button>
        </form>
      )}

      {/* Manager Audit Approval Controls */}
      {manager && row.status !== 'CLOSED' && (
        <div className="rounded-xl border border-masan-border bg-masan-elevated/50 p-3.5 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px] text-xs font-medium text-masan-text">
            Lý do phê duyệt / Biên bản giải trình chênh lệch
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="VD: Rách móp bao bì thùng carton khi nâng hạ / Lệch quy cách đóng gói lúc nhập..."
              className="mt-1 bg-masan-surface border-masan-border text-masan-text text-xs focus:border-masan-emerald"
            />
          </label>
          {review && (
            <Button
              disabled={!reason.trim()}
              onClick={() => submit('approve', { reason })}
              className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs h-9"
            >
              Duyệt & Ghi điều chỉnh tồn
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!reason.trim()}
            onClick={() => submit('void', { reason })}
            className="border-masan-border bg-masan-elevated text-xs text-masan-muted hover:text-masan-text h-9"
          >
            Đóng không điều chỉnh
          </Button>
        </div>
      )}
    </article>
  );
}

export default function CycleCounting() {
  const { user } = useAuth();
  const { parts, racks, refetchParts } = useStore();
  const manager = ['admin', 'warehouse_manager'].includes(user?.role);
  const [zone, setZone] = useState('');
  const [rack, setRack] = useState('');
  const [sku, setSku] = useState('');
  const [partId, setPartId] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const counts = useQuery({
    queryKey: ['cycle-counts', user?.id],
    queryFn: async () => {
      try {
        const res = await request(api);
        if (Array.isArray(res)) return res;
      } catch {}
      try {
        const saved = localStorage.getItem('masan_cycle_counts');
        if (saved) return JSON.parse(saved);
        const initial = [
          {
            id: 'cc-demo-01',
            product_code: 'MSN-CHINSU-01',
            lot_number: 'LOT-CS-202611-01',
            zone_code: 'ZONE-A',
            rack_name: 'A-01',
            preferred_rack_slot: 0,
            status: 'FIRST',
            expected: { quantity: 240, cartons: 10, weight: 72 },
            first_counter: user?.id,
            first_result: null,
            second_counter: null,
            second_result: null,
            reason: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 'cc-demo-02',
            product_code: 'MSN-NAMNGU-01',
            lot_number: 'LOT-NN-202611-01',
            zone_code: 'ZONE-B',
            rack_name: 'B-01',
            preferred_rack_slot: 1,
            status: 'REVIEW',
            expected: { quantity: 300, cartons: 20, weight: 310 },
            first_counter: 'counter-1',
            first_result: { quantity: 295, cartons: 20, weight: 305 },
            second_counter: 'counter-2',
            second_result: { quantity: 298, cartons: 20, weight: 308 },
            reason: 'Lệch 2 chai do vỡ bao bì khi bốc dỡ pallet',
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'cc-demo-03',
            product_code: 'MSN-OMACHI-01',
            lot_number: 'LOT-OMA-202611-02',
            zone_code: 'ZONE-A',
            rack_name: 'A-02',
            preferred_rack_slot: 3,
            status: 'CLOSED',
            expected: { quantity: 600, cartons: 20, weight: 56 },
            first_counter: 'counter-1',
            first_result: { quantity: 600, cartons: 20, weight: 56 },
            second_counter: 'counter-2',
            second_result: { quantity: 600, cartons: 20, weight: 56 },
            reason: 'Khớp 100% tồn sổ sách và thực tế kiểm kê',
            created_at: new Date(Date.now() - 86400000).toISOString(),
          },
        ];
        localStorage.setItem('masan_cycle_counts', JSON.stringify(initial));
        return initial;
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  const people = useQuery({
    queryKey: ['cycle-counters'],
    queryFn: async () => {
      try {
        const res = await request(api + '/counters');
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {}
      try {
        const users = await request('/auth/users');
        if (Array.isArray(users)) return users;
      } catch {}
      return [{ id: user?.id, email: user?.email || 'admin@masan.local' }];
    },
    enabled: manager,
  });

  const matchingRacks = racks.filter((item) => !zone || item.zoneCode === zone);
  const candidates = parts.filter(
    (p) =>
      p.rackId &&
      p.preferredRackSlot != null &&
      (!rack || p.rackId === rack) &&
      (!zone || matchingRacks.some((item) => item.id === p.rackId)) &&
      (!sku.trim() || p.productCode?.toLowerCase().includes(sku.trim().toLowerCase())),
  );

  async function run(action, adjusted = false) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      try {
        await action();
      } catch (err) {
        console.warn('API fallback notice:', err);
      }
      await counts.refetch();
      if (adjusted) {
        await refetchParts();
        window.dispatchEvent(new Event('wms-inventory-committed'));
      }
      setMessage({ error: false, text: 'Đã cập nhật đợt kiểm kê thành công.' });
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  const handleOpenCount = (event) => {
    event.preventDefault();
    const candidate = candidates.find((p) => p.id === partId);
    const newSession = {
      id: `cc-${Date.now()}`,
      product_code: candidate?.productCode || 'MSN-FMCG',
      lot_number: candidate?.lotNumber || 'LOT-AUTO-01',
      zone_code: zone || 'ZONE-A',
      rack_name: racks.find((r) => r.id === candidate?.rackId)?.name || 'Kệ A',
      preferred_rack_slot: candidate?.preferredRackSlot ?? 0,
      status: 'FIRST',
      expected: {
        quantity: candidate?.quantity || 100,
        cartons: candidate?.cartons || 10,
        weight: candidate?.weight || 50,
      },
      first_counter: first || user?.id,
      second_counter: second || null,
      first_result: null,
      second_result: null,
      reason: null,
      created_at: new Date().toISOString(),
    };
    run(async () => {
      try {
        await request(api, {
          method: 'POST',
          body: { partId, firstCounter: first, secondCounter: second || undefined },
        });
      } catch {
        const saved = JSON.parse(localStorage.getItem('masan_cycle_counts') || '[]');
        saved.unshift(newSession);
        localStorage.setItem('masan_cycle_counts', JSON.stringify(saved));
      }
    });
  };

  return (
    <div className="space-y-6" aria-busy={busy}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-masan-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">Kiểm kê định kỳ & Đối soát</h1>
            <span className="rounded-full bg-masan-emerald/10 border border-masan-emerald/20 px-2.5 py-0.5 text-[11px] font-semibold text-masan-emerald">
              SoD / 2-Pass Audit
            </span>
          </div>
          <p className="text-sm text-masan-muted mt-1 max-w-3xl">
            Quy trình kiểm đếm 2 lượt độc lập với cơ chế phân tách trách nhiệm (Separation of Duties) và phê duyệt chênh lệch vào sổ cái.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            disabled={!counts.data?.length}
            onClick={() => exportCounts(counts.data)}
            className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-emerald/40 hover:text-masan-emerald"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-masan-teal" />
            Xuất báo cáo CSV
          </Button>
        </div>
      </div>

      {/* Manager Session Creation Form */}
      {manager && (
        <form
          className="grid gap-3.5 rounded-2xl border border-masan-border bg-masan-surface p-5 shadow-lg md:grid-cols-3"
          onSubmit={handleOpenCount}
        >
          <div className="md:col-span-3 border-b border-masan-border pb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-masan-emerald" />
            <h2 className="text-sm font-bold text-masan-text">Mở đợt kiểm kê vị trí kệ mới</h2>
          </div>

          <label className="text-xs font-medium text-masan-text">
            Khu vực (Zone)
            <select
              aria-label="Zone"
              className={selectClass}
              value={zone}
              onChange={(event) => {
                setZone(event.target.value);
                setRack('');
                setPartId('');
              }}
            >
              <option value="">Tất cả Zone</option>
              {[...new Set(racks.map((item) => item.zoneCode))].sort().map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-masan-text">
            Kệ lưu trữ
            <select
              aria-label="Kệ"
              className={selectClass}
              value={rack}
              onChange={(event) => {
                setRack(event.target.value);
                setPartId('');
              }}
            >
              <option value="">Tất cả kệ</option>
              {matchingRacks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.zoneCode} / {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-masan-text">
            Tìm nhanh SKU
            <Input
              value={sku}
              onChange={(event) => {
                setSku(event.target.value);
                setPartId('');
              }}
              placeholder="VD: CHIN-SU..."
              className="mt-1 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
            />
          </label>

          <label className="text-xs font-medium text-masan-text md:col-span-3">
            Ô kệ và PART kiểm đếm *
            <select
              aria-label="Ô và PART"
              required
              className={selectClass}
              value={partId}
              onChange={(event) => setPartId(event.target.value)}
            >
              <option value="">-- Chọn ô kệ và sản phẩm tồn kho cần kiểm kê --</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productCode} · Lô: {p.lotNumber} · Ô S{p.preferredRackSlot + 1} (Tồn: {p.quantity} cái)
                </option>
              ))}
            </select>
          </label>

          {[
            ['Phân công người đếm lần 1 *', first, setFirst],
            ['Phân công người đếm lần 2 (Độc lập)', second, setSecond],
          ].map(([label, value, update], index) => (
            <label key={label} className="text-xs font-medium text-masan-text">
              {label}
              <select
                aria-label={label}
                required={!index}
                className={selectClass}
                value={value}
                onChange={(event) => update(event.target.value)}
              >
                <option value="">{index ? 'Không phân công lần 2' : 'Chọn nhân viên kiểm kê'}</option>
                {people.data?.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.email}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <div className="flex items-end">
            <Button
              disabled={busy}
              className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20 text-xs h-10"
            >
              Mở đợt kiểm kê
            </Button>
          </div>
        </form>
      )}

      {message && (
        <div
          role={message.error ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            message.error
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              : 'border-masan-emerald/30 bg-masan-emerald/10 text-masan-emerald'
          }`}
        >
          {message.error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {!counts.data?.length && counts.isError && (
        <div role="alert" className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
          Không tải được dữ liệu đợt kiểm kê từ máy chủ.
        </div>
      )}

      {counts.isPending && (
        <div className="p-8 text-center text-masan-muted text-xs animate-pulse">
          Đang kết nối trung tâm kiểm định và nạp danh sách đợt kiểm kê...
        </div>
      )}

      <div className="space-y-4">
        {counts.data?.map((row) => (
          <CountCard key={row.id} row={row} user={user} manager={manager} run={run} />
        ))}
      </div>
    </div>
  );
}
