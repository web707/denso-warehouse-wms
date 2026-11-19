# CẨM NANG DỮ LIỆU KIỂM THỬ THỦ CÔNG (TEST DATA REFERENCE GUIDE)
## HỆ THỐNG MASAN CONSUMER WMS – ENTERPRISE EDITION
**Mục đích:** Cung cấp toàn bộ danh mục mã sản phẩm (SKU), số lô (Lot ID), vị trí giá kệ (Racks/Slots), mã đơn và dữ liệu mẫu chuẩn hóa để người dùng tự kiểm thử không gặp lỗi vi phạm dữ liệu.

---

## 1. DANH MỤC SẢN PHẨM MASAN MASTER SKUS (CHỦ LỰC)

Hệ thống được thiết kế chuyên biệt cho 6 dòng sản phẩm chủ lực của Masan Consumer thuộc 3 phân nhóm ngành hàng:

| Mã SKU (Part Code) | Tên Sản Phẩm Chính Xác | Ngành Hàng | Phân Khu Lưu Trữ Chuẩn | Quy Cách Thùng | Mã Vạch EAN-13 |
|:---|:---|:---|:---|:---:|:---:|
| **`MSN-FMCG-001`** | Nước mắm Nam Ngư Đệ Nhị 900ml | Gia vị & Nước chấm | **Zone A** (Kệ lỏng) | 15 chai / thùng | 8936017361012 |
| **`MSN-FMCG-002`** | Nước tương Chinsu Nấm Shiitake 330ml | Gia vị & Nước chấm | **Zone A** (Kệ lỏng) | 24 chai / thùng | 8936017361029 |
| **`MSN-FMCG-003`** | Mì Kokomi Đại 90g (Tôm chua cay) | Thực phẩm tiện lợi | **Zone B** (Kệ mì ăn liền) | 30 gói / thùng | 8936017361036 |
| **`MSN-FMCG-004`** | Mì Omachi Xốt Bò Hầm 80g | Thực phẩm tiện lợi | **Zone B** (Kệ mì ăn liền) | 30 gói / thùng | 8936017361043 |
| **`MSN-FMCG-005`** | Cà phê sữa hòa tan Vinacafe CHẤT | Đồ uống đóng chai & cafe | **Zone C** (Kệ đồ uống) | 20 hộp / thùng | 8936017361050 |
| **`MSN-FMCG-006`** | Nước tăng lực Wakeup 247 vị cà phê | Đồ uống đóng chai & cafe | **Zone C** (Kệ đồ uống) | 24 chai / thùng | 8936017361067 |

---

## 2. SƠ ĐỒ VỊ TRÍ GIÁ KỆ (RACKS & ZONES DIRECTORY)

Kho thành phẩm Masan được chia làm 4 phân khu chức năng độc lập:

### 2.1. Phân khu Zone A (Ngành Gia Vị & Nước Chấm - Tải trọng nặng)
- **Kệ `A-01` (R01):** Kệ tầng 1-4, hiện đang chứa lô hàng lịch sử `LOT-NN-HIST-01` (Nam Ngư) và `LOT-CS-HIST-01` (Chinsu).
- **Kệ `A-02` (R02):** Kệ tầng 1-4, hiện đang chứa lô hàng lịch sử `LOT-NN-HIST-02`.
- **Kệ `A-03`:** Kệ chuyên dụng cho Nước mắm Nam Ngư Đệ Nhị (`MSN-FMCG-001`). Sức chứa tối đa: 500 thùng.
- **Kệ `A-04`:** Kệ chuyên dụng cho Nước tương Chinsu Nấm (`MSN-FMCG-002`). Sức chứa tối đa: 500 thùng.
- **Kệ `A-05`:** Kệ trống dự phòng dùng cho kiểm thử điều chuyển Putaway.

### 2.2. Phân khu Zone B (Ngành Thực Phẩm Tiện Lợi - Thể tích lớn)
- **Kệ `B-01`:** Kệ chuyên dụng cho Mì Omachi Xốt Bò Hầm (`MSN-FMCG-004`). Sức chứa: 600 thùng.
- **Kệ `B-02`:** Kệ chuyên dụng cho Mì Kokomi Đại 90g (`MSN-FMCG-003`). Sức chứa: 600 thùng.
- **Kệ `B-03`:** Kệ trống, sẵn sàng cho bài test Putaway và Đếm kiểm kê Vòng 1 & Vòng 2.
- **Kệ `B-04`, `B-05`, `B-06`:** Kệ lưu trữ luân chuyển mì gói dự phòng.

### 2.3. Phân khu Zone C (Ngành Đồ Uống & Cà Phê)
- **Kệ `C-01`:** Kệ chuyên dụng cho Cà phê Vinacafe CHẤT (`MSN-FMCG-005`). Sức chứa: 400 thùng.
- **Kệ `C-02`:** Kệ chuyên dụng cho Nước tăng lực Wakeup 247 (`MSN-FMCG-006`). Sức chứa: 400 thùng.
- **Kệ `C-03`, `C-04`, `C-05`:** Kệ hàng đồ uống dự phòng.

### 2.4. Phân khu Zone Q & Khu Vực Đệm (Special Purpose Racks)
- **`DOCK-STAGING`:** Khu vực sàn đệm tiếp nhận hàng tại cửa nhập kho. Nơi tập kết hàng sau khi bấm Xác nhận nhận hàng theo PO trước khi Putaway vào kệ chính.
- **`DOCK-QUARANTINE` (Zone Q):** Khu vực cách ly đặc biệt dành cho hàng phát hiện rách hỏng, bẹp móp hoặc lô bị QC đánh giá NG (Fail) chờ xử lý tiêu hủy hoặc trả về nhà máy.

---

## 3. DANH SÁCH LÔ HÀNG TEST ĐẶC TRƯNG (FEATURE LOTS)

| Số Lô (Lot ID) | SKU Tương Ứng | Hạn Sử Dụng (Exp Date) | Trạng Thái QC | Ý Nghĩa Trong Kịch Bản Kiểm Thử |
|:---|:---|:---:|:---:|:---|
| **`LOT-NN-202612-01`** | `MSN-FMCG-001` | 31/12/2026 (Cận hạn <60d) | `AVAILABLE` | Dùng để test thuật toán **FEFO**: Hệ thống sẽ tự động ưu tiên xuất lô này trước lô năm 2027. |
| **`LOT-NN-202706-02`** | `MSN-FMCG-001` | 30/06/2027 (Hạn dài >180d) | `AVAILABLE` | Lô đối chứng để chứng minh FEFO không lấy nhầm lô hạn xa. |
| **`LOT-OMA-PENDING-01`**| `MSN-FMCG-004` | 15/08/2027 | `PENDING` | Dùng cho bài test **QC Inspection**: Phê duyệt PASS để xem hàng chuyển sang AVAILABLE. |
| **`LOT-OMA-DEFECT-02`** | `MSN-FMCG-004` | 20/09/2027 | `UNDER_INSPECTION` | Dùng cho bài test **QC Rejection**: Đánh giá FAIL để xem cơ chế cô lập TRC-04 vào Zone Q. |
| **`DQA-COMMON-01`** | `MSN-FMCG-001` | 10/10/2027 | `AVAILABLE` | Lô chuẩn để kiểm thử màn hình **Truy vết phả hệ chuỗi cung ứng** (`/trace`) với 5 chặng lịch sử. |

---

## 4. DỮ LIỆU MẪU ĐỀ XUẤT CHO CÁC FORM NHẬP LIỆU (COPY-PASTE TEMPLATES)

### 4.1. Dữ liệu tạo Đơn Nhận Hàng theo PO (PO Receiving Form)
- **Mã PO:** `PO-2026-MSN-TEST-99`
- **Nhà cung cấp:** `Công ty Cổ phần Hàng tiêu dùng Masan - Chi nhánh Hải Dương`
- **Sản phẩm:** `MSN-FMCG-003 - Mì Kokomi Đại 90g`
- **Số lượng PO:** `300`
- **Số lượng thực nhận:** `300` (Nếu test nhận đủ) hoặc `290` (Nếu test nhận thiếu 10 thùng)
- **Hàng hỏng:** `0` (Nhận chuẩn) hoặc `5` (Test Dock Quarantine)
- **Ghi chú sai lệch:** `Kiểm tra thực tế phát hiện 5 thùng rách góc bìa carton do dây đai siết quá chặt`
- **Số lô:** `LOT-KKM-TEST-99`
- **Ngày sản xuất:** Lấy ngày hôm nay (Ví dụ: `2026-11-15`)
- **Hạn sử dụng:** Lấy ngày cách hiện tại 9 tháng (Ví dụ: `2027-08-15`)

### 4.2. Dữ liệu tạo Đơn Xuất Kho (Dispatch Order Form)
- **Mã đơn xuất:** `DO-2026-WINMART-TEST-01`
- **Khách hàng:** `Hệ thống Bách Hóa Xanh / WinMart Miền Bắc`
- **Loại đơn:** `Xuất bán lẻ siêu thị FMCG`
- **Sản phẩm & Số lượng:**
  - SKU: `MSN-FMCG-001` (Nước mắm Nam Ngư) - Số lượng: `50` thùng
  - SKU: `MSN-FMCG-003` (Mì Kokomi Đại) - Số lượng: `100` thùng
- **Ghi chú giao hàng:** `Giao trước 17h00 tại Tổng kho Logistics Sóng Thần`

### 4.3. Dữ liệu tạo Đợt Kiểm Kê Định Kỳ (Cycle Count Form)
- **Tên đợt kiểm kê:** `Kiểm kê định kỳ tháng 11 - Phân khu Zone B`
- **Phạm vi kiểm kê:** Chọn `Zone B`
- **Ghi chú kiểm toán:** `Kiểm tra đối chiếu độ chính xác tồn kho ngành thực phẩm tiện lợi theo quy chế SoD`
