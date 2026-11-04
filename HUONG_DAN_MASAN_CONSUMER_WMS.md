# MASAN CONSUMER WMS — BẢN CHUYỂN ĐỔI V6

## 1. Nội dung
- Thiết kế lại màn hình đăng nhập (xanh emerald, dark green, bố cục responsive); không hiển thị tài khoản hay mật khẩu gợi ý.
- Bật lại bảo vệ backend với JWT cho API, frontend dùng phiên đăng nhập, có đăng xuất.
- Cập nhật brand, menu, nội dung lô hàng/SKU/hàng FMCG.
- Dashboard bổ sung luồng hoạt động Masan tham chiếu tài liệu `recomend WMS Masann.docx`.
- Giữ nguyên database, vị trí kho 3D, tồn kho, nhập/xuất và điều chuyển của bản gốc.

## 2. Cấu hình lần đầu
- Backup PostgreSQL trước khi triển khai.
- Tại `denso-wms-backend/` tạo `.env` từ `.env.example` rồi sửa DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME theo database đang dùng.
- Đặt JWT_ACCESS_SECRET và JWT_REFRESH_SECRET thành 2 chuỗi ngẫu nhiên dài và khác nhau trên production.
- `SEED_ADMIN_EMAIL` là email nội bộ cho tài khoản `admin`. `SEED_ADMIN_PASSWORD` là mật khẩu đăng nhập mong muốn.
- Chạy `npm ci`, `npm run migration:run` (nếu DB chưa có migration), sau đó **`npm run setup:admin`** (không reset dữ liệu kho).
- Chạy `npm run start:dev` (hoặc build/start production). Frontend: `npm ci`, `npm run build`; triển khai lại frontend và backend.
- API_BASE_URL frontend phải trỏ đến backend mới. Mọi API được bảo vệ bằng JWT; frontend cũ chưa được cập nhật sẽ nhận 401.
- Đối với Vercel: đặt biến môi trường phía backend trên nơi triển khai backend, không lưu mật khẩu vào biến Vite frontend.

## 3. Tương thích DB
Mã kho `DENSO-WH` trong database/các chỗ tìm kiếm được **giữ nguyên như mã kỹ thuật legacy** để không làm ẩn kệ và tồn kho đang có. Giao diện hiển thị trung tâm `DC-HN-01` theo tài liệu tham khảo Masan. Đây là alias trưng bày, không phải quy hoạch kho vật lý đã được triển khai. Khi muốn thực sự đổi warehouse_code trong DB hãy thực hiện migration có kiểm thử riêng, không thay bừa chuỗi trên các bảng.

## 4. Phạm vi báo cáo tham chiếu
Theo tài liệu người dùng cung cấp: Kokomi, Omachi, CHIN-SU, Nam Ngư, Vinacafé, Wake-up 247; chiến lược FEFO; khu hàng khô/hàng lỏng/kho lạnh tách biệt; luồng Dock nhập → Staging/QC → Kệ → Pick/Pack → Dock xuất. Các phần này là hướng thiết kế, **chưa thay thế thuật toán phân bổ, quy tắc FEFO và quản trị nhiệt độ trong backend**. Chưa đổi format Excel/DB và chưa đưa dữ liệu sản phẩm demo vào DB.

## 5. Bảo mật
Mật khẩu admin không hardcode trong bundle frontend. JWT access token và refresh token lưu ở sessionStorage; đăng xuất xóa local session. Với production, cần dùng mật khẩu mạnh và HTTPS. Đăng ký tự do không được mở; chỉ auth/login, auth/refresh, các luồng reset password và health được bỏ qua global guard. Không có tính năng seed tự động đổi mật khẩu khi khởi động; `setup:admin` là thao tác admin chủ động.

## 6. Kiểm thử cần làm trên môi trường thực
Đăng nhập sai/đúng, logout, tải lại sau login, phiên hết hạn/refresh; nhập → kệ 3D, xuất → giảm tồn, điều chuyển → kệ nguồn/đích; kiểm tra FEFO bằng nghiệp vụ thủ công; không chạy seed --reset trên DB thật.
