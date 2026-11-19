# BÁO CÁO ĐỒNG BỘ ĐA TRÌNH DUYỆT KHÔNG CẦN RELOAD
**Ngày thực hiện:** 17/11/2026  
**Phương pháp đo kiểm:** Khởi chạy đồng thời 2 phiên trình duyệt Chromium tách biệt hoàn toàn qua Playwright:
- **Phiên 1:** Trưởng kho (`staging.manager@masan.local`)
- **Phiên 2:** Nhân viên kho (`staging.staff@masan.local`)

---

## 1. Kết quả đo kiểm độ trễ đồng bộ (Latency Benchmark)

| Kịch bản nghiệp vụ | Phiên phát động | Phiên tiếp nhận | Độ trễ đo được | Mục tiêu tiêu chuẩn | Kết luận |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Điều chuyển 4 PCS từ R01 sang R03** | Manager (API Commit) | Staff (Trình duyệt) | **1184 ms** | < 3,000 ms | **PASS (Vượt trội)** |
| **Ping sức khỏe mạng định kỳ (Manager)** | Manager Browser | NestJS API | **16 ms** | < 200 ms | **PASS** |
| **Ping sức khỏe mạng định kỳ (Staff)** | Staff Browser | NestJS API | **79 ms** | < 200 ms | **PASS** |

---

## 2. Kiểm thử phát hiện mất mạng & Tự phục hồi (Offline Recovery)

### 2.1. Kịch bản mô phỏng đứt kết nối mạng
- Can thiệp chặn đường truyền mạng tới endpoint `/api/health` trên phiên của Staff.
- **Hành vi quan sát được:**
  - Trong vòng chu kỳ đồng bộ, hệ thống phát hiện mất kết nối mạng.
  - HUD trên cùng lập tức chuyển sang trạng thái cảnh báo màu đỏ: **`MẤT KẾT NỐI (DỮ LIỆU CŨ)`**.
  - Hiển thị banner thông báo cảnh báo màu đỏ cảnh báo người vận hành không thao tác trên dữ liệu tồn kho chưa được đồng bộ.
  - **Minh chứng:** `sync_07_offline_detection_banner.png`.

### 2.2. Kịch bản phục hồi kết nối mạng
- Gỡ bỏ việc chặn đường truyền, mạng được thông suốt trở lại.
- **Hành vi quan sát được:**
  - Hệ thống tự động phát hiện kết nối khả dụng trở lại ngay ở lần ping tiếp theo.
  - HUD chuyển về màu xanh lá: **`TRỰC TUYẾN (<latency>ms)`**.
  - Tự động nạp lại dữ liệu tồn kho mới nhất và hiển thị banner thông báo xanh lá xác nhận tái kết nối thành công.
  - **Minh chứng:** `sync_08_reconnected_and_resynced.png`.

---

## 3. Đánh giá kiến trúc đồng bộ
Cơ chế Controlled Polling kết hợp Mutex Lock (`isSyncing`) và Storage Event listener (`wms_inventory_committed`) giúp loại bỏ hoàn toàn tình trạng nghẽn hàng đợi (request storming), giữ cho frame Three.js luôn ổn định 60 FPS mà vẫn đảm bảo độ trễ cập nhật thực tế chỉ xấp xỉ **1.1 giây**.
