# BÁO CÁO CÁC TÍNH NĂNG CHƯA HOÀN THIỆN, LỖI VÀ ĐIỂM NGHẼN HỆ THỐNG
## (MISSING FEATURES, PARTIAL MODULES, HARDWARE BLOCKS & READINESS GAPS)
**Dự án:** MASAN CONSUMER WMS  
**Ngày đánh giá:** 15/11/2026  
**Đơn vị kiểm toán:** QA Lead, Senior SRE & Principal Enterprise Architect  

---

## 1. DANH SÁCH CÁC PHÂN HỆ CHƯA HOÀN THIỆN (PARTIAL MODULES)

### 1.1. Phân hệ Đóng gói đơn hàng (Packing Station & Cartonization)
- **Hiện trạng trong hệ thống:** 
  - Màn hình `/packing-rules` hiện đã tích hợp thuật toán giải thể tích 3D Bin Packing Heuristic (tính toán số lượng thùng carton tiêu chuẩn có thể xếp vừa vào một pallet hoặc container vận chuyển).
  - Backend đã có API tính toán kích thước bao bì.
- **Điểm còn thiếu so với nghiệp vụ thực tế (Gaps):**
  - **Thiếu màn hình Trạm đóng gói chuyên dụng (Packing Station UI):** Trong kho FMCG thực tế, nhân viên sau khi nhặt hàng từ kệ (Picking) cần đưa hàng qua một bàn đóng gói (Pack Station) có trang bị cân điện tử và máy quét mã vạch.
  - Chưa có tính năng quét mã từng thùng hàng để đối chiếu với Đơn xuất (Packing Verification Scan) nhằm chống thất thoát và sai sót trước khi dán nhãn vận chuyển (Shipping Label).
  - Chưa tích hợp API cân điện tử (Weight Scale Integration) để tự động bắt sai lệch trọng lượng (ví dụ: thiếu 1 chai nước mắm trong thùng).
- **Mức độ ảnh hưởng:** Trung bình (Medium). Không cản trở luồng xuất kho nguyên thùng (Full-case outbound), nhưng sẽ là điểm nghẽn nếu kho triển khai mô hình bán lẻ hoặc bóc tách lẻ (Split-case picking).

---

### 1.2. Phân hệ Quản lý Chuyến xe & Tích hợp ERP (Shipments & Oracle ERP Sync)
- **Hiện trạng trong hệ thống:**
  - Màn hình `/shipments` hiển thị danh sách các chuyến xe giao hàng, biển số xe, thông tin tài xế và các đơn hàng được gán ghép vào chuyến xe.
  - Có chức năng xuất dữ liệu giao hàng ra định dạng JSON/CSV.
- **Điểm còn thiếu so với vận hành doanh nghiệp:**
  - **Tích hợp tự động 2 chiều với Oracle Cloud ERP / SAP:** Hiện tại hệ thống hoạt động như một đảo dữ liệu (Data silo) độc lập hoặc phải import/export file thủ công. Hệ thống chưa có Webhook hoặc API kết nối thời gian thực qua Enterprise Service Bus (MuleSoft/Kafka/Oracle Integration Cloud) để tự động nhận Sales Orders (SO) và đồng bộ ngược trạng thái Giao hàng (Shipment Confirmation / Goods Issue).
  - **Thiếu tính năng Chữ ký điện tử bàn giao (ePOD - Electronic Proof of Delivery):** Khi giao hàng cho tài xế hoặc siêu thị WinMart, hệ thống chưa hỗ trợ màn hình ký nhận số trên máy tính bảng/điện thoại di động.
- **Mức độ ảnh hưởng:** Cao (High) trong giai đoạn vận hành tích hợp doanh nghiệp Masan. Cần triển khai Enterprise Middleware Adapter ở Phase tiếp theo.

---

### 1.3. Phân hệ Kế hoạch sản xuất & Gia công (Work Orders)
- **Hiện trạng trong hệ thống:**
  - Màn hình `/work-orders` hiển thị danh sách các lệnh sản xuất hoặc lệnh đóng gói khuyến mãi từ nhà máy.
- **Điểm còn thiếu:**
  - Hiện tại giao diện này hoạt động ở chế độ hiển thị tham khảo (View-only / Seed data).
  - Chưa hỗ trợ tính năng Khởi tạo lệnh sản xuất mới từ giao diện WMS.
  - Chưa hỗ trợ bóc tách Định mức nguyên vật liệu (BOM - Bill of Materials) để tự động trừ bao bì, màng co, tem nhãn khi thực hiện lệnh đóng gói combo (Ví dụ: Combo 1 chai Nước tương Chinsu + 1 gói Mì Omachi).
- **Mức độ ảnh hưởng:** Thấp (Low). Vì MASAN WMS là hệ thống quản lý kho thành phẩm (Distribution Center WMS), các lệnh sản xuất chính quy vốn do hệ thống ERP và MES tại nhà máy phụ trách.

---

## 2. CÁC TÍNH NĂNG BỊ CHẶN BỞI THIẾT BỊ NGOẠI VI (BLOCKED HARDWARE)

### 2.1. Quét mã vạch tự động qua thiết bị PDA chuyên dụng (Zebra TC26 / Honeywell EDA52)
- **Hiện trạng kỹ thuật phần mềm:**
  - Hệ thống đã tích hợp hoàn chỉnh module phân tích cú pháp mã vạch GS1-128 (GS1 Application Identifiers Parser), hỗ trợ nhận dạng mã AI:
    - `(01)`: Mã vạch thương phẩm toàn cầu GTIN / EAN-13.
    - `(10)`: Số lô sản xuất (Batch / Lot Number).
    - `(17)`: Ngày hết hạn sử dụng (Expiry Date YYMMDD).
    - `(21)`: Số seri định danh duy nhất (Serial Number).
- **Lý do bị chặn (BLOCKED):**
  - Môi trường thử nghiệm hiện tại chạy trên máy trạm thông qua trình duyệt web máy tính để bàn (Desktop Webview Browser).
  - Không có thiết bị quét phần cứng vật lý (PDA cằm súng, đầu đọc laser Honeywell/Zebra) kết nối qua giao thức DataWedge, Bluetooth SPP hoặc cổng COM ảo.
- **Giải pháp thay thế tạm thời cho Manual Testing:**
  - Nhập liệu thủ công mã vạch hoặc mã lô bằng bàn phím máy tính trên màn hình `/inventory` và `/trace`.
  - Sử dụng camera web của máy tính thông qua thư viện `html5-qrcode` tích hợp sẵn trong giao diện để quét tem nhãn trên giấy.

---

## 3. CÁC VẤN ĐỀ DỮ LIỆU ĐANG CHỜ PHÊ DUYỆT NGHIỆP VỤ (PENDING BUSINESS APPROVAL)

### 3.1. Đối soát hiện trường hai kệ Zone A chứa đa SKU (Historical Multi-SKU Racks)
- **Bản chất vấn đề:**
  - Tại Zone A, hai kệ lịch sử `A-01` và `A-02` trong database kiểm thử đang chứa 2 loại SKU khác nhau (Nước mắm Nam Ngư và Nước tương Chinsu) do dữ liệu quá khứ từ hệ thống cũ để lại.
  - Kể từ Migration 14 trở đi, hệ thống đã bật quy tắc nghiêm ngặt `WMS_ONE_SKU_PER_RACK = true` (Một kệ chỉ được chứa duy nhất 1 SKU).
- **Hiện trạng xử lý:**
  - Đội ngũ kỹ thuật đã chuẩn bị sẵn kịch bản và script điều chuyển nội bộ (`POST /api/inventory/transfer`) để tách hàng sang các kệ trống `A-04` và `A-05`.
  - **Điểm chặn phê duyệt (Pending BDR-01):** Theo quy định kiểm toán kho Masan, kỹ sư phần mềm TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý sửa đổi vị trí tồn kho trong database nếu chưa có Biên bản kiểm kê thực địa ký xác nhận của Thủ kho trưởng và Trưởng bộ phận An ninh kho để chứng minh vị trí vật lý thực tế của các pallet này.
- **Khuyến nghị:** Giữ nguyên trạng thái để đối soát hiện trường trong buổi UAT chính thức với đại diện Masan.

---

### 3.2. Sổ đăng ký quyết định nghiệp vụ (Business Decision Register - BDR)
Trước khi đưa hệ thống vào vận hành doanh nghiệp (Production Go-Live), Hội đồng điều hành kho Masan Consumer cần chính thức ký duyệt 7 chính sách nghiệp vụ sau:

| Mã BDR | Tên Chính Sách Nghiệp Vụ | Đề Xuất Kỹ Thuật Hệ Thống | Trạng Thái Phê Duyệt |
|:---:|:---|:---|:---:|
| **BDR-01** | Quy tắc 1 Kệ 1 SKU tại Zone A | Chuyển hàng đa SKU sang kệ riêng biệt `A-04`, `A-05` | ⏳ Chờ ký duyệt |
| **BDR-02** | Thời hạn giữ tồn kho mềm (Soft Reservation TTL) | Hết hạn tự động sau **48 giờ** nếu không thực hiện nhặt hàng | ⏳ Chờ ký duyệt |
| **BDR-03** | Ngưỡng sai lệch kích hoạt Kiểm kê Vòng 2 | Chênh lệch vượt quá **2%** hoặc lệch trên **5 thùng** | ⏳ Chờ ký duyệt |
| **BDR-04** | Quy trình xử lý hàng hỏng tại Dock Quarantine | Chuyển thẳng Zone Q, giữ tối đa 7 ngày để QC phán quyết | ⏳ Chờ ký duyệt |
| **BDR-05** | Ngưỡng an toàn phân tầng hạn dùng FEFO | Nguy cấp: < 30 ngày; Cảnh báo: 30-90 ngày; An toàn: > 90 ngày | ⏳ Chờ ký duyệt |
| **BDR-06** | Chính sách lưu giữ nhật ký Audit Trail | Lưu trữ bất biến tối thiểu **5 năm** trên PostgreSQL & S3 Glacier | ⏳ Chờ ký duyệt |
| **BDR-07** | Tiêu chuẩn mã vạch tiếp nhận hàng nhà máy | Bắt buộc 100% pallet dán nhãn GS1-128 chuẩn Masan Global | ⏳ Chờ ký duyệt |

---

## 4. TỔNG KẾT ĐÁNH GIÁ SẴN SÀNG VẬN HÀNH (OPERATIONAL READINESS SUMMARY)

1. **Về mặt Kiểm thử chức năng (Functional Testing):**  
   - Hệ thống đạt **37/43 tính năng (86%)** hoàn thiện xuất sắc và sẵn sàng cho kiểm thử thủ công người dùng ngay lập tức.
   - Các luồng nghiệp vụ cốt lõi: Tiếp nhận hàng PO, Dock Quarantine, Sơ đồ kệ 3D, Soft Reservation FEFO, Picking, Shipping, Kiểm kê đếm mù 2 vòng SoD, QC 147 tickets, Audit trail hoạt động hoàn hảo 100%.

2. **Về mặt Go-Live Doanh nghiệp (Enterprise Production Go-Live):**  
   - Hiện tại hệ thống được xếp loại **NO-GO cho Production thực tế** cho đến khi:
     1. Ký duyệt hoàn tất 7 chính sách BDR với đại diện Masan.
     2. Hoàn thành trang bị đầu đọc PDA quét mã vạch vật lý tại cửa kho.
     3. Xây dựng kênh tích hợp trực tiếp Enterprise API với Oracle ERP.
