import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  History,
  MoreHorizontal,
  Pencil,
  Printer,
  QrCode,
  ScanLine,
  Search,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Crop,
  Layers,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { raw, request } from '@/api/client';
import { useAuth } from '@/lib/auth';

const kinds = {
  '01-VT': 'Phiếu nhập kho',
  '02-VT': 'Phiếu xuất kho',
  '03-VT': 'Kiểm nghiệm',
  '05-VT': 'Tổng hợp kiểm kê',
  DELIVERY: 'Phiếu giao hàng',
  DISCREPANCY: 'Sai lệch nhận hàng',
  QUARANTINE: 'Hàng hỏng / cách ly',
  ISSUE_REQUEST: 'Yêu cầu xuất',
  PICKING: 'Picking List',
  PACKING: 'Packing List',
  TRANSPORT: 'Bàn giao vận chuyển',
  SHIP_CONFIRMATION: 'Xác nhận xuất',
  TRANSFER: 'Điều chuyển',
  CYCLE_COUNT: 'Kiểm kê',
  ADJUSTMENT: 'Điều chỉnh tồn',
  ERP_ATTACHMENT: 'Đính kèm ERP',
  PURCHASE_ORDER: 'Purchase Order',
  SALES_ORDER: 'Sales Order',
  INVOICE: 'Hóa đơn',
};

const states = {
  UPLOADED: 'Đã tải',
  NEEDS_REVIEW: 'Cần kiểm tra',
  DRAFT: 'Bản nháp',
  ISSUED: 'Đã phát hành',
  VOIDED: 'Đã hủy',
};

const formClass = 'rounded-2xl border border-masan-border bg-masan-surface p-5 space-y-4 shadow-lg';
const selectClass =
  'h-9 rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none';
const emptyLine = { sku: '', name: '', uom: '', expected: '', actual: '', lot: '', expirationDate: '' };
const headers = { number: 'Số chứng từ', po: 'PO / SO', issuer: 'Đơn vị phát hành', date: 'Ngày lập', note: 'Ghi chú' };
const columns = {
  sku: 'SKU',
  name: 'Tên hàng',
  uom: 'ĐVT',
  expected: 'Theo chứng từ',
  actual: 'Thực tế trên phiếu',
  lot: 'Số lô',
  expirationDate: 'Hạn dùng',
};
const writers = ['admin', 'warehouse_manager', 'warehouse_staff'];
const issuers = ['admin', 'warehouse_manager'];
const inbound = ['01-VT', 'DELIVERY', 'PURCHASE_ORDER'];
const root = '/documents';
const errorText = (e) => e?.message || 'Không xử lý được yêu cầu';
const badgeTone = {
  UPLOADED: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  NEEDS_REVIEW: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  DRAFT: 'text-masan-muted bg-masan-elevated border-masan-border',
  ISSUED: 'text-masan-emerald bg-masan-emerald/10 border-masan-emerald/20',
  VOIDED: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        badgeTone[status] || 'bg-masan-elevated text-masan-muted border-masan-border'
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {states[status] || status}
    </span>
  );
}

function KindSelect({ value, change, all = false }) {
  return (
    <select className={selectClass} value={value} onChange={(e) => change(e.target.value)}>
      {all && <option value="">Tất cả loại</option>}
      {Object.entries(kinds).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

function sourceFile(file, rotation, crop) {
  if (!imageFile(file) || (!rotation && !crop)) return Promise.resolve(file);
  return createImageBitmap(file).then((bitmap) => {
    const inset = Math.floor((Math.min(bitmap.width, bitmap.height) * crop) / 100);
    const w = bitmap.width - 2 * inset,
      h = bitmap.height - 2 * inset;
    const canvas = document.createElement('canvas');
    const vertical = rotation % 180 !== 0;
    canvas.width = vertical ? h : w;
    canvas.height = vertical ? w : h;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, inset, inset, w, h, -w / 2, -h / 2, w, h);
    bitmap.close();
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], 'capture.jpg', { type: 'image/jpeg' })) : reject(Error('Không xử lý được ảnh'))),
        'image/jpeg',
        0.9,
      ),
    );
  });
}
const imageFile = (file) => file?.type.startsWith('image/');

function useObjectUrl(blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
async function fileBlob(url) {
  return (await raw(url)).blob();
}
function saveFile(blob, name) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DocumentSourceButton({ reference, kind, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  if (!writers.includes(user?.role) || !reference) return null;
  async function open() {
    setBusy(true);
    setError('');
    try {
      const result = await request(`${root}/source/${kind}/${reference}`, { method: 'POST' });
      navigate(root + '/' + result.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={open}
        className="h-7 text-xs border-masan-border bg-masan-elevated text-masan-muted hover:border-masan-emerald hover:text-masan-emerald"
      >
        <Printer className="w-3 h-3 mr-1 text-masan-teal" />
        {children}
      </Button>
      {error && <span role="alert" className="text-xs text-rose-400 mt-1">{error}</span>}
    </span>
  );
}

function Upload({ mode }) {
  const [kind, setKind] = useState('01-VT');
  const [file, setFile] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState(0);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [stream, setStream] = useState(null);
  const video = useRef(null);
  const navigate = useNavigate();
  const fileUrl = useObjectUrl(file);
  const image = imageFile(file) ? fileUrl : '';
  useEffect(() => {
    if (!stream) return;
    if (video.current) video.current.srcObject = stream;
    return () => stream.getTracks().forEach((track) => track.stop());
  }, [stream]);
  function selectFile(next) {
    setError('');
    setRotation(0);
    setCrop(0);
    if (!next) return;
    if (!/\.(jpe?g|png|pdf|xlsx)$/i.test(next.name)) {
      setError('Chọn một tệp JPG, PNG, PDF hoặc XLSX.');
      return;
    }
    if (next.size > 8 * 1024 * 1024) {
      setError('Tệp vượt quá giới hạn 8 MiB.');
      return;
    }
    setFile(next);
  }
  const choose = (e) => selectFile(e.target.files[0]);
  async function upload(create = false) {
    setBusy(true);
    setError('');
    try {
      let result;
      if (create) result = await request(root, { method: 'POST', body: { kind } });
      else {
        const data = new FormData();
        data.append('kind', kind);
        data.append('file', await sourceFile(file, rotation, crop));
        result = await request(root + '/upload', { method: 'POST', body: data });
      }
      navigate(root + '/' + result.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function openCode(value) {
    try {
      const url = new URL(value.trim(), window.location.origin);
      if (url.origin !== window.location.origin || !/^\/documents\/[\da-f-]{36}$/i.test(url.pathname)) {
        throw Error('QR không thuộc Document Center của môi trường này.');
      }
      setError('');
      navigate(url.pathname);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function decode(event) {
    const image = event.target.files[0];
    if (!image) return;
    try {
      const bitmap = await createImageBitmap(image);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const { default: jsQR } = await import('jsqr');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, data.width, data.height);
      if (!code) throw Error('Không đọc được QR trong ảnh.');
      openCode(code.data);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function camera() {
    try {
      setError('');
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }));
    } catch {
      setError('Không mở được camera. Hãy cấp quyền hoặc tải ảnh từ thiết bị.');
    }
  }
  function capture() {
    const frame = video.current;
    if (!frame?.videoWidth) {
      setError('Camera chưa sẵn sàng.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = frame.videoWidth;
    canvas.height = frame.videoHeight;
    canvas.getContext('2d').drawImage(frame, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Không chụp được ảnh.');
          return;
        }
        setFile(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
        setRotation(0);
        setCrop(0);
        setStream(null);
      },
      'image/jpeg',
      0.92,
    );
  }
  return (
    <div className="space-y-4 text-masan-text">
      {mode !== 'qr' && (
        <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-masan-text">
          Loại chứng từ <KindSelect value={kind} change={setKind} />
        </label>
      )}
      {mode === 'create' && (
        <Button
          disabled={busy}
          onClick={() => upload(true)}
          className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
        >
          Tạo bản nháp thủ công
        </Button>
      )}
      {mode === 'scan' && (
        <>
          <p className="text-xs font-medium text-masan-muted">
            Bước {file ? '2/7 · Xem trước tệp tải lên' : '1/7 · Chọn nguồn tệp'}
          </p>
          <label
            className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-dashed p-7 text-center transition-all ${
              dragging
                ? 'bg-masan-emerald/10 border-masan-emerald text-masan-emerald'
                : 'border-masan-border bg-masan-elevated/50 hover:border-masan-emerald/40'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              selectFile(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud className="size-8 text-masan-teal" aria-hidden="true" />
            <span className="text-sm font-semibold text-masan-text">
              {file ? 'Chọn tệp khác' : 'Kéo thả hoặc chọn tệp tải lên'}
            </span>
            <span className="text-xs text-masan-muted">JPG, PNG, PDF hoặc XLSX · Tối đa 8 MiB</span>
            <input
              className="sr-only"
              aria-label="Tải ảnh, PDF hoặc XLSX"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.xlsx"
              onChange={choose}
            />
          </label>
          {!stream ? (
            <Button
              type="button"
              variant="outline"
              onClick={camera}
              className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-teal"
            >
              <Camera className="mr-2 size-4 text-masan-teal" />
              Mở camera quét trực tiếp
            </Button>
          ) : (
            <div className="space-y-2">
              <video ref={video} autoPlay playsInline muted className="max-h-72 rounded-xl border border-masan-border" />
              <div className="flex gap-2">
                <Button type="button" onClick={capture} className="bg-masan-emerald text-slate-950 font-bold text-xs">
                  Chụp ảnh
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStream(null)}
                  className="border-masan-border text-xs text-masan-muted"
                >
                  Tắt camera
                </Button>
              </div>
            </div>
          )}
          {image && (
            <div className="space-y-2">
              <div className="grid h-52 place-items-center overflow-hidden rounded-xl border border-masan-border bg-masan-elevated p-2">
                <img
                  className="max-h-44 max-w-full object-contain"
                  src={image}
                  alt="Ảnh phiếu đã chọn"
                  style={{
                    transform: `rotate(${rotation}deg) scale(${1 + crop / 75})`,
                    clipPath: `inset(${crop}%)`,
                  }}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((rotation + 90) % 360)}
                  className="border-masan-border bg-masan-elevated text-xs text-masan-text"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1 text-masan-teal" />
                  Xoay 90°
                </Button>
                <label className="flex items-center gap-2 text-xs text-masan-muted">
                  <Crop className="w-3.5 h-3.5" />
                  Cắt viền
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={crop}
                    onChange={(e) => setCrop(Number(e.target.value))}
                    className="accent-emerald-500"
                  />
                </label>
              </div>
            </div>
          )}
          {file && (
            <p className="break-all text-xs text-masan-muted flex items-center gap-1">
              <FileText className="size-4 text-masan-teal" />
              <span className="font-mono text-masan-text">{file.name}</span> · {Math.ceil(file.size / 1024)} KiB
            </p>
          )}
          {fileUrl && file?.type === 'application/pdf' && (
            <iframe
              title="Xem trước tệp PDF"
              sandbox=""
              src={fileUrl}
              className="h-56 w-full rounded-xl border border-masan-border bg-masan-elevated"
            />
          )}
          <Button
            disabled={busy || !file}
            onClick={() => upload()}
            className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
          >
            {busy ? 'Đang trích xuất OCR…' : 'Tải lên để kiểm tra & trích xuất'}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </>
      )}
      {mode === 'qr' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            openCode(qr);
          }}
        >
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-masan-border bg-masan-elevated/50 p-6 hover:border-masan-teal transition-all">
            <QrCode className="size-5 text-masan-teal" />
            <span className="text-xs font-semibold text-masan-text">Chọn ảnh mã QR</span>
            <input
              className="sr-only"
              aria-label="Quét ảnh QR"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={decode}
            />
          </label>
          <label className="block text-xs font-medium text-masan-text">
            Hoặc dán liên kết chứng từ
            <Input
              className="mt-1 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald font-mono"
              placeholder="VD: /documents/uuid-..."
              value={qr}
              onChange={(e) => setQr(e.target.value)}
            />
          </label>
          <Button
            disabled={!qr.trim()}
            className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
          >
            Mở chứng từ
          </Button>
        </form>
      )}
      {error && <p role="alert" className="text-rose-400 text-xs">{error}</p>}
    </div>
  );
}

export default function Documents() {
  const { id } = useParams();
  const { user } = useAuth();
  const canWrite = writers.includes(user?.role),
    canIssue = issuers.includes(user?.role);
  const [filters, setFilters] = useState({ q: '', kind: '', status: '', day: '', creator: '' });
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState(null);
  const [page, setPage] = useState(1);
  const [downloadError, setDownloadError] = useState('');
  const pageSize = 10;
  const change = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const results = useQuery({
    queryKey: ['documents', filters],
    enabled: !id,
    queryFn: () => request(root + '?' + new URLSearchParams(filters)),
  });
  const rows = results.data ?? [];
  const last = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, last);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const dialogTitles = { create: 'Tạo chứng từ mới', scan: 'Quét & OCR chứng từ', qr: 'Quét mã QR chứng từ' };
  const dialogDescriptions = {
    create: 'Chọn loại chứng từ chuẩn để khởi tạo bản nháp nghiệp vụ.',
    scan: 'Tải lên hình ảnh, hóa đơn, PDF hoặc tệp Excel để máy tự động bóc tách thông tin.',
    qr: 'Dùng mã QR trên biên bản WMS hoặc dán liên kết để truy xuất nhanh.',
  };

  async function download(doc) {
    setDownloadError('');
    try {
      const path = root + '/' + doc.id;
      const info = await request(path);
      const version = info.versions[0]?.version;
      if (version) saveFile(await fileBlob(path + '/pdf?version=' + version), `${doc.kind}-${doc.number || doc.id}.pdf`);
      else if (info.hasFile) saveFile(await fileBlob(path + '/file'), doc.filename || doc.id);
      else throw Error('Chứng từ chưa có tệp tải xuống.');
    } catch (e) {
      setDownloadError(errorText(e));
    }
  }

  if (id) return <DocumentDetail key={id} id={id} user={user} canWrite={canWrite} canIssue={canIssue} />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-masan-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">
              Trung tâm Chứng từ & OCR
            </h1>
            <span className="rounded-full bg-masan-emerald/10 border border-masan-emerald/20 px-2.5 py-0.5 text-[11px] font-semibold text-masan-emerald">
              Digital Document Hub
            </span>
          </div>
          <p className="text-sm text-masan-muted mt-1 max-w-3xl">
            Số hóa biên bản, nhận diện phiếu giấy bằng OCR, tra cứu lịch sử phát hành và in ấn biểu mẫu chuẩn WMS.
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              onClick={() => setMode('create')}
              className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-emerald/40 hover:text-masan-emerald"
            >
              <FilePlus2 className="mr-1.5 size-3.5 text-masan-teal" />
              Tạo chứng từ
            </Button>
            <Button
              onClick={() => setMode('scan')}
              className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold shadow-md shadow-emerald-950/20 text-xs"
            >
              <ScanLine className="mr-1.5 size-3.5" />
              Quét phiếu OCR
            </Button>
          </div>
        )}
      </div>

      {/* Quick Launch Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ...(canWrite
            ? [
                {
                  icon: ScanLine,
                  label: 'Quét phiếu giấy OCR',
                  detail: 'Bóc tách tự động ảnh chụp, PDF và hóa đơn',
                  onClick: () => setMode('scan'),
                },
              ]
            : []),
          {
            icon: QrCode,
            label: 'Quét mã QR',
            detail: 'Truy xuất tức thời chứng từ từ mã in trên phiếu',
            onClick: () => setMode('qr'),
          },
          {
            icon: Printer,
            label: 'Xem & In ấn chứng từ',
            detail: 'Tra cứu danh sách và xuất bản phát hành PDF',
            onClick: () => document.getElementById('document-search')?.focus(),
          },
        ].map(({ icon: Icon, label, detail, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-masan-border bg-masan-surface p-4 text-left transition-all hover:border-masan-emerald/50 hover:bg-masan-elevated/40"
          >
            <span className="rounded-xl bg-masan-emerald/10 border border-masan-emerald/20 p-2.5 text-masan-emerald">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-xs font-bold text-masan-text group-hover:text-masan-emerald transition-colors">
                {label}
              </strong>
              <span className="block text-[11px] text-masan-muted mt-0.5">{detail}</span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-masan-muted group-hover:text-masan-emerald group-hover:translate-x-0.5 transition-all"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      {/* Modal Dialog for Scan / Create / QR */}
      <Dialog
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl bg-masan-surface border-masan-border text-masan-text">
          <DialogHeader>
            <DialogTitle className="text-masan-text font-bold text-base">{dialogTitles[mode]}</DialogTitle>
            <DialogDescription className="text-masan-muted text-xs">{dialogDescriptions[mode]}</DialogDescription>
          </DialogHeader>
          {mode && <Upload key={mode} mode={mode} />}
        </DialogContent>
      </Dialog>

      {/* Search & Documents Table */}
      <section
        className="rounded-2xl border border-masan-border bg-masan-surface shadow-lg overflow-hidden"
        aria-labelledby="documents-table-title"
      >
        <details className="group border-b border-masan-border" open>
          <summary className="cursor-pointer px-4 pt-4 text-xs font-bold uppercase tracking-wider text-masan-muted md:hidden">
            Tìm kiếm & Bộ lọc nâng cao
          </summary>
          <div className="space-y-4 p-4 md:px-5">
            <div className="flex items-center justify-between">
              <h2 id="documents-table-title" className="text-sm font-bold text-masan-text flex items-center gap-2">
                <FileText className="w-4 h-4 text-masan-teal" />
                Danh mục chứng từ lưu trữ
              </h2>
              <span className="text-xs font-mono text-masan-muted">{rows.length} hồ sơ</span>
            </div>

            <form
              className="flex flex-wrap items-end gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                change('q', search.trim());
              }}
            >
              <label className="min-w-44 grow text-xs font-medium text-masan-muted">
                Tìm mã phiếu, PO, SKU
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-masan-muted" aria-hidden="true" />
                  <Input
                    id="document-search"
                    className="pl-9 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
                    placeholder="VD: mã phiếu hoặc SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </label>
              <label className="grid gap-1 text-xs font-medium text-masan-muted">
                Loại chứng từ <KindSelect all value={filters.kind} change={(v) => change('kind', v)} />
              </label>
              <label className="grid gap-1 text-xs font-medium text-masan-muted">
                Trạng thái
                <select className={selectClass} value={filters.status} onChange={(e) => change('status', e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(states).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-masan-muted">
                Ngày tạo
                <Input
                  type="date"
                  className="bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
                  value={filters.day}
                  onChange={(e) => change('day', e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-masan-muted">
                Người lập
                <Input
                  className="w-36 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
                  placeholder="email người lập"
                  value={filters.creator}
                  onChange={(e) => change('creator', e.target.value)}
                />
              </label>
              <Button
                type="submit"
                className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs h-9"
              >
                Tìm kiếm
              </Button>
              {Object.values(filters).some(Boolean) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearch('');
                    setFilters({ q: '', kind: '', status: '', day: '', creator: '' });
                    setPage(1);
                  }}
                  className="text-xs text-masan-muted hover:text-masan-text h-9"
                >
                  Xóa bộ lọc
                </Button>
              )}
            </form>
          </div>
        </details>

        {downloadError && (
          <div role="alert" className="p-3 mx-4 my-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300">
            {downloadError}
          </div>
        )}

        {results.isPending && (
          <div role="status" className="space-y-3 p-5">
            <p className="text-xs text-masan-muted animate-pulse">Đang nạp dữ liệu chứng từ kho…</p>
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded-xl bg-masan-elevated" />
            ))}
          </div>
        )}

        {results.isError && (
          <div className="p-5">
            <p role="alert" className="mb-2 text-xs text-rose-400">
              {errorText(results.error)}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => results.refetch()}
              className="text-xs border-masan-border text-masan-text"
            >
              Thử lại
            </Button>
          </div>
        )}

        {results.isSuccess &&
          (!rows.length ? (
            <div className="grid justify-items-center gap-2 px-4 py-12 text-center">
              <FileText className="size-8 text-masan-muted" aria-hidden="true" />
              <p className="font-semibold text-xs text-masan-text">Chưa có chứng từ phù hợp với bộ lọc</p>
              <p className="text-[11px] text-masan-muted">Hãy thử thay đổi từ khóa hoặc điều kiện tìm kiếm.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:min-w-[880px]">
                  <thead className="sticky top-0 bg-masan-elevated text-[11px] font-semibold text-masan-muted uppercase tracking-wider border-b border-masan-border z-10">
                    <tr>
                      {['Loại chứng từ', 'Mã chứng từ', 'Đơn liên kết', 'PO/SO liên kết', 'Ngày tạo', 'Người lập', 'Trạng thái', 'Thao tác'].map(
                        (label) => (
                          <th scope="col" key={label} className="px-4 py-3 font-semibold">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-masan-border/40 font-mono text-[11px]">
                    {visible.map((doc) => {
                      const path = root + '/' + doc.id;
                      const editable =
                        canWrite &&
                        !doc.reference_id &&
                        ['UPLOADED', 'NEEDS_REVIEW'].includes(doc.status) &&
                        (canIssue || doc.creator?.toLowerCase() === user?.email?.toLowerCase());
                      return (
                        <tr key={doc.id} className="hover:bg-masan-elevated/40 transition-colors">
                          <td className="px-4 py-3 font-sans font-semibold text-masan-emerald">
                            {kinds[doc.kind] || doc.kind}
                          </td>
                          <td className="px-4 py-3 font-bold text-masan-text">
                            <Link className="hover:underline hover:text-masan-teal transition-colors" to={path}>
                              {doc.reference_id ? doc.id.slice(0, 8) : doc.number || doc.id.slice(0, 8)}
                            </Link>
                            <button
                              type="button"
                              className="ml-2 text-[10px] text-masan-teal hover:underline font-sans"
                              aria-label={`Sao chép mã chứng từ ${doc.id}`}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(doc.id);
                                  setDownloadError('');
                                } catch {
                                  setDownloadError('Không sao chép được mã chứng từ.');
                                }
                              }}
                            >
                              Sao chép
                            </button>
                          </td>
                          <td className="px-4 py-3 text-masan-muted">
                            {doc.reference_id ? doc.number || '—' : '—'}
                          </td>
                          <td className="px-4 py-3 text-masan-muted font-sans">{doc.po || '—'}</td>
                          <td className="px-4 py-3 text-masan-muted whitespace-nowrap">
                            {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3 text-masan-muted font-sans truncate max-w-[140px]">
                            {doc.creator}
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <StatusBadge status={doc.status} />
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <div className="flex items-center gap-1">
                              <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-masan-text hover:text-masan-emerald">
                                <Link to={path}>Xem chi tiết</Link>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 text-masan-muted hover:text-masan-text"
                                    aria-label={`Thao tác ${kinds[doc.kind] || doc.kind} ${doc.number || doc.id}`}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-masan-surface border-masan-border text-masan-text text-xs">
                                  {editable && (
                                    <DropdownMenuItem asChild className="hover:bg-masan-elevated focus:bg-masan-elevated">
                                      <Link to={path + '#review'}>
                                        <Pencil className="mr-2 size-3.5 text-masan-teal" /> Sửa bản nháp
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  {doc.status !== 'VOIDED' && (
                                    <DropdownMenuItem asChild className="hover:bg-masan-elevated focus:bg-masan-elevated">
                                      <Link to={path + '#print'}>
                                        <Printer className="mr-2 size-3.5 text-masan-teal" /> Xem/In PDF
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  {(doc.filename || doc.status === 'ISSUED') && (
                                    <DropdownMenuItem
                                      onSelect={() => download(doc)}
                                      className="hover:bg-masan-elevated focus:bg-masan-elevated"
                                    >
                                      <ArrowDownToLine className="mr-2 size-3.5 text-masan-emerald" /> Tải tệp
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem asChild className="hover:bg-masan-elevated focus:bg-masan-elevated">
                                    <Link to={path + '#history'}>
                                      <History className="mr-2 size-3.5 text-masan-muted" /> Lịch sử
                                    </Link>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-masan-border px-4 py-3 text-xs text-masan-muted md:px-5 bg-masan-elevated/40">
                <span>
                  {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} / {rows.length}
                  {rows.length === 150 ? ' kết quả gần nhất' : ' chứng từ'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 border-masan-border bg-masan-elevated text-masan-text"
                    aria-label="Trang trước"
                    disabled={current <= 1}
                    onClick={() => setPage(current - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span>
                    Trang {current} / {last}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 border-masan-border bg-masan-elevated text-masan-text"
                    aria-label="Trang sau"
                    disabled={current >= last}
                    onClick={() => setPage(current + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ))}
      </section>
    </div>
  );
}

function DocumentDetail({ id, user, canWrite, canIssue }) {
  const path = root + '/' + id;
  const { hash } = useLocation();
  const result = useQuery({ queryKey: ['document', id], queryFn: () => request(path) });
  const doc = result.data;
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [box, setBox] = useState(null);
  const [size, setSize] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [qr, setQr] = useState(true);
  const [landscape, setLandscape] = useState(false);
  const [reason, setReason] = useState('');
  const [manualReview, setManualReview] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const imageQuery = useQuery({
    queryKey: ['document-page', id, page],
    enabled: !!doc?.hasFile && !doc.mime.includes('spreadsheet'),
    queryFn: () => fileBlob(path + '/file?page=' + page),
    retry: false,
  });
  const image = useObjectUrl(imageQuery.data);
  const preview = useObjectUrl(pdf);
  const fields = draft ?? doc?.fields ?? {};
  const pages = doc?.extraction ?? [];
  const editable =
    canWrite &&
    (canIssue || doc?.created_by === user?.id) &&
    !doc?.reference_id &&
    ['UPLOADED', 'NEEDS_REVIEW'].includes(doc?.status);
  const waitingForScan = editable && doc?.status === 'UPLOADED' && !manualReview;
  const scannedInbound = doc?.hasFile && !doc?.reference_id && inbound.includes(doc?.kind);
  const receiveReady = scannedInbound && doc?.status === 'DRAFT';
  const options = { qr, landscape };
  useEffect(() => {
    if (doc && ['#review', '#print', '#history'].includes(hash)) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    }
  }, [doc, hash]);

  async function run(fn) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function change(key, value) {
    setDraft({ ...fields, [key]: value });
  }
  function cell(i, key, value) {
    change(
      'lines',
      fields.lines.map((line, index) => (index === i ? { ...line, [key]: value } : line)),
    );
  }
  async function review(mode) {
    const payload = { fields: { ...fields, lines: fields.lines ?? [] }, revision: doc.revision };
    const result = await request(path + '/' + mode, {
      method: mode === 'draft' ? 'PATCH' : 'POST',
      body: payload,
    });
    if (mode === 'validate') {
      if (result.errors.length) throw Error(result.errors.join(' · '));
      setNotice('Dữ liệu hợp lệ để xác nhận bản nháp.');
    } else {
      setDraft(null);
      await reload();
      setNotice(mode === 'confirm' ? 'Đã xác nhận bản nháp.' : 'Đã lưu bản nháp.');
    }
  }
  function reload() {
    return result.refetch();
  }
  function highlight(value) {
    if (!value) return;
    const candidate = pages
      .flatMap((p) => p.words?.map((w) => ({ ...w, page: p.page })) ?? [])
      .find((w) => w.text.toLowerCase().includes(String(value).split(/\s/)[0].toLowerCase()));
    if (candidate) {
      setPage(candidate.page);
      setBox(candidate.box);
    }
  }
  if (result.isPending) return <main className="p-8 text-xs text-masan-muted">Đang tải chứng từ…</main>;
  if (result.isError)
    return (
      <main className="p-8 text-xs text-rose-400">
        <p role="alert">{errorText(result.error)}</p>
        <Link to={root} className="text-masan-emerald underline mt-2 block">
          Quay lại danh sách
        </Link>
      </main>
    );

  return (
    <div className="space-y-6">
      <Link
        to={root}
        className="inline-flex items-center gap-2 text-xs font-semibold text-masan-emerald hover:text-masan-teal transition-colors"
      >
        <ArrowLeft className="size-4" /> Quay lại danh mục chứng từ
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-masan-border pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-masan-text">{kinds[doc.kind]}</h1>
            <StatusBadge status={doc.status} />
          </div>
          <p className="mt-1 break-all text-xs font-mono text-masan-muted">{fieldDisplay(fields.number, doc.id)}</p>
        </div>
      </header>

      {doc.hasFile && !doc.reference_id && (
        <nav
          aria-label="Tiến độ nhận diện"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-masan-border bg-masan-surface p-3.5 text-xs"
        >
          <span className="text-masan-muted">1. Chọn nguồn</span>
          <span className="text-masan-muted">2. Xem trước</span>
          <span className={waitingForScan ? 'font-bold text-masan-emerald' : 'text-masan-muted'}>3. Chạy OCR</span>
          <span className={editable && !waitingForScan ? 'font-bold text-masan-emerald' : 'text-masan-muted'}>
            4. Kiểm tra kết quả
          </span>
          <span className={editable && !waitingForScan ? 'font-bold text-masan-emerald' : 'text-masan-muted'}>
            5. Đối chiếu SKU
          </span>
          <span className={doc.status === 'DRAFT' ? 'font-bold text-masan-emerald' : 'text-masan-muted'}>
            6. Xác nhận bản nháp
          </span>
          {scannedInbound && (
            <span className={receiveReady ? 'font-bold text-masan-emerald' : 'text-masan-muted'}>
              7. Mở Receiving
            </span>
          )}
        </nav>
      )}

      {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-masan-emerald/30 bg-masan-emerald/10 p-3 text-xs text-masan-emerald">{notice}</p>}

      <div className={`grid items-start gap-4 ${doc.hasFile ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]' : ''}`}>
        {doc.hasFile && (
          <section className={`${formClass} min-w-0`}>
            <div className="flex items-center justify-between border-b border-masan-border pb-3">
              <h2 className="text-sm font-bold text-masan-text flex items-center gap-2">
                <FileText className="w-4 h-4 text-masan-teal" />
                Chứng từ gốc đã quét
              </h2>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => run(async () => saveFile(await fileBlob(path + '/file'), doc.filename || id))}
                className="h-7 text-xs border-masan-border bg-masan-elevated text-masan-text hover:border-masan-emerald"
              >
                <ArrowDownToLine className="w-3 h-3 mr-1 text-masan-emerald" />
                Tải bản gốc
              </Button>
            </div>

            {imageQuery.isFetching && <p className="text-xs text-masan-muted">Đang dựng trang…</p>}
            {image && (
              <div className="relative inline-block overflow-hidden rounded-xl border border-masan-border bg-masan-elevated p-2">
                <img
                  alt={'Trang ' + page + ' của chứng từ'}
                  src={image}
                  className="max-h-[560px] max-w-full rounded-lg object-contain"
                  onLoad={(e) => setSize([e.target.naturalWidth, e.target.naturalHeight])}
                />
                {box && size && (
                  <span
                    className="pointer-events-none absolute border-2 border-masan-emerald shadow-sm shadow-emerald-500/50"
                    style={{
                      left: (box.x0 / size[0]) * 100 + '%',
                      top: (box.y0 / size[1]) * 100 + '%',
                      width: ((box.x1 - box.x0) / size[0]) * 100 + '%',
                      height: ((box.y1 - box.y0) / size[1]) * 100 + '%',
                    }}
                  />
                )}
              </div>
            )}
            {pages.length > 1 && (
              <label className="block text-xs font-medium text-masan-muted">
                Trang
                <select
                  className={selectClass}
                  value={page}
                  onChange={(e) => {
                    setPage(Number(e.target.value));
                    setBox(null);
                  }}
                >
                  {pages.map((p) => (
                    <option key={p.page}>{p.page}</option>
                  ))}
                </select>
              </label>
            )}
            {imageQuery.isError && <p className="text-xs text-rose-400">Không có bản xem trước cho trang này.</p>}
            {editable && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await request(path + '/scan', { method: 'POST' });
                    setDraft(null);
                    await reload();
                  })
                }
                className="w-full bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
              >
                {busy ? 'Đang trích xuất OCR…' : 'Chạy lại OCR / Bóc tách thông tin'}
              </Button>
            )}

            {pages.length > 0 && (
              <details className="rounded-xl border border-masan-border bg-masan-elevated/50 p-3 text-xs">
                <summary className="font-semibold cursor-pointer text-masan-text select-none">
                  Văn bản OCR nhận diện được ({pages.length} trang)
                </summary>
                {pages.map((p) => (
                  <section key={p.page} className="my-2 space-y-1">
                    <p className="text-xs text-masan-teal">
                      Trang {p.page} · Động cơ: {p.engine}
                      {Number.isFinite(p.confidence) ? ` · Độ tin cậy: ${Math.round(p.confidence)}%` : ''}
                    </p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-masan-surface p-2 text-[11px] font-mono text-masan-muted border border-masan-border">
                      {p.text || 'Không nhận diện được chữ.'}
                    </pre>
                  </section>
                ))}
              </details>
            )}
          </section>
        )}

        <section id="review" className={`${formClass} min-w-0 scroll-mt-20`}>
          <div className="border-b border-masan-border pb-3">
            <h2 className="text-sm font-bold text-masan-text">
              {editable ? 'Kiểm tra & Chuẩn hóa dữ liệu nhận diện' : 'Dữ liệu chứng từ đã khóa'}
            </h2>
          </div>
          {waitingForScan ? (
            <div className="rounded-xl border border-dashed border-masan-border p-6 text-center space-y-3">
              <p className="text-xs text-masan-muted">
                Chạy OCR trên tệp nguồn để trích xuất tự động, hoặc mở biểu mẫu để nhập liệu thủ công.
              </p>
              <Button
                variant="outline"
                onClick={() => setManualReview(true)}
                className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-emerald"
              >
                Nhập thủ công
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(headers).map(([key, label]) => (
                  <label key={key} className="grid gap-1 text-xs font-medium text-masan-muted">
                    {label}
                    <Input
                      type={key === 'date' ? 'date' : 'text'}
                      readOnly={!editable}
                      value={fields[key] ?? ''}
                      placeholder="Chưa có"
                      className="bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-masan-emerald"
                      onFocus={() => highlight(fields[key])}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <h3 className="pt-2 text-xs font-bold uppercase tracking-wider text-masan-muted">
                Dòng hàng · SKU và đơn vị tính
              </h3>
              {(fields.lines ?? []).map((line, i) => (
                <fieldset
                  key={i}
                  className="grid gap-3 rounded-xl border border-masan-border bg-masan-elevated/40 p-3.5 sm:grid-cols-2"
                >
                  <legend className="px-2 text-xs font-bold text-masan-teal">Dòng {i + 1}</legend>
                  {Object.entries(columns).map(([key, label]) => (
                    <label key={key} className="grid gap-1 text-xs font-medium text-masan-muted">
                      {label}
                      <Input
                        type={key === 'expirationDate' ? 'date' : ['expected', 'actual'].includes(key) ? 'number' : 'text'}
                        readOnly={!editable}
                        onFocus={() => highlight(line[key])}
                        value={line[key] ?? ''}
                        placeholder="Chưa có"
                        className="bg-masan-surface border-masan-border text-masan-text text-xs focus:border-masan-emerald font-mono"
                        onChange={(e) => cell(i, key, e.target.value)}
                      />
                    </label>
                  ))}
                  {editable && (
                    <div className="sm:col-span-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => change('lines', fields.lines.filter((_, index) => index !== i))}
                        className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-7"
                      >
                        Xóa dòng
                      </Button>
                    </div>
                  )}
                  {!editable &&
                    !doc.reference_id &&
                    doc.status === 'DRAFT' &&
                    inbound.includes(doc.kind) &&
                    (doc.receipts.some((r) => r.line_number === i + 1) ? (
                      <span className="sm:col-span-2 text-xs text-masan-emerald font-medium">✓ Đã liên kết phiếu nhận</span>
                    ) : (
                      <Link
                        className="sm:col-span-2 text-xs font-bold text-masan-emerald hover:underline"
                        to={'/inventory?' + new URLSearchParams({ tab: 'receiving', document: id, line: String(i + 1) })}
                      >
                        Tiếp tục nhận dòng {i + 1} tại Vận hành kho →
                      </Link>
                    ))}
                </fieldset>
              ))}
              {editable && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => change('lines', [...(fields.lines ?? []), { ...emptyLine }])}
                    className="border-masan-border bg-masan-elevated text-xs text-masan-text"
                  >
                    Thêm dòng
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => review('draft'))}
                    className="border-masan-border bg-masan-elevated text-xs text-masan-text"
                  >
                    Lưu sửa đổi
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => review('validate'))}
                    className="border-masan-border bg-masan-elevated text-xs text-masan-teal"
                  >
                    Kiểm tra SKU & ĐVT
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => setConfirmation('draft')}
                    className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs"
                  >
                    Xác nhận bản nháp
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {!waitingForScan && (
        <section id="print" className={`${formClass} scroll-mt-20`}>
          <div className="border-b border-masan-border pb-3">
            <h2 className="text-sm font-bold text-masan-text">Xuất bản phát hành PDF & In ấn chuẩn WMS</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-masan-text">
              <input
                type="checkbox"
                checked={qr}
                onChange={(e) => setQr(e.target.checked)}
                className="rounded accent-emerald-500"
              />{' '}
              In mã QR truy xuất
            </label>
            <label className="flex items-center gap-1.5 text-xs text-masan-text">
              <input
                type="checkbox"
                checked={landscape}
                onChange={(e) => setLandscape(e.target.checked)}
                className="rounded accent-emerald-500"
              />{' '}
              Khổ A4 ngang (Landscape)
            </label>
            {doc.status !== 'VOIDED' && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => setPdf(await fileBlob(path + '/preview?' + new URLSearchParams(options))))
                }
                className="bg-masan-emerald hover:bg-masan-emerald/90 text-slate-950 font-bold text-xs h-8"
              >
                Xem trước PDF
              </Button>
            )}
            {preview && (
              <>
                <Button
                  variant="outline"
                  onClick={() => saveFile(pdf, `${doc.kind}-${id}.pdf`)}
                  className="border-masan-border bg-masan-elevated text-xs text-masan-text h-8"
                >
                  Tải PDF
                </Button>
                <a
                  className="text-xs font-semibold text-masan-emerald underline hover:text-masan-teal"
                  href={preview}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở tab mới để in
                </a>
              </>
            )}
            {canIssue && doc.reference_id && doc.status !== 'VOIDED' && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmation('issue')}
                className="border-masan-emerald/30 text-masan-emerald hover:bg-masan-emerald/10 text-xs h-8"
              >
                Lưu bản phát hành
              </Button>
            )}
          </div>
          {preview && (
            <iframe
              title="Xem PDF A4"
              src={preview}
              className="h-[580px] w-full rounded-xl border border-masan-border bg-masan-elevated"
            />
          )}
          {doc.versions.map((v) => (
            <div
              className="flex items-center justify-between rounded-xl border border-masan-border bg-masan-elevated/40 p-3 text-xs"
              key={v.version}
            >
              <span className="font-mono text-masan-text">
                Bản {v.version} · {new Date(v.created_at).toLocaleString('vi-VN')}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => run(async () => setPdf(await fileBlob(path + '/pdf?version=' + v.version)))}
                className="h-7 text-xs border-masan-border bg-masan-elevated text-masan-text hover:border-masan-teal"
              >
                Xem lại phiên bản
              </Button>
            </div>
          ))}
          {canIssue && doc.status !== 'VOIDED' && (
            <form
              className="flex flex-wrap items-end gap-2 pt-3 border-t border-masan-border/60"
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmation('void');
              }}
            >
              <label className="flex-1 min-w-[200px] text-xs font-medium text-masan-text">
                Lý do hủy chứng từ *
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="Ghi rõ lý do hủy hiệu lực..."
                  className="mt-1 bg-masan-elevated border-masan-border text-masan-text text-xs focus:border-rose-400"
                />
              </label>
              <Button variant="destructive" disabled={busy || !reason.trim()} className="text-xs h-9">
                Hủy hiệu lực chứng từ
              </Button>
            </form>
          )}
        </section>
      )}

      <section id="history" className={`${formClass} scroll-mt-20`}>
        <div className="border-b border-masan-border pb-3">
          <h2 className="text-sm font-bold text-masan-text flex items-center gap-2">
            <History className="w-4 h-4 text-masan-teal" />
            Nhật ký kiểm toán & Xử lý chứng từ
          </h2>
        </div>
        <div className="space-y-2">
          {doc.events.map((event, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-xl border border-masan-border bg-masan-elevated/30 p-2.5 text-xs"
            >
              <div>
                <span className="font-bold text-masan-text font-mono">{event.action}</span> ·{' '}
                <span className="text-masan-muted">{event.actor_id}</span>
                {event.reason && <span className="text-masan-teal"> — "{event.reason}"</span>}
              </div>
              <span className="text-[11px] font-mono text-masan-muted">
                {new Date(event.created_at).toLocaleString('vi-VN')}
              </span>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={
          { draft: 'Xác nhận bản nháp?', issue: 'Lưu bản phát hành?', void: 'Hủy hiệu lực chứng từ?' }[confirmation]
        }
        description={
          {
            draft: 'Dữ liệu đã duyệt sẽ được khóa. Việc xác nhận bản nháp không ghi tồn.',
            issue: 'WMS sẽ lưu nội dung PDF và thông tin phiên bản phát hành.',
            void: 'Bản PDF đã phát hành vẫn được giữ trong lịch sử.',
          }[confirmation]
        }
        confirmLabel={confirmation === 'void' ? 'Hủy hiệu lực' : 'Xác nhận'}
        onConfirm={() => {
          if (confirmation === 'draft') run(() => review('confirm'));
          if (confirmation === 'issue')
            run(async () => {
              await request(path + '/issue', { method: 'POST', body: options });
              await reload();
            });
          if (confirmation === 'void')
            run(async () => {
              await request(path + '/void', { method: 'POST', body: { reason } });
              setPdf(null);
              await reload();
            });
        }}
      />
    </div>
  );
}

const fieldDisplay = (number, id) => (number ? `${number} · ${id}` : id);
