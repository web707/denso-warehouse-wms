import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { fmtNum } from '@/lib/calculations';
import { subinventoryCode } from '@/lib/warehouse';
import {
  JUDGMENT, SHIPMENT_STATUS, WO_STATUS, fmtDate, isQcAvailable, useInspections, useLotStatus, useShipments, useWorkOrders,
} from '@/lib/supplyChain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Pill from '@/components/Pill';
import ExpiryBadge from '@/components/ExpiryBadge';

const norm = (v) => String(v || '').trim().toLowerCase();

function Section({ step, title, count, to, linkLabel, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">{step}</span>
          <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
          <Pill tone={count ? 'indigo' : 'slate'}>{count}</Pill>
        </div>
        {to && <Link to={to} className="text-sm font-medium text-indigo-600 hover:underline whitespace-nowrap">{linkLabel}</Link>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const Empty = ({ text }) => <p className="text-sm text-slate-500">{text}</p>;

export default function Traceability() {
  const [params, setParams] = useSearchParams();
  const lot = params.get('lot') || '';
  const sku = params.get('sku') || '';
  const [input, setInput] = useState(lot);
  const { parts, racks } = useStore();
  const { data: workOrders = [] } = useWorkOrders();
  const { data: inspections = [] } = useInspections();
  const { data: lotStatuses = [] } = useLotStatus();
  const { data: shipments = [] } = useShipments();

  const rackById = useMemo(() => new Map(racks.map((r) => [r.id, r])), [racks]);

  const matches = lotStatuses.filter((l) => !l.qualityScopeId && (!lot || norm(l.lotNumber).includes(norm(lot))));
  const scoped = new Map(lotStatuses.filter(row => row.qualityScopeId).map(row => [row.qualityScopeId, row.judgment]));
  const exact = matches.filter((l) => l.lotNumber === lot);
  const identity = sku ? exact.find((l) => l.productCode === sku) : (exact.length === 1 ? exact[0] : null);
  const { data: ledger = [], isPending: ledgerPending, isError: ledgerError } = useQuery({
    queryKey: ['inventory', 'traceability', identity?.lotId],
    queryFn: () => api.inventory.list({ lotId: identity.lotId, limit: 200 }),
    enabled: !!identity,
  });
  const data = useMemo(() => {
    if (!identity) return null;
    const matchesPair = (row) => row.lotNumber?.trim() === identity.lotNumber
      && row.itemNumber?.trim() === identity.productCode;
    return {
      workOrders: workOrders.filter(matchesPair),
      parts: parts.filter((p) => p.lotId === identity.lotId),
      inspections: inspections.filter((i) => i.lotId === identity.lotId),
      shipments: shipments.filter(matchesPair),
      latest: identity.inspectionId ? identity : null,
    };
  }, [identity, workOrders, parts, inspections, shipments]);

  const warnings = useMemo(() => {
    if (!data?.latest || isQcAvailable(data.latest.judgment)) return [];
    const j = data.latest.judgment;
    const out = [];
    const inStock = data.parts.length;
    if (inStock) out.push(`Lô đang ở trạng thái ${j} nhưng còn ${fmtNum(inStock)} PART trong kho. Cần cách ly, không xuất đi.`);
    const after = data.shipments.filter((s) => s.actualShipDate && new Date(s.actualShipDate) > new Date(data.latest.inspectionDate));
    if (after.length) out.push(`${fmtNum(after.length)} lô giao đã xuất đi SAU khi lô bị ${j}: ${after.map((s) => s.shipmentNumber).join(', ')}.`);
    return out;
  }, [data]);

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    setParams(v ? { lot: v } : {});
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Truy vết theo lô</h1>
        <p className="text-sm text-slate-500 mt-1">Tìm số lô và chọn SKU để xem nguồn gốc, tồn kho, kiểm định và giao hàng.</p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input list="known-lots" value={input} onChange={(e) => setInput(e.target.value)} placeholder="LOT-2026-001" aria-label="Lot Number" className="pl-9" />
          <datalist id="known-lots">{[...new Set(matches.map((l) => l.lotNumber))].map((name) => <option key={name} value={name} />)}</datalist>
        </div>
        <Button type="submit">Truy vết</Button>
      </form>

      {!data && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Các lô đã biết</h2>
          {matches.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Chưa có lô nào. Hãy gán Lot Number cho PART, lệnh sản xuất, phiếu kiểm tra hoặc lô giao.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {matches.slice(0, 40).map((l) => (
                <button
                  key={l.lotId}
                  type="button"
                  onClick={() => { setInput(l.lotNumber); setParams({ lot: l.lotNumber, sku: l.productCode }); }}
                  className="inline-flex items-center gap-2 h-8 rounded-md border border-slate-200 px-3 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {l.lotNumber} · {l.productCode}
                  {l.judgment && <Pill tone={JUDGMENT[l.judgment]?.tone || 'amber'}>{JUDGMENT[l.judgment]?.label || 'Cần kiểm định'}</Pill>}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {data && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-slate-500">Lot Number</p>
              <p className="text-xl font-semibold text-slate-900">{identity.lotNumber} · {identity.productCode}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Kết luận chất lượng mới nhất</p>
              {data.latest
                ? <p className="mt-0.5"><Pill tone={JUDGMENT[data.latest.judgment].tone}>{data.latest.judgment}</Pill> <span className="text-xs text-slate-500">{data.latest.inspectionType} · {fmtDate(data.latest.inspectionDate)}</span></p>
                : <p className="text-sm text-slate-500 mt-0.5">Cần kiểm định</p>}
            </div>
          </div>

          {warnings.map((w) => (
            <div key={w} role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />{w}
            </div>
          ))}

          <Section step="1" title="Lệnh sản xuất" count={data.workOrders.length} to="/work-orders" linkLabel="Mở Kế hoạch sản xuất">
            {data.workOrders.length === 0 ? <Empty text="Không có lệnh sản xuất nào cho lô này." /> : (
              <ul className="divide-y divide-slate-200">
                {data.workOrders.map((w) => (
                  <li key={w.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><span className="font-medium text-slate-900">{w.workOrderNumber}</span> <span className="text-slate-500">· {w.itemNumber} · {w.customerName || 'Chưa có khách'}</span></span>
                    <span className="flex items-center gap-2 tabular-nums text-slate-600">
                      {fmtNum(w.completedQuantity)}/{fmtNum(w.plannedStartQuantity)}
                      <Pill tone={(WO_STATUS[w.workOrderStatus] || WO_STATUS.UNRELEASED).tone}>{(WO_STATUS[w.workOrderStatus] || WO_STATUS.UNRELEASED).label}</Pill>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section step="2" title="Tồn kho" count={data.parts.length} to="/racks" linkLabel="Mở Sơ đồ kho">
            {data.parts.length === 0 ? <Empty text="Không có PART nào trong kho thuộc lô này." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500"><tr>
                    {['PART', 'Item Number', 'Vị trí', 'Số lượng', 'Hạn dùng', 'QC', 'Nhà cung cấp'].map((h) => <th key={h} className="py-2 pr-3 text-left font-medium whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.parts.map((p) => (
                      <tr key={p.id} className="border-t border-slate-200">
                        <td className="py-2 pr-3 text-slate-900">{p.partName}</td>
                        <td className="py-2 pr-3 text-slate-600">{p.productCode}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{p.rackId ? subinventoryCode(rackById.get(p.rackId), p.preferredRackSlot) : <span className="text-slate-400">Chưa xếp kệ</span>}</td>
                        <td className="py-2 pr-3 tabular-nums whitespace-nowrap">{fmtNum(p.quantity)} {p.uomCode}</td>
                        <td className="py-2 pr-3 whitespace-nowrap"><ExpiryBadge date={p.expirationDate} /></td>
                        <td className="py-2 pr-3">{p.receivingDamaged ? 'BLOCKED' : p.qualityScopeId ? (scoped.get(p.qualityScopeId) === 'REINSPECTION_REQUIRED' ? 'Chờ QC' : scoped.get(p.qualityScopeId) || 'Chờ QC') : identity.judgment}</td>
                        <td className="py-2 text-slate-600">{p.supplierName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section step="3" title="Sổ giao dịch theo lô" count={ledger.length}>
            {ledgerPending && <Empty text="Đang tải giao dịch…" />}
            {ledgerError && <Empty text="Không tải được sổ giao dịch." />}
            {!ledgerPending && !ledgerError && ledger.length === 0 && <Empty text="Chưa có giao dịch gắn định danh lô." />}
            {ledger.length > 0 && <ul className="divide-y divide-slate-200">
              {ledger.map((row) => <li key={row.id} className="py-2 text-sm">
                <p>{fmtDate(row.createdAt, true)} · {row.type} · {fmtNum(row.quantityPcs)} đơn vị</p>
                <p className="break-all text-xs text-slate-500">PART {row.partId}{row.destinationPartId ? ` → ${row.destinationPartId}` : ''}</p>
              </li>)}
            </ul>}
          </Section>

          <Section step="4" title="Kiểm tra chất lượng" count={data.inspections.length} to="/inspections" linkLabel="Mở Kiểm tra chất lượng">
            {data.inspections.length === 0 ? <Empty text="Lô này chưa có phiếu kiểm tra." /> : (
              <ul className="divide-y divide-slate-200">
                {data.inspections.map((i) => (
                  <li key={i.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><span className="font-medium text-slate-900">{i.inspectionId}</span> <span className="text-slate-500">· {i.inspectionType} · {fmtDate(i.inspectionDate, true)}</span></span>
                    <span className="flex items-center gap-2 tabular-nums text-slate-600">
                      {fmtNum(i.passQuantity)} đạt / {fmtNum(i.failQuantity)} lỗi
                      <Pill tone={JUDGMENT[i.judgment].tone}>{i.judgment}</Pill>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section step="5" title="Giao hàng" count={data.shipments.length} to="/shipments" linkLabel="Mở Giao hàng">
            {data.shipments.length === 0 ? <Empty text="Lô này chưa được giao cho khách." /> : (
              <ul className="divide-y divide-slate-200">
                {data.shipments.map((s) => (
                  <li key={s.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><span className="font-medium text-slate-900">{s.shipmentNumber}</span> <span className="text-slate-500">· {s.customerName} · {fmtNum(s.shippedQuantity)} {s.itemNumber}</span></span>
                    <span className="flex items-center gap-2 text-slate-600">
                      {s.delayDays > 0 && <Pill tone="red">Trễ {s.delayDays} ngày</Pill>}
                      <Pill tone={(SHIPMENT_STATUS[s.shipmentStatus] || SHIPMENT_STATUS.RELEASED).tone}>{(SHIPMENT_STATUS[s.shipmentStatus] || SHIPMENT_STATUS.RELEASED).label}</Pill>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
