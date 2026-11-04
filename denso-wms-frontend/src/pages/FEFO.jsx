import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Boxes, AlertTriangle, Search } from 'lucide-react';
import { useStore } from '@/lib/store';
import { fmtNum } from '@/lib/calculations';
import { Input } from '@/components/ui/input';

const formatDate = (date) => date ? new Date(`${String(date).slice(0,10)}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa khai báo';
function daysLeft(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0,10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((date.getTime() - today.getTime())/86400000);
}
export default function FEFO() {
  const { parts, racks } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const rackById = useMemo(() => Object.fromEntries(racks.map((r)=>[r.id,r])), [racks]);
  const rows = useMemo(() => {
    const grouped = new Map();
    parts.filter((p) => Number(p.quantity || 0)>0 || Number(p.cartons || 0)>0).forEach((p) => {
      const sku = (p.productCode || p.partName || '').trim().toUpperCase();
      if (!grouped.has(sku)) grouped.set(sku, []);
      grouped.get(sku).push(p);
    });
    return [...grouped].flatMap(([sku, items]) => {
      const dated = items.filter((p) => daysLeft(p.expirationDate) !== null).sort((a,b)=>String(a.expirationDate).localeCompare(String(b.expirationDate)));
      const prioritized = new Map(dated.map((p,i)=>[p.id,i+1]));
      return items.map((p)=>{
        const remain = daysLeft(p.expirationDate);
        return { ...p, sku, days: remain, priority: prioritized.get(p.id) || null, totalBatches: dated.length,
          status: remain === null ? 'missing' : remain < 0 ? 'expired' : remain <= 30 ? 'soon' : prioritized.get(p.id)===1 ? 'first' : 'later' };
      });
    }).sort((a,b) => (a.days===null ? Infinity : a.days) - (b.days===null ? Infinity : b.days));
  }, [parts]);
  const visible = useMemo(()=>rows.filter((p)=>(filter==='all' || filter===p.status) && (!query || `${p.partName} ${p.sku} ${p.lotNumber || ''}`.toLowerCase().includes(query.toLowerCase()))),[rows,filter,query]);
  const expired = rows.filter((r)=>r.status==='expired').length;
  const soon = rows.filter((r)=>r.status==='soon').length;
  const unknown = rows.filter((r)=>r.status==='missing').length;
  const status = { expired:['Hết hạn','bg-rose-50 text-rose-700 border-rose-200'], soon:['Sắp hết hạn','bg-amber-50 text-amber-800 border-amber-200'], first:['Ưu tiên FEFO','bg-emerald-50 text-emerald-800 border-emerald-200'], later:['Hàng mới hơn','bg-blue-50 text-blue-800 border-blue-200'], missing:['Thiếu HSD','bg-slate-100 text-slate-700 border-slate-200'] };
  return <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
    <header><div className="flex items-center gap-2"><CalendarDays className="w-7 h-7 text-emerald-600"/><h1 className="text-2xl font-semibold">Quản lý lô &amp; FEFO</h1></div><p className="mt-1 text-sm text-slate-500">Phân biệt hàng cũ/mới theo hạn sử dụng của cùng SKU. Lô gần hết hạn được đề xuất lấy trước; không tự động trừ tồn.</p></header>
    <div className="grid sm:grid-cols-4 gap-3">{[
      ['Lô có hàng', rows.length, 'border-slate-200'],['Đã quá HSD',expired,'border-rose-200'],['HSD ≤ 30 ngày',soon,'border-amber-200'],['Chưa có HSD',unknown,'border-slate-200']].map(([title,value,border])=><div key={title} className={`rounded-2xl border ${border} bg-white p-4`}><p className="text-sm text-slate-500">{title}</p><p className="text-3xl font-semibold mt-2">{fmtNum(value)}</p></div>)}</div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/><span>Đây là gợi ý FEFO theo ngày HSD đã nhập, <b>không phải ngày nhập kho thực tế</b>. Lô quá hạn hoặc QC HOLD/NG phải được kiểm tra/cách ly trước khi xuất. Chưa tự động chặn xuất ở API.</span></div>
    <div className="bg-white border rounded-2xl overflow-hidden">
      <div className="p-4 border-b flex flex-wrap gap-3 justify-between items-center"><div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/><Input className="pl-9" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Tìm SKU, sản phẩm, số lô..." /></div><select value={filter} onChange={(e)=>setFilter(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm text-slate-900"><option value="all">Tất cả tình trạng</option>{Object.entries(status).map(([k,v])=><option key={k} value={k}>{v[0]}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="min-w-[930px] w-full text-sm"><thead className="bg-slate-50 text-slate-600 text-left"><tr>{['SKU / sản phẩm','Lô hàng','Hạn dùng','Ưu tiên','Số lượng','Vị trí hiện tại','Gợi ý cất / lấy','Thao tác'].map((t)=><th key={t} className="px-4 py-3 font-semibold">{t}</th>)}</tr></thead><tbody className="divide-y">{visible.map((p)=>{const [label,tone]=status[p.status];const rack=rackById[p.rackId];return <tr key={p.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-medium">{p.partName}</p><p className="text-xs text-slate-500">{p.sku}</p></td><td className="px-4 py-3">{p.lotNumber || 'Chưa có lô'}</td><td className="px-4 py-3 whitespace-nowrap">{formatDate(p.expirationDate)}{p.days!==null && <p className="text-xs text-slate-500">{p.days<0 ? `Quá hạn ${Math.abs(p.days)} ngày` : `Còn ${p.days} ngày`}</p>}</td><td className="px-4 py-3"><span className={`inline-flex text-xs font-semibold px-2 py-1 border rounded-full ${tone}`}>{label}</span>{p.priority && <p className="text-xs text-slate-500 mt-1">Lô {p.priority}/{p.totalBatches} theo HSD</p>}</td><td className="px-4 py-3 tabular-nums">{fmtNum(p.cartons || 0)} thùng<p className="text-xs text-slate-500">{fmtNum(p.quantity || 0)} đơn vị</p></td><td className="px-4 py-3">{rack ? `${rack.zoneCode} · ${rack.name}` : 'Chưa phân bổ'}{Number.isInteger(p.preferredRackSlot) && <p className="text-xs text-slate-500">S{String(p.preferredRackSlot+1).padStart(2,'0')}</p>}</td><td className="px-4 py-3 text-xs text-slate-600">{p.status === 'expired' ? 'Cách ly, không lấy xuất' : p.status === 'missing' ? 'Bổ sung HSD trước khi xếp' : p.priority === 1 || p.days <= 30 ? 'Ưu tiên tầng 1–2, gần Dock xuất' : 'Ưu tiên tầng 3–4 / sâu trong kệ'}</td><td className="px-4 py-3"><Link to={p.rackId ? `/racks/${p.rackId}/plan?q=${encodeURIComponent(p.partName)}` : `/orders/${p.orderId}`} className="inline-flex items-center text-emerald-700 hover:underline whitespace-nowrap">Xem vị trí <ArrowUpRight className="w-4 h-4"/></Link></td></tr>})}</tbody></table>{visible.length===0 && <div className="p-12 text-center text-slate-500"><Boxes className="w-8 h-8 mx-auto mb-2"/>Chưa tìm thấy lô hàng phù hợp.</div>}</div>
    </div>
  </div>;
}
