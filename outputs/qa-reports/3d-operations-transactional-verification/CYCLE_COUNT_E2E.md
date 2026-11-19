# BÁO CÁO KIỂM ĐỊNH KIỂM KÊ ĐỊNH KỲ & PHÂN TÁCH TRÁCH NHIỆM (CYCLE COUNT E2E & SoD)
**Hệ thống:** MASAN CONSUMER WMS · TRUNG TÂM ĐIỀU HÀNH KHO 3D  
**Môi trường:** Staging QA Clone (Port API: 5089, Database: PostgreSQL 55434)  
**Ngày kiểm định:** 17/11/2026  
**Trạng thái kiểm định:** **100% PASS**

---

## 1. NGUYÊN TẮC PHÂN TÁCH TRÁCH NHIỆM (SEGREGATION OF DUTIES - SoD)
Quy trình kiểm kê Masan yêu cầu sự độc lập tuyệt đối giữa các vai trò để chống gian lận tồn kho:
1. **SoD 1:** Người đếm Vòng 1 và Người đếm Vòng 2 phải là 2 cá nhân khác nhau (`firstCounter !== secondCounter`).
2. **SoD 2:** Nhân viên kho thông thường không được tự ý mở đợt kiểm kê (chỉ Quản lý kho hoặc Quản trị viên được mở).
3. **SoD 3:** Người tạo phiếu hoặc người tham gia đếm không được tự phê duyệt kết quả kiểm kê (`creator_id` và `counters` không được duyệt).

## 2. KẾT QUẢ THỰC THI KIỂM ĐỊNH

### Kiểm định SoD 1: Trùng người đếm Vòng 1 và Vòng 2
- **Thử nghiệm:** Gửi request mở đợt kiểm kê với `firstCounter = counter1Id` và `secondCounter = counter1Id`.
- **Kết quả:** Backend từ chối ngay lập tức với `400 Bad Request`.
- **Đánh giá:** **PASS**.

### Kiểm định SoD 2: Nhân viên mở đợt kiểm kê trái thẩm quyền
- **Thử nghiệm:** Dùng token của nhân viên vận hành (`staging.staff@masan.local`) gọi `POST /api/inventory/cycle-counts`.
- **Kết quả:** Backend chặn với `403 Forbidden`.
- **Đánh giá:** **PASS**.

### Mở Đợt Kiểm kê Hợp lệ bởi Quản lý Kho
- **Thực thi:** Quản lý kho (`staging.manager@masan.local`) mở đợt kiểm kê cho lô hàng Nam Ngư Nhãn Vàng tại Ô S03.
  - Phân công Người đếm Vòng 1: Nhân viên vận hành (`staging.staff@masan.local`).
  - Phân công Người đếm Vòng 2: Kiểm soát viên tồn kho (`staging.inventory@masan.local`).
- **Kết quả:** `201 Created`, sinh mã đợt kiểm kê `9b46b367-383c-4616-b2c0-a3ae70d9afc8`, trạng thái ban đầu: `FIRST`.

### Tiến hành Đếm 2 Vòng Độc lập
1. **Vòng 1:** Nhân viên vận hành đăng nhập, đếm thực tế và gửi số liệu -> Trạng thái chuyển sang `SECOND`.
2. **Vòng 2:** Kiểm soát viên tồn kho đăng nhập độc lập, đếm thực tế và gửi số liệu -> Trạng thái chuyển sang `REVIEW` (Sẵn sàng đối chiếu).

### Kiểm định SoD 3: Người đếm tự phê duyệt kết quả
- **Thử nghiệm:** Nhân viên vận hành (Người đếm Vòng 1) gọi `POST /api/inventory/cycle-counts/:id/approve`.
- **Kết quả:** Backend chặn nghiêm ngặt với `403 Forbidden` (`"Người tạo hoặc người đếm không được tự duyệt"`).
- **Đánh giá:** **PASS**.

### Phê duyệt Độc lập bởi Quản trị viên (Admin Approval)
- **Thực thi:** Quản trị viên cấp cao (`staging.admin@masan.local`) thực hiện thẩm định và phê duyệt kết quả kiểm kê.
- **Kết quả:**
  - Phản hồi: `201 Created`.
  - Trạng thái phiếu kiểm kê trong CSDL (`cycle_counts`): Chuyển thành `CLOSED`.
  - Tự động ghi nhận nghiệp vụ điều chỉnh kiểm toán (`adjustment`) nếu có chênh lệch.

## 3. KẾT LUẬN
Kiểm soát SoD 3 cấp hoạt động hoàn hảo và bảo vệ tuyệt đối tính trung thực của dữ liệu tồn kho.
