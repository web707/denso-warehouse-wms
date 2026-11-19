# MASAN CONSUMER WMS – DISASTER RECOVERY & POSTGRESQL TLS AUDIT (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Disaster Recovery, Automated Backup Strategy, RTO/RPO Metrics & TLS Audit  
**Chuyên gia phụ trách**: Principal Infrastructure Architect & PostgreSQL DBA  
**Ngày lập**: 12/11/2026  

---

## 1. KIỂM TOÁN MÃ HÓA ĐƯỜNG TRUYỀN POSTGRESQL (TLS / SSL WIRE AUDIT)

### 1.1. Hiện trạng cụm cơ sở dữ liệu thực tế
Tiến hành kiểm tra trực tiếp cụm PostgreSQL trên cổng `55432`:
```sql
SHOW ssl;
```
- **Kết quả trả về**: `off`.
- **Trạng thái thực tế**: Cụm PostgreSQL local đang chạy trong môi trường phát triển với cờ SSL bị tắt trong file cấu hình `postgresql.conf`.

### 1.2. Đánh giá mã nguồn Backend (`denso-wms-backend/src/config/typeorm.config.ts`)
Mã nguồn backend sau Phase 4 đã được chuẩn hóa qua hàm `buildPgSslConfig()`:
```typescript
export function buildPgSslConfig(env: NodeJS.ProcessEnv): SslConfig {
  const mode = (env.DB_SSL_MODE || 'disable').toLowerCase();
  const isProd = env.NODE_ENV === 'production';
  if (isProd && (mode === 'disable' || mode === 'allow' || mode === 'prefer')) {
    throw new Error('Production environment strictly forbids unencrypted database connections (DB_SSL_MODE must be require, verify-ca, or verify-full)');
  }
  // ... cấu hình chứng chỉ CA và rejectUnauthorized: true
}
```

### 1.3. Kết luận về TLS cho Production: **BLOCKED / NOT VERIFIED ON HOST**
- **Lý do**: Không có hạ tầng Public Key Infrastructure (PKI) và chứng chỉ SSL x509 thực tế trên máy trạm Windows phát triển này.
- **Điều kiện tiên quyết để đạt chuẩn Production**:
  1. Cung cấp file chứng chỉ CA doanh nghiệp của Masan (`root-ca.crt`).
  2. Bật `ssl = on` trong `postgresql.conf` của máy chủ DB chính thức.
  3. Cấp phát cặp khóa `server.crt` và `server.key` với Subject Alternative Name (SAN) trùng khớp với DNS của database.
  4. Cấu hình biến môi trường trên máy chủ ứng dụng:
     ```env
     DB_SSL_MODE=verify-full
     DB_SSL_CA_PATH=/etc/ssl/certs/masan-root-ca.crt
     ```

---

## 2. THIẾT KẾ QUY TRÌNH SAO LƯU TỰ ĐỘNG (AUTOMATED BACKUP STRATEGY)

Hệ thống sao lưu cho môi trường Enterprise được thiết kế theo mô hình 3-2-1:
- **3 bản sao** dữ liệu.
- **2 loại phương tiện** lưu trữ khác nhau (Local NVMe + Cloud Object Storage S3/MinIO).
- **1 bản sao offsite** tại Data Center dự phòng (DR Site).

### 2.1. Script sao lưu tự động định kỳ (Linux / Windows Cron)
```bash
#!/bin/bash
# MASAN CONSUMER WMS - AUTOMATED BACKUP SCRIPT
set -eo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/masan-wms"
DUMP_FILE="${BACKUP_DIR}/wms_prod_${TIMESTAMP}.dump"
GPG_FILE="${DUMP_FILE}.gpg"

mkdir -p "${BACKUP_DIR}"

# 1. Thực hiện pg_dump định dạng custom (-Fc) kèm checksum
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -Fc -b -v -f "${DUMP_FILE}"

# 2. Mã hóa dữ liệu bằng chuẩn AES-256 (GPG)
gpg --symmetric --cipher-algo AES256 --batch --passphrase "${BACKUP_ENCRYPTION_KEY}" -o "${GPG_FILE}" "${DUMP_FILE}"
rm -f "${DUMP_FILE}"

# 3. Tạo SHA-256 Checksum
sha256sum "${GPG_FILE}" > "${GPG_FILE}.sha256"

# 4. Đẩy file lên S3 / Object Storage an toàn
aws s3 cp "${GPG_FILE}" "s3://masan-wms-dr-backups/daily/${GPG_FILE}"

# 5. Dọn dẹp bản sao lưu cũ theo chính sách Retention
find "${BACKUP_DIR}" -name "wms_prod_*.dump.gpg" -mtime +7 -delete
```

### 2.2. Chính sách Lưu giữ Bản sao lưu (Retention Policy: GFS - Grandfather-Father-Son)
- **Hàng ngày (Son)**: Giữ trong 7 ngày gần nhất.
- **Hàng tuần (Father)**: Giữ 4 bản cuối mỗi tuần trong 1 tháng.
- **Hàng tháng (Grandfather)**: Giữ 12 bản cuối mỗi tháng trong 1 năm.
- **Hàng năm (Archive)**: Giữ 3 bản sao lưu cuối năm phục vụ kiểm toán tài chính và pháp lý nhà nước.

---

## 3. THỰC NGHIỆM KHÔI PHỤC THỰC TẾ VÀ ĐO LƯỜNG RTO (RECOVERY TIME OBJECTIVE)

Trong Phase 4 và Phase 5, bài kiểm tra khôi phục thảm họa thực tế đã được tiến hành trên cơ sở dữ liệu `wms_phase4_restore_test`:
1. File Dump nguồn: `work/phase4-pretest.dump` (Kích thước: 3.42 MB, SHA-256: `C6955724E9F40FDA2D385E1CE33C655CC8F0FB45936E864D712D05E010C3DCB6`).
2. Thời gian khôi phục đo bằng đồng hồ thực tế:
   - Tạo database trắng: 1.2 giây.
   - Lệnh `pg_restore -Fc`: **24.8 giây**.
   - Chạy migration 14: 0.9 giây.
   - **TỔNG THỜI GIAN KHÔI PHỤC (RTO ĐO ĐƯỢC)**: **~27 GIÂY**.
3. **Độ chính xác dữ liệu sau khôi phục**:
   - `parts`: 10.140 dòng (Khớp 100%).
   - `containers`: 331 dòng (Khớp 100%).
   - `inspections`: 10.415 dòng (Khớp 100%).
   - `inventory_transactions`: 50.663 dòng (Khớp 100%).

---

## 4. ĐÁNH GIÁ CHỈ SỐ RTO VÀ RPO CẤP DOANH NGHIỆP

> [!IMPORTANT]
> **ĐÁNH GIÁ ĐẠT / KHÔNG ĐẠT MỤC TIÊU DOANH NGHIỆP**:
> - **RTO (Recovery Time Objective - Thời gian gián đoạn tối đa cho phép)**:
>   - Mục tiêu doanh nghiệp đề xuất: **≤ 30 phút**.
>   - Kết quả đo lường thực tế: **27 giây** (cho dữ liệu) + **3 phút** (cho khởi động ứng dụng và container).
>   - **KẾT LUẬN RTO**: **ĐẠT (PASS)**.
> - **RPO (Recovery Point Objective - Khối lượng dữ liệu tối đa chấp nhận bị mất khi gặp sự cố)**:
>   - Mục tiêu doanh nghiệp đề xuất: **≤ 15 phút**.
>   - Hiện trạng với cơ chế pg_dump định kỳ 1 lần/ngày: **RPO LÊN ĐẾN 24 GIỜ**!
>   - **KẾT LUẬN RPO**: **CHƯA ĐẠT (GAP CẦN KHẮC PHỤC)**.

### GIẢI PHÁP ĐẠT CHUẨN RPO ≤ 15 PHÚT:
Để đạt chỉ tiêu RPO ≤ 15 phút cho Masan Consumer, hạ tầng bắt buộc phải cấu hình:
1. **PostgreSQL WAL Archiving**:
   ```ini
   wal_level = replica
   archive_mode = on
   archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f'
   archive_timeout = 300 # Tự động cắt WAL file mỗi 5 phút (đảm bảo RPO tối đa 5 phút)
   ```
2. **Point-in-Time Recovery (PITR) Tooling**: Triển khai công cụ chuẩn công nghiệp như **pgBackRest** hoặc **WAL-G** đồng bộ liên tục log WAL lên S3/Cloud Storage. Khi xảy ra sự cố hỏng ổ cứng, hệ thống có thể tua lại dữ liệu chính xác đến từng microsecond trước thời điểm thảm họa.
