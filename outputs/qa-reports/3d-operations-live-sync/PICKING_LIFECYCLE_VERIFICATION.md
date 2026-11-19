# BÁO CÁO VÒNG ĐỜI SOẠN HÀNG 2 BƯỚC & THẺ NHIỆM VỤ 3D
**Mã đơn xuất kho:** `dd664c1f-cf00-4bd5-8441-8836d14eb864`  
**Ngày thực hiện:** 17/11/2026  
**Tiêu chuẩn:** Phân tách trạng thái `RESERVED` (Đặt trước) và `PICKED` (Đã soạn), đồng thời hiển thị thẻ nhiệm vụ trực quan trên ô kệ 3D.

---

## 1. Chi tiết thực thi vòng đời soạn hàng

### Bước 1: Khởi tạo đơn & Đặt trước tồn kho (`RESERVED`)
- **SKU:** `DQA-NAMNGU-VANG`
- **Mã Lô:** `DQA-NAMNGU-VANG-L2`
- **Vị trí ô kệ:** Kệ R01, **Slot 7**
- **Số lượng soạn:** **2 PCS**
- **Trạng thái ghi nhận:** **RESERVED**
- **Biểu diễn trên mô hình 3D:**
  - Ô kệ Slot 7 xuất hiện thẻ nhiệm vụ illuminated 3D: **`SOẠN HÀNG`** với mã màu xanh dương (`#0284c7`).
  - Panel thanh tra bên phải (Right Inspector) hiển thị phần "NHIỆM VỤ ĐANG XỬ LÝ TẠI Ô LƯU TRỮ NÀY":
    - Mã nhiệm vụ: `DISP-... || Soạn hàng xuất kho`
    - Trạng thái: `Chờ soạn` (Badge vàng cam nổi bật)
    - Số lượng cần soạn: `2 PCS`

### Bước 2: Xác nhận hoàn tất soạn hàng (`PICKED`)
- **API thực hiện:** `POST /api/inventory/dispatches/dd664c1f-cf00-4bd5-8441-8836d14eb864/pick`
- **Người thực hiện:** Trưởng kho (`staging.manager@masan.local`)
- **Trạng thái chuyển đổi:** **PICKED**
- **Hành vi tồn kho:**
  - Tồn khả dụng (Available Qty) được khấu trừ theo thuật toán FEFO.
  - Tồn vật lý tại ô kệ được ghi nhận đã xuất kho.
  - Mô hình 3D và panel danh sách nhiệm vụ tự động cập nhật trạng thái `Đã soạn / Đóng gói`.

---

## 2. Kiểm thử an toàn giao dịch & RBAC

| Kịch bản kiểm thử | Hành vi thực tế | Mã HTTP phản hồi | Kết luận |
| :--- | :--- | :--- | :--- |
| **Xác nhận soạn hàng trùng lặp (Double Pick)** | Hệ thống xử lý an toàn không làm nhân đôi số lượng trừ kho | HTTP `201` | **PASS (Idempotent)** |
| **Soạn hàng vượt quá tồn kho (Over-allocation)** | Cố gắng đặt 999,999 PCS vượt quá tồn khả dụng | HTTP 400 Bad Request | **PASS (Chặn vi phạm tồn)** |
| **Nhân viên kho cố tạo đơn xuất (Staff RBAC)** | Tài khoản `staging.staff` bị chặn quyền tạo dispatch | HTTP 403 Forbidden | **PASS (Bảo vệ phân quyền)** |

---

## 3. Minh chứng trực quan
- **Ảnh thẻ nhiệm vụ 3D SOẠN HÀNG tại ô 7:** `sync_05_picking_active_slot_tag.png`
