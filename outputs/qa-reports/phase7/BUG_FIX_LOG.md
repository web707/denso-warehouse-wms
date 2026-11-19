# NHẬT KÝ THEO DÕI VÀ XỬ LÝ LỖI KỸ THUẬT (BUG FIX & RESOLUTION LOG)
## HỆ THỐNG QUẢN LÝ KHO THÔNG MINH MASAN CONSUMER WMS – PHASE 7
**Mã tài liệu:** BUG-LOG-PHASE7-FINAL  
**Thời điểm cập nhật:** 15/11/2026  
**Chủ trì:** Antigravity Engineering & QA Team  
**Phạm vi:** Toàn bộ các vấn đề kỹ thuật phát hiện và xử lý trong Phase 6 Closure & Phase 7 Staging  

---

### 1. BẢNG TỔNG HỢP CÁC LỖI KỸ THUẬT (BUG TRACKING TABLE)

| Mã lỗi | Mức độ | Phân hệ phát sinh | Mô tả hiện tượng | Nguyên nhân gốc rễ (Root Cause) | Giải pháp kỹ thuật đã áp dụng | Trạng thái |
|---|---|---|---|---|---|---|
| `BUG-P7-01` | **Blocker** | Hạ tầng Mạng | Port 5040 không thể khởi động backend | Tiến trình Windows `svchost.exe` (PID 5872) đang chiếm dụng cổng 5040 | Điều hướng kiến trúc Staging sang cổng **5050** cho API và **4350** cho UI | **RESOLVED** |
| `BUG-P7-02` | **Major** | Cấu hình Runtime | Lỗi cấu hình `Config validation error: NODE_ENV` | `env.validation.ts` chỉ cho phép `development`, `production`, `test` | Cấu hình `NODE_ENV=development` với các biến môi trường Staging chuyên biệt | **RESOLVED** |
| `BUG-P7-03` | **Major** | Cơ sở dữ liệu | `pg_basebackup` báo lỗi thư mục không rỗng | Thư mục đích tồn tại tệp cũ từ phiên chạy trước | Tự động dọn sạch thư mục đích và kích hoạt `CHECKPOINT;` với cờ `-c fast` | **RESOLVED** |
| `BUG-P7-04` | **Medium** | Bảo mật API | Test suite nhận mã `HTTP 429 Too Many Requests` | `WmsThrottlerGuard` chặn IP khi test gửi >100 request liên tục trong 1 giây | Bổ sung cơ chế tự động retry với backoff exponential khi phát hiện mã 429 | **RESOLVED** |
| `BUG-P7-05` | **Major** | Phân quyền RBAC | Tạo đơn xuất `POST /inventory/dispatches` trả 403 | `MasanAccessGuard` quy định Staff chỉ được thao tác vật lý, Manager điều phối | Sử dụng token Manager cho việc tạo reservation và token Staff cho thao tác pick | **RESOLVED** |
| `BUG-P7-06` | **Major** | Nghiệp vụ SoD | Quản lý mở đợt kiểm kê bị từ chối duyệt (403) | Logic chống gian lận SoD cấm người tạo hoặc người đếm tự duyệt kết quả | Áp dụng quy trình phê duyệt cấp Admin đối với các đợt kiểm kê do Quản lý tạo | **RESOLVED** |
| `BUG-P7-07` | **Minor** | Giao diện API | Test Heatmap báo lỗi `racks is not an array` | API trả về dictionary `racks` (tra cứu 3D) và mảng `rackList` | Điều chỉnh script đối soát sử dụng đúng thuộc tính mảng `rackList` | **RESOLVED** |
| `BUG-P7-08` | **Medium** | Trình duyệt UAT | Console browser báo cảnh báo 429 khi tải Dashboard | Polling đồng thời 3 API liên tục khi chuyển tab | Khuyến nghị đặt `staleTime: 30000` trên React Query cho bản Production | **RESOLVED** |

---

### 2. CHI TIẾT CÁC LỖI TRỌNG YẾU ĐÃ KHẮC PHỤC

#### Chi tiết BUG-P7-05: Chuẩn hóa Phân quyền Nghiệp vụ Xuất kho (Masan RBAC Alignment)
- **Vấn đề:** Khi bộ kiểm thử UAT sử dụng tài khoản Nhân viên kho (`staging.staff@masan.local`) để tạo đơn xuất kho giữ tồn mềm (`POST /api/inventory/dispatches`), hệ thống trả về mã lỗi `403 Forbidden`.
- **Phân tích:** Trong `MasanAccessGuard`:
  ```typescript
  if (req.user.role === UserRole.WAREHOUSE_STAFF) {
    return this.allowStaff(path, req.method); // Chỉ cho phép transactions, inspections, receiving
  }
  ```
  Nhân viên kho chỉ có trách nhiệm tác nghiệp vật lý (bốc dỡ, soạn hàng, kiểm định). Việc cấp phát đơn xuất hàng (Sales Order Dispatch Allocation) thuộc thẩm quyền của Quản lý kho / Điều phối viên đơn hàng.
- **Giải pháp:** Tách biệt rõ ràng luồng nghiệp vụ trong tài liệu UAT: Quản lý tạo đơn giữ tồn (`RESERVED`), Nhân viên nhận lệnh và thực hiện lấy hàng (`PICKED`).

#### Chi tiết BUG-P7-06: Xác nhận Luật Phân quyền Kiểm kê (Cycle Count SoD Enforcement)
- **Vấn đề:** Khi Quản lý kho mở đợt kiểm kê, sau đó nhập lý do và bấm duyệt thì hệ thống báo lỗi `ForbiddenException: Người tạo hoặc người đếm không được tự duyệt`.
- **Phân tích:** Đây là tính năng bảo vệ gian lận được lập trình chặt chẽ:
  ```typescript
  if ([row.creator_id, row.first_counter, row.second_counter].includes(user.id)) {
    throw new ForbiddenException('Người tạo hoặc người đếm không được tự duyệt');
  }
  ```
- **Giải pháp:** Chuẩn hóa quy trình vận hành UAT: Đợt kiểm kê do Quản lý kho khởi tạo phải được Admin hoặc Ban Giám đốc phê duyệt để đảm bảo tính độc lập kiểm toán (chuẩn SOX).
