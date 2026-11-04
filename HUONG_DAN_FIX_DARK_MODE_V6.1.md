# MASAN Consumer WMS V6.1 – Sửa tương phản Dark Mode

## Vấn đề và nguyên nhân

Bản V6 đảo thang `slate` để tạo chữ sáng trong Dark Mode, nhưng màu nền gradient của mục
**Luồng vận hành kho Masan Consumer** vẫn giữ trắng/xanh rất nhạt. Kết quả là tiêu đề
sáng nằm trên nền sáng. Các popup mô hình 3D dùng `bg-white/95` cũng chưa được remap,
và màn hình đăng nhập giữ nguyên nền cố định sáng khi đổi sang giao diện tối.

## Đã sửa

- `denso-wms-frontend/src/components/MasanOpsGuide.jsx`: gradient đầu dashboard có màu riêng
  cho giao diện tối; chỉnh tiêu đề và nhãn quy trình để chữ/nền đủ tách biệt.
- `denso-wms-frontend/src/index.css`: map cả `bg-white/90`, `bg-white/95` sang màu nền tối
  khi có `.dark`, khắc phục popup/tooltip trên sơ đồ 3D và bảng QR. Khung xuất QR vẫn giữ
  palette trắng để phục vụ xuất/in.
- `denso-wms-frontend/src/pages/Login.jsx`: bổ sung nền Dark Mode đồng bộ với màu chữ,
  sửa độ rõ placeholder trong input.
- Không thay đổi database, tài khoản, phân quyền, API, giao dịch kho, dữ liệu hoặc mô hình 3D.

## Cập nhật

1. Sao lưu project cũ.
2. Thay frontend bằng source của gói V6.1 (có thể giữ cấu hình `.env` hiện tại).
3. Từ `denso-wms-frontend`, chạy `npm ci` và `npm run build`, sau đó deploy lại bản build.
4. Tải lại trang bằng `Ctrl+Shift+R` để bỏ cache cũ.
5. Chuyển giữa Light / Dark / System và kiểm tra dashboard, login, popup 3D, trang QR.

## Hạn chế kiểm thử

Kiểm tra nguồn và cú pháp thành công; cần chạy thử UI bằng trình duyệt thực tế trên môi trường
của bạn sau khi deploy để xác nhận rendering đúng trên các thiết bị.
