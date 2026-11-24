import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes, Info, Warehouse } from 'lucide-react';
import PackingRuleEditor from '@/components/PackingRuleEditor';
import { RACK_SPEC } from '@/lib/viz/rackLayout';

const specRows = [
  { section: 'Cấu trúc kệ', rows: [
    { label: 'Số khoang', value: `${RACK_SPEC.bays}` },
    { label: 'Số tầng', value: `${RACK_SPEC.levels}` },
    { label: 'Tổng ô', value: `${RACK_SPEC.slotCount}` },
  ]},
  { section: 'Kích thước mỗi ô', rows: [
    { label: 'Rộng', value: `${RACK_SPEC.bayWidthMm.toLocaleString('vi-VN')} mm` },
    { label: 'Sâu', value: `${RACK_SPEC.depthMm.toLocaleString('vi-VN')} mm` },
    { label: 'Cao', value: `${RACK_SPEC.levelHeightMm.toLocaleString('vi-VN')} mm` },
  ]},
  { section: 'Quy ước vị trí', rows: [
    { label: 'Tầng 1', value: 'S01 – S05' },
    { label: 'Tầng 2', value: 'S06 – S10' },
    { label: 'Tầng 3', value: 'S11 – S15' },
    { label: 'Tầng 4', value: 'S16 – S20' },
  ]},
  { section: 'Nguyên tắc Masan', rows: [
    { label: 'Phân tách', value: '1 SKU / ô' },
    { label: 'Ưu tiên', value: 'Tầng thấp trước (FEFO)' },
    { label: 'Xoay thùng', value: '90° mặt đáy' },
  ]},
];

export default function PackingRules() {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 text-masan-text">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-masan-text">Quy ước lưu kho & Tiêu chuẩn FMCG</h1>
        <p className="text-sm text-masan-muted mt-1">Thông số kỹ thuật ô kệ và nguyên tắc lưu trữ bảo đảm tiêu chuẩn an toàn thực phẩm HACCP / ISO 22000</p>
      </div>

      <Card className="bg-masan-surface border-masan-border shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-masan-teal" />
              <CardTitle className="text-masan-text font-bold">Kệ sản phẩm tiêu chuẩn</CardTitle>
            </div>
            <Badge className="bg-masan-emerald text-slate-950 font-bold">5 × 4 = 20 ô</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-masan-elevated/40 p-2 rounded-xl border border-masan-border">
            {specRows.map((group) => (
              <div key={group.section} className="bg-masan-surface p-4 rounded-lg border border-masan-border/60 space-y-2">
                <p className="text-xs font-bold text-masan-teal uppercase tracking-wide">{group.section}</p>
                {group.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-masan-muted">{r.label}</span>
                    <span className="font-semibold text-masan-text font-mono text-right">{r.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-masan-surface border-masan-border shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-masan-text font-bold">Nguyên tắc phân hàng & Xếp kệ</CardTitle>
            <Badge variant="secondary" className="text-xs bg-masan-elevated text-masan-muted border border-masan-border">Có thể chỉnh sửa</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-masan-emerald/10 border border-masan-emerald/20 mb-4 text-xs text-masan-emerald">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Hệ thống ưu tiên gom cùng SKU / Lô hàng vào cùng ô kệ, xếp từ tầng thấp lên tầng cao theo nguyên tắc FEFO và tự chuyển sang ô tiếp theo khi ô hiện tại đạt dung tích cho phép.
            </p>
          </div>
          <PackingRuleEditor />
        </CardContent>
      </Card>

      <Card className="bg-masan-surface border-masan-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-base text-masan-text font-bold">Sơ đồ đánh số vị trí 20 ô kệ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 20 }, (_, i) => {
              const level = Math.floor(i / 5) + 1;
              const bay = (i % 5) + 1;
              return (
                <div key={i} className="rounded-xl border border-masan-border bg-masan-elevated/70 p-3 text-center">
                  <Boxes className="w-4 h-4 mx-auto text-masan-teal mb-1" />
                  <p className="text-xs font-bold text-masan-text font-mono">S{String(i + 1).padStart(2, '0')}</p>
                  <p className="text-[10px] text-masan-muted font-mono">T{level} · K{bay}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
