import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/auth';
import { canWrite } from '@/lib/access';
import { storageLabel } from '@/lib/masanStorage';
import {
  ArrowUpRight,
  CalendarDays,
  Boxes,
  AlertTriangle,
  Search,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { fmtNum } from '@/lib/calculations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isQcAvailable, lotStatusMap, useLotStatus } from '@/lib/supplyChain';

const formatDate = (date) =>
  date ? new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa khai báo';

function daysLeft(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const localDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const today = new Date(`${localDate}T00:00:00`);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export default function FEFO() {
  const { parts, racks, refetchParts } = useStore();
  const { user } = useAuth();
  const { data: lotStatus } = useLotStatus();
  const quality = useMemo(() => lotStatusMap(lotStatus), [lotStatus]);
  const canEdit = canWrite(user?.role, 'parts');
  const [editingId, setEditingId] = useState(null);
  const [expiryDraft, setExpiryDraft] = useState('');
  const [expiryError, setExpiryError] = useState('');
  const [expirySaving, setExpirySaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const saveExpiry = async (id) => {
    setExpirySaving(true);
    setExpiryError('');
    try {
      await api.parts.update(id, { expirationDate: expiryDraft || null });
      await refetchParts();
      setEditingId(null);
    } catch (error) {
      setExpiryError(error.message || 'Không lưu được HSD');
    } finally {
      setExpirySaving(false);
    }
  };

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [demoOnly, setDemoOnly] = useState(false);
  const rackById = useMemo(() => Object.fromEntries(racks.map((r) => [r.id, r])), [racks]);

  const rows = useMemo(() => {
    const grouped = new Map();
    parts
      .filter((p) => Number(p.quantity || 0) > 0 || Number(p.cartons || 0) > 0)
      .forEach((p) => {
        const sku = (p.productCode || p.partName || '').trim().toUpperCase();
        if (!grouped.has(sku)) grouped.set(sku, []);
        grouped.get(sku).push(p);
      });
    return [...grouped]
      .flatMap(([sku, items]) => {
        const dated = items
          .filter(
            (p) =>
              p.expirationDate &&
              daysLeft(p.expirationDate) >= 0 &&
              isQcAvailable(quality.get(p.qualityScopeId ?? p.lotId)?.judgment),
          )
          .sort(
            (a, b) =>
              String(a.expirationDate).localeCompare(String(b.expirationDate)) ||
              String(a.createdAt || '').localeCompare(String(b.createdAt || '')) ||
              a.id.localeCompare(b.id),
          );
        const prioritized = new Map(dated.map((p, i) => [p.id, i + 1]));
        return items.map((p) => {
          const remain = daysLeft(p.expirationDate);
          const judgment = quality.get(p.qualityScopeId ?? p.lotId)?.judgment;
          return {
            ...p,
            sku,
            judgment,
            days: remain,
            priority: prioritized.get(p.id) || null,
            totalBatches: dated.length,
            status:
              remain !== null && remain < 0
                ? 'expired'
                : judgment && !isQcAvailable(judgment)
                ? 'qc_blocked'
                : remain !== null && remain <= 30
                ? 'soon'
                : remain === null
                ? 'missing'
                : !judgment
                ? 'qc_pending'
                : prioritized.get(p.id) === 1
                ? 'first'
                : 'later',
          };
        });
      })
      .sort((a, b) => (a.days === null ? Infinity : a.days) - (b.days === null ? Infinity : b.days));
  }, [parts, quality]);

  const visible = useMemo(
    () =>
      rows.filter(
        (p) =>
          (filter === 'all' || filter === p.status) &&
          (!demoOnly || /^(MASAN-TEST-|MASAN-DEMO-)/.test(p.productCode || '')) &&
          (!query || `${p.partName} ${p.sku} ${p.lotNumber || ''}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [rows, filter, query, demoOnly],
  );

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const expired = rows.filter((r) => r.status === 'expired').length;
  const soon = rows.filter((r) => r.status === 'soon').length;
  const unknown = rows.filter((r) => r.status === 'missing').length;

  const status = {
    qc_pending: ['Chờ kết luận QC', 'bg-purple-500/10 text-purple-400 border-purple-500/20'],
    qc_blocked: ['QC chặn xuất', 'bg-rose-500/10 text-rose-400 border-rose-500/20'],
    expired: ['Đã quá HSD', 'bg-rose-500/10 text-rose-400 border-rose-500/20'],
    soon: ['Cận hạn (≤ 30 ngày)', 'bg-amber-500/10 text-amber-400 border-amber-500/20'],
    first: ['Ưu tiên FEFO số 1', 'bg-masan-emerald/10 text-masan-emerald border-masan-emerald/20'],
    later: ['Lô mới hơn', 'bg-sky-500/10 text-sky-400 border-sky-500/20'],
    missing: ['Thiếu HSD', 'bg-masan-elevated text-masan-muted border-masan-border'],
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-masan-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">
              Quản lý Lô & Chuẩn xuất FEFO
            </h1>
            <span className="rounded-full bg-masan-emerald/10 border border-masan-emerald/20 px-2.5 py-0.5 text-[11px] font-semibold text-masan-emerald">
              First-Expired First-Out
            </span>
          </div>
          <p className="text-sm text-masan-muted mt-1 max-w-3xl">
            Kiểm soát nghiêm ngặt thời hạn sử dụng theo múi giờ Việt Nam. Nghiệp vụ xuất kho tự động chọn lô cận hạn trước,
            chặn tuyệt đối hàng quá hạn và lô bị QC khóa.
          </p>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-masan-border/80 transition-all">
          <div className="flex items-center justify-between text-masan-muted text-xs">
            <span>Tổng lô có tồn kho</span>
            <Boxes className="w-4 h-4 text-masan-teal" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-masan-text">
            {fmtNum(rows.length)}
          </p>
          <p className="text-[11px] text-masan-muted mt-1">Đang phân bổ trên giá kệ</p>
        </div>

        <div className="rounded-2xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-masan-muted text-xs">
            <span>Đã quá hạn sử dụng</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-rose-400">
            {fmtNum(expired)}
          </p>
          <p className="text-[11px] text-rose-400/80 mt-1">Khóa xuất kho tự động</p>
        </div>

        <div className="rounded-2xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-masan-muted text-xs">
            <span>Cận hạn (≤ 30 ngày)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-amber-400">
            {fmtNum(soon)}
          </p>
          <p className="text-[11px] text-amber-400/80 mt-1">Cần ưu tiên đẩy đơn xuất</p>
        </div>

        <div className="rounded-2xl border border-masan-border bg-masan-surface p-4 shadow-sm hover:border-masan-border/80 transition-all">
          <div className="flex items-center justify-between text-masan-muted text-xs">
            <span>Chưa khai báo HSD</span>
            <Calendar className="w-4 h-4 text-masan-muted" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-masan-muted">
            {fmtNum(unknown)}
          </p>
          <p className="text-[11px] text-masan-muted mt-1">Cần bổ sung thông tin lô</p>
        </div>
      </div>

      {/* Info Alert */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <span>
          Hạn sử dụng được tính toán chính xác theo lịch pháp lý Việt Nam (Asia/Ho_Chi_Minh). Engine điều phối tự động bỏ qua lô hết hạn hoặc đang chịu trạng thái kiểm định HOLD/REINSPECTION_REQUIRED khi cấp phát đơn xuất.
        </span>
      </div>

      {/* Filter and Data Table */}
      <div className="rounded-2xl border border-masan-border bg-masan-surface shadow-lg overflow-hidden">
        <div className="p-4 border-b border-masan-border flex flex-wrap gap-3 justify-between items-center bg-masan-elevated/40">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 w-4 h-4 text-masan-muted" />
            <Input
              className="pl-9 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm SKU, sản phẩm, số lô..."
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
            >
              <option value="all">Tất cả tình trạng FEFO</option>
              {Object.entries(status).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[0]}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-xs text-masan-muted whitespace-nowrap cursor-pointer select-none">
              <input
                type="checkbox"
                checked={demoOnly}
                onChange={(e) => {
                  setDemoOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded accent-emerald-500"
              />
              Chỉ dữ liệu thử nghiệm
            </label>
          </div>
        </div>

        {expiryError && (
          <div role="alert" className="px-4 py-2 text-xs text-rose-300 bg-rose-500/10 border-b border-rose-500/20">
            {expiryError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[930px] w-full text-xs text-left">
            <thead className="sticky top-0 bg-masan-elevated text-[11px] font-semibold text-masan-muted uppercase tracking-wider border-b border-masan-border z-10">
              <tr>
                {['SKU / Sản phẩm', 'Lô hàng', 'Hạn sử dụng', 'Ưu tiên xuất', 'Số lượng', 'Vị trí kệ', 'Khuyến nghị vị trí', 'Thao tác'].map(
                  (t) => (
                    <th key={t} className="px-4 py-3 font-semibold">
                      {t}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-masan-border/40 font-mono text-[11px]">
              {pageRows.map((p) => {
                const [label, tone] = status[p.status];
                const rack = rackById[p.rackId];
                return (
                  <tr key={p.id} className="hover:bg-masan-elevated/40 transition-colors">
                    <td className="px-4 py-3 font-sans">
                      <p className="font-semibold text-masan-text text-xs">
                        {p.partName}
                      </p>
                      <p className="text-[11px] text-masan-muted font-mono">{p.sku}</p>
                      <p className="text-[10px] text-masan-teal">{storageLabel(p.storageClass)}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-masan-text">{p.lotNumber || 'Chưa có lô'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {editingId === p.id ? (
                        <div className="flex flex-col gap-1.5 min-w-[145px]">
                          <input
                            type="date"
                            aria-label={`HSD cho ${p.partName}`}
                            value={expiryDraft}
                            onChange={(e) => setExpiryDraft(e.target.value)}
                            className="rounded-lg border border-masan-border bg-masan-elevated px-2 py-1 text-xs text-masan-text focus:border-masan-emerald"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={expirySaving || !expiryDraft}
                              onClick={() => saveExpiry(p.id)}
                              className="text-masan-emerald font-semibold text-xs hover:underline"
                            >
                              {expirySaving ? 'Đang lưu...' : 'Lưu HSD'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setExpiryError('');
                              }}
                              className="text-masan-muted text-xs hover:text-masan-text"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-masan-text font-semibold">{formatDate(p.expirationDate)}</div>
                          {p.days !== null && (
                            <p
                              className={`text-[10px] mt-0.5 ${
                                p.days < 0
                                  ? 'text-rose-400 font-bold'
                                  : p.days <= 30
                                  ? 'text-amber-400 font-bold'
                                  : 'text-masan-muted'
                              }`}
                            >
                              {p.days < 0 ? `Quá hạn ${Math.abs(p.days)} ngày` : `Còn ${p.days} ngày`}
                            </p>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(p.id);
                                setExpiryDraft(p.expirationDate || '');
                              }}
                              className="block text-masan-teal hover:underline text-[10px] font-sans mt-0.5"
                            >
                              Chỉnh sửa HSD
                            </button>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 border rounded-full ${tone}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {label}
                        {p.judgment && !isQcAvailable(p.judgment) ? ` · ${p.judgment}` : ''}
                      </span>
                      {p.priority && (
                        <p className="text-[10px] text-masan-muted mt-1 font-mono">
                          Lô thứ {p.priority}/{p.totalBatches}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-masan-text">{fmtNum(p.cartons || 0)}</span> thùng
                      <p className="text-[10px] text-masan-emerald font-semibold">{fmtNum(p.quantity || 0)} PCS</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-masan-text font-semibold">
                        {rack ? `${rack.zoneCode} · ${rack.name}` : 'Chưa xếp kệ'}
                      </span>
                      {Number.isInteger(p.preferredRackSlot) && (
                        <p className="text-[10px] text-masan-teal font-mono">
                          Ô S{String(p.preferredRackSlot + 1).padStart(2, '0')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-sans text-masan-muted">
                      {['expired', 'qc_blocked'].includes(p.status)
                        ? 'Chuyển Dock Q cách ly'
                        : p.status === 'qc_pending'
                        ? 'Chờ biên bản kiểm định'
                        : p.status === 'missing'
                        ? 'Bổ sung HSD trước khi cất'
                        : p.priority === 1 || p.days <= 30
                        ? 'Tầng 1–2, gần cửa xuất'
                        : 'Tầng 3–4, lưu trữ dài hạn'}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <Link
                        to={
                          p.rackId
                            ? `/racks/${p.rackId}/plan?q=${encodeURIComponent(p.partName)}`
                            : `/orders/${p.orderId}`
                        }
                        className="inline-flex items-center text-masan-emerald hover:text-masan-teal hover:underline whitespace-nowrap text-xs font-semibold"
                      >
                        Vị trí kệ <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="p-12 text-center text-masan-muted font-sans text-xs">
              <Boxes className="w-8 h-8 mx-auto mb-2 text-masan-muted" />
              Chưa tìm thấy lô hàng nào phù hợp với điều kiện lọc.
            </div>
          )}
        </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-wrap justify-between items-center gap-3 text-xs text-masan-muted p-4 border-t border-masan-border bg-masan-elevated/40">
          <p>
            Đang xem {pageRows.length} / {visible.length} lô tồn kho · Trang {currentPage} / {pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((n) => Math.max(1, n - 1))}
              className="border-masan-border bg-masan-elevated text-xs text-masan-text"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pages}
              onClick={() => setPage((n) => Math.min(pages, n + 1))}
              className="border-masan-border bg-masan-elevated text-xs text-masan-text"
            >
              Trang sau <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
