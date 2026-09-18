import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

function csvEscape(v) { const s = String(v ?? ''); return `"${s.replaceAll('"', '""')}"`; }
function downloadCsv(rows) {
  const headers = ['Zone','Kệ','PART','Mã hàng','Ô','Số lượng','Số thùng','Khối lượng kg'];
  const body = rows.map((r) => [r.zone,r.rack,r.partName,r.productCode,r.slot,r.quantity,r.cartons,r.weight].map(csvEscape).join(','));
  const blob = new Blob(['\ufeff' + [headers.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bao-cao-ton-kho-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

export default function Reports() {
  const { parts, racks, orders } = useStore();
  const [zone, setZone] = useState('ALL');
  const [tx, setTx] = useState([]);
  useEffect(() => { api.inventory.list({ limit: 500 }).then(setTx).catch(() => {}); }, []);
  const zones = [...new Set(racks.map((r) => r.zoneCode))].sort();
  const rows = useMemo(() => parts.map((p) => { const r = racks.find((x) => x.id === p.rackId); return { zone: r?.zoneCode || 'Chưa xếp', rack: r?.name || '—', partName: p.partName, productCode: p.productCode, slot: p.preferredRackSlot == null ? '—' : `S${String(p.preferredRackSlot + 1).padStart(2,'0')}`, quantity: p.quantity, cartons: p.cartons, weight: p.weight }; }).filter((r) => zone === 'ALL' || r.zone === zone), [parts, racks, zone]);
  const totalWeight = rows.reduce((s,r)=>s+r.weight,0), totalCartons=rows.reduce((s,r)=>s+r.cartons,0), usedRacks=new Set(rows.filter(r=>r.rack!=='—').map(r=>`${r.zone}/${r.rack}`)).size;
  const txStats = { inbound: tx.filter(t=>t.type==='inbound').length, outbound: tx.filter(t=>t.type==='outbound').length, transfer: tx.filter(t=>t.type==='transfer').length };

  return <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <div className="flex flex-wrap justify-between gap-3 items-end"><div><h1 className="text-2xl font-bold">Báo cáo kho</h1><p className="text-sm text-slate-500 mt-1">Tổng hợp tồn kho, sử dụng kệ và nghiệp vụ nhập/xuất/điều chuyển.</p></div><div className="flex gap-2 print:hidden"><select className="h-10 border rounded-md px-3 bg-white" value={zone} onChange={(e)=>setZone(e.target.value)}><option value="ALL">Tất cả Zone</option>{zones.map(z=><option key={z}>{z}</option>)}</select><Button variant="outline" onClick={()=>downloadCsv(rows)}><FileSpreadsheet className="w-4 h-4 mr-2"/>CSV</Button><Button onClick={()=>window.print()}><Printer className="w-4 h-4 mr-2"/>In báo cáo</Button></div></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">{[
      ['PART',rows.length],['Kệ đang dùng',usedRacks],['Thùng',totalCartons.toLocaleString('vi-VN')],['Khối lượng',`${totalWeight.toLocaleString('vi-VN')} kg`],['Lô linh kiện',orders.length]
    ].map(([k,v])=><div key={k} className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-400">{k}</div><div className="text-2xl font-black mt-1">{v}</div></div>)}</div>
    <div className="grid md:grid-cols-3 gap-3">{[['Nhập kho',txStats.inbound],['Xuất kho',txStats.outbound],['Điều chuyển',txStats.transfer]].map(([k,v])=><div key={k} className="bg-indigo-50 border border-indigo-100 rounded-xl p-4"><div className="text-sm text-indigo-700">{k}</div><div className="text-xl font-black text-indigo-900">{v} giao dịch</div></div>)}</div>
    <div className="bg-white border rounded-2xl overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Zone','Kệ','PART','Mã hàng','Ô','SL','Thùng','Kg'].map(h=><th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-t"><td className="p-3">{r.zone}</td><td className="p-3 font-bold">{r.rack}</td><td className="p-3">{r.partName}</td><td className="p-3">{r.productCode}</td><td className="p-3">{r.slot}</td><td className="p-3">{r.quantity}</td><td className="p-3">{r.cartons}</td><td className="p-3">{r.weight.toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>
  </div>;
}
