# DENSO WMS v5.3 — Điều chuyển hàng trực tiếp trên sơ đồ 3D

## Cách sử dụng

1. Mở **Sơ đồ kho 3D** (menu Kệ kho).
2. Bấm **Bật điều chuyển 3D**. Trong chế độ này, click kệ trên mô hình sẽ chọn kệ nguồn, **không chuyển trang**.
3. Chọn **PART** trong kệ nguồn.
4. Chọn kệ đích: có thể click kệ khác trên mô hình nếu cùng Zone đang xem, hoặc chọn từ danh sách để chuyển sang Zone / mã kho khác đã tồn tại.
5. Chọn ô S01–S20 còn trống, hoặc để **Tự chọn ô trống an toàn**.
6. Bấm **Xác nhận điều chuyển**.

## Quy tắc quan trọng

- Chỉ hỗ trợ **chuyển toàn bộ một PART**, không chia một phần số lượng giữa hai kệ.
- Backend thực hiện giao dịch `transfer` trong database transaction: khóa PART, khóa kệ đích, kiểm tra kệ/ô trống và sức chứa. Không thay đổi tồn thực tế khi điều chuyển, chỉ đổi vị trí. Lịch sử ghi đủ nguồn và đích.
- Backend trả về `partSnapshot` sau khi lưu. Frontend sử dụng snapshot đó cập nhật ngay state dùng chung: PART rời kệ/Zone nguồn và xuất hiện tại kệ/Zone đích. Các màn hình khác dùng cùng state sẽ phản ánh thay đổi, không cần reload trang.
- Không được chuyển vào cùng chính ô nguồn. Nếu không chọn ô, backend tự tìm ô còn trống đáp ứng quy tắc kiểm tra tải trọng.
- Không tự tạo kho/Zone/kệ mới: chỉ có thể chuyển đến kệ đã tồn tại trong hệ thống.
- Nút điều chuyển bị khóa trong lúc xử lý để tránh gửi giao dịch lặp.

## Cài đặt

Cập nhật **đồng thời frontend và backend** từ ZIP mới, chạy các lệnh cài đặt và khởi động theo tài liệu gốc. Sao lưu PostgreSQL trước khi triển khai. Không cần chạy migration riêng cho tính năng này.

## Giới hạn kiểm thử

Đã kiểm tra cú pháp JSX và TypeScript của phần thay đổi. Chưa chạy thử end-to-end với PostgreSQL và backend thật trong môi trường này. Sau triển khai, kiểm tra: chuyển cùng kệ khác ô, khác kệ cùng Zone, khác Zone, ô đích đầy, kệ quá tải, PART hết tồn, từ chối truy cập API (401) và đồng bộ ở các tab khác.
