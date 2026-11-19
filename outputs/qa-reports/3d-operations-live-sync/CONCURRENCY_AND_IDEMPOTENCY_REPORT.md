# BÁO CÁO KIỂM TRA ĐỒNG THỜI VÀ TÍNH LŨY QUYỀN (CONCURRENCY & IDEMPOTENCY)
**Ngày thực hiện:** 17/11/2026  
**Mục tiêu:** Đảm bảo hệ thống không bị lỗi dữ liệu (Race conditions, Lost updates, Double spending) khi nhiều người dùng cùng thao tác đồng thời.

---

## 1. Kết quả kiểm định các tình huống xung đột

### 1.1. Double Pick (Gửi lệnh xác nhận soạn hàng 2 lần liên tiếp)
- **Mục tiêu:** Ngăn chặn việc nhân viên bấm nút nhiều lần dẫn đến việc trừ tồn kho hai lần cho cùng một mặt hàng.
- **Thực thi:** Gửi liên tiếp 2 request `POST /api/inventory/dispatches/:id/pick`.
- **Kết quả:** Request đầu tiên hoàn tất chuyển trạng thái thành `PICKED`. Request thứ hai được hệ thống xử lý an toàn (Idempotent), không gây lỗi hệ thống và không tạo thêm bản ghi trừ tồn sai lệch.

### 1.2. Over-Allocation (Bảo vệ chống xuất vượt tồn kho)
- **Mục tiêu:** Ngăn chặn việc tạo đơn xuất hàng khi tồn khả dụng không đủ.
- **Thực thi:** Gửi yêu cầu tạo đơn xuất với số lượng `999,999 PCS` cho SKU `DQA-NAMNGU-VANG`.
- **Kết quả:** Backend từ chối ngay lập tức với mã HTTP **400 Bad Request** kèm thông báo lỗi tồn kho không đủ. Tồn kho trong cơ sở dữ liệu hoàn toàn không bị ảnh hưởng.

### 1.3. Staff RBAC Enforcement
- **Mục tiêu:** Kiểm soát chặt chẽ phân quyền vai trò.
- **Thực thi:** Sử dụng token của Nhân viên kho (`staging.staff`) để gọi API tạo đơn xuất kho `POST /api/inventory/dispatches`.
- **Kết quả:** Backend trả về mã HTTP **403 Forbidden**. Nhân viên kho không thể vượt quyền của Trưởng kho.

---

## 2. Idempotency Key Trong Giao Dịch WMS
Hệ thống bắt buộc sử dụng `Idempotency-Key` trong HTTP Header đối với các giao dịch tạo đơn xuất kho. Khi nhận được cùng một key trong khoảng thời gian hiệu lực, hệ thống trả về kết quả đã xử lý thay vì tạo đơn trùng lặp.
