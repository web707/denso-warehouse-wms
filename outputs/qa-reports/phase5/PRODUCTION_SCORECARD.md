# MASAN CONSUMER WMS – PRODUCTION READINESS SCORECARD (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Enterprise Production Readiness Scorecard & Release Evaluation  
**Thời điểm đánh giá**: Kết thúc Phase 5 (12/11/2026)  
**Hội đồng thẩm định**: Principal Enterprise Architect, SRE Lead, Security Engineer, QA Lead, PostgreSQL DBA  

---

## 1. BẢNG ĐIỂM SẴN SÀNG SẢN XUẤT (10 CHIỀU ĐÁNH GIÁ CỐT LÕI)

| STT | Trục Đánh Giá Kỹ Thuật (Dimension) | Điểm số (Thang 10) | Trọng số | Điểm Trọng Số | Hiện trạng Kỹ thuật & Bằng chứng Thực nghiệm | Trạng thái Nghiệm thu |
|:---:|---|:---:|:---:|:---:|---|:---:|
| **1** | **Hiệu năng & Độ trễ (Performance & Latency)** | **8.5** | 15% | 1.28 | Dashboard p95 = 38ms; 100 VU đạt 30.73 RPS, 0 lỗi 429/5xx; 100% 2xx. Tuy nhiên p95 ở 100 VU vẫn đạt 5.1s do bão hòa pool (25 connections) và row lock. | **PASS FOR PILOT** |
| **2** | **Bảo mật & Rate Limiting (Security & Hardening)** | **8.0** | 10% | 0.80 | WmsThrottlerGuard chuẩn hóa quota theo user (600 req/min) và IP login (20 req/min); Brute-force protection chặn chuẩn tại lần 21. Cần Redis khi scale nhiều node. | **PASS** |
| **3** | **Toàn vẹn Tồn kho & Truy xuất (Data Integrity)** | **8.0** | 15% | 1.20 | Bảo toàn 100% số lượng và trọng lượng khi chia tách nhiều bước (TRC-01); Khóa dòng chống over-issue tuyệt đối (TRC-02). Đã cảnh báo rủi ro trùng số Lô giữa các SKU (TRC-04). | **PASS WITH RISK NOTE** |
| **4** | **Tính sẵn sàng cao (High Availability)** | **6.5** | 10% | 0.65 | Node.js backend chạy đơn thực thể (Single Node). Chưa có cấu hình Keepalived / HAProxy hoặc cụm K8s đa vùng. Database chưa cấu hình Streaming Replication. | **PARTIAL** |
| **5** | **Khôi phục Thảm họa (Disaster Recovery & RTO/RPO)**| **7.0** | 10% | 0.70 | Khôi phục thực tế đạt RTO = 27 giây (Mục tiêu < 30 phút -> Đạt). RPO hiện tại phụ thuộc dump hàng ngày (24h), cần WAL archiving để đạt RPO < 15 phút. TLS local tắt. | **PARTIAL** |
| **6** | **Tương thích Thiết bị & PDA (Hardware Integration)**| **5.0** | 10% | 0.50 | Tạo nhãn QR/Barcode tốt. ADB scan thực tế rỗng (BLOCKED). Web UI thiếu global barcode wedge listener cho máy quét laser Zebra/Honeywell. | **BLOCKED ON HARDWARE** |
| **7** | **Khả năng Kiểm toán & Nhật ký (Audit & Compliance)** | **8.5** | 10% | 0.85 | Bảng `inventory_transactions` bất biến, lưu đầy đủ snapshot trước/sau, người dùng, thời gian. Phân quyền RBAC chặn staff giải phóng hàng NG. | **PASS** |
| **8** | **Độ bao phủ Nghiệp vụ Kho (Business Functionality)** | **6.5** | 10% | 0.65 | Đạt xuất sắc các luồng cốt lõi (Nhập, Chuyển 1 phần, Xuất FEFO, Khóa QC, 3D Digital Twin). Còn thiếu nghiệp vụ kho lớn (Đối chiếu PO, Kiểm kê chu kỳ, Trả hàng RMA). | **PASS FOR PILOT** |
| **9** | **Khả năng Giám sát & Vận hành (Observability)** | **7.5** | 5% | 0.38 | Health endpoint `/api/health` hoạt động. Logging ra stdout. Cần bổ sung metric Prometheus và OpenTelemetry APM cho production. | **PASS** |
| **10**| **Môi trường & Đóng gói (Deployment & Staging)** | **7.5** | 5% | 0.38 | Graceful shutdown có sẵn. Biến môi trường chuẩn hóa. Cần hoàn thiện Dockerfile và cấu hình Nginx reverse proxy chính thức. | **PASS** |
|---|---|:---:|:---:|:---:|---|:---:|
| **TỔNG**| **ĐIỂM SẴN SÀNG TOÀN DIỆN (WEIGHTED READINESS)** | | **100%** | **7.39 / 10** | **ĐẠT MỨC SẴN SÀNG CHO PILOT / STAGING** | **CONDITIONAL** |

---

## 2. DANH MỤC BLOCKERS CẦN GIẢI QUYẾT TRƯỚC KHI GO-LIVE FULL PRODUCTION

| Mã Blocker | Phân loại | Mô tả chi tiết vấn đề | Tác động nếu không xử lý | Điều kiện gỡ bỏ Blocker |
|---|---|---|---|---|
| **BLK-01** | **Bảo mật / TLS** | Cơ sở dữ liệu PostgreSQL local đang chạy `ssl = off`. Backend production bắt buộc `DB_SSL_MODE=verify-full`. | Nguy cơ nghe lén dữ liệu (Eavesdropping) hoặc tấn công Man-in-the-Middle trên mạng nội bộ. | Cấp phát chứng chỉ CA và SSL x509 cho máy chủ PostgreSQL Staging/Prod. |
| **BLK-02** | **Dữ liệu / Nghiệp vụ** | Số Lô (`lot_number`) dùng chung cho nhiều SKU khác nhau (TRC-04). | QC chặn xuất một mã lô có thể làm gián đoạn việc xuất kho của các SKU hoàn toàn khác mang cùng số lô. | Thêm ràng buộc `(product_code, lot_number)` và thêm cột `product_code` vào bảng `inspections`. |
| **BLK-03** | **Hạ tầng / DR** | Chưa cấu hình PostgreSQL WAL Archiving. RPO hiện tại là 24 giờ. | Khi sập ổ cứng máy chủ dữ liệu, Masan có thể bị mất trắng toàn bộ dữ liệu giao dịch trong ngày (lên đến 24h). | Thiết lập pgBackRest hoặc script đẩy WAL định kỳ lên S3/MinIO để đảm bảo RPO ≤ 15 phút. |
| **BLK-04** | **Phần cứng / Mobile** | Chưa kiểm thử trên thiết bị máy quét mã vạch công nghiệp thực tế (Zebra / Honeywell PDA). | Nhân viên kho thực địa thao tác chậm hoặc không tương thích cơ chế bắn mã vạch của máy quét. | Triển khai hook `useBarcodeScanner` và chạy kiểm thử chấp nhận (UAT) với ít nhất 2 thiết bị PDA thật tại kho mẫu. |

---

## 3. PHÁN QUYẾT CHÍNH THỨC CỦA HỘI ĐỒNG KIẾN TRÚC (RELEASE VERDICT)

Dựa trên toàn bộ dữ liệu kiểm thử thực nghiệm, đối chiếu mã nguồn và phân tích rủi ro vận hành:

### 1. QUYẾT ĐỊNH CHO MÔI TRƯỜNG STAGING / PILOT:
> **GO FOR CONTROLLED STAGING & PILOT DEPLOYMENT**  
> Hệ thống hoàn toàn đủ điều kiện về mặt kỹ thuật, độ ổn định và tính toàn vẹn tồn kho để triển khai cài đặt lên môi trường **Staging** và tiến hành **Thử nghiệm có kiểm soát (Pilot)** tại một kho mẫu của Masan Consumer (với số lượng nhân viên dưới 20 người, quy mô dưới 5.000 SKU).

### 2. QUYẾT ĐỊNH CHO MÔI TRƯỜNG TOÀN DIỆN ENTERPRISE PRODUCTION:
> **NO-GO FOR FULL DIRECT PRODUCTION ROLLOUT**  
> Nghiêm cấm triển khai thay thế ngay lập tức toàn bộ hệ thống kho chính của Masan Consumer cho đến khi hoàn tất khắc phục 4 Blocker trọng yếu nêu trên (BLK-01 đến BLK-04) và nhận được sự phê chuẩn chính thức của Ban Lãnh đạo Khối Chuỗi cung ứng Masan Consumer.
