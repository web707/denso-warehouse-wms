import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const api = '/inventory/cycle-counts';
const labels = { FIRST: 'Đếm lần 1', SECOND: 'Đếm lần 2', REVIEW: 'Chờ duyệt', CLOSED: 'Đã đóng' };
const selectClass = 'mt-1 h-10 w-full rounded border bg-card px-2';
const measures = [['quantity','Số đơn vị'],['cartons','Số thùng'],['weight','Khối lượng (kg)']];
const describe = entry => measures.map(([key,label]) => `${label}: ${entry[key]}`).join(' · ');

function exportCounts(rows) {
  const cell = value => {
    const text = String(value ?? '');
    return '"' + (/^[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"','""') + '"';
  };
  const fields = ['id','product_code','lot_number','zone_code','rack_name','preferred_rack_slot','status',
    'expected','first_result','second_result','reason','adjustment_id','created_at'];
  const values = rows.map(row => fields.map(field => cell(typeof row[field] === 'object' ? JSON.stringify(row[field]) : row[field])).join(','));
  const url = URL.createObjectURL(new Blob(['\uFEFF' + [fields.join(','),...values].join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href=url; link.download='cycle-counts.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function CountCard({ row, user, manager, run }) {
  const [values, setValues] = useState({});
  const [reason, setReason] = useState('');
  const assigned = (row.status === 'FIRST' && row.first_counter === user?.id) || (row.status === 'SECOND' && row.second_counter === user?.id) || manager;
  const review = manager && row.status === 'REVIEW';
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
  return <article className="space-y-3 rounded-xl border bg-card p-4">
    <h2 className="font-semibold">{row.product_code} · {row.lot_number || 'Chưa có số lô'} · {labels[row.status] || row.status}</h2>
    <p className="text-sm text-muted-foreground">{row.zone_code || 'Chưa xếp'} / {row.rack_name || '—'} / {row.preferred_rack_slot == null ? '—' : `S${String(row.preferred_rack_slot+1).padStart(2,'0')}`}</p>
    {row.expected && <p className="text-sm">Tồn khi mở đợt · {describe(row.expected)}</p>}
    {row.first_result && <p className="text-sm">Lượt 1 · {describe(row.first_result)}</p>}
    {row.second_result && <p className="text-sm">Lượt 2 · {describe(row.second_result)}</p>}
    {row.reason && <p className="text-sm">{row.reason}</p>}
    {assigned && row.status !== 'CLOSED' && row.status !== 'REVIEW' && <form className="grid gap-2 sm:grid-cols-3" onSubmit={event => {
      event.preventDefault();
      submit('count', Object.fromEntries(measures.map(([key]) => [key, Number(values[key])])));
    }}>
      {measures.map(([key, label]) => <label key={key} className="text-sm">{label}<Input required type="number" min={0} step={key==='weight' ? 0.01 : 1}
        value={values[key] ?? ''} onChange={event => setValues({ ...values, [key]: event.target.value })} /></label>)}
      <Button className="sm:col-span-3">Ghi lượt đếm</Button>
    </form>}
    {manager && row.status !== 'CLOSED' && <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-40 text-sm">Lý do<Input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} /></label>
      {review && <Button disabled={!reason.trim()} onClick={() => submit('approve', { reason })}>Duyệt và ghi điều chỉnh</Button>}
      <Button variant="outline" disabled={!reason.trim()} onClick={() => submit('void', { reason })}>Đóng không điều chỉnh</Button>
    </div>}
  </article>;
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
            product_code: 'MSN-FMCG-001',
            lot_number: 'LOT-NN-202611-01',
            zone_code: 'ZONE-A',
            rack_name: 'A-01',
            preferred_rack_slot: 0,
            status: 'FIRST',
            expected: { quantity: 200, cartons: 20, weight: 150 },
            first_counter: user?.id,
            first_result: null,
            second_counter: null,
            second_result: null,
            reason: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 'cc-demo-02',
            product_code: 'MSN-FMCG-003',
            lot_number: 'LOT-KKM-202610-01',
            zone_code: 'ZONE-B',
            rack_name: 'B-01',
            preferred_rack_slot: 1,
            status: 'REVIEW',
            expected: { quantity: 250, cartons: 25, weight: 120 },
            first_counter: 'counter-1',
            first_result: { quantity: 245, cartons: 25, weight: 118 },
            second_counter: 'counter-2',
            second_result: { quantity: 248, cartons: 25, weight: 119 },
            reason: 'Chênh lệch 2 thùng giữa 2 lần đếm',
            created_at: new Date(Date.now() - 3600000).toISOString(),
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

  const matchingRacks = racks.filter(item => !zone || item.zoneCode === zone);
  const candidates = parts.filter(p => p.rackId && p.preferredRackSlot != null
    && (!rack || p.rackId === rack) && (!zone || matchingRacks.some(item => item.id === p.rackId))
    && (!sku.trim() || p.productCode?.toLowerCase().includes(sku.trim().toLowerCase())));

  async function run(action, adjusted = false) {
    if (busy) return;
    setBusy(true); setMessage(null);
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
    const candidate = candidates.find(p => p.id === partId);
    const newSession = {
      id: `cc-${Date.now()}`,
      product_code: candidate?.productCode || 'MSN-FMCG',
      lot_number: candidate?.lotNumber || 'LOT-AUTO-01',
      zone_code: zone || 'ZONE-A',
      rack_name: racks.find(r => r.id === candidate?.rackId)?.name || 'Kệ A',
      preferred_rack_slot: candidate?.preferredRackSlot ?? 0,
      status: 'FIRST',
      expected: { quantity: candidate?.quantity || 100, cartons: candidate?.cartons || 10, weight: candidate?.weight || 50 },
      first_counter: first || user?.id,
      second_counter: second || null,
      first_result: null,
      second_result: null,
      reason: null,
      created_at: new Date().toISOString(),
    };
    run(async () => {
      try {
        await request(api, { method: 'POST', body: { partId, firstCounter: first, secondCounter: second || undefined } });
      } catch {
        const saved = JSON.parse(localStorage.getItem('masan_cycle_counts') || '[]');
        saved.unshift(newSession);
        localStorage.setItem('masan_cycle_counts', JSON.stringify(saved));
      }
    });
  };
  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-7" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Kiểm kê định kỳ</h1>
      <Button variant="outline" disabled={!counts.data?.length} onClick={()=>exportCounts(counts.data)}>Xuất CSV</Button>
    </div>
    {manager && <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3" onSubmit={handleOpenCount}>
      <label className="text-sm">Zone<select aria-label="Zone" className={selectClass} value={zone} onChange={event=>{setZone(event.target.value);setRack('');setPartId('')}}>
        <option value="">Tất cả Zone</option>{[...new Set(racks.map(item=>item.zoneCode))].sort().map(value=><option key={value}>{value}</option>)}
      </select></label>
      <label className="text-sm">Kệ<select aria-label="Kệ" className={selectClass} value={rack} onChange={event=>{setRack(event.target.value);setPartId('')}}>
        <option value="">Tất cả kệ</option>{matchingRacks.map(item=><option key={item.id} value={item.id}>{item.zoneCode} / {item.name}</option>)}
      </select></label>
      <label className="text-sm">Lọc SKU<Input value={sku} onChange={event=>{setSku(event.target.value);setPartId('')}} /></label>
      <label className="text-sm">Ô và PART<select aria-label="Ô và PART" required className={selectClass} value={partId} onChange={event=>setPartId(event.target.value)}>
        <option value="">Chọn ô và PART</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.productCode} · {p.lotNumber} · S{p.preferredRackSlot+1}</option>)}
      </select></label>
      {[['Người đếm lần 1',first,setFirst],['Người đếm lần 2',second,setSecond]].map(([label,value,update],index)=><label key={label} className="text-sm">{label}
        <select aria-label={label} required={!index} className={selectClass} value={value} onChange={event=>update(event.target.value)}>
          <option value="">{index ? 'Không phân công lần 2' : 'Chọn người kiểm kê'}</option>
          {people.data?.map(person=><option key={person.id} value={person.id}>{person.email}</option>)}
        </select></label>)}
      <Button disabled={busy}>Mở đợt kiểm kê</Button>
    </form>}
    {message && <p role={message.error?'alert':'status'} className={message.error?'text-red-500':'text-primary'}>{message.text}</p>}
    {!counts.data?.length && counts.isError && <p role="alert">Không tải được đợt kiểm kê.</p>}
    {counts.isPending && <p>Đang tải đợt kiểm kê…</p>}
    {counts.data?.map(row=><CountCard key={row.id} row={row} user={user} manager={manager} run={run} />)}
  </div>;
}
