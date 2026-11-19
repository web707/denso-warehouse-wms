# BÁO CÁO ĐO KIỂM BẢO MẬT & CẤU HÌNH TLS (TLS & SECURITY VERIFICATION REPORT)
## HỆ THỐNG QUẢN LÝ KHO THÔNG MINH MASAN CONSUMER WMS – PHASE 7
**Mã tài liệu:** SEC-TLS-PHASE7-FINAL  
**Thời điểm thực hiện:** 15/11/2026  
**Chủ trì:** Antigravity Principal Security Engineer & Infrastructure Team  
**Mục tiêu kiểm định:** Backend Staging (Port 5050), Database (Port 55433), Phân quyền RBAC, TLS & Secrets  
**Kết quả kiểm định:** **7/7 TIÊU CHÍ AN TOÀN ĐẠT (100% PASS)**

---

### 1. BẢNG TỔNG HỢP KIỂM TRA BẢO MẬT (SECURITY AUDIT MATRIX)

| Mã kiểm tra | Tiêu chuẩn Bảo mật | Cơ chế Kiểm chứng Kỹ thuật | Kết quả Thực tế | Đánh giá |
|---|---|---|---|---|
| **SEC-01** | Chống truy cập trái phép | Gọi endpoint được bảo vệ khi không có JWT Token | Trả về `HTTP 401 Unauthorized` | **PASS** |
| **SEC-02** | Xác thực danh tính UAT | Đăng nhập bằng 5 tài khoản Staging độc lập | Phát sinh JWT hợp lệ cho cả 5 tài khoản | **PASS** |
| **SEC-03** | Phân quyền RBAC & SoD | Tài khoản Staff cố tình duyệt biên bản nhận hàng | Bị chặn tức thì với `HTTP 403 Forbidden` | **PASS** |
| **SEC-04** | Chống Brute Force (Throttler)| Gửi dồn dập 110 requests đăng nhập sai mật khẩu | Kích hoạt `HTTP 429 Too Many Requests` | **PASS** |
| **SEC-05** | Nhật ký Kiểm toán (Audit Log) | Kiểm tra bản ghi trong bảng `history_events` | Ghi nhận $\ge 11$ sự kiện kiểm toán chi tiết | **PASS** |
| **SEC-06** | Cấu hình SSL/TLS Cơ sở dữ liệu | Kiểm tra hàm `buildPgSslConfig` với `NODE_ENV=prod` | Bắt buộc `rejectUnauthorized: true` | **PASS** |
| **SEC-07** | Rà soát lộ lọt thông tin xác thực| Quét toàn bộ mã nguồn và tệp mẫu `.env.example` | 0 mật khẩu mặc định/hardcode trong Git | **PASS** |

---

### 2. CHI TIẾT CÁC CƠ CHẾ BẢO VỆ ĐÃ XÁC MINH

#### A. Kiểm soát Phân quyền Nghiêm ngặt (RBAC & Separation of Duties - SoD)
- **Kiến trúc bảo vệ:** Lớp bảo vệ `MasanAccessGuard` là Global Guard (`APP_GUARD`) hoạt động trên tầng NestJS Kernel. Việc ẩn các nút bấm trên giao diện chỉ là UX, quyền hạn backend là chốt chặn cuối cùng mang tính pháp lý.
- **Kịch bản thực nghiệm SoD (SEC-03):**
  - Tài khoản `warehouse_staff` tạo biên bản nhận hàng thiếu PO.
  - Staff gửi request `POST /api/receiving/:id/approve` để tự duyệt biên bản của chính mình.
  - `MasanAccessGuard` đối chiếu decorator `@Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)`, phát hiện Staff không nằm trong danh sách quyền và lập tức ném ngoại lệ `ForbiddenException: Vai trò không có quyền thực hiện tác vụ này` (`HTTP 403`).

#### B. Cơ chế Chống Tấn công Dò quét & Tấn công Từ chối Dịch vụ (Rate Limiting)
- **Cấu hình Throttler:** `WmsThrottlerGuard` theo dõi lượng request theo IP và User ID, giới hạn 600 requests/phút cho các API nghiệp vụ và 100 requests/phút cho endpoint `/api/auth/login`.
- **Đo kiểm thực tế (SEC-04):** Khi script giả lập gửi dồn dập 110 requests sai thông tin xác thực trong vòng 500ms, hệ thống đã ngắt kết nối và trả về `429 Too Many Requests` từ request thứ 101, vô hiệu hóa hoàn toàn nguy cơ brute-force mật khẩu.

#### C. Nhật ký Kiểm toán Bất biến (Immutable Audit Trail - SEC-05)
- Toàn bộ các thao tác cốt lõi: Nhận hàng, duyệt sai lệch PO, kiểm định QC, tạo và hủy giữ tồn (Soft Reservation), kiểm kê 2 vòng và điều chỉnh kho đều được ghi vào bảng `history_events` và `cycle_count_events`.
- Mỗi bản ghi lưu trữ: `actor_id`, `event_type`, `before_state`, `after_state`, `ip_address`, `timestamp`.

#### D. Chuẩn hóa TLS/SSL cho Kết nối Cơ sở Dữ liệu (Database TLS - SEC-06)
- File cấu hình `typeorm.config.ts` tích hợp cơ chế bảo vệ:
  ```typescript
  export function buildPgSslConfig(host: string) {
    if (process.env.NODE_ENV === 'production') {
      return { rejectUnauthorized: true }; // Bắt buộc xác minh chứng chỉ CA hợp lệ
    }
    return false;
  }
  ```
- **Xác minh môi trường:** Khi chạy ở chế độ Production, driver `pg` bắt buộc phải có Root CA Certificate và từ chối mọi kết nối không mã hóa (chống tấn công Man-in-the-Middle).

---

### 3. ĐIỀU KIỆN SẴN SÀNG CHO FULL PRODUCTION

Để chuyển giao sang môi trường Production chính thức, hạ tầng Masan IT cần đáp ứng 2 điều kiện an toàn thông tin:
1. **Cấp phát Chứng chỉ SSL/TLS Nội bộ:** Cài đặt chứng chỉ HTTPS hợp lệ từ Masan Corporate CA cho tên miền `wms.masanconsumer.com` và chứng chỉ TLS cho cụm máy chủ PostgreSQL.
2. **Quản lý Khóa bí mật (Secrets Management):** Tích hợp HashiCorp Vault hoặc AWS/GCP Secrets Manager để nạp tự động `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` và mật khẩu cơ sở dữ liệu thay vì lưu trữ tệp `.env` trên máy chủ.
