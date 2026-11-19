import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PackagePlus,
  Search,
  Tag,
  ArrowRight,
  Info,
  Boxes,
  Layers3,
  X,
  MapPin,
  PackageSearch,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { isReadOnly } from '@/lib/access';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MASAN_CATEGORIES,
  MASAN_BRAND_COUNT,
  MASAN_REFERENCE_PRODUCTS,
  normalizeCatalogText,
} from '@/lib/masanCatalog';

const ALL = 'all';
const CARD_ICONS = [Tag, Boxes, PackagePlus, BookOpen, Layers3, Tag, Boxes, Building2];

function BrandSection({ brand, isService, parts, racks, orderId, canCreate, onLocate }) {
  const [expanded, setExpanded] = useState(false);
  const visibleProducts = expanded ? brand.products : brand.products.slice(0, 4);
  return (
    <section className="min-w-0 rounded-xl border border-masan-border bg-masan-elevated/40 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-bold text-masan-text break-words">{brand.name}</h3>
        {!isService && (
          <span className="shrink-0 text-[10px] font-mono text-masan-muted bg-masan-surface border border-masan-border px-1.5 py-0.5 rounded">
            {brand.products.length} mẫu
          </span>
        )}
      </div>
      {isService ? (
        <p className="mt-2 text-[11px] leading-relaxed text-masan-muted">
          Kênh bán lẻ / dịch vụ trong hệ sinh thái, không phải SKU nhập kho.
        </p>
      ) : brand.products.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-masan-muted">
          Tài liệu chỉ nêu tên thương hiệu, chưa có sản phẩm cụ thể.
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-1.5">
            {visibleProducts.map((name) => {
              const matches = parts.filter((p) => normalizeCatalogText(p.partName) === normalizeCatalogText(name));
              const existingCount = matches.length;
              return (
                <div
                  key={name}
                  className="flex gap-2 items-center justify-between rounded-lg border border-masan-border bg-masan-surface px-2.5 py-2 hover:border-masan-emerald/40 transition-colors"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onLocate(name, matches)}
                      className="text-left text-xs font-semibold text-masan-text hover:text-masan-teal hover:underline break-words"
                      title={`Xem vị trí lưu kho của ${name}`}
                    >
                      {name}
                    </button>
                    {existingCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => onLocate(name, matches)}
                        className="mt-0.5 flex items-center gap-1 text-[10px] font-mono text-masan-emerald hover:underline"
                      >
                        <MapPin className="h-3 w-3" /> Xem {existingCount} vị trí trong kho
                      </button>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-masan-muted/60">Chưa có tồn kho</p>
                    )}
                  </div>
                  {canCreate && orderId && (
                    <Link
                      to={`/orders/${encodeURIComponent(orderId)}?catalog=${encodeURIComponent(name)}`}
                      title={`Điền tên ${name} vào form thêm hàng`}
                      aria-label={`Thêm ${name} vào lô hiện có`}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-masan-emerald/30 bg-masan-emerald/10 px-2 py-1 text-[11px] font-semibold text-masan-emerald transition hover:bg-masan-emerald/20 focus-visible:outline-none"
                    >
                      <PackagePlus className="h-3 w-3" /> <span className="hidden sm:inline">Tạo PART</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          {brand.products.length > 4 && (
            <button
              type="button"
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-masan-emerald hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  Thu gọn <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Xem thêm {brand.products.length - 4} sản phẩm <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default function Catalog() {
  const { parts, orders, racks } = useStore();
  const [locating, setLocating] = useState(null);
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(ALL);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const orderId =
    orders.length === 1 ? orders[0].id : orders.find((order) => order.id === selectedOrderId)?.id || null;
  const canCreate = !isReadOnly(user?.role);

  const filtered = useMemo(() => {
    const needle = normalizeCatalogText(query);
    return MASAN_CATEGORIES.filter((cat) => categoryId === ALL || categoryId === cat.id)
      .map((cat) => {
        if (!needle) return cat;
        const categoryMatches = normalizeCatalogText(cat.name + ' ' + cat.summary).includes(needle);
        const brands = cat.brands
          .map((brand) => {
            const brandMatches = normalizeCatalogText(brand.name).includes(needle);
            return {
              ...brand,
              products:
                categoryMatches || brandMatches
                  ? brand.products
                  : brand.products.filter((p) => normalizeCatalogText(p).includes(needle)),
              matches:
                categoryMatches || brandMatches || brand.products.some((p) => normalizeCatalogText(p).includes(needle)),
            };
          })
          .filter((brand) => brand.matches);
        return { ...cat, brands };
      })
      .filter((cat) => cat.brands.length);
  }, [query, categoryId]);

  return (
    <div className="space-y-6">
      {/* Location Modal */}
      {locating && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setLocating(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Vị trí tồn kho"
            className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl bg-masan-surface border border-masan-border p-5 shadow-2xl text-masan-text"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-masan-border pb-3">
              <div>
                <h2 className="text-base font-bold text-masan-text">{locating.name}</h2>
                <p className="text-xs text-masan-muted">Các lô hàng và vị trí lưu trữ thực tế trong kho</p>
              </div>
              <button
                type="button"
                onClick={() => setLocating(null)}
                aria-label="Đóng"
                className="rounded-lg p-1.5 hover:bg-masan-elevated text-masan-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {locating.matches.length === 0 ? (
                <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
                  Sản phẩm này chưa có bản ghi tồn kho; cần tạo PART trước khi tra cứu vị trí.
                </p>
              ) : (
                locating.matches.map((part) => {
                  const rack = racks.find((r) => r.id === part.rackId);
                  return (
                    <div
                      key={part.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-masan-border bg-masan-elevated/40 p-3"
                    >
                      <div className="text-xs space-y-1 font-mono">
                        <p className="font-bold text-masan-text">
                          Lô: {part.lotNumber || part.productCode || part.id.slice(0, 8)}
                        </p>
                        <p className="text-masan-muted">
                          {rack ? `DC-HN-01 / ${rack.zoneCode} / ${rack.name}` : 'Chưa phân bổ kệ'} ·{' '}
                          {Number.isInteger(part.preferredRackSlot)
                            ? `S${String(part.preferredRackSlot + 1).padStart(2, '0')}`
                            : 'Chưa gán ô'}
                        </p>
                        <p className="text-masan-emerald font-bold">
                          {part.cartons || 0} thùng · {part.quantity || 0} đơn vị
                        </p>
                      </div>
                      {rack && (
                        <Link
                          to={`/racks/${encodeURIComponent(rack.id)}/plan?q=${encodeURIComponent(part.partName)}`}
                          className="shrink-0 text-xs font-semibold text-masan-teal hover:underline flex items-center gap-1"
                        >
                          Mở kệ <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* Top Header */}
      <header className="rounded-2xl border border-masan-border bg-masan-surface p-5 shadow-lg sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-masan-emerald">
              <BookOpen className="h-4 w-4" /> Danh mục tham chiếu hệ sinh thái
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-masan-text">
              Danh mục thương hiệu & Sản phẩm Masan FMCG
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-masan-muted">
              Tra cứu chuẩn hóa ngành hàng, thương hiệu và sản phẩm tiêu biểu theo hồ sơ sản phẩm Masan Consumer.
            </p>
          </div>
          <Button
            variant="outline"
            asChild
            className="border-masan-border bg-masan-elevated text-xs text-masan-text hover:border-masan-emerald hover:text-masan-emerald"
          >
            <Link to="/orders">
              Lô hàng đang quản lý <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Ngành hàng FMCG', MASAN_CATEGORIES.length],
            ['Thương hiệu', MASAN_BRAND_COUNT],
            ['Sản phẩm mẫu', MASAN_REFERENCE_PRODUCTS.length],
            ['PARTs trên kệ', parts.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-masan-border bg-masan-elevated/50 p-3">
              <p className="text-[11px] text-masan-muted">{label}</p>
              <p className="mt-1 text-xl font-bold font-mono text-masan-text">{value}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Info Alert */}
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs leading-relaxed text-sky-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p>
          <b>Hướng dẫn tích hợp:</b> Bấm <b>Tạo PART</b> cạnh tên sản phẩm để mở biểu mẫu và tự điền tên vào lô hàng. Bạn chỉ cần nhập mã SKU nội bộ, số lô, hạn dùng và chỉ định ô kệ.
        </p>
      </div>

      {canCreate && orders.length > 1 && (
        <div className="rounded-xl border border-masan-border bg-masan-surface p-4">
          <label htmlFor="target-order" className="block text-xs font-semibold text-masan-text">
            Chọn lô hàng đích trước khi tạo PART từ danh mục
          </label>
          <select
            id="target-order"
            className="mt-2 h-10 w-full max-w-lg rounded-lg border border-masan-border bg-masan-elevated px-3 text-xs text-masan-text focus:border-masan-emerald focus:outline-none"
            value={selectedOrderId}
            onChange={(event) => setSelectedOrderId(event.target.value)}
          >
            <option value="">— Chọn lô hàng đích —</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber} · {order.name || order.destination || 'Lô hàng'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter and Search Bar */}
      <section className="space-y-3" aria-label="Bộ lọc danh mục">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-masan-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-masan-surface border-masan-border text-masan-text pl-9 text-xs focus:border-masan-emerald"
            placeholder="Tìm thương hiệu, sản phẩm, ngành hàng..."
            aria-label="Tìm trong danh mục Masan"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ id: ALL, short: 'Tất cả' }, ...MASAN_CATEGORIES].map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-pressed={categoryId === cat.id}
              onClick={() => setCategoryId(cat.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none ${
                categoryId === cat.id
                  ? 'border-masan-emerald bg-masan-emerald text-slate-950 font-bold shadow-sm'
                  : 'border-masan-border bg-masan-surface text-masan-muted hover:text-masan-text hover:border-masan-emerald/40'
              }`}
            >
              {cat.short}
            </button>
          ))}
        </div>
      </section>

      {/* Category Results */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-masan-border p-10 text-center text-xs text-masan-muted">
          Không có kết quả phù hợp. Hãy thử tìm theo tên thương hiệu khác hoặc chọn “Tất cả”.
        </div>
      ) : (
        <div className="space-y-5">
          {filtered.map((cat) => {
            const Icon = CARD_ICONS[MASAN_CATEGORIES.findIndex((c) => c.id === cat.id)] || Tag;
            const isService = cat.kind === 'service';
            return (
              <section
                key={cat.id}
                id={cat.id}
                className="overflow-hidden rounded-2xl border border-masan-border bg-masan-surface shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-masan-border p-4 bg-masan-elevated/40 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-masan-emerald/10 border border-masan-emerald/20 p-2.5 text-masan-emerald">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-masan-text">{cat.name}</h2>
                      <p className="mt-0.5 text-xs text-masan-muted">{cat.summary}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-masan-elevated border border-masan-border px-3 py-1 text-xs font-mono text-masan-muted">
                    {cat.brands.length} thương hiệu{isService ? ' · Dịch vụ' : ''}
                  </span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                  {cat.brands.map((brand) => (
                    <BrandSection
                      key={brand.name}
                      brand={brand}
                      isService={isService}
                      parts={parts}
                      racks={racks}
                      orderId={orderId}
                      canCreate={canCreate}
                      onLocate={(name, matches) => setLocating({ name, matches })}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
