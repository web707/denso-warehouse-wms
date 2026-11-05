import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Building2, CheckCircle2, ChevronDown, ChevronUp, PackagePlus, Search, Tag, ArrowRight, Info, Boxes, Layers3 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { isReadOnly } from '@/lib/access';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MASAN_CATEGORIES, MASAN_BRAND_COUNT, MASAN_REFERENCE_PRODUCTS, countMatchingInventory, normalizeCatalogText } from '@/lib/masanCatalog';

const ALL = 'all';
const CARD_ICONS = [Tag, Boxes, PackagePlus, BookOpen, Layers3, Tag, Boxes, Building2];

function BrandSection({ brand, isService, parts, orderId, canCreate }) {
  const [expanded, setExpanded] = useState(false);
  const visibleProducts = expanded ? brand.products : brand.products.slice(0, 4);
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 break-words">{brand.name}</h3>
        {!isService && <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{brand.products.length} mẫu</span>}
      </div>
      {isService ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Kênh bán lẻ / dịch vụ trong hệ sinh thái, không phải SKU nhập kho.</p>
      ) : brand.products.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Tài liệu chỉ nêu tên thương hiệu, chưa có sản phẩm cụ thể.</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {visibleProducts.map((name) => {
              const existingCount = countMatchingInventory(parts, name);
              return (
                <div key={name} className="flex gap-2 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 break-words">{name}</p>
                    {existingCount > 0 && <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="h-3 w-3" /> {existingCount} bản ghi cùng tên trong kho</p>}
                  </div>
                  {canCreate && orderId && (
                    <Link
                      to={`/orders/${encodeURIComponent(orderId)}?catalog=${encodeURIComponent(name)}`}
                      title={`Điền tên ${name} vào form thêm hàng`}
                      aria-label={`Thêm ${name} vào lô hiện có`}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <PackagePlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tạo PART</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          {brand.products.length > 4 && (
            <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <>Thu gọn <ChevronUp className="h-3.5 w-3.5" /></> : <>Xem thêm {brand.products.length - 4} sản phẩm <ChevronDown className="h-3.5 w-3.5" /></>}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default function Catalog() {
  const { parts, orders } = useStore();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(ALL);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  // Avoid silently using the wrong order when the WMS has multiple lots.
  const orderId = orders.length === 1 ? orders[0].id : (orders.find((order) => order.id === selectedOrderId)?.id || null);
  const canCreate = !isReadOnly(user?.role);
  const filtered = useMemo(() => {
    const needle = normalizeCatalogText(query);
    return MASAN_CATEGORIES.filter((cat) => categoryId === ALL || categoryId === cat.id).map((cat) => {
      if (!needle) return cat;
      const categoryMatches = normalizeCatalogText(cat.name + ' ' + cat.summary).includes(needle);
      const brands = cat.brands.map((brand) => {
        const brandMatches = normalizeCatalogText(brand.name).includes(needle);
        return {
          ...brand,
          products: categoryMatches || brandMatches ? brand.products : brand.products.filter((p) => normalizeCatalogText(p).includes(needle)),
          matches: categoryMatches || brandMatches || brand.products.some((p) => normalizeCatalogText(p).includes(needle)),
        };
      }).filter((brand) => brand.matches);
      return { ...cat, brands };
    }).filter((cat) => cat.brands.length);
  }, [query, categoryId]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      <header className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700"><BookOpen className="h-4 w-4" /> Danh mục tham chiếu</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Danh mục sản phẩm & thương hiệu Masan</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">Tra cứu ngành hàng, thương hiệu và các sản phẩm tiêu biểu dựa trên tài liệu Danh_Muc_San_Pham_Masan.docx. Danh mục này không tự tạo SKU hoặc thay đổi tồn kho.</p>
          </div>
          <Button variant="outline" asChild><Link to="/orders">Lô hàng đang quản lý <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Ngành hàng', MASAN_CATEGORIES.length],
            ['Thương hiệu', MASAN_BRAND_COUNT],
            ['Tên sản phẩm tham chiếu', MASAN_REFERENCE_PRODUCTS.length],
            ['PART trong hệ thống', parts.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p></div>
          ))}
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b>Phân biệt dữ liệu:</b> Tên thương hiệu/sản phẩm bên dưới là danh mục từ tài liệu, không phải tồn kho đã nhập. Nhấn <b>Tạo PART</b> để mở form và tự điền tên; bạn vẫn cần nhập mã SKU nội bộ, lô, số lượng, HSD và vị trí thật. Nhóm Bán lẻ & Dịch vụ không đưa vào nhập kho như hàng hóa.</p>
      </div>

      {canCreate && orders.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label htmlFor="target-order" className="block text-xs font-semibold text-slate-700">Chọn lô hàng đích trước khi tạo PART từ danh mục</label>
          <select
            id="target-order"
            className="mt-2 h-10 w-full max-w-lg rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            value={selectedOrderId}
            onChange={(event) => setSelectedOrderId(event.target.value)}
          >
            <option value="">— Chọn lô hàng —</option>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.name || order.destination || 'Lô hàng'}</option>)}
          </select>
          <p className="mt-2 text-xs text-slate-500">Sản phẩm chỉ được đưa vào lô bạn chọn sau khi hoàn thành form và lưu thành công.</p>
        </div>
      )}

      <section className="space-y-3" aria-label="Bộ lọc danh mục">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="bg-white pl-9" placeholder="Tìm thương hiệu, sản phẩm, ngành hàng..." aria-label="Tìm trong danh mục Masan" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ id: ALL, short: 'Tất cả' }, ...MASAN_CATEGORIES].map((cat) => (
            <button key={cat.id} type="button" aria-pressed={categoryId === cat.id} onClick={() => setCategoryId(cat.id)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${categoryId === cat.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}>
              {cat.short}
            </button>
          ))}
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Không có kết quả phù hợp. Thử tên thương hiệu hoặc chọn “Tất cả”.</div>
      ) : (
        <div className="space-y-5">
          {filtered.map((cat) => {
            const Icon = CARD_ICONS[MASAN_CATEGORIES.findIndex((c) => c.id === cat.id)] || Tag;
            const isService = cat.kind === 'service';
            return (
              <section key={cat.id} id={cat.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Icon className="h-5 w-5" /></span>
                    <div><h2 className="text-base font-bold text-slate-900">{cat.name}</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">{cat.summary}</p></div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{cat.brands.length} thương hiệu{isService ? ' · Dịch vụ' : ''}</span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                  {cat.brands.map((brand) => <BrandSection key={brand.name} brand={brand} isService={isService} parts={parts} orderId={orderId} canCreate={canCreate} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {canCreate && orders.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Chưa có lô hàng để thêm PART. Hãy tạo lô hàng tại <Link to="/orders" className="font-semibold underline">Lô hàng & SKU</Link>, sau đó dùng danh mục làm mẫu tên sản phẩm.
        </div>
      )}
      {canCreate && orders.length > 1 && !orderId && (
        <p className="text-xs text-slate-500">Bạn có nhiều lô hàng. Chọn một lô ở trên để hiện nút Tạo PART bên cạnh tên sản phẩm.</p>
      )}
      <p className="text-xs leading-relaxed text-slate-500">Nguồn nội dung: file “Danh_Muc_San_Pham_Masan.docx” do người dùng cung cấp. Đây là danh mục tham chiếu phục vụ giao diện quản lý kho, không phải chứng từ xuất nhập, không phải dữ liệu master SKU chính thức.</p>
    </div>
  );
}
