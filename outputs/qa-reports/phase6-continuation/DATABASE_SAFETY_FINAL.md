# MASAN CONSUMER WMS – DATABASE SAFETY & MIGRATION VERIFICATION (PHASE 6)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Database Safety Audit, Migration 13 → 15 Lifecycle & Environment Isolation Runbook  
**Thời điểm thực hiện**: 13/11/2026  
**Chuyên gia phụ trách**: Principal Software Architect, PostgreSQL DBA & Senior QA Lead  

---

## 1. TRẢ LỜI TRỰC DIỆN 7 CÂU HỎI THEO YÊU CẦU

### Câu hỏi 1: Database chính và demo đã được phân tách an toàn chưa?
> **TRẢ LỜI**: **ĐÃ PHÂN TÁCH AN TOÀN TUYỆT ĐỐI (100% ISOLATED)**.
> - **Môi trường Demo trực quan (cổng 4310)**: Chạy qua Vite với cờ `--mode demo`, proxy độc quyền đến backend cổng **5032** (PID 19816). Backend này chỉ kết nối duy nhất vào cơ sở dữ liệu `wms_dashboard_demo_test` (đã có 15 migration, 100 part, 12 kệ, có nhãn DEMO / QA trên UI). Backend 5032 có guard chặn không cho phép khởi động nếu cấu hình trỏ vào `wms_demo` hoặc `NODE_ENV=production`.
> - **Môi trường chính cũ (cổng 5001)**: Đang chạy backend PID 14896 trỏ vào database `wms_demo` (13 migration, 0 part, 0 kệ). Giao diện 4310 hoàn toàn không gọi vào 5001.

### Câu hỏi 2: Có cần nâng cấp `wms_demo` ngay không?
> **TRẢ LỜI**: **CHƯA CẦN NÂNG CẤP NGAY LẬP TỨC (HOLD MIGRATION ON WMS_DEMO)**.
> - Database `wms_demo` hiện tại có 0 part, 0 kệ, 0 giao dịch (chưa chứa dữ liệu vận hành sản xuất).
> - Để đảm bảo nguyên tắc an toàn Zero Risk, việc chạy migration lên `wms_demo` phải tuân theo Runbook bảo trì có phê duyệt, đồng bộ cùng lúc với việc cập nhật bản build backend 5001 để tránh tình trạng lệch schema/API.

### Câu hỏi 3: Migration 13 → 15 đã được thử an toàn trên QA chưa?
> **TRẢ LỜI**: **ĐÃ THỬ NGHIỆM VÀ XÁC MINH TOÀN DIỆN (FULL LIFECYCLE PASS)**.
> - Đã tạo bản sao độc lập `wms_upgrade_test_clone` từ đúng template của `wms_demo` (Migration 13).
> - Chạy `migration:run`: Nâng cấp thành công 13 → 14 (`AddPerformanceIndexes`) → 15 (`AddInventoryLotIdentity`). Bảng `inventory_lots`, khóa ngoại `lot_id` và trigger `parts_assign_lot_identity` được tạo chuẩn xác.
> - Chạy `migration:revert`: Rollback thành công từ 15 về 14.
> - Chạy `migration:run` lần 2: Tái áp dụng từ 14 lên 15 thành công không lỗi.

### Câu hỏi 4: TRC-04 có còn nguy cơ tái phát không?
> **TRẢ LỜI**: **ĐÃ LOẠI BỎ NGUY CƠ TÁI PHÁT TRÊN CÁC DATABASE CÓ MIGRATION 15**.
> - Bảng `inventory_lots` tạo ràng buộc duy nhất `UNIQUE (product_code, lot_number)`.
> - Trigger `parts_assign_lot_identity` tự động sinh hoặc gán đúng `lot_id` theo cặp `(SKU, Lot)`.
> - Mọi truy vấn QC và FEFO trong backend (`latestLotQuality`, `allocateOutbound`) giờ đây đều lọc theo đúng `lot_id` thay vì chuỗi `lot_number` chung chung. Hai sản phẩm khác nhau dù vô tình mang cùng số lô cũng có 2 `lot_id` riêng biệt, kết luận QC của SKU này không thể lây nhiễm sang SKU kia.

### Câu hỏi 5: Những hạng mục Phase 6 nào đã hoàn thành?
> **TRẢ LỜI**:
> 1. **P0 TRC-04**: Sửa dứt điểm định danh Lô theo SKU (Migration 15 + Trigger + Backend + Frontend).
> 2. **Kiểm thử hồi quy TRC-04**: 7/7 nhóm test trực tiếp PASS, 28/28 test Phase 2 PASS, 74/74 Jest PASS.
> 3. **Phân tách an toàn Demo vs Chính**: Cổng 4310 proxy độc lập vào 5032 / `wms_dashboard_demo_test`.
> 4. **Xác minh giao diện trực quan 4310**: Chạy Playwright headless kiểm tra Login, Dashboard KPI, Refresh lưu phiên, Nhập kho, Sơ đồ kho 3D, FEFO, Truy vết lô đều PASS với 0 lỗi console/mạng.
> 5. **Thử nghiệm Migration Lifecycle 13 → 15**: Kiểm chứng up/down/re-up thành công trên clone của `wms_demo`.

### Câu hỏi 6: Những hạng mục Phase 6 nào còn thiếu hoặc cần hoàn thiện tiếp?
> **TRẢ LỜI**:
> 1. **Receiving Workflow**: Xử lý sai lệch chứng từ khi nhận hàng (Overage/Shortage discrepancy).
> 2. **Inventory Reservation & Stocktaking**: Giữ tồn khi tạo phiếu xuất và Module kiểm kê định kỳ (Cycle Counting).
> 3. **Quy tắc One Rack – One SKU**: Đã thử nghiệm trên QA, cần xác nhận chính sách vận hành kho thực tế từ Masan.
> 4. **Cấu hình PostgreSQL WAL Archiving & PITR**: Nâng cấp RPO từ 24h xuống ≤ 15 phút.
> 5. **PostgreSQL TLS Host**: Cluster local đang `ssl = off`, cần tài liệu hướng dẫn cấp phát cert cho Staging.

### Câu hỏi 7: Tiếp theo nên triển khai phần nào?
> **TRẢ LỜI**:
> **Ưu tiên 1**: Hoàn thiện quy trình Receiving nâng cao (xử lý sai lệch chứng từ và hàng hỏng tại cửa nhập).  
> **Ưu tiên 2**: Xây dựng module Kiểm kê định kỳ (Cycle Counting) và cơ chế Giữ tồn (Inventory Reservation).  
> **Ưu tiên 3**: Thiết lập script sao lưu WAL Archiving kết hợp kiểm thử phục hồi PITR.

---

## 2. MANIFEST CHI TIẾT 15 MIGRATION HIỆN CÓ

| STT | Timestamp Migration | Tên Migration | Bảng / Đối tượng tác động | Khả năng Rollback | Trạng thái trên `wms_demo` | Trạng thái trên QA / Demo 4310 |
|:---:|---|---|---|:---:|:---:|:---:|
| 1 | `1785582713571` | `InitSchema` | Khởi tạo bảng ban đầu (users, orders, parts, containers,...) | Có | Đã chạy | Đã chạy |
| 2 | `1785591384811` | `AddOrderScopingToContainersAndHistory` | Thêm order_id cho containers, bảng history_events | Có | Đã chạy | Đã chạy |
| 3 | `1787000000000` | `AddWarehouseRackFields` | Thêm warehouse_code, zone_code cho containers | Có | Đã chạy | Đã chạy |
| 4 | `1787100000000` | `AddStage3InventoryAndZones` | Bổ sung warehouse_zones, load_plans | Có | Đã chạy | Đã chạy |
| 5 | `1787200000000` | `AddOracleInventoryFieldsToParts` | Thêm uom_code, expiration_date, supplier_name cho parts | Có | Đã chạy | Đã chạy |
| 6 | `1787300000000` | `AddSupplyChainTables` | Thêm shipments, packing_rules | Có | Đã chạy | Đã chạy |
| 7 | `1787400000000` | `AddShipmentIdToShipments` | Bổ sung shipment_id | Có | Đã chạy | Đã chạy |
| 8 | `1787900000000` | `AddMasanAccessRoles` | Bổ sung enum vai trò người dùng Masan | Có | Đã chạy | Đã chạy |
| 9 | `1788000000000` | `AddMasanStorageClassification` | Thêm storage_class cho parts | Có | Đã chạy | Đã chạy |
| 10 | `1788100000000` | `AddRackProductFamily` | Thêm product_family cho containers & parts | Có | Đã chạy | Đã chạy |
| 11 | `1788200000000` | `AddInventoryIdempotency` | Thêm bảng inventory_idempotency | Có | Đã chạy | Đã chạy |
| 12 | `1788300000000` | `AddInventoryQualityAudit` | Bổ sung auditing cho inspections | Có | Đã chạy | Đã chạy |
| 13 | `1788400000000` | `AddStableProductCategories` | Chuẩn hóa danh mục sản phẩm Masan | Có | **Đã chạy (Hiện tại)** | Đã chạy |
| 14 | `1788500000000` | `AddPerformanceIndexes` | Chỉ mục composite cho inspections, transactions, parts | Có | **Chưa chạy** | Đã chạy |
| 15 | `1788600000000` | `AddInventoryLotIdentity` | Tạo bảng `inventory_lots`, khóa ngoại `lot_id`, trigger bất biến (P0 TRC-04) | Có (có guard) | **Chưa chạy** | Đã chạy |

---

## 3. RUNBOOK NÂNG CẤP MÔI TRƯỜNG CHÍNH / STAGING (CHUẨN BỊ KHI CÓ QUYẾT ĐỊNH CUTOVER)

> [!CAUTION]
> **HƯỚNG DẪN DÀNH CHO QUẢN TRỊ VIÊN HỆ THỐNG KHI THỰC HIỆN BẢO TRÌ CHÍNH THỨC**.  
> **TUYỆT ĐỐI KHÔNG TỰ ĐỘNG CHẠY KHI CHƯA CÓ LỆNH CUTOVER TỪ LÃNH ĐẠO MASAN.**

### Giai đoạn 1: Chuẩn bị & Sao lưu (Thời gian: 5 phút)
1. Thông báo cửa sổ bảo trì (Maintenance Window).
2. Tạm dừng lưu lượng vào hệ thống (chuyển Nginx sang trang bảo trì 503 Service Unavailable).
3. Thực hiện sao lưu Full Dump của cơ sở dữ liệu đích:
   ```powershell
   $TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
   & "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -p 55432 -U wms_local -d wms_demo -Fc -f "work/wms_demo_backup_$TIMESTAMP.dump"
   Get-FileHash "work/wms_demo_backup_$TIMESTAMP.dump" -Algorithm SHA256 > "work/wms_demo_backup_$TIMESTAMP.sha256"
   ```

### Giai đoạn 2: Triển khai Migration (Thời gian: 2 phút)
1. Kiểm tra không có transaction nào đang giữ lock:
   ```sql
   SELECT pid, query, state, age(clock_timestamp(), query_start) FROM pg_stat_activity WHERE state != 'idle';
   ```
2. Thực thi migration TypeORM:
   ```powershell
   Set-Location "C:\Users\ADMIN\Documents\Codex\2026-11-12\c-users-admin-downloads-denso-warehouse\work\denso-warehouse-wms-main\denso-wms-backend"
   $env:DB_NAME = 'wms_demo'
   node.exe node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js
   ```
3. Xác minh số migration đạt đủ 15:
   ```sql
   SELECT count(*) FROM migrations; -- Phải trả về 15
   SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_lots'); -- Phải trả về true
   ```

### Giai đoạn 3: Khởi động lại Ứng dụng & Kiểm thử nghiệm thu (Thời gian: 3 phút)
1. Build backend mới nhất:
   ```powershell
   npm run build
   ```
2. Khởi động lại service backend cổng 5001.
3. Smoke Test kiểm tra sức khỏe và dữ liệu:
   - `GET /api/health` trả về HTTP 200.
   - `GET /api/parts/dashboard-summary` trả về HTTP 200 (không còn lỗi 400 UUID).
4. Mở lại lưu lượng trên Nginx Reverse Proxy. Hoàn tất bảo trì.
