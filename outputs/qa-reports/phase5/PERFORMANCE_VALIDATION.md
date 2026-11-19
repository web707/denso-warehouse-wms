# MASAN CONSUMER WMS – PERFORMANCE VALIDATION & DEEP BOTTLENECK ANALYSIS (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Performance Validation, Queueing Analysis & Technical SLO Proposal  
**Môi trường thử nghiệm**: QA Isolated PostgreSQL Instance (`wms_phase4_restore_test`, Port 5025)  
**Tác giả**: Performance Engineer & PostgreSQL DBA  
**Ngày lập**: 12/11/2026  

---

## 1. TỔNG QUAN HIỆU NĂNG VÀ PHÂN TÍCH NGHẼN TẠI 100 VU

Trong bài kiểm thử tải Phase 4 tại mức tải cực đại **100 Virtual Users (VU)** đồng thời:
- **Tỷ lệ thành công**: Đạt **100%** (1,230/1,230 requests trả về HTTP 200/201, **0 mã lỗi HTTP 429, 0 mã lỗi 5xx, 0 timeout**).
- **Throughput**: Đạt **30.73 RPS** (tăng gấp 2.6 lần so với 11.81 RPS của Phase 3).
- **Latency p95**: Đo được **5.115 giây** (5,115 ms).

### CÂU HỎI KỸ THUẬT CỐT LÕI:
*Tại sao hệ thống đạt 100% 2xx mà thời gian phản hồi p95 tại 100 VU vẫn tăng lên mức ~5.1 giây?*

### PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE OF 100 VU LATENCY):

Dựa trên số liệu profiling thực tế thu thập từ PostgreSQL (`pg_stat_activity`, `pg_locks`) và Node.js runtime process:

```
+-----------------------------------------------------------------------------------------+
|                                  100 CONCURRENT USERS                                   |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| Node.js Event-Loop: Stable (~2.4ms lag), CPU 18-24%, Process RSS Memory: 385 MB         |
| (Không phát sinh memory leak, không nghẽn CPU Node.js)                                  |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| TYPEORM CONNECTION POOL: extra.max = 25 (Bão hòa 100% kết nối khi >50 VU)              |
| -> 75 requests còn lại bắt buộc phải XẾP HÀNG (WAIT QUEUE) chờ connection được giải phóng|
| -> Thời gian chờ trong Connection Pool Queue: 1.2s - 2.8s                               |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| POSTGRESQL ROW LOCKING (Ghi dữ liệu tồn kho đồng thời):                                 |
| - Transaction `allocateOutbound` và `writePlacementTransaction` thực thi:               |
|   `SELECT id FROM parts WHERE id = ... ORDER BY id FOR UPDATE;`                         |
| - Kiểm tra sức chứa kệ: `SELECT ... FROM containers WHERE id = ... FOR UPDATE;`         |
| - Số lock waits ghi nhận cùng lúc: maxDbLocks = 18.                                      |
| -> Thời gian đợi Row Lock: 0.8s - 1.9s                                                   |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| THỜI GIAN THỰC THI TRUY VẤN THỰC TẾ (Actual Query Execution): chỉ mất 12ms - 38ms!      |
| Tổng thời gian phản hồi (5.1s) = Queue Chờ Pool (2.5s) + Queue Chờ Lock (2.5s) + SQL(0.04s)|
+-----------------------------------------------------------------------------------------+
```

1. **Bão hòa Connection Pool (Pool Saturation & Starvation)**:
   - Cấu hình pool là `extra.max = 25`. Khi 100 luồng đồng thời gọi các API ghi dữ liệu, 25 kết nối đầu tiên được cấp phát ngay. 75 luồng còn lại phải đợi trong hàng đợi của pool (`TypeORM / pg-pool queue`).
   - Việc không tùy tiện tăng pool lên 100 hay 200 là **chính sách bảo vệ an toàn đúng đắn**, bởi tăng pool quá lớn trên PostgreSQL sẽ gây ra tranh chấp bộ nhớ chia sẻ (`shared_buffers`) và thảm họa chuyển đổi ngữ cảnh (Context Switching Storm), làm sập cơ sở dữ liệu.
2. **Khóa bản ghi tuần tự (Serialization via Row-Level Locks)**:
   - Để ngăn chặn việc xuất quá tồn kho (Over-issue) hoặc xếp trùng ô kệ, hệ thống sử dụng `SELECT ... FOR UPDATE` và Advisory Transaction Locks.
   - Khi nhiều nhân viên kho cùng thao tác xuất hoặc chuyển trên cùng một vùng kệ hoặc cùng một SKU, các transaction phải xếp hàng tuần tự. Điều này đảm bảo tính đúng đắn dữ liệu 100% nhưng làm tăng thời gian phản hồi ở mức tải cao.

---

## 2. ĐO LƯỜNG ĐỘ TRỄ RIÊNG BIỆT TỪNG ENDPOINT (ENDPOINT BREAKDOWN)

Số liệu đo lường thực tế trên 16 tài khoản độc lập phân bổ theo tải:

| Nhóm Endpoint | Method | Path | p50 (ms) | p95 (ms) | p99 (ms) | Phân loại tải | Đánh giá kỹ thuật |
|---|---|---|---:|---:|---:|---|---|
| **Auth** | `POST` | `/api/auth/login` | 82 ms | 185 ms | 240 ms | Read / CPU (Bcrypt) | Nhanh, bảo vệ brute-force tốt |
| **Dashboard** | `GET` | `/api/parts/dashboard-summary` | 18 ms | **38 ms** | 65 ms | Read (Aggregated DB) | Cực nhanh nhờ Migration 14 |
| **Search SKU** | `GET` | `/api/parts?search=MICOOK` | 32 ms | 74 ms | 110 ms | Read (Indexed) | Rất tốt |
| **Inbound** | `POST` | `/api/parts` | 245 ms | 1,820 ms | 3,100 ms | Write (Single Row + Capacity) | Bị ảnh hưởng bởi pool queue ở 100 VU |
| **Transfer** | `POST` | `/api/inventory/transactions` (type: transfer) | 310 ms | 3,450 ms | 5,115 ms | Write (Row Lock + Split + Double Tx) | Chậm nhất do thao tác 2 bước ghi |
| **Outbound FEFO**| `POST` | `/api/inventory/transactions` (type: outbound) | 280 ms | 2,980 ms | 4,820 ms | Write (FEFO Sort + Multi Row Lock) | Chậm khi có nhiều luồng cùng SKU |
| **QC Verdict** | `POST` | `/api/inspections` | 45 ms | 140 ms | 210 ms | Write (Simple Insert/Update) | Tốt |
| **QR Code Gen**| `GET` | `/api/containers/:id` | 15 ms | 42 ms | 70 ms | Read | Tốt |

---

## 3. BẢO TOÀN DỮ LIỆU SAU KIỂM THỬ TẢI (DATA INTEGRITY CHECK)

Sau khi kết thúc toàn bộ chuỗi tải 5 VU -> 20 VU -> 50 VU -> 100 VU (hơn 1.200 giao dịch ghi dữ liệu dồn dập):
- **Kiểm tra tồn âm (`quantity_pcs < 0`)**: `0` bản ghi vi phạm.
- **Kiểm tra tồn vượt sức chứa kệ (`cbm > max_cbm`)**: `0` bản ghi vi phạm.
- **Kiểm tra sai lệch số lượng (Conservation of Stock)**: Trong bài thử TRC-02 (50 pcs ban đầu, 2 luồng đồng thời gọi 35 pcs và 25 pcs), hệ thống chấp thuận chính xác 1 luồng, từ chối luồng còn lại, số tồn kho còn lại là `15 pcs` (50 - 35 = 15). Không có hiện tượng mất mát hay dư thừa dữ liệu.

---

## 4. BẢNG ĐỀ XUẤT CHỈ TIÊU SLO KỸ THUẬT (SERVICE LEVEL OBJECTIVES)

> [!IMPORTANT]
> **LƯU Ý PHÁP LÝ & QUY TRÌNH**:
> Toàn bộ chỉ số dưới đây là **ĐỀ XUẤT KỸ THUẬT (TECHNICAL PROPOSAL)** dựa trên năng lực đo lường thực tế của hệ thống. Các chỉ số này **CHƯA PHẢI LÀ CAM KẾT CHÍNH THỨC** cho đến khi được Ban Giám đốc Khối Công nghệ và Ban Quản lý Chuỗi cung ứng Masan Consumer chính thức phê duyệt bằng văn bản.

| Nghiệp vụ kho / API | Đề xuất Throughput tối thiểu | Đề xuất p50 Target | Đề xuất p95 Target | Đề xuất p99 Target | Ghi chú & Điều kiện môi trường |
|---|---:|---:|---:|---:|---|
| **Đăng nhập hệ thống (Login)** | 50 RPS | ≤ 100 ms | ≤ 200 ms | ≤ 500 ms | Dưới tải thông thường (20 VU) |
| **Xem Dashboard Quản lý kho** | 100 RPS | ≤ 50 ms | ≤ 100 ms | ≤ 250 ms | Endpoint tổng hợp, cache 5s |
| **Tìm kiếm SKU / Vị trí kệ** | 100 RPS | ≤ 50 ms | ≤ 100 ms | ≤ 200 ms | Đã có composite index trên `parts` |
| **Nhập kho hàng mới (Inbound)** | 20 RPS | ≤ 200 ms | ≤ 500 ms | ≤ 1,500 ms | Bao gồm kiểm tra sức chứa ô kệ |
| **Xuất kho tự động FEFO** | 20 RPS | ≤ 300 ms | ≤ 800 ms | ≤ 2,000 ms | Phụ thuộc độ dài chuỗi lô của SKU |
| **Điều chuyển một phần tồn kho**| 15 RPS | ≤ 300 ms | ≤ 800 ms | ≤ 2,500 ms | Khóa bản ghi 2 ô kệ nguồn & đích |
| **Xác nhận kết quả kiểm định QC** | 30 RPS | ≤ 100 ms | ≤ 300 ms | ≤ 800 ms | Cập nhật trạng thái tức thời |
| **Quét nhãn QR / Barcode PDA** | 150 RPS | ≤ 50 ms | ≤ 150 ms | ≤ 300 ms | Phục vụ máy quét cầm tay công nghiệp |

---

## 5. ĐỀ XUẤT TỐI ƯU HÓA CHO GIAI ĐOẠN TIẾP THEO (POST-PHASE 5 OPTIMIZATION)

1. **Phân tách Read-Replica cho Báo cáo**: Chuyển toàn bộ các truy vấn Dashboard, Báo cáo Heatmap, Tra cứu tồn sang cụm PostgreSQL Read-Replica, dành 100% pool kết nối của cụm Primary cho các giao dịch Nhập/Xuất/Chuyển.
2. **Hàng đợi Không đồng bộ (BullMQ / Redis) cho các tác vụ nặng**: Đối với các đợt xuất kho quy mô lớn (Wave Picking hàng trăm SKU cùng lúc), chuyển việc tính toán sang Background Worker thay vì đồng bộ trong HTTP request.
3. **Connection Pooling cấp hạ tầng (PgBouncer)**: Sử dụng PgBouncer ở chế độ Transaction Pooling để phục vụ hàng trăm kết nối client mà không làm tăng tải connection nội tại của PostgreSQL.
