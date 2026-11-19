# MASAN CONSUMER WMS – STAGING READINESS & DEPLOYMENT ARCHITECTURE (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Staging Environment Parity, Secrets Management & Container Readiness  
**Chuyên gia phụ trách**: Principal DevOps & SRE Lead  
**Ngày lập**: 12/11/2026  

---

## 1. SO SÁNH TƯƠNG ĐỒNG GIỮA STAGING VÀ PRODUCTION (ENVIRONMENT PARITY)

Để đảm bảo kết quả kiểm thử trên môi trường Staging phản ánh chính xác 100% hành vi của hệ thống khi Go-Live, kiến trúc môi trường Staging được chuẩn hóa theo ma trận tương đồng sau:

| Thành phần hạ tầng | Môi trường Local / Dev (Hiện tại) | Môi trường Staging (Mục tiêu Phase 5) | Môi trường Production Chính thức | Đánh giá Mức độ Tương đồng |
|---|---|---|---|:---:|
| **Hệ điều hành Host** | Windows 11 Enterprise | Ubuntu Linux 22.04 LTS (Docker) | Ubuntu Linux 22.04 LTS (K8s) | **Đạt chuẩn (Linux container)** |
| **Node.js Runtime** | Node v24.16.0 (Windows) | Node.js v20.x LTS (Docker Alpine) | Node.js v20.x LTS (Docker Alpine) | **Đạt chuẩn LTS** |
| **PostgreSQL Database** | PostgreSQL 18.0 (Localhost:55432) | PostgreSQL 16.x HA Cluster | PostgreSQL 16.x Managed / Cloud HA | **Đạt chuẩn tương thích** |
| **Cơ chế TLS/SSL** | Tắt (`ssl = off`) | TLS 1.3 với Cert Doanh nghiệp nội bộ | TLS 1.3 với Wildcard Cert Masan | **Cần cấp chứng chỉ** |
| **Reverse Proxy** | Không có (Gọi trực tiếp port 5001) | Nginx Reverse Proxy (SSL Offloading) | Nginx Ingress Controller / Cloudflare | **Bắt buộc cấu hình** |
| **Rate Limit Storage** | In-Memory (Bộ nhớ tiến trình) | Redis Cluster v7.x | Redis Cluster v7.x | **Cần bổ sung Redis** |
| **Giám sát & Logs** | Console Stdout / File log phẳng | Prometheus + Grafana + Loki | Datadog / ELK Stack Masan | **Cần tích hợp Agent** |

---

## 2. DANH MỤC BIẾN MÔI TRƯỜNG BẮT BUỘC (ENVIRONMENT VARIABLES AUDIT)

Bảng rà soát các biến môi trường trong file `.env` phục vụ đóng gói container cho Staging:

| Tên biến cấu hình | Giá trị yêu cầu cho Staging | Mục đích & Ràng buộc an ninh |
|---|---|---|
| `NODE_ENV` | `staging` (hoặc `production`) | Kích hoạt tối ưu hóa TypeORM, ẩn stack trace lỗi nhạy cảm |
| `PORT` | `5001` | Cổng dịch vụ backend lắng nghe bên trong container |
| `DB_HOST` | `postgres-staging.masan.internal` | Địa chỉ máy chủ PostgreSQL Staging nội bộ |
| `DB_PORT` | `5432` | Cổng chuẩn PostgreSQL |
| `DB_USERNAME` | `masan_wms_app` | Tài khoản ứng dụng với quyền hạn tối thiểu (Không dùng superuser `postgres`) |
| `DB_PASSWORD` | *[Inject từ Vault / K8s Secret]* | Mật khẩu phức tạp ngẫu nhiên (tối thiểu 32 ký tự) |
| `DB_NAME` | `masan_wms_staging` | Cơ sở dữ liệu Staging riêng biệt |
| `DB_SSL_MODE` | `require` hoặc `verify-ca` | Bắt buộc mã hóa đường truyền tới database |
| `DB_SSL_CA_PATH` | `/etc/ssl/certs/masan-internal-ca.crt` | Đường dẫn file CA chứng thực máy chủ database |
| `DB_POOL_MAX` | `30` | Kích thước pool kết nối database cho mỗi instance |
| `JWT_SECRET` | *[Inject từ Vault / K8s Secret]* | Chuỗi bí mật ký token (HS256/RS256, tối thiểu 256 bits) |
| `JWT_EXPIRES_IN` | `8h` | Thời hạn phiên làm việc của nhân viên ca kho (8 tiếng) |
| `TRUST_PROXY` | `10.0.0.0/8,loopback` | Chỉ định dải mạng của Nginx Ingress để chống giả mạo IP |

---

## 3. THIẾT LẬP REVERSE PROXY NGINX CHO STAGING

Cấu hình mẫu `/etc/nginx/conf.d/masan-wms-staging.conf`:

```nginx
server {
    listen 80;
    server_name wms-staging.masanconsumer.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wms-staging.masanconsumer.com;

    ssl_certificate /etc/ssl/certs/masan-wildcard.crt;
    ssl_certificate_key /etc/ssl/private/masan-wildcard.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Giao diện Frontend tĩnh
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Chuyển hướng API sang Backend
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 5s;
    }
}
```

---

## 4. KIỂM SOÁT TIẾN TRÌNH VÀ TẮT MÁY MỀM DẺO (GRACEFUL SHUTDOWN)

### 4.1. Endpoint Kiểm tra Sức khỏe (Health Probes)
- **Liveness Probe**: `GET /api/health` trả về `{"status":"ok","timestamp":"..."}` kiểm tra tiến trình Node.js còn phản hồi.
- **Readiness Probe**: Cần bổ sung kiểm tra kết nối cơ sở dữ liệu (`SELECT 1;`) trước khi Load Balancer phân bổ lưu lượng người dùng đến node.

### 4.2. Xử lý Tín hiệu Kết thúc (Graceful Shutdown on SIGTERM / SIGINT)
- Khi Kubernetes hoặc PM2 yêu cầu khởi động lại node, tiến trình Node.js phải:
  1. Ngừng nhận HTTP requests mới từ Load Balancer.
  2. Đợi các giao dịch ghi kho (`inventory_transactions`) đang dở dang hoàn tất (timeout 10 giây).
  3. Đóng an toàn connection pool của TypeORM (`dataSource.destroy()`).
  4. Thoát tiến trình với mã exit code 0.
- Mã nguồn hiện tại trong `main.ts` đã bật cờ `app.enableShutdownHooks()`.

---

## 5. KẾT LUẬN MỨC ĐỘ SẴN SÀNG CHO STAGING (STAGING READINESS VERDICT)

- **Đánh giá tổng thể**: **SẴN SÀNG TRIỂN KHAI LÊN STAGING (READY FOR STAGING DEPLOYMENT)**.
- **Điều kiện cần hoàn tất trước khi triển khai**:
  1. Tạo Dockerfile đa tầng (Multi-stage Dockerfile) cho Backend và Frontend.
  2. Chuẩn bị file `.env.staging` với các secret được bảo vệ trong hệ thống CI/CD bí mật.
  3. Đăng ký tên miền nội bộ và chứng chỉ SSL cho môi trường Staging.
