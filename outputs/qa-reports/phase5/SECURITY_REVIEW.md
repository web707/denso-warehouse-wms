# MASAN CONSUMER WMS – ENTERPRISE SECURITY & RATE LIMIT REVIEW (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Application Security Audit, Rate Limiting & Identity Architecture Review  
**Chuyên gia phụ trách**: Principal Security Engineer & DevSecOps Lead  
**Ngày lập**: 12/11/2026  

---

## 1. TỔNG QUAN KIẾN TRÚC BẢO VỆ VÀ RATE LIMITING

Trong Phase 4, cơ chế kiểm soát truy cập và bảo vệ lưu lượng đã được tái cấu trúc toàn diện qua bộ lọc tùy biến `WmsThrottlerGuard` (`src/common/guards/wms-throttler.guard.ts`).

### Mô hình phân tầng Rate Limiting hiện tại:

```
[ INCOMING HTTP REQUEST ]
           │
           ▼
[ TRUST_PROXY CHECK ] ──(Đọc header X-Forwarded-For theo cấu hình TRUST_PROXY)
           │
           ▼
[ AUTHENTICATION INSPECTION ]
      ├── (Chưa xác thực - Unauthenticated):
      │       │
      │       ├── Đường dẫn /auth/login: Khóa theo `ip:<client_ip>` ── Quota: 20 req/phút
      │       └── Đường dẫn /auth/forgot-password: Khóa theo `ip:<client_ip>` ── Quota: 10 req/phút
      │
      └── (Đã xác thực - Authenticated JWT):
              │
              └── Tất cả các API nghiệp vụ: Khóa theo `user:<user_id>` ── Quota: 600 req/phút
```

---

## 2. ĐÁNH GIÁ CÁC VẤN ĐỀ AN NINH TRỌNG YẾU (SECURITY FINDINGS)

### 2.1. Nguy cơ Giả mạo IP (IP Spoofing) và Chuỗi Proxy (Trusted Proxy Chain)
- **Hiện trạng cấu hình**: Trong `src/main.ts`, ứng dụng kích hoạt:
  ```typescript
  const trustProxy = configService.get<string>('TRUST_PROXY', 'loopback');
  app.set('trust proxy', trustProxy);
  ```
- **Phân tích rủi ro an ninh**:
  - `loopback` (hoặc `true` / `1`) chỉ đạo Express tin tưởng header `X-Forwarded-For` từ client kết nối trực tiếp.
  - **RỦI RO THỰC TẾ**: Nếu backend WMS được public trực tiếp ra Internet mà **KHÔNG CÓ Reverse Proxy tin cậy** (như Nginx, AWS ALB, Cloudflare) đứng trước để ghi đè header `X-Forwarded-For`, kẻ tấn công có thể chèn header giả:
    ```http
    X-Forwarded-For: 203.0.113.195
    ```
    Khi đó, kẻ tấn công có thể liên tục thay đổi IP giả để vượt qua cơ chế giới hạn 20 req/phút của trang login (Bypass Brute-force Protection).
  - **Khuyến nghị bắt buộc cho Production**:
    1. Bắt buộc đặt WMS backend phía sau Nginx / Traefik / Cloudflare.
    2. Cấu hình Nginx thiết lập rõ ràng:
       ```nginx
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       ```
    3. Cấu hình `TRUST_PROXY` của backend trỏ chính xác về CIDR subnet của Reverse Proxy (ví dụ `10.0.0.0/8` hoặc `172.16.0.0/12`), **tuyệt đối không để `true` hoặc `all` trên production**.

---

### 2.2. Kiểm định Chống tấn công dò mật khẩu (Brute-Force Attack Mitigation)
- **Kết quả kiểm thử thực tế (SEC-BF)**:
  - Chạy 25 yêu cầu đăng nhập dồn dập trong 2 giây từ cùng một IP với tài khoản không tồn tại.
  - Kết quả: Từ request thứ 21, hệ thống lập tức trả về `HTTP 429 Too Many Requests` với thông báo:
    ```json
    {
      "statusCode": 429,
      "message": "ThrottlerException: Too Many Requests"
    }
    ```
  - **Đánh giá**: Cơ chế chặn brute-force hoạt động chính xác và nhạy bén.

---

### 2.3. Quản lý Phiên, Token Hết hạn và Thu hồi Quyền (Session & Token Revocation)
- **Hiện trạng**:
  - Hệ thống sử dụng JSON Web Token (JWT) phi trạng thái (Stateless).
  - Secret key: Lấy từ biến môi trường `JWT_SECRET`.
  - Thời hạn sống của Access Token: Mặc định trong cấu hình.
- **Lỗ hổng kiến trúc (Architectural Gap)**:
  - **Thiếu Blacklist / Token Revocation**: Do JWT là phi trạng thái, khi một nhân viên kho bị thu hồi quyền hoặc quản lý đổi mật khẩu của nhân viên, Access Token cũ của nhân viên đó **vẫn tiếp tục có hiệu lực cho đến khi hết hạn (TTL)**!
  - Trong môi trường kho bãi Masan, nếu một nhân viên bị chấm dứt hợp đồng lao động đột ngột hoặc mất điện thoại di động/PDA, hệ thống chưa thể "hủy phiên ngay lập tức" (Instant Revocation).
- **Khuyến nghị kiến trúc**:
  - Bổ sung cơ chế **Redis Token Blocklist** hoặc trường `token_version` / `password_changed_at` trong bảng `users`. Mỗi khi gọi API, verify xem token có version trùng với version hiện tại của user không.

---

### 2.4. Khả năng Mở rộng Nhiều Thực thể Backend (Multi-Instance Scaling)
- **Hiện trạng**: Bộ lưu trữ của Throttler hiện đang dùng **Bộ nhớ cục bộ (In-Memory Throttler Storage)** của tiến trình Node.js đơn lẻ.
- **Rủi ro khi Scale-Out**:
  - Khi triển khai Masan WMS trên cụm Kubernetes hoặc sau Load Balancer gồm 3 Pods/Nodes:
    - Một user có thể thực hiện 600 req/phút trên Node 1 + 600 req/phút trên Node 2 + 600 req/phút trên Node 3 = Tổng cộng 1.800 req/phút!
    - Kẻ tấn công có thể chia đều luồng brute-force qua các node để không bị kích hoạt 429.
  - Row locking trên PostgreSQL vẫn bảo vệ được database, nhưng cơ chế Rate Limit cấp ứng dụng sẽ bị phân mảnh.
- **Khuyến nghị cho Production**:
  - Tích hợp `@nest-lab/throttler-storage-redis` kết nối cụm Redis tập trung của Masan Consumer để đồng bộ quota trên toàn bộ cụm máy chủ backend.

---

## 3. MA TRẬN PHÂN QUYỀN VAI TRÒ (RBAC AUDIT MATRIX)

Đã đối chiếu logic xác thực và ủy quyền trong toàn bộ controllers và guards:

| Vai trò (Role) | Đăng nhập & Đổi mật khẩu | Tra cứu Tồn & Sơ đồ 3D | Tạo đơn Nhập kho (Inbound) | Chuyển kệ (Transfer) | Xuất kho (Outbound FEFO) | Kiểm định QC (Inspect) | Giải phóng lô lỗi (Override NG) | Quản lý Tài khoản (User CRUD) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **admin** | Có | Có | Có | Có | Có | Có | Có | **Có (Độc quyền)** |
| **warehouse_manager** | Có | Có | Có | Có | Có | Có | **Có (Độc quyền)** | Không |
| **warehouse_staff** | Có | Có | Có | Có | Có | Không | **KHÔNG (Bị chặn 403)** | Không |
| **director** | Có | Có (Chỉ xem) | Không | Không | Không | Không | Không | Không |
| **qc_inspector** (Proposed) | Có | Có | Không | Không | Không | **Có** | Không | Không |

**Đánh giá tuân thủ**:
- Đã kiểm tra thực tế: Tài khoản `warehouse_staff` khi cố tình gọi API giải phóng hàng hỏng (Overriding NG lot) lập tức bị trả về mã lỗi **HTTP 403 Forbidden**.
- Hệ thống tuân thủ chặt chẽ nguyên tắc đặc quyền tối thiểu (Principle of Least Privilege).

---

## 4. BẢNG TỔNG HỢP KIỂM TOÁN AN NINH (SECURITY AUDIT CHECKLIST)

| Hạng mục kiểm tra | Trạng thái | Mức độ rủi ro | Hành động khắc phục |
|---|:---:|:---:|---|
| **SQL Injection** | **PASS** | Thấp | Toàn bộ truy vấn đều qua TypeORM QueryBuilder hoặc tham số hóa `$1, $2` bằng pg driver |
| **Brute-Force Protection** | **PASS** | Thấp | Đã kích hoạt 20 req/phút theo IP trên `/auth/login` |
| **Corporate NAT / Shared IP** | **PASS** | Thấp | Đã tách quota 600 req/phút theo `user:<id>` |
| **Password Hashing** | **PASS** | Thấp | Sử dụng Bcrypt với salt rounds tiêu chuẩn (10) |
| **Role-Based Access Control** | **PASS** | Thấp | Đã phân tách quyền hạn Staff vs Manager |
| **Token Revocation (Logout/Ban)** | **PARTIAL** | **Trung bình** | Cần bổ sung Redis Blocklist cho JWT |
| **Cluster Rate Limit (Multi-node)**| **PARTIAL** | **Trung bình** | Cần chuyển Throttler Storage sang Redis |
| **PostgreSQL Wire TLS** | **BLOCKED** | **Cao** | Cluster PostgreSQL local đang `ssl = off`, cần cấp phát CA cert cho Production |
