# MASAN CONSUMER WMS — Nâng cấp V7.1: Danh mục sản phẩm Masan

## Nội dung được cập nhật

Sử dụng đúng tài liệu **Danh_Muc_San_Pham_Masan.docx** (2 trang) làm dữ liệu tham chiếu. Danh mục gồm:

1. Gia vị & nước chấm — CHIN-SU, Nam Ngư, Tam Thái Tử.
2. Thực phẩm tiện lợi — Omachi, KOKOMI, CHIN-SU Story/Hi-Fresh, Gumi, Omtomi, Tiến Vua, Sagami.
3. Thực phẩm chế biến — Ponnie, Heo Cao Bồi.
4. Đồ uống & cà phê — Vinacafé, Wake-Up, B’fast, Wake-Up 247, Compact, EnerZ, Lemona, BupnonTEA 365.
5. Nước khoáng — Vĩnh Hảo, Vivant, Quang Hạnh.
6. Thịt tươi & nông sản — MEATDeli, WinEco.
7. Chăm sóc gia đình — Sopa, NET, Super NET.
8. Bán lẻ & dịch vụ — WinMart, WinMart+, WIN, Phúc Long.

Trang **Danh mục sản phẩm Masan** tại đường dẫn `/catalog`:
- Tìm kiếm có hỗ trợ tiếng Việt không dấu.
- Lọc theo 8 ngành hàng, xem các thương hiệu và ví dụ sản phẩm trong tài liệu.
- Cho phép mở form **Thêm hàng** đã điền trước **tên sản phẩm** vào một lô đang tồn tại (chỉ người có quyền sửa).
- Có chỉ báo số bản ghi trong kho khớp **chính xác tên sản phẩm** (không tự gán SKU hoặc suy đoán số lượng).

Mục **Lô hàng · SKU** có nút đi nhanh vào danh mục; form **Thêm sản phẩm** có hộp chọn tên tham chiếu. Dashboard có đường dẫn danh mục và hiển thị 8 nhóm sản phẩm/dịch vụ.

## Cách sử dụng

1. Chạy backend và frontend theo tài liệu V7 hiện có.
2. Truy cập **Danh mục sản phẩm Masan** trên menu bên trái.
3. Nếu hệ thống có nhiều lô hàng, **chọn lô đích** trước. Tìm thương hiệu/sản phẩm và nhấn **Tạo PART** đối với mẫu hàng hóa muốn nhập.
4. Form tự điền **tên sản phẩm**. Điền thủ công mã SKU nội bộ, Division/DC Prefix, PO, số lượng, số thùng, kích thước, trọng lượng, hạn dùng, số lô và vị trí; xác nhận nhập.
5. Nếu không có lô hàng, mở **Lô hàng · SKU** để tạo lô trước.

## Nguyên tắc bảo toàn dữ liệu

- **Không đổi schema/database**, không reset, không thêm SKU tự động vào PostgreSQL.
- Giữ nguyên luồng nhập/xuất/điều chuyển, FEFO, phân quyền, 3D, QR, báo cáo của V7.
- Phân biệt danh mục **tham chiếu** với tồn kho thật (giá trị tồn lấy từ API như trước).
- Bán lẻ/dịch vụ không xuất hiện trong danh sách mẫu để nhập kho.
- Tài liệu chỉ ghi tên sản phẩm ví dụ, **không cung cấp mã SKU nội bộ, thông số thùng, trọng lượng, giá hay HSD chính thức**; những trường này để người dùng nhập theo dữ liệu thực tế.
- Các tên kết hợp thương hiệu/loại sản phẩm là **nhãn gợi ý nhập liệu** từ mô tả tài liệu, không phải xác nhận chính xác tên sản phẩm thương mại trên bao bì.

## File sửa / thêm

- `denso-wms-frontend/src/lib/masanCatalog.js` (dữ liệu tham chiếu, chuẩn hóa tìm kiếm)
- `denso-wms-frontend/src/pages/Catalog.jsx` (trang danh mục mới)
- `denso-wms-frontend/src/App.jsx` (route `/catalog`)
- `denso-wms-frontend/src/components/Layout.jsx` (menu)
- `denso-wms-frontend/src/components/MasanOpsGuide.jsx` (dashboard)
- `denso-wms-frontend/src/pages/Orders.jsx` (lối tắt)
- `denso-wms-frontend/src/pages/OrderDetail.jsx` (deeplink mở form)
- `denso-wms-frontend/src/components/PartDialog.jsx` (chọn tên mẫu)

## Cập nhật Windows / Deploy

**Sao lưu dự án và PostgreSQL trước khi nâng cấp.** Bản V7.1 chỉ chỉnh frontend, nên không có migration mới.

Nếu đang triển khai V7, thay frontend bằng thư mục `denso-wms-frontend` của ZIP mới, giữ nguyên biến môi trường của hệ thống đang hoạt động, chạy:

```powershell
cd denso-wms-frontend
npm ci
npm run build
```

Sau đó deploy lại frontend lên Vercel hoặc server hiện có. Backend giữ nguyên nhưng vẫn phải đang chạy để trang hiển thị tồn kho thực tế.

## Kiểm thử

Đã kiểm tra parse JS/JSX và dữ liệu danh mục bằng Node.js. Chưa tích hợp chạy trình duyệt với backend/PostgreSQL thật trong môi trường xây dựng gói; hãy kiểm tra luồng `/catalog` → `Tạo PART` → lưu và xem 3D sau khi triển khai.
