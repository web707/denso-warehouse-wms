# MASAN CONSUMER WMS V8.1 – Highlight 3D & Giới hạn 20 kệ/Zone

## 1. Trải nghiệm 3D
- Khi click ô S01–S20 trong trang chi tiết kệ: carton ở ô được chọn giữ màu đậm, viền rõ; hàng ở các ô khác mờ đi. Chọn ô khác để chuyển focus, click lại hoặc nhấn dấu X để bỏ chọn.
- Nội dung tải trọng, mã SKU, số thùng và thao tác điều chuyển nằm trong **panel bên phải**. Đã gỡ popup HTML lớn che vật thể 3D; khi hover chỉ hiện gợi ý nhỏ ở góc trên.
- Sơ đồ toàn Zone cũng dùng nhãn thông tin gọn, không còn popup to che kệ. Trong chế độ điều chuyển, chỉ kệ được chọn nổi bật.

## 2. Vì sao trước đó có 24/20?
Ở bản cũ, khởi tạo sơ đồ kho lấy kệ theo `orderId` nhưng giao diện quản lý Zone tính tất cả kệ cùng `warehouseCode + zoneCode`. Vì vậy nhiều đơn đã từng được khởi tạo kệ riêng có thể tạo ra >20 bản ghi trong một Zone. Con số 24/20 **có thể phản ánh 24 bản ghi thật**, không chỉ là lỗi cách viết chữ.

## 3. Sửa an toàn
- Frontend chỉ hiển thị tối đa 20 **kệ vật lý**, ưu tiên R01–R20. Các bản ghi dư, trùng R01 hoặc R21... sẽ được thông báo riêng kèm số PART và nút mở kiểm tra.
- Backend khởi tạo theo **warehouse + zone**, không tạo 20 kệ mới cho từng đơn, giới hạn tối đa 20, kiểm tra tên R01–R20 và dùng PostgreSQL advisory lock để ngăn nhiều yêu cầu tạo đồng thời vượt giới hạn.
- Kệ vật lý giờ nhận PART thuộc nhiều lô/đơn nếu đạt quy tắc bảo quản và sức chứa. Thuộc tính `orderId` của kệ cũ giữ lại làm liên kết lịch sử (các nghiệp vụ cũ như tự động phân bổ theo đơn vẫn dùng trường này).
- Không có auto-merge/auto-delete; backend chặn xoá kệ còn PART. Nếu bản ghi dư đang chứa hàng, người quản lý phải kiểm tra điều kiện ô đích rồi điều chuyển từng PART trước khi xoá bản ghi rỗng.
- **Không có migration và không xóa database** trong ZIP này. Không tự ghi đè kết nối PostgreSQL.

## 4. Đối chiếu 4 bản ghi dư (ví dụ 24/20)
1. Sao lưu PostgreSQL.
2. Chạy file `AUDIT_KE_DU_TRUNG_ZONE.sql` ở chế độ chỉ đọc; xem tên, ID, đơn hàng và số PART của từng bản ghi.
3. Vào Quản lý Zone / Sơ đồ kho Zone A, kiểm tra cảnh báo kệ dư/trùng và mở từng bản ghi. Đối chiếu với kho thực tế.
4. Nếu có hàng, điều chuyển đến một ô trống hợp lệ trong 20 vị trí chuẩn **sau khi được backend kiểm tra sức chứa**, xác nhận mô hình 3D nguồn/đích.
5. Chỉ khi kệ dư không còn hàng và được xác nhận không phải kệ vật lý độc lập, mới xóa bản ghi dư bằng quy trình quản trị. Không xóa một lúc 4 bản ghi chưa xác minh.

## 5. Kiểm thử
- Chọn S17: chỉ thùng ở S17 đậm, bên phải hiện thông tin S17. Chọn S18: focus chuyển ngay, popup lớn không còn. Bỏ chọn: hiển thị tất cả.
- Kiểm tra Zone A 24 bản ghi: số kệ hiển thị tối đa 20/20, có cảnh báo bản ghi dư/trùng với nút tra cứu, không mất PART liên kết.
- Thử tạo R01 khi đã tồn tại / tạo R21 / thêm kệ thứ 21 / bấm khởi tạo từ đơn mới: backend phải từ chối hoặc không tạo thêm.
- Nhập hàng của lô khác vào một kệ hiện có: vẫn phải qua kiểm tra nhóm bảo quản, vị trí, tải trọng và lịch sử.
- Thử xóa kệ có PART: hệ thống phải từ chối.

## 6. Triển khai
- Cập nhật cả frontend + backend từ bản ZIP này. Giữ nguyên file `.env` và dữ liệu PostgreSQL hiện có.
- Trong mỗi thư mục `denso-wms-frontend` và `denso-wms-backend`, chạy `npm ci` rồi `npm run build`; cần kiểm thử kết nối PostgreSQL và trình duyệt trước khi đẩy production.
- Sau khi deploy, tải lại trang bằng `Ctrl + Shift + R`.
- Không thể kết luận 4 bản ghi nào dư nếu chưa truy cập DB thực tế. **Bản này ngăn phát sinh thêm, cảnh báo minh bạch; không âm thầm xoá tồn kho**.
