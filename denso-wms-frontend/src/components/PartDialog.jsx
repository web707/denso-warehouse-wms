import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { calcPartCbm, fmtDec } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MASAN_CATEGORIES } from '@/lib/masanCatalog';
import { STORAGE_CLASSES, suggestMasanStorageClass } from '@/lib/masanStorage';
import { getFamily, familyLabel, rackFamily } from '@/lib/rackProductFamily';

const empty = {
  orderId: '',
  partName: '',
  productCode: '',
  masterPo: '',
  dcPrefix: '',
  poNumber: '',
  divisionCode: '',
  quantity: '',
  weight: '',
  cartons: '',
  cartonLength: '',
  cartonWidth: '',
  cartonHeight: '',
  rackId: '__none__',
  lotNumber: '',
  uomCode: 'EA',
  unitCost: '',
  expirationDate: '',
  storageClass: 'unknown',
  supplierName: '',
  supplierId: '',
  supplierSiteCode: '',
};

const UOM_OPTIONS = [
  { value: 'EA', label: 'EA — cái' },
  { value: 'KG', label: 'KG — ki-lô-gam' },
  { value: 'ROLL', label: 'ROLL — cuộn' },
];

export default function PartDialog({ open, onOpenChange, part, defaultOrderId, suggestedProduct = '' }) {
  const { orders, racks, parts, divisions, addPart, updatePart, assignPart } = useStore();
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setSubmitError('');
    setErrors({});
    if (part) {
      setForm({
        ...empty,
        ...part,
        rackId: part.rackId || '__none__',
        quantity: String(part.quantity ?? ''),
        weight: String(part.weight ?? ''),
        cartons: String(part.cartons ?? ''),
        cartonLength: String(part.cartonLength ?? ''),
        cartonWidth: String(part.cartonWidth ?? ''),
        cartonHeight: String(part.cartonHeight ?? ''),
        unitCost: String(part.unitCost ?? ''),
        supplierId: String(part.supplierId ?? ''),
      });
    } else {
      const initialOrderId = defaultOrderId || orders[0]?.id || '';
      const order = orders.find((o) => o.id === initialOrderId);
      const matching = divisions.find((d) => d.code === order?.division);
      const defaultDivision = matching || (divisions.length === 1 ? divisions[0] : null);
      setForm({ ...empty, orderId: initialOrderId, divisionCode: defaultDivision?.code || '', dcPrefix: defaultDivision?.dcPrefixes?.length === 1 ? defaultDivision.dcPrefixes[0].code : '', partName: suggestedProduct, storageClass: suggestMasanStorageClass(suggestedProduct) });
    }
  }, [part, open, orders, divisions, defaultOrderId, suggestedProduct]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({...e,[k]:''})); };
  const err = (key) => errors[key] ? <p role="alert" className="text-xs font-medium text-red-500 mt-1">{errors[key]}</p> : null;
  const invalidClass = (key) => errors[key] ? 'border-red-500 ring-1 ring-red-500' : '';
  const validate = () => {
    const issues = {};
    if (!form.orderId) issues.orderId = 'Bạn chưa chọn đơn hàng.';
    if (!form.partName.trim()) issues.partName = 'Nhập tên sản phẩm.';
    if (!form.masterPo.trim()) issues.masterPo = 'Nhập Master PO (mã chứng từ).' ;
    if (!chosenDivision) issues.divisionCode = 'Chọn Division hợp lệ để lưu hàng.';
    if (!form.dcPrefix || !availablePrefixes.some((d) => d.code === form.dcPrefix)) issues.dcPrefix = 'Chọn DC Prefix thuộc Division đã chọn.';
    for (const [key,label] of [['quantity','Số lượng PCS'],['cartons','Tổng thùng']]) {const n=Number(form[key]);if(!Number.isInteger(n)||n<=0) issues[key] = `${label} phải là số nguyên lớn hơn 0.`;}
    if (!Number.isFinite(Number(form.weight)) || Number(form.weight)<0) issues.weight = 'Trọng lượng phải là số không âm.';
    for (const key of ['cartonLength','cartonWidth','cartonHeight']) if (!Number.isFinite(Number(form[key])) || Number(form[key])<=0) issues[key] = 'Nhập kích thước hợp lệ lớn hơn 0.';
    if (form.uomCode === 'EA' && Number(form.quantity) < Number(form.cartons)) issues.quantity = 'Số cái (PCS) không thể ít hơn số thùng. Kiểm tra lại quy cách đóng gói.';
    if (form.unitCost!=='' && (!Number.isFinite(Number(form.unitCost)) || Number(form.unitCost)<0)) issues.unitCost = 'Đơn giá không hợp lệ.';
    if (form.supplierId!=='' && (!Number.isInteger(Number(form.supplierId))|| Number(form.supplierId)<0)) issues.supplierId='Mã NCC phải là số nguyên không âm.';
    if (form.rackId !== '__none__' && form.storageClass === 'unknown') issues.storageClass = 'Chọn nhóm bảo quản trước khi xếp vào kệ.';
    if (form.rackId !== '__none__' && form.storageClass !== 'household' && !form.expirationDate) issues.expirationDate = 'Nhập hạn sử dụng trước khi phân bổ vào kệ.';
    return issues;
  };
  const chosenDivision = divisions.find((d) => d.code === form.divisionCode);
  const availablePrefixes = chosenDivision?.dcPrefixes || [];
  const requestedFamily = getFamily({ partName: form.partName, storageClass: form.storageClass });
  const compatibleRacks = racks.filter((rack) => {
    const group = rackFamily(rack, parts);
    return rack.id === part?.rackId || !requestedFamily || !group || group === requestedFamily;
  });

  const cbmPreview =
    form.cartonLength && form.cartonWidth && form.cartonHeight && form.cartons
      ? calcPartCbm({
          cartonLength: +form.cartonLength,
          cartonWidth: +form.cartonWidth,
          cartonHeight: +form.cartonHeight,
          cartons: +form.cartons,
        })
      : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError('');
    const issues=validate();setErrors(issues);
    if(Object.keys(issues).length){setSubmitError('Vui lòng sửa các trường viền đỏ trước khi lưu.');return;}
    setSubmitting(true);
    try {
    const data = {
      orderId: form.orderId,
      partName: form.partName,
      productCode: form.productCode,
      masterPo: form.masterPo,
      dcPrefix: form.dcPrefix,
      poNumber: form.poNumber,
      divisionCode: form.divisionCode,
      quantity: +form.quantity || 0,
      weight: +form.weight || 0,
      cartons: +form.cartons || 0,
      cartonLength: +form.cartonLength || 0,
      cartonWidth: +form.cartonWidth || 0,
      cartonHeight: +form.cartonHeight || 0,
      rackId: form.rackId === '__none__' ? null : form.rackId,
      lotNumber: form.lotNumber.trim(),
      uomCode: form.uomCode || 'EA',
      unitCost: form.unitCost,
      expirationDate: form.expirationDate,
      storageClass: form.storageClass,
      supplierName: form.supplierName.trim(),
      supplierId: form.supplierId,
      supplierSiteCode: form.supplierSiteCode.trim(),
    };
    if (part) {
      await updatePart(part.id, data);
      if ((part.rackId || null) !== data.rackId) await assignPart(part.id, data.rackId);
    } else {
      await addPart(data); // Backend validates and assigns the rack atomically.
    }
    onOpenChange(false);
    } catch (err) {
      setSubmitError(err?.message || 'Không thể lưu PART');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{part ? 'Sửa thông tin hàng' : 'Thêm sản phẩm vào kho (PART/SKU)'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {!part && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
              <Label htmlFor="masan-sample">Chọn nhanh sản phẩm từ danh mục Masan (tùy chọn)</Label>
              <select
                id="masan-sample"
                value={MASAN_CATEGORIES.some((c) => c.brands.some((b) => b.products.includes(form.partName))) ? form.partName : ''}
                onChange={(event) => setForm((f) => ({ ...f, partName: event.target.value, storageClass: suggestMasanStorageClass(event.target.value) }))}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
              >
                <option value="">Tự nhập tên sản phẩm...</option>
                {MASAN_CATEGORIES.filter((category) => category.kind === 'stock').map((category) => (
                  <optgroup key={category.id} label={category.name}>
                    {category.brands.flatMap((brand) => brand.products.map((product) => (
                      <option key={`${brand.name}-${product}`} value={product}>{product}</option>
                    )))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-slate-600">Chỉ điền tên. Mã SKU, lô, số lượng, trọng lượng, HSD và kích thước phải nhập theo chứng từ thực tế.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Đơn hàng</Label>
              <Select value={form.orderId} onValueChange={(v) => {
                const order = orders.find((o) => o.id === v);
                setForm((f) => ({ ...f, orderId: v, divisionCode: order?.division || f.divisionCode, dcPrefix: '' }));
              }}>
                <SelectTrigger className={invalidClass('orderId')}><SelectValue placeholder="Chọn đơn hàng" /></SelectTrigger>{err('orderId')}
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.orderNumber} — {o.division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tên sản phẩm / PART</Label>
              <Input className={invalidClass('partName')} value={form.partName} onChange={(e) => setForm((f) => ({ ...f, partName: e.target.value, storageClass: suggestMasanStorageClass(e.target.value) }))} placeholder="VD: Kokomi Đại 90g" required />{err('partName')}
            </div>
            <div className="space-y-1.5">
              <Label>Mã SKU nội bộ (ItemNumber)</Label>
              <Input value={form.productCode} onChange={(e) => set('productCode', e.target.value)} placeholder="Mã thực tế theo hệ thống" />
            </div>
            <div className="space-y-1.5">
              <Label>Master PO</Label>
              <Input className={invalidClass('masterPo')} value={form.masterPo} onChange={(e) => set('masterPo', e.target.value)} placeholder="M91846" />{err('masterPo')}
            </div>
            <div className="space-y-1.5">
              <Label>Division (bắt buộc)</Label>
              <select className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${invalidClass('divisionCode')}`} value={form.divisionCode} required onChange={(e) => { const d=divisions.find((item)=>item.code===e.target.value); setForm((f) => ({ ...f, divisionCode: e.target.value, dcPrefix: d?.dcPrefixes?.length === 1 ? d.dcPrefixes[0].code : '' })); setErrors((old)=>({...old,divisionCode:'',dcPrefix:''})); }}>
                <option value="">Chọn Division...</option>
                {divisions.map((d) => <option key={d.id} value={d.code}>{d.code}</option>)}
              </select>{err('divisionCode')}
            </div>
            <div className="space-y-1.5">
              <Label>DC Prefix (bắt buộc)</Label>
              <select className={`h-10 w-full rounded-md border bg-white px-3 text-sm ${invalidClass('dcPrefix')}`} value={form.dcPrefix} required onChange={(e) => set('dcPrefix', e.target.value)}>
                <option value="">Chọn DC Prefix...</option>
                {availablePrefixes.map((prefix) => <option key={prefix.id} value={prefix.code}>{prefix.code}</option>)}
              </select>{err('dcPrefix')}
            </div>
            <div className="space-y-1.5">
              <Label>Số PO</Label>
              <Input value={form.poNumber} onChange={(e) => set('poNumber', e.target.value)} placeholder="134736" />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-3">
            <p className="font-semibold text-sm text-emerald-900">Phân loại bảo quản & hạn sử dụng (quan trọng)</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1.5 block text-xs font-semibold text-slate-700">Nhóm bảo quản đã kiểm tra trên nhãn / nhà cung cấp
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900" value={form.storageClass} onChange={(e) => set('storageClass', e.target.value)} required>
                  {STORAGE_CLASSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                </select>{err('storageClass')}
              </label>
              <label className="space-y-1.5 block text-xs font-semibold text-slate-700">Hạn sử dụng (HSD)
                <Input className={invalidClass('expirationDate')} type="date" value={form.expirationDate} onChange={(e) => set('expirationDate', e.target.value)} required={form.storageClass !== 'household' && form.storageClass !== 'unknown'} />{err('expirationDate')}
              </label>
            </div>
            <p className="text-xs text-emerald-900">Chọn khu bảo quản trước khi gán kệ. Hàng có HSD được ưu tiên FEFO; thiếu HSD sẽ hiện cảnh báo trong Quản lý lô & FEFO. Không tự suy đoán nhiệt độ từ tên sản phẩm.</p>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Kích thước & Số lượng</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Số lượng (PCS)</Label>
                <Input className={invalidClass('quantity')} type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />{err('quantity')}
              </div>
              <div className="space-y-1.5">
                <Label>Trọng lượng (KG)</Label>
                <Input className={invalidClass('weight')} type="number" step="0.1" min="0" value={form.weight} onChange={(e) => set('weight', e.target.value)} required />{err('weight')}
              </div>
              <div className="space-y-1.5">
                <Label>Tổng thùng</Label>
                <Input className={invalidClass('cartons')} type="number" min="0" value={form.cartons} onChange={(e) => set('cartons', e.target.value)} required />{err('cartons')}
              </div>
              <div className="space-y-1.5">
                <Label>Dài (cm)</Label>
                <Input className={invalidClass('cartonLength')} type="number" min="0" value={form.cartonLength} onChange={(e) => set('cartonLength', e.target.value)} required />{err('cartonLength')}
              </div>
              <div className="space-y-1.5">
                <Label>Rộng (cm)</Label>
                <Input className={invalidClass('cartonWidth')} type="number" min="0" value={form.cartonWidth} onChange={(e) => set('cartonWidth', e.target.value)} required />{err('cartonWidth')}
              </div>
              <div className="space-y-1.5">
                <Label>Cao (cm)</Label>
                <Input className={invalidClass('cartonHeight')} type="number" min="0" value={form.cartonHeight} onChange={(e) => set('cartonHeight', e.target.value)} required />{err('cartonHeight')}
              </div>
            </div>
            {cbmPreview > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium">
                CBM tự tính: {fmtDec(cbmPreview, 3)} m³
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Thông tin tồn kho (theo Oracle)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lotNumber">Số lô (LotNumber) · Tùy chọn</Label>
                <Input id="lotNumber" value={form.lotNumber} onChange={(e) => set('lotNumber', e.target.value)} placeholder="LOT-2026-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Đơn vị (UOMCode)</Label>
                <Select value={form.uomCode} onValueChange={(v) => set('uomCode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitCost">Đơn giá (UnitCost) · Tùy chọn</Label>
                <Input className={invalidClass('unitCost')} id="unitCost" type="number" step="0.01" min="0" value={form.unitCost} onChange={(e) => set('unitCost', e.target.value)} placeholder="12.50" />{err('unitCost')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplierName">Nhà cung cấp (SupplierName)</Label>
                <Input id="supplierName" value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplierId">Mã NCC (SupplierId)</Label>
                <Input className={invalidClass('supplierId')} id="supplierId" type="number" min="0" step="1" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)} />{err('supplierId')}
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="supplierSiteCode">Site NCC (SupplierSiteCode)</Label>
                <Input id="supplierSiteCode" value={form.supplierSiteCode} onChange={(e) => set('supplierSiteCode', e.target.value)} placeholder="HN-01" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-1.5">
            <Label>Phân bổ vào Kệ kho theo chủ đề</Label>
            <p className="text-xs text-slate-500 mb-1">{requestedFamily ? `Chủ đề: ${familyLabel(requestedFamily)}. Chỉ hiển thị các kệ trống hoặc cùng nhóm.` : 'Chọn tên sản phẩm / nhóm bảo quản để xem gợi ý kệ phù hợp.'}</p>
            <Select value={form.rackId} onValueChange={(v) => set('rackId', v)}>
              <SelectTrigger><SelectValue placeholder="Chưa phân bổ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Chưa phân bổ —</SelectItem>
                {compatibleRacks.map((c) => (
                  <SelectItem key={c.id} value={c.id}>DC-HN-01 / {c.zoneCode} / {c.name} · {familyLabel(rackFamily(c, parts))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {submitError && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{submitError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu...' : part ? 'Lưu thay đổi' : 'Thêm hàng'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}