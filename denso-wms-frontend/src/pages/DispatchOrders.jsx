import { useRef, useState } from 'react';
import { DocumentSourceButton } from './Documents';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const route = '/inventory/dispatches';
const status = { RESERVED: 'Đã giữ', PICKED: 'Đã soạn', SHIPPED: 'Đã xuất', CANCELLED: 'Đã hủy' };
const packingStatus = { NOT_STARTED: 'Chưa đóng gói', PARTIAL: 'Đóng gói một phần', COMPLETE: 'Đã đóng gói đủ', CANCELLED: 'Đã hủy' };

function PackingDetails({ order, canWrite }) {
  const [open, setOpen] = useState(false);
  return <details className="space-y-2" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Phiếu đóng gói</summary>
    {open && <PackingList order={order} canWrite={canWrite} />}
  </details>;
}

function PackingList({ order, canWrite }) {
  const path = `${route}/${order.id}/packing`;
  const packing = useQuery({ queryKey: ['dispatch-packing', order.id, order.status], queryFn: () => request(path) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);

  async function pack(event, partId) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = { partId, quantity: Number(new FormData(form).get('quantity')) };
    const payload = JSON.stringify(body);
    if (pending.current?.payload !== payload) pending.current = { payload, key: crypto.randomUUID() };
    setError('');
    setBusy(true);
    try {
      await request(path, { method: 'POST', body, headers: { 'Idempotency-Key': pending.current.key } });
      pending.current = null;
      form.reset();
      await packing.refetch();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (packing.isPending) return <p>Đang tải phiếu đóng gói…</p>;
  if (packing.isError) return <p role="alert">Không tải được phiếu đóng gói.</p>;
  return <section className="space-y-2 rounded-lg border p-3 text-sm" aria-label="Phiếu đóng gói">
    <p role="status">{packingStatus[packing.data.packingStatus]}</p>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {packing.data.lines.map(line => <div className="space-y-1" key={line.partId}>
      <p>{packing.data.sku} · {line.lotNumber} · PART {line.partId} · Đã đóng {line.packed}/{line.picked}</p>
      {canWrite && order.status === 'PICKED' && line.packed < line.picked &&
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => pack(event, line.partId)}>
          <label>Số lượng đóng gói<Input name="quantity" required type="number" min={1} max={line.picked - line.packed} /></label>
          <Button disabled={busy}>Ghi đóng gói</Button>
        </form>}
    </div>)}
  </section>;
}

export default function DispatchOrders() {
  const { user } = useAuth();
  const { parts, refetchParts } = useStore();
  const canWrite = ['admin', 'warehouse_manager'].includes(user?.role);
  const [reference, setReference] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(null);
  const stock = useQuery({
    queryKey: ['dispatch-stock', sku],
    enabled: !!sku.trim(),
    queryFn: () => request(route + '/availability?' + new URLSearchParams({ sku: sku.trim() })),
  });

  const orders = useQuery({
    queryKey: ['dispatch-orders'],
    queryFn: () => request(route),
  });

  const skus = [...new Set(parts.map(part => part.productCode).filter(Boolean))].sort();

  async function run(action, shipped = false) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await Promise.all([orders.refetch(), sku.trim() && stock.refetch()]);
      if (shipped) {
        await refetchParts();
        window.dispatchEvent(new Event('wms-inventory-committed'));
      }
      setMessage('Đã cập nhật đơn xuất thành công.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function reserve(event) {
    event.preventDefault();
    const body = { reference: reference.trim(), sku: sku.trim(), quantity: Number(quantity) };
    const payload = JSON.stringify(body);
    if (pending.current?.payload !== payload) pending.current = { payload, key: crypto.randomUUID() };
    run(async () => {
      await request(route, { method: 'POST', body, headers: { 'Idempotency-Key': pending.current.key } });
      pending.current = null;
      setReference('');
      setQuantity('');
    });
  }

  const handleAction = (orderId, actionName) => {
    run(() => request(`${route}/${orderId}/${actionName}`, { method: 'POST' }), actionName === 'ship');
  };

  return <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-7">
    <h1 className="text-2xl font-semibold">Đơn xuất kho</h1>
    {canWrite && <form onSubmit={reserve} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
      <label className="text-sm">Mã đơn<Input required maxLength={100} value={reference} onChange={event => setReference(event.target.value)} /></label>
      <label className="text-sm">SKU<Input required list="dispatch-skus" maxLength={120} value={sku} onChange={event => setSku(event.target.value)} /></label>
      <datalist id="dispatch-skus">{skus.map(value => <option key={value} value={value} />)}</datalist>
      <label className="text-sm">Số lượng yêu cầu<Input required type="number" min={1} value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      {sku.trim() && <p className="text-sm text-muted-foreground md:col-span-3">
        {stock.isPending ? 'Đang tải tồn…' : stock.isError ? 'Không tải được tồn.' :
          `Tồn đã xếp: ${stock.data.physicalPlaced} · Đã giữ: ${stock.data.held} · Có thể cấp phát: ${stock.data.available}`}
      </p>}
      <Button disabled={busy}>Giữ tồn theo FEFO</Button>
    </form>}
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {message && <p role="status" className="text-primary">{message}</p>}
    {orders.isPending && <p>Đang tải đơn…</p>}
    {!orders.data?.length && orders.isError && <p role="alert">Không tải được đơn xuất.</p>}
    {orders.data?.map(order => <article key={order.id} className="space-y-2 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{order.reference} · {status[order.status] || order.status}</h2>
      <div className="flex flex-wrap gap-2">
        <DocumentSourceButton kind="02-VT" reference={order.id}>In phiếu 02-VT</DocumentSourceButton>
        <DocumentSourceButton kind="PICKING" reference={order.id}>In Picking List</DocumentSourceButton>
        <DocumentSourceButton kind="PACKING" reference={order.id}>In Packing List</DocumentSourceButton>
      </div>
      <p className="text-sm">{order.sku} · Yêu cầu {order.quantity} · Đang giữ {['RESERVED','PICKED'].includes(order.status) ? order.quantity : 0}</p>
      <ul className="text-sm text-muted-foreground">{(order.allocations || []).map(row => <li key={row.partId}>{row.lotNumber} · {row.quantity} đơn vị</li>)}</ul>
      {order.status !== 'RESERVED' && <PackingDetails order={order} canWrite={canWrite} />}
      {canWrite && ['RESERVED','PICKED'].includes(order.status) && <div className="flex flex-wrap gap-2">
        {order.status === 'RESERVED' ? <Button type="button" disabled={busy} onClick={() => handleAction(order.id, 'pick')}>Xác nhận soạn</Button> :
          <Button type="button" disabled={busy} onClick={() => handleAction(order.id, 'ship')}>Xác nhận xuất</Button>}
        <Button type="button" variant="outline" disabled={busy} onClick={() => handleAction(order.id, 'cancel')}>Hủy giữ tồn</Button>
      </div>}
    </article>)}
  </main>;
}
