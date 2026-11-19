# BÁO CÁO TRUY VẾT VẬN HÀNH 3D (OPERATIONAL TRACEABILITY)
**Ngày thực hiện:** 17/11/2026  
**Mục tiêu:** Chứng minh mô hình 3D là màn hình điều hành kho trực quan, gắn kết chặt chẽ với dữ liệu nghiệp vụ thời gian thực.

---

## 1. Bản đồ cấu trúc kho & Liên kết nghiệp vụ
- **Mô hình 3D:** Hiển thị toàn diện Zone A với 3 dãy kệ chính:
  - **R01** (`b530a998-a483-46ef-9988-e52db3d46eaa`): 20 ô (4 tầng x 5 khoang)
  - **R02** (`c98735a4-5ab4-465a-bc55-f5f61a7db97e`): 20 ô (4 tầng x 5 khoang)
  - **R03** (`2b7a3a0d-ad6f-4290-84d3-eb9854ae0640`): 20 ô (4 tầng x 5 khoang)
- **Dữ liệu thể hiện trên từng ô kệ:**
  - Trạng thái chứa hàng / ô trống.
  - Tỷ lệ chiếm dụng không gian và tải trọng thực tế.
  - Thông tin chi tiết: SKU, Tên sản phẩm, Số lượng PCS, Số thùng, Khối lượng, Trạng thái QC (`RELEASED`), Hạn sử dụng (FEFO).

---

## 2. Hệ thống Thẻ Nhiệm vụ 3D Phát sáng (Illuminated 3D Task Badges)
Mỗi nhiệm vụ đang diễn ra tại ô kệ được định danh trực tiếp trong không gian 3D:

| Loại nhiệm vụ | Màu sắc nhận diện | Mã màu Hex | Nội dung hiển thị trên 3D |
| :--- | :--- | :--- | :--- |
| **Soạn hàng xuất kho** | Xanh dương (Sky Blue) | `#0284c7` | **`SOẠN HÀNG`** |
| **Kiểm kê định kỳ** | Hổ phách (Amber) | `#d97706` | **`KIỂM KÊ`** |
| **Điều chuyển vị trí** | Tím (Purple) | `#7c3aed` | **`ĐIỀU CHUYỂN`** |

Khi người vận hành nhấp chọn một ô kệ có nhiệm vụ, panel bên phải (Right Inspector) hiển thị khối **"NHIỆM VỤ ĐANG XỬ LÝ TẠI Ô LƯU TRỮ NÀY"** với mã lệnh, tiến độ, người thực hiện và mốc thời gian.

---

## 3. Tính năng Tìm kiếm nhanh & Auto-focus
- Người vận hành nhập mã SKU hoặc số Lô vào ô tìm kiếm: Hệ thống tự động lọc danh sách nhiệm vụ và di chuyển tiêu cự camera 3D trực tiếp tới ô kệ chứa mặt hàng đó.
- **Minh chứng:** `sync_09_search_auto_focus.png`.

---

## 4. Minh bạch phân định ranh giới (Simulation Demarcation)
Nút kích hoạt hành trình mô phỏng xe nâng được đặt tên rõ ràng: **`Hành trình 3D (Mô phỏng)`** kèm nhãn chú thích người dùng: *Mô phỏng vật lý tách biệt với dữ liệu vận hành thực tế*. Điều này triệt tiêu rủi ro người vận hành nhầm lẫn giữa dữ liệu đo đạc trực tuyến và hoạt cảnh sandbox.
- **Minh chứng:** `sync_11_simulation_labeling_verified.png`.
