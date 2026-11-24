import { useEffect, useMemo, useRef, useState } from 'react';
import { SLOTS_PER_RACK, slotCode, slotPosition, summarizeRack, zoneShort } from '@/lib/warehouse';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  CheckSquare2,
  Download,
  FileDown,
  Layers3,
  Package,
  Printer,
  QrCode,
  Search,
  Square,
  Warehouse,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LOAD_STATUS_META, RACK_SAFETY, loadStatus } from '@/lib/viz/rackSafety';

const WAREHOUSE_CODE = 'MASAN-HN-01';
const LABEL_PRESETS = {
  small: { label: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  medium: { label: '70 × 40 mm', widthMm: 70, heightMm: 40 },
  large: { label: '100 × 60 mm', widthMm: 100, heightMm: 60 },
  a4: { label: 'A4 · nhiều tem', widthMm: 90, heightMm: 55, a4: true },
};
const TYPES = [
  { value: 'zone', label: 'QR Zone', icon: Layers3 },
  { value: 'rack', label: 'QR Kệ', icon: Warehouse },
  { value: 'slot', label: 'QR Ô', icon: QrCode },
  { value: 'part', label: 'QR SKU', icon: Package },
];
const STATUS_ORDER = ['all', 'empty', 'active', 'near', 'full', 'overload'];
const STATUS_LABEL = {
  all: 'Tất cả trạng thái',
  empty: 'Trống',
  active: 'Đang sử dụng',
  near: 'Gần đầy',
  full: 'Đầy tải',
  overload: 'Quá tải',
};

const safeText = (value) => String(value || '').trim();

function labelStatusClass(status) {
  return (
    {
      empty: 'border-masan-border bg-masan-surface',
      active: 'border-masan-emerald/40 bg-masan-surface hover:border-masan-emerald',
      near: 'border-amber-500/40 bg-masan-surface hover:border-amber-500',
      full: 'border-sky-500/40 bg-masan-surface hover:border-sky-500',
      overload: 'border-rose-500/40 bg-masan-surface hover:border-rose-500',
    }[status] || 'border-masan-border bg-masan-surface'
  );
}

function statusDot(status) {
  return (
    {
      empty: '#94a3b8',
      active: '#10B981',
      near: '#f59e0b',
      full: '#38bdf8',
      overload: '#f87171',
    }[status] || '#94a3b8'
  );
}

function MiniStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-masan-border bg-masan-surface px-4 py-3 flex gap-3 items-center shadow-sm">
      <div className="w-9 h-9 rounded-xl bg-masan-emerald/10 border border-masan-emerald/20 text-masan-emerald flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold font-mono text-masan-text">{value}</div>
        <div className="text-xs text-masan-muted">{label}</div>
        {sub && <div className="text-[10px] text-masan-muted/70 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function LabelCard({ item, selected, onToggle, onPreview }) {
  const meta = LOAD_STATUS_META[item.status] || LOAD_STATUS_META.empty;
  return (
    <div
      className={`qr-label-card relative rounded-2xl border p-3.5 cursor-pointer transition-all hover:shadow-lg ${labelStatusClass(
        item.status,
      )} ${selected ? 'ring-2 ring-masan-emerald border-masan-emerald' : ''}`}
      onClick={() => onPreview(item.key)}
    >
      <button
        type="button"
        className="absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-md bg-masan-elevated/90 border border-masan-border flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.key);
        }}
        aria-label="Chọn nhãn"
      >
        {selected ? (
          <CheckSquare2 className="w-4 h-4 text-masan-emerald" />
        ) : (
          <Square className="w-4 h-4 text-masan-muted" />
        )}
      </button>
      <div className="flex justify-center p-2 rounded-xl bg-white mx-auto max-w-[110px]">
        <QRCodeSVG value={item.qrValue} size={92} />
      </div>
      <div className="font-bold text-center mt-2.5 text-xs text-masan-text truncate">{item.title}</div>
      <div className="text-[10px] text-center text-masan-muted truncate">{item.subtitle}</div>
      <div className="mx-auto overflow-hidden max-w-[140px] mt-1 bg-white p-1 rounded flex justify-center">
        <Barcode value={item.barcodeValue} height={18} width={0.8} displayValue={false} margin={0} />
      </div>
      {item.status && (
        <div
          className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold"
          style={{ color: meta.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </div>
      )}
    </div>
  );
}

function PrintableLabel({ item, preset, pdfKey }) {
  const meta = LOAD_STATUS_META[item.status] || LOAD_STATUS_META.empty;
  const narrow = preset.widthMm <= 50;
  return (
    <div
      data-pdf-key={pdfKey || item.key}
      className="print-label bg-white border border-slate-300 rounded-md overflow-hidden box-border"
      style={{ width: `${preset.widthMm}mm`, height: `${preset.heightMm}mm`, padding: narrow ? '2mm' : '3mm' }}
    >
      <div className="h-full flex gap-2 items-center">
        <QRCodeSVG value={item.qrValue} size={narrow ? 70 : 92} />
        <div className="min-w-0 flex-1">
          <div className="text-[7px] uppercase tracking-wide text-slate-400">{item.kindLabel}</div>
          <div className={`${narrow ? 'text-sm' : 'text-lg'} font-bold leading-tight truncate`}>{item.title}</div>
          <div className="text-[8px] text-slate-500 truncate">{item.subtitle}</div>
          {item.detail && <div className="text-[7px] text-slate-600 mt-0.5 line-clamp-2">{item.detail}</div>}
          <div className="overflow-hidden mt-1">
            <Barcode value={item.barcodeValue} height={narrow ? 15 : 22} width={0.75} displayValue={false} margin={0} />
          </div>
          {item.status && (
            <div className="text-[7px] font-bold flex items-center gap-1 mt-0.5" style={{ color: meta.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QRLabels() {
  const { racks, parts } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const pdfRootRef = useRef(null);
  const [zones, setZones] = useState([]);
  const [type, setType] = useState('slot');
  const [zoneCode, setZoneCode] = useState(() => racks[0]?.zoneCode || 'ZONE-A');
  const [rackId, setRackId] = useState(() => racks[0]?.id || '');
  const [level, setLevel] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [presetKey, setPresetKey] = useState('medium');
  const [selected, setSelected] = useState(new Set());
  const [previewKey, setPreviewKey] = useState('');
  const [exporting, setExporting] = useState(false);
  const [printedCount, setPrintedCount] = useState(() => Number(localStorage.getItem('wms_qr_labels_printed') || 0));

  const publicBase = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
  const localOnly = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const preset = LABEL_PRESETS[presetKey];

  useEffect(() => {
    api.zones.list({ warehouseCode: WAREHOUSE_CODE }).then(setZones).catch(() => setZones([]));
  }, []);

  const zoneRacks = useMemo(
    () =>
      racks.filter(
        (r) => (r.warehouseCode || WAREHOUSE_CODE) === WAREHOUSE_CODE && (r.zoneCode || 'ZONE-A') === zoneCode,
      ),
    [racks, zoneCode],
  );

  useEffect(() => {
    if (!zoneRacks.length) {
      setRackId('');
      return;
    }
    const valid = zoneRacks.some((r) => r.id === rackId);
    if (!valid) setRackId(type === 'slot' ? zoneRacks[0].id : '');
    if (type === 'slot' && !rackId) setRackId(zoneRacks[0].id);
  }, [zoneRacks, rackId, type]);

  const rack = useMemo(() => racks.find((r) => r.id === rackId) || null, [racks, rackId]);
  const rackParts = useMemo(() => parts.filter((p) => p.rackId === rackId), [parts, rackId]);
  const slotItems = useMemo(
    () =>
      Array.from({ length: SLOTS_PER_RACK }, (_, index) => {
        const code = slotCode(index);
        const slotParts = rackParts.filter(
          (p) => p.preferredRackSlot === index && (p.quantity > 0 || p.cartons > 0 || p.weight > 0),
        );
        const cartonCount = slotParts.reduce((sum, p) => sum + Number(p.cartons || 0), 0);
        const weightKg = slotParts.reduce((sum, p) => sum + Number(p.weight || 0), 0);
        const load = loadStatus(weightKg, RACK_SAFETY.slotMaxKg);
        const firstPart = slotParts[0];
        const fullCode = `${zoneShort(rack?.zoneCode)}-${rack?.name || 'RACK'}-${code}`;
        return {
          key: `slot:${rackId}:${index}`,
          kind: 'slot',
          kindLabel: 'Ô lưu trữ',
          title: `${rack?.name || 'RACK'}-${code}`,
          subtitle: `${rack?.warehouseCode || WAREHOUSE_CODE} / ${rack?.zoneCode || zoneCode} · Tầng ${
            Math.floor(index / 5) + 1
          } · Khoang ${(index % 5) + 1}`,
          code: fullCode,
          barcodeValue: fullCode,
          qrValue: `${publicBase}/locations/${rackId}/${code}`,
          status: load,
          level: slotPosition(index).level,
          index,
          weightKg,
          cartonCount,
          partCount: slotParts.length,
          part: firstPart,
          detail: `Tọa độ vị trí: Tầng ${Math.floor(index / 5) + 1} · Khoang ${(index % 5) + 1} · Tải tối đa: 250 kg`,
        };
      }),
    [rackParts, rack, rackId, publicBase, zoneCode],
  );

  const rackItems = useMemo(
    () =>
      zoneRacks.map((r) => {
        const sum = summarizeRack(r, parts);
        const rp = sum.parts;
        const usedSlots = sum.usedSlots;
        const weightKg = sum.totalWeight;
        const st = sum.status;
        const code = `${zoneShort(r.zoneCode)}-${r.name}`;
        return {
          key: `rack:${r.id}`,
          kind: 'rack',
          kindLabel: 'Kệ kho',
          title: r.name,
          subtitle: `${r.warehouseCode || WAREHOUSE_CODE} / ${r.zoneCode}`,
          code,
          barcodeValue: code,
          qrValue: `${publicBase}/racks/${r.id}/plan`,
          status: st,
          detail: `${usedSlots}/${SLOTS_PER_RACK} ô · ${rp.length} SKU · ${weightKg.toLocaleString('vi-VN')} kg`,
          rack: r,
        };
      }),
    [zoneRacks, parts, publicBase],
  );

  const zoneItems = useMemo(
    () =>
      (zones.length
        ? zones
        : [...new Set(racks.map((r) => r.zoneCode))].filter(Boolean).map((code) => ({ code, name: code }))
      ).map((z) => {
        const zr = racks.filter((r) => r.zoneCode === z.code);
        const ids = new Set(zr.map((r) => r.id));
        const zp = parts.filter((p) => ids.has(p.rackId));
        const code = `${WAREHOUSE_CODE}-${z.code}`;
        return {
          key: `zone:${z.code}`,
          kind: 'zone',
          kindLabel: 'Khu kho',
          title: z.code,
          subtitle: `${WAREHOUSE_CODE} · ${z.name || 'Khu lưu trữ'}`,
          code,
          barcodeValue: code,
          qrValue: `${publicBase}/racks?zone=${encodeURIComponent(z.code)}`,
          status: zp.length ? 'active' : 'empty',
          detail: `${zr.length} kệ · ${zp.length} SKU`,
        };
      }),
    [zones, racks, parts, publicBase],
  );

  const partItems = useMemo(() => {
    const zoneRackIds = new Set(zoneRacks.map((r) => r.id));
    return parts
      .filter((p) => zoneRackIds.has(p.rackId) && (!rackId || p.rackId === rackId))
      .map((p) => {
        const pr = racks.find((r) => r.id === p.rackId);
        const sIndex = Number.isInteger(p.preferredRackSlot) ? p.preferredRackSlot : null;
        const loc = sIndex === null ? 'Chưa có ô ưu tiên' : `${pr?.name}-${slotCode(sIndex)}`;
        const code = p.productCode || p.masterPo || p.id;
        return {
          key: `part:${p.id}`,
          kind: 'part',
          kindLabel: 'Sản phẩm / SKU',
          title: p.partName,
          subtitle: `${code} · ${pr?.zoneCode || zoneCode} / ${loc}`,
          code,
          barcodeValue: code,
          qrValue: `${publicBase}/racks/${p.rackId}/plan?q=${encodeURIComponent(
            p.productCode || p.partName || p.masterPo || '',
          )}`,
          status: p.rackId ? 'active' : 'empty',
          detail: `${p.cartons || 0} thùng · ${Number(p.weight || 0).toLocaleString('vi-VN')} kg`,
          part: p,
        };
      });
  }, [zoneRacks, parts, racks, rackId, publicBase, zoneCode]);

  const rawItems = type === 'zone' ? zoneItems : type === 'rack' ? rackItems : type === 'part' ? partItems : slotItems;
  const query = search.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      rawItems.filter((item) => {
        if (type === 'slot' && level !== 'all' && item.level !== Number(level)) return false;
        if (status !== 'all' && item.status !== status) return false;
        if (!query) return true;
        return [item.title, item.subtitle, item.code, item.detail].some((v) => safeText(v).toLowerCase().includes(query));
      }),
    [rawItems, type, level, status, query],
  );

  useEffect(() => {
    setSelected(new Set(filteredItems.map((i) => i.key)));
    setPreviewKey(filteredItems[0]?.key || '');
  }, [type, zoneCode, rackId, level, status]);

  const preview = filteredItems.find((i) => i.key === previewKey) || filteredItems[0] || null;
  const selectedItems = filteredItems.filter((i) => selected.has(i.key));
  const usedSlotsInZone = useMemo(
    () => zoneRacks.reduce((sum, r) => sum + summarizeRack(r, parts).usedSlots, 0),
    [zoneRacks, parts],
  );

  const toggleSelected = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const selectAll = () => setSelected(new Set(filteredItems.map((i) => i.key)));
  const clearSelected = () => setSelected(new Set());
  const rememberPrinted = (count) => {
    const next = printedCount + count;
    setPrintedCount(next);
    localStorage.setItem('wms_qr_labels_printed', String(next));
  };

  const handlePrint = () => {
    if (!selectedItems.length) {
      toast({
        variant: 'destructive',
        title: 'Chưa chọn nhãn',
        description: 'Hãy chọn ít nhất một nhãn trước khi in.',
      });
      return;
    }
    rememberPrinted(selectedItems.length);
    setTimeout(() => window.print(), 80);
  };

  const handleExportPdf = async () => {
    if (!selectedItems.length) {
      toast({
        variant: 'destructive',
        title: 'Chưa chọn nhãn',
        description: 'Hãy chọn ít nhất một nhãn trước khi xuất PDF.',
      });
      return;
    }
    const nodes = [...(pdfRootRef.current?.querySelectorAll('[data-pdf-key]') || [])];
    if (!nodes.length) return;
    setExporting(true);
    try {
      if (preset.a4) {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const positions = [
          [10, 12],
          [110, 12],
          [10, 79],
          [110, 79],
          [10, 146],
          [110, 146],
          [10, 213],
          [110, 213],
        ];
        for (let i = 0; i < nodes.length; i += 1) {
          if (i > 0 && i % positions.length === 0) pdf.addPage();
          const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
          const [x, y] = positions[i % positions.length];
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, 90, 55, undefined, 'FAST');
        }
        pdf.save(`QR-WMS-${zoneCode}-${Date.now()}.pdf`);
      } else {
        const pdf = new jsPDF({
          orientation: preset.widthMm >= preset.heightMm ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [preset.widthMm, preset.heightMm],
        });
        for (let i = 0; i < nodes.length; i += 1) {
          if (i > 0)
            pdf.addPage(
              [preset.widthMm, preset.heightMm],
              preset.widthMm >= preset.heightMm ? 'landscape' : 'portrait',
            );
          const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
          pdf.addImage(
            canvas.toDataURL('image/png'),
            'PNG',
            1.5,
            1.5,
            preset.widthMm - 3,
            preset.heightMm - 3,
            undefined,
            'FAST',
          );
        }
        pdf.save(`QR-WMS-${zoneCode}-${Date.now()}.pdf`);
      }
      rememberPrinted(selectedItems.length);
      toast({
        title: 'Đã xuất PDF nhãn',
        description: `${selectedItems.length} nhãn đã được tạo theo khổ ${preset.label}.`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Xuất PDF thất bại', description: err.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-masan-border pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">
              Studio Nhãn Mã QR & Barcode
            </h1>
            <span className="rounded-full bg-masan-emerald/10 border border-masan-emerald/20 px-2.5 py-0.5 text-[11px] font-semibold text-masan-emerald">
              Label Engineering Studio
            </span>
          </div>
          <p className="text-sm text-masan-muted mt-1 max-w-3xl">
            Tạo và in tem nhãn chuẩn công nghiệp cho Zone, Kệ, Ô lưu trữ và mã SKU / PARTs. Quét tức thời để điều hướng vị trí 3D.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={exporting}
            className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-teal hover:text-masan-teal"
          >
            {exporting ? (
              <Download className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
            ) : (
              <FileDown className="w-3.5 h-3.5 mr-1.5 text-masan-teal" />
            )}
            Xuất PDF tem nhãn
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20 text-xs"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" /> In nhãn tức thời
          </Button>
        </div>
      </div>

      {localOnly && (
        <div className="print:hidden rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          <b>Lưu ý khi quét mã từ điện thoại:</b> Đảm bảo điện thoại cùng mạng nội bộ hoặc cấu hình tên miền WMS chính thức trước khi dán tem thực địa vào kho.
        </div>
      )}

      {/* KPI Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
        <MiniStat
          icon={Warehouse}
          label="Kệ trong Zone"
          value={zoneRacks.length}
          sub={`${zoneCode} · tối đa 20 kệ`}
        />
        <MiniStat
          icon={Boxes}
          label="Ô đang sử dụng"
          value={usedSlotsInZone}
          sub={`${Math.max(0, zoneRacks.length * SLOTS_PER_RACK - usedSlotsInZone)} ô trống`}
        />
        <MiniStat
          icon={Package}
          label="PARTs trong Zone"
          value={parts.filter((p) => zoneRacks.some((r) => r.id === p.rackId)).length}
        />
        <MiniStat
          icon={QrCode}
          label="Nhãn đã chọn"
          value={selectedItems.length}
          sub={`${filteredItems.length} nhãn hiển thị`}
        />
        <MiniStat icon={Printer} label="Đã in / xuất" value={printedCount} sub="Phiên làm việc" />
      </div>

      {/* Controls Panel */}
      <div
        id="qr-center-controls"
        className="print:hidden rounded-2xl border border-masan-border bg-masan-surface p-5 space-y-4 shadow-lg"
      >
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`h-9 px-4 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                type === t.value
                  ? 'bg-masan-emerald text-slate-950 font-bold border-masan-emerald shadow-sm'
                  : 'bg-masan-elevated text-masan-muted border-masan-border hover:text-masan-text hover:border-masan-emerald/40'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
          <label className="text-xs font-medium text-masan-muted">
            Zone
            <select
              className="mt-1 w-full h-9 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
              value={zoneCode}
              onChange={(e) => setZoneCode(e.target.value)}
            >
              {(zones.length
                ? zones
                : [...new Set(racks.map((r) => r.zoneCode))].filter(Boolean).map((code) => ({ code, name: code }))
              ).map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name && z.name !== z.code ? `${z.code} · ${z.name}` : z.code}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-masan-muted">
            Kệ kho
            <select
              className="mt-1 w-full h-9 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
              value={rackId}
              onChange={(e) => setRackId(e.target.value)}
              disabled={type === 'zone'}
            >
              <option value="">Tất cả kệ</option>
              {zoneRacks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-masan-muted">
            Tầng kệ
            <select
              className="mt-1 w-full h-9 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              disabled={type !== 'slot'}
            >
              <option value="all">Tất cả tầng</option>
              {[1, 2, 3, 4].map((v) => (
                <option key={v} value={v}>
                  Tầng {v}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-masan-muted">
            Tải trọng
            <select
              className="mt-1 w-full h-9 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-masan-muted">
            Khổ tem nhãn
            <select
              className="mt-1 w-full h-9 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
              value={presetKey}
              onChange={(e) => setPresetKey(e.target.value)}
            >
              {Object.entries(LABEL_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-masan-muted" />
            <Input
              className="pl-9 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="R12, S08, PART, PO..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap text-xs pt-1 border-t border-masan-border/40">
          <div className="text-masan-muted font-mono">{`${filteredItems.length} nhãn phù hợp`}</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={selectAll}
              className="h-7 text-xs border-masan-border bg-masan-elevated text-masan-text hover:border-masan-emerald"
            >
              Chọn tất cả
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelected}
              className="h-7 text-xs text-masan-muted hover:text-masan-text"
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Labels Explorer + Preview Drawer */}
      <div className="print:hidden grid xl:grid-cols-[1fr_360px] gap-5 items-start">
        <div className="rounded-2xl border border-masan-border bg-masan-surface p-5 shadow-lg">
          {filteredItems.length === 0 ? (
            <div className="py-20 text-center text-xs text-masan-muted">Không có nhãn phù hợp bộ lọc.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <LabelCard
                  key={item.key}
                  item={item}
                  selected={selected.has(item.key)}
                  onToggle={toggleSelected}
                  onPreview={setPreviewKey}
                />
              ))}
            </div>
          )}
        </div>

        {/* Live Preview Panel */}
        <div className="sticky top-5 rounded-2xl border border-masan-border bg-masan-surface p-5 min-h-[500px] shadow-lg">
          {!preview ? (
            <div className="h-[450px] flex items-center justify-center text-center text-xs text-masan-muted">
              Chọn một nhãn để xem trước bản in.
            </div>
          ) : (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wider text-masan-muted">
                Xem trước bản in tem nhãn
              </div>
              <div className="mt-4 flex justify-center p-3 rounded-2xl bg-white max-w-[200px] mx-auto shadow-sm">
                <QRCodeSVG value={preview.qrValue} size={170} />
              </div>
              <div className="text-lg font-bold text-center mt-4 text-masan-text">{preview.title}</div>
              <div className="text-xs text-center text-masan-muted mt-1">{preview.subtitle}</div>
              <div className="mt-3 overflow-hidden flex justify-center bg-white p-1 rounded-lg max-w-[190px] mx-auto">
                <Barcode value={preview.barcodeValue} height={30} width={1.05} displayValue={false} />
              </div>
              <div className="mt-4 rounded-xl bg-masan-elevated border border-masan-border p-3 text-xs">
                <div className="font-semibold text-masan-text">{preview.detail || 'Nhãn vị trí kho'}</div>
                <div className="text-[10px] text-masan-muted font-mono break-all mt-2">{preview.code}</div>
                {preview.status && (
                  <div
                    className="mt-2 flex items-center gap-2 text-xs font-semibold"
                    style={{ color: statusDot(preview.status) }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: statusDot(preview.status) }} />
                    {STATUS_LABEL[preview.status]}
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {preview.kind === 'slot' && (
                  <Button
                    variant="outline"
                    className="text-xs border-masan-border bg-masan-elevated text-masan-text"
                    onClick={() => navigate(`/locations/${rackId}/${slotCode(preview.index)}`)}
                  >
                    Chi tiết ô
                  </Button>
                )}
                {preview.kind === 'rack' && (
                  <Button
                    variant="outline"
                    className="text-xs border-masan-border bg-masan-elevated text-masan-text"
                    onClick={() => navigate(`/racks/${preview.rack.id}/plan`)}
                  >
                    Mở kệ 3D
                  </Button>
                )}
                {preview.kind === 'zone' && (
                  <Button
                    variant="outline"
                    className="text-xs border-masan-border bg-masan-elevated text-masan-text"
                    onClick={() => navigate(`/racks?zone=${encodeURIComponent(preview.title)}`)}
                  >
                    Mô hình Zone
                  </Button>
                )}
                {preview.kind === 'part' && (
                  <Button
                    variant="outline"
                    className="text-xs border-masan-border bg-masan-elevated text-masan-text"
                    onClick={() => navigate(preview.qrValue.replace(publicBase, ''))}
                  >
                    Tìm trên kệ
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setSelected(new Set([preview.key]));
                    rememberPrinted(1);
                    setTimeout(() => window.print(), 100);
                  }}
                  className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  In nhãn này
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden DOM elements for printing & PDF rendering */}
      <div id="qr-print-root">
        {selectedItems.map((item) => (
          <PrintableLabel key={item.key} item={item} preset={preset} />
        ))}
      </div>
      <div ref={pdfRootRef} id="qr-pdf-root" aria-hidden="true">
        {selectedItems.map((item) => (
          <PrintableLabel
            key={item.key}
            item={item}
            preset={preset.a4 ? LABEL_PRESETS.a4 : preset}
            pdfKey={item.key}
          />
        ))}
      </div>

      <style>{`
        #qr-print-root { display:none; }
        #qr-pdf-root { position: fixed; left: -12000px; top: 0; display: grid; gap: 8px; background: white; padding: 8px; z-index:-1; }
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body * { visibility: hidden !important; }
          #qr-print-root, #qr-print-root * { visibility: visible !important; }
          #qr-print-root { display:grid !important; position:absolute; left:0; top:0; width:100%; grid-template-columns:${
            preset.a4 ? 'repeat(2, 90mm)' : 'repeat(auto-fit, minmax(' + preset.widthMm + 'mm, ' + preset.widthMm + 'mm))'
          }; gap:4mm; align-items:start; }
          #qr-print-root .print-label { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
