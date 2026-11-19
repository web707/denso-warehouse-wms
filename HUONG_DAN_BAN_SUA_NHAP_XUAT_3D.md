# DENSO WMS — bản sửa nhập/xuất kho và đồng bộ 3D

## Những thay đổi

- `InventoryOperations`: kiểm tra dữ liệu đầu vào, yêu cầu kệ khi nhận PART chưa định vị, hiển thị lỗi trực tiếp; tránh double submit.
- Backend `POST /api/inventory/transactions`: vẫn cập nhật phần tồn và ghi sổ trong **một database transaction**. Response bổ sung `partSnapshot` gồm tồn kho và vị trí **sau khi lưu**. Tự tìm ô S01–S20 chưa dùng khi nhập vào kệ chưa chọn ô (có lock trên hàng kệ); báo lỗi nếu kệ đầy.
- Store React áp dụng `partSnapshot` ngay khi HTTP thành công; bảng kệ và cảnh kho 3D đọc cùng state, không phải đợi `resetData()` gọi lại 5 API.
- Kệ 3D/khung kho mặc định hiển thị **tồn kho** thay vì Heatmap thống kê giao dịch. Vẫn có nút bật Heatmap. Khi giao dịch thành công Heatmap tự tải mới.
- Cửa sổ khác cùng trình duyệt nhận sự kiện `storage` để đồng bộ tồn kho; trên trang chi tiết kệ, plan tự tải lại khi tồn kho thay đổi.
- Form tạo/sửa PART: bổ sung Division và DC Prefix dạng danh sách hợp lệ, thông báo lỗi khi lưu thay vì promise rejection. Không tự tạo Division giả.
- Client: bỏ email/mật khẩu quản trị hardcode trong JavaScript. Bản backend đi kèm hiện dùng public guard; nếu backend trên host khác bật JWT thì phải cấu hình auth đúng, **không tự bỏ xác thực ở server đang hoạt động**.

## Cách cập nhật

1. **Sao lưu PostgreSQL** trước khi triển khai; không xóa hay khởi tạo lại database.
2. Thay **cả** frontend và backend bằng 2 thư mục trong ZIP. Chỉ thay frontend mà chưa cập nhật backend sẽ không có `partSnapshot` nên không đồng bộ tức thời.
3. Giữ lại `.env` đang sử dụng trên máy chủ (không đè bằng `.env.example`). Kiểm tra `VITE_API_BASE_URL` và proxy `/api` trỏ về backend bản mới. Cài dependency, build và khởi động lại hai dịch vụ bằng script hiện có.
4. Nếu DevTools còn báo HTTP `401`: backend đang chạy **không giống** public guard ở ZIP này hoặc reverse proxy đang từ chối. Kiểm tra response, URL, phiên bản deploy, config auth; không tự ý tắt cơ chế bảo vệ của hệ thống khác.
5. Tải lại trang, thử nhập PART vào kệ S01 (hoặc để auto), xuất một phần, xuất hết, điều chuyển, xem kho 3D. Chế độ Tồn kho thể hiện mức dùng; Heatmap là thống kê giao dịch, không phải biểu diễn tồn thực.

## Giới hạn cần lưu ý

- Thử nghiệm trong phiên này là kiểm tra cú pháp các file đã sửa. Không có `node_modules` và PostgreSQL trong gói ZIP, nên chưa chạy được integration/e2e với backend thật.
- Cập nhật 'ngay lập tức' là **ngay khi API commit xong và trả kết quả**, không thể hiển thị trước khi server xác nhận. Tab khác trong cùng trình duyệt sẽ refetch sau sự kiện.
- Form `Shipments` trong mục chứng từ vận chuyển dùng Item Number/LOT và chưa liên kết định danh PART duy nhất. Tạo một chứng từ Shipment **không tự trừ kho** để tránh xuất nhầm hoặc trừ hai lần. Ghi nhận xuất thực tế ở mục Nhập · Xuất · Điều chuyển.
- `manifest.json` syntax error trong screenshot là lỗi PWA/host riêng, không phải nguyên nhân trực tiếp của nghiệp vụ nhập/xuất.
