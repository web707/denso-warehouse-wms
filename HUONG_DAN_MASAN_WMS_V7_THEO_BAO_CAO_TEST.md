# MASAN CONSUMER WMS V7 — sửa theo báo cáo test

> **Cơ sở:** `báo cáo test.docx`, 5 mục nhận xét trên trang 1–2.

## 1. Nhận diện thương hiệu
- Sidebar sử dụng **MASAN CONSUMER WMS**, tên module theo nghiệp vụ hàng tiêu dùng nhanh.
- Trên trang giao hàng, thay nội dung dành cho lĩnh vực ô tô bằng đại lý/WinMart, lưu ý dữ liệu vận chuyển là nội bộ.
- **Không đổi `DENSO-WH` trong dữ liệu/kỹ thuật** vì mã kho đã là khóa liên kết tới các kệ; đổi nó trực tiếp sẽ làm mất các quan hệ hiện tại. Giao diện hiển thị theo Masan.

## 2. Phân quyền RBAC
Vai trò | Xem dữ liệu | Nhập/Xuất/Điều chuyển | Quản lý SKU/kệ/đơn/giao hàng | Quản lý nhân sự
--- | --- | --- | --- | ---
admin | Có | Có | Có | Có
warehouse_manager | Có | Có | Có | Không
director | Có | Không | Không | Không
warehouse_staff | Có | Có, cùng ghi nhận QC | Không | Không
user (tài khoản cũ) | Có | Không | Không | Không

- Mới: `/users` cho admin, hỗ trợ tạo tài khoản không phải admin, phân vai trò, khóa/mở tài khoản.
- Backend `MasanAccessGuard` chặn ghi trái quyền bằng HTTP 403; frontend ẩn nút thay đổi trên trang giao hàng và nhập/xuất đối với vai trò xem.
- Những trang legacy khác có thể còn hiển thị nút, nhưng backend không cho phép lưu nếu sai vai trò.
- Vẫn cần chuẩn bị email, chính sách cấp quyền/mật khẩu của tổ chức trước khi sử dụng thực tế.

## 3. Giao hàng
- Màn `/shipments` hiện **điều phối giao hàng Masan**, carrierCode, trackingNumber, khách hàng, tình trạng; người quản lý có thể cập nhật thủ công.
- **Chưa tích hợp TMS/carrier API, không có GPS hay trạng thái hãng vận chuyển realtime**. JSON/EDI chỉ là công cụ trao đổi thử nghiệm, không tuyên bố đã kết nối đối tác.

## 4. Kho 3D
- Các kệ có hàng sẽ hiển thị khối màu tương ứng vị trí của PART theo `preferredRackSlot`, mã hàng xác định màu nhất quán.
- Tooltip cho biết mã hàng và số thùng. Khi `preferredRackSlot` chưa được gán, vị trí khối hàng chỉ là **minh họa**, không phải xác nhận vị trí thực tế.
- Không thay đổi dữ liệu vật lý trong database chỉ vì thao tác hiển thị.

## 5. Hàng cũ/mới (FEFO)
- Trang `/fefo`: gom SKU, sắp xếp theo HSD, đề xuất lấy lô gần hạn nhất trước, cảnh báo hết hạn / ≤30 ngày / thiếu HSD.
- **Định nghĩa “cũ/mới” dựa trên HSD**, không dựa trên thời điểm nhập kho (source hiện chưa có ngày sản xuất/nhập theo từng kiện).
- FEFO hiện là **hỗ trợ quyết định**, chưa tự động chọn lô hoặc ngăn xuất lô QC HOLD/NG tại transaction API. Cần quy tắc kiểm định, batch/reservation riêng để chặn cứng.

## Nâng cấp bản đã chạy (không xóa dữ liệu)
1. Sao lưu database PostgreSQL thật trước khi nâng cấp.
2. Cập nhật source backend và frontend, bảo đảm `.env` backend giữ đúng DB hiện hữu (không ghi đè file `.env`).
3. Tại `denso-wms-backend` chạy `npm ci`, sau đó `npm run migration:run`; hoặc chạy `UPGRADE_MASAN_V7.bat` trên Windows.
4. Build/deploy lại backend (JWT/RBAC) **và** frontend. Đăng nhập tài khoản admin hiện hữu; không tạo lại nếu đã có.
5. Vào `/users` tạo quản lý kho, giám đốc, nhân viên. Kiểm thử GET/POST/PATCH/DELETE với từng tài khoản trước khi đưa vào vận hành.
6. Vào `/fefo` đối chiếu các lô có HSD, rồi mở sơ đồ 3D kiểm tra hàng đặt trên kệ đúng với `preferredRackSlot`.
7. Nếu lần đầu cấu hình, thiết lập email và mật khẩu quản trị bí mật trong `.env`; tuyệt đối không đưa mật khẩu vào frontend hoặc repository.

## Giới hạn kiểm thử
- Đã kiểm tra cú pháp source; không thử nghiệm kết nối với database PostgreSQL production và chưa tích hợp hãng vận chuyển thật.
- Trước khi deploy chính thức cần chạy `npm run build` cho cả hai dự án và kiểm thử end-to-end với database sao lưu.
