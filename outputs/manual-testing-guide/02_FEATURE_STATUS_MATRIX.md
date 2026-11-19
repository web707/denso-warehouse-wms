# MA TRẬN TRẠNG THÁI TÍNH NĂNG TOÀN DIỆN (FEATURE STATUS MATRIX)
## DỰ ÁN HỆ THỐNG QUẢN LÝ KHO MASAN CONSUMER WMS
**Ngày lập báo cáo:** 15/11/2026  
**Môi trường khảo sát:** Staging (`http://localhost:4350`, API `5050`) & QA (`http://localhost:4340`, API `5036`)  
**Tình trạng kiểm tra:** Đối chiếu trực tiếp Source code (NestJS + React/Vite), Database PostgreSQL (`wms_staging_test` / `wms_historical_repair_test`), API Spec và Browser UI Execution.

---

## 1. ĐỊNH NGHĨA TRẠNG THÁI (STATUS DEFINITIONS)

| Trạng thái | Ký hiệu | Ý nghĩa thực tế trong hệ thống |
| :--- | :---: | :--- |
| **FULLY WORKING** | ✅ | Tính năng hoàn chỉnh: UI có form/nút bấm, Backend NestJS xử lý logic + transaction DB đầy đủ, dữ liệu lưu chuẩn PostgreSQL, có audit log và phản hồi UI trực quan. |
| **PARTIAL** | ⚠️ | Tính năng chạy được một phần luồng: UI hoặc API hoạt động nhưng thiếu một số bước nghiệp vụ thực tế (ví dụ: mô phỏng đóng thùng thay vì trạm quét thực, đồng bộ Oracle ERP dạng file JSON thay vì Webhook/SOAP). |
| **PLACEHOLDER** | ℹ️ | Giao diện đã dựng sẵn bảng biểu/thông tin để tham khảo nhưng chưa có action tạo/sửa thực tế trên DB (chủ yếu là view-only hoặc đọc từ master seed). |
| **BLOCKED** | 🚫 | Tính năng bị chặn bởi yếu tố ngoại vi/phần cứng: logic phần mềm có sẵn nhưng không thể thực hiện hoàn chỉnh nếu thiếu thiết bị thực địa (ví dụ: quét PDA Zebra qua laser, in decal QR qua máy in ZPL). |
| **PENDING APPROVAL** | ⏳ | Tính năng hoặc dữ liệu đã sẵn sàng kỹ thuật nhưng đang bị khóa logic/chặn phê duyệt do cần quyết định pháp lý / SOP từ Hội đồng vận hành Masan (BDR Register). |

---

## 2. MA TRẬN TRẠNG THÁI CHI TIẾT TỪNG TÍNH NĂNG

### A. NHÓM VẬN HÀNH (OPERATIONS)

| STT | Mã Tính Năng | Tên Tính Năng & Phân Hệ | Route Frontend | Backend API Endpoint | Trạng Thái | Đánh Giá Chi Tiết & Giới Hạn Nghiệp Vụ |
|:---:|:---|:---|:---|:---|:---:|:---|
| 1 | **DSH-01** | Dashboard KPI Overview | `/` | `GET /api/inventory/summary`<br>`GET /api/racks/utilization` | ✅ FULLY WORKING | Hiển thị 8 cards KPI: Tổng tồn (cases), SKU active, Vốn tồn kho (VND), Trực quan hóa công suất kệ 3D, Cảnh báo hạn dùng FEFO, Lô chờ QC. Tự refresh dữ liệu chuẩn xác. |
| 2 | **DSH-02** | Sức chứa Zone & Cảnh báo kho | `/` | `GET /api/zones`<br>`GET /api/reports/dashboard` | ✅ FULLY WORKING | Hiển thị % lấp đầy theo Zone A, B, C, Quarantine. Có biểu đồ cảnh báo tồn dưới ngưỡng an toàn (Safety Stock). |
| 3 | **RCV-01** | Nhận hàng theo PO (Standard Receiving) | `/inventory` (Tab Receiving) | `POST /api/inbound/po-receipt` | ✅ FULLY WORKING | Cho phép nhập PO number, Nhà cung cấp, chọn SKU Masan, nhập số lượng, số lô, NSX, HSD. Ghi nhận `wms_orders` và `order_items` với status `RECEIVED`. |
| 4 | **RCV-02** | Xử lý Sai lệch PO (Thiếu / Thừa / Hỏng) | `/inventory` (Tab Receiving) | `POST /api/inbound/po-receipt` (discrepancy payload) | ✅ FULLY WORKING | Form tự động tính: Chênh lệch = Thực nhận - PO. Nếu có hàng hỏng (damaged > 0), hệ thống tự sinh mã biên bản `DISC-xxxx`, bắt buộc nhập ghi chú nguyên nhân. |
| 5 | **RCV-03** | Dock Quarantine tự động | `/inventory` & `/zones` | `POST /api/inbound/po-receipt` | ✅ FULLY WORKING | Khi ghi nhận hàng hỏng hoặc sai lệch nghiêm trọng, hệ thống tự động đưa số lượng hỏng vào vị trí cách ly `DOCK-QUARANTINE` (Zone Q), không cho phép phân bổ xuất kho. |
| 6 | **RCV-04** | Nhập kho thủ công không PO (Standard Inbound) | `/inventory` (Tab Tiêu chuẩn) | `POST /api/inventory/inbound` | ✅ FULLY WORKING | Dành cho nhập nội bộ hoặc trả hàng: Chọn SKU, Rack đích (A-01..C-05), Lot ID, số lượng, NSX, HSD. Kiểm tra sức chứa kệ trước khi ghi sổ. |
| 7 | **RCV-05** | Putaway (Cất hàng vào kệ) | `/inventory` | `POST /api/inventory/transfer` | ✅ FULLY WORKING | Di chuyển hàng từ Staging Inbound / Dock vào kệ chính thức. Kiểm tra nghiêm ngặt quy tắc `WMS_ONE_SKU_PER_RACK`. |
| 8 | **OUT-01** | Tạo Đơn Xuất Kho (Dispatch Order) | `/dispatch-orders` | `POST /api/dispatch-orders` | ✅ FULLY WORKING | Form tạo đơn xuất gồm: Mã đơn `DO-xxxx`, Khách hàng (VinMart, BigC...), Loại đơn, Danh sách Items (SKU + số lượng yêu cầu). |
| 9 | **OUT-02** | Soft Reservation với Thuật Toán FEFO | `/dispatch-orders` | `POST /api/dispatch-orders/:id/reserve` | ✅ FULLY WORKING | Tính năng cốt lõi: Backend tự quét tồn khả dụng (`AVAILABLE` + QC `PASSED`), ưu tiên lô có HSD gần nhất (First Expired First Out). Khóa mềm tồn (`reserved_quantity`), ngăn ngừa over-selling. |
| 10 | **OUT-03** | Nhặt hàng theo Picking List | `/dispatch-orders` | `POST /api/dispatch-orders/:id/pick` | ✅ FULLY WORKING | Hiển thị bảng chỉ dẫn nhân viên kho đến đúng Tên kệ, Vị trí slot, Lô và Số lượng cần nhặt. Bấm "Xác nhận nhặt hàng" chuyển trạng thái đơn sang `PICKED`. |
| 11 | **OUT-04** | Đóng gói đơn hàng (Packing Station) | `/dispatch-orders` & `/packing-rules` | `GET /api/packing-rules` | ⚠️ PARTIAL | Đã có thuật toán 3D Bin Packing tính toán thể tích thùng carton và container, nhưng chưa có màn hình trạm đóng gói chuyên dụng để quét Barcode từng case vào thùng vận chuyển. |
| 12 | **OUT-05** | Xuất kho & Giao hàng (Dispatch / Shipping) | `/dispatch-orders` | `POST /api/dispatch-orders/:id/ship` | ✅ FULLY WORKING | Trừ tồn vật lý thực tế trên kệ (`wms_inventory` và `parts`), giải phóng `reserved_quantity`, chuyển trạng thái đơn sang `SHIPPED`, ghi log audit và xuất phiếu vận chuyển. |
| 13 | **OUT-06** | Hủy đơn xuất & Giải phóng Giữ tồn | `/dispatch-orders` | `POST /api/dispatch-orders/:id/cancel` | ✅ FULLY WORKING | Cho phép hủy đơn khi đang ở trạng thái DRAFT hoặc RESERVED. Tự động hoàn trả toàn bộ số lượng giữ tồn về tồn khả dụng (ATP) ngay lập tức. |
| 14 | **CC-01** | Khởi tạo Đợt Kiểm Kê (Cycle Count) | `/cycle-counts` | `POST /api/cycle-counts` | ✅ FULLY WORKING | Tạo đợt kiểm kê theo Zone hoặc Toàn kho. Gán phân công nhân viên đếm Vòng 1 và Vòng 2. |
| 15 | **CC-02** | Đếm mù Vòng 1 (Blind Count Round 1) | `/cycle-counts` | `POST /api/cycle-counts/:id/count` (round: 1) | ✅ FULLY WORKING | Người đếm KHÔNG nhìn thấy tồn hệ thống (Blind). Nhập số lượng thực tế đếm được theo từng SKU và Kệ. Hệ thống khóa không cho xem chênh lệch ở vòng này. |
| 16 | **CC-03** | Đếm Vòng 2 & Nguyên tắc SoD | `/cycle-counts` | `POST /api/cycle-counts/:id/count` (round: 2) | ✅ FULLY WORKING | Thực hiện khi có sai lệch > 2%. Bắt buộc kiểm soát tách biệt nhiệm vụ (Segregation of Duties): Người đếm Vòng 2 PHẢI KHÁC người đếm Vòng 1. Backend từ chối nếu cùng user. |
| 17 | **CC-04** | So lệch & Phê duyệt Điều chỉnh Tồn | `/cycle-counts` | `POST /api/cycle-counts/:id/approve` | ✅ FULLY WORKING | Chỉ Admin / Kho trưởng mới có quyền phê duyệt. Hiển thị bảng so lệch 3 cột: Hệ thống, Vòng 1, Vòng 2. Khi duyệt, backend tự động cân chỉnh tồn kho thực tế và tạo audit record. |
| 18 | **INV-01** | Bảng Tra Cứu Tồn Kho Chi Tiết (Ledger) | `/inventory` (Tab Tiêu chuẩn) | `GET /api/inventory/ledger` | ✅ FULLY WORKING | Bảng tra cứu toàn diện: Mã SKU, Tên sản phẩm, Lot ID, Tên Kệ, Số lượng vật lý, Tồn khả dụng (ATP), Tồn đang giữ (Reserved), Ngày SX, Hạn dùng, Trạng thái QC. |
| 19 | **INV-02** | Điều chuyển Kho Nội Bộ (Transfer) | `/inventory` (Tab Tiêu chuẩn) | `POST /api/inventory/transfer` | ✅ FULLY WORKING | Cho phép chuyển hàng giữa các kệ (Full transfer hoặc Partial transfer). Kiểm tra quy tắc 1 kệ 1 SKU và sức chứa tối đa của kệ nhận. |
| 20 | **CAT-01** | Danh Mục Sản Phẩm Masan (Catalog) | `/catalog` | `GET /api/catalog/products` | ✅ FULLY WORKING | Hiển thị 6 dòng SKU chủ lực: Nước mắm Nam Ngư Đệ Nhị, Nước tương Chinsu Nấm Shiitake, Mì Kokomi Đại 90g, Mì Omachi Xốt Bò Hầm, Cà phê Vinacafe CHẤT, Nước tăng lực Wakeup 247. Kèm barcode EAN-13, quy cách đóng gói (cases/pallet). |
| 21 | **FEFO-01** | Giám Sát Phân Tầng Hạn Dùng (FEFO Board) | `/fefo` | `GET /api/inventory/fefo-status` | ✅ FULLY WORKING | Phân loại trực quan theo 3 cấp độ: Nguy cấp (<30 ngày - Đỏ), Cần chú ý (30-90 ngày - Vàng), An toàn (>90 ngày - Xanh). Hiển thị thứ tự ưu tiên xuất kho theo FEFO rank. |
| 22 | **QR-01** | Tạo & Tra Cứu Mã QR/Barcode Vị Trí & Lô | `/qr-labels` | `GET /api/qr-labels/generate` | ✅ FULLY WORKING | Sinh mã QR code và Barcode SVG/Canvas cho: Mã kệ (Rack ID), Mã lô (Lot ID), Mã đơn xuất, Mã sản phẩm EAN-13. Hỗ trợ in nhãn tem nhiệt. |
| 23 | **PDA-01** | Trình Phân Tích Chuẩn GS1-128 | Nền tảng Core | GS1 Parser module | 🚫 BLOCKED (Hardware) | Đã tích hợp hàm bóc tách mã AI: (01) GTIN, (10) Batch, (17) Expiry Date, (21) Serial. Tuy nhiên việc quét thực tế qua thiết bị PDA chuyên dụng (Zebra TC26/Honeywell EDA52) bị chặn do môi trường test không có thiết bị vật lý kết nối cổng COM/HID. |

---

### B. NHÓM QUẢN LÝ KHO & KHÔNG GIAN LƯU TRỮ (WAREHOUSE & SPATIAL)

| STT | Mã Tính Năng | Tên Tính Năng & Phân Hệ | Route Frontend | Backend API Endpoint | Trạng Thái | Đánh Giá Chi Tiết & Giới Hạn Nghiệp Vụ |
|:---:|:---|:---|:---|:---|:---:|:---|
| 24 | **3D-01** | Sơ Đồ Kho 3D Trực Quan (Interactive 3D) | `/racks` | `GET /api/racks/spatial` | ✅ FULLY WORKING | Dựng toàn bộ 18 kệ thuộc 3 Zone A, B, C và Zone Q bằng Three.js / Canvas. Hỗ trợ xoay góc nhìn (Orbit controls), zoom in/out, pan. |
| 25 | **3D-02** | Mã Hóa Màu Trạng Thái Kệ 3D | `/racks` | `GET /api/racks/spatial` | ✅ FULLY WORKING | Kệ đổi màu theo trạng thái: Trống (Xám), Có hàng bình thường (Xanh lá), Đầy công suất >90% (Vàng cam), Kệ cách ly/QC lỗi (Đỏ), Kệ bị khóa/sai lệch (Tím). |
| 26 | **3D-03** | Chi Tiết Kệ (Bin Inspector Drawer) | `/racks` | `GET /api/racks/:id` | ✅ FULLY WORKING | Click chuột vào bất kỳ kệ 3D nào sẽ mở thanh trượt chi tiết: Xem SKU đang chứa, số lượng cases, Lot ID, hạn dùng, % công suất và lịch sử dịch chuyển gần nhất. |
| 27 | **3D-04** | Điều Chuyển Trực Tiếp Trên Sơ Đồ 3D | `/racks` | `POST /api/inventory/transfer` | ✅ FULLY WORKING | Nút bấm "Điều chuyển nhanh" ngay trong Drawer của kệ: Chọn kệ đích trực quan trên sơ đồ, nhập số lượng cần chuyển và xác nhận tức thì. |
| 28 | **ZON-01** | Quản Lý Phân Khu Kho (Zones) | `/zones` | `GET /api/zones` | ✅ FULLY WORKING | Danh mục và thông số Zone A (Gia vị lỏng: Nước mắm, nước tương), Zone B (Thực phẩm tiện lợi: Mì gói ăn liền), Zone C (Đồ uống đóng chai), Zone Q (Khu cách ly hàng chờ phán quyết QC). |
| 29 | **RUL-01** | Quy Tắc Lưu Trữ (Packing & Storage Rules) | `/packing-rules` | `GET /api/packing-rules` | ✅ FULLY WORKING | Thiết lập quy định: Trọng tải sàn, chiều cao tối đa của pallet, quy tắc xếp chồng, quy tắc cô lập hàng hỏng/hóa chất tẩy rửa (nếu có). |

---

### C. NHÓM CHUỖI CUNG ỨNG & CHẤT LƯỢNG (SUPPLY CHAIN & QC)

| STT | Mã Tính Năng | Tên Tính Năng & Phân Hệ | Route Frontend | Backend API Endpoint | Trạng Thái | Đánh Giá Chi Tiết & Giới Hạn Nghiệp Vụ |
|:---:|:---|:---|:---|:---|:---:|:---|
| 30 | **QC-01** | Danh Sách Phiếu Kiểm Định Chất Lượng | `/inspections` | `GET /api/inspections` | ✅ FULLY WORKING | Quản lý 147 phiếu kiểm tra chất lượng theo chuẩn ISO 22000 / IATF 16949. Lọc theo trạng thái: PENDING, PASSED, FAILED, UNDER_INSPECTION. |
| 31 | **QC-02** | Phán Quyết Chất Lượng Lô (Verdict OK/NG) | `/inspections` | `POST /api/inspections/:id/verdict` | ✅ FULLY WORKING | QC Inspector thực hiện phán quyết: Nếu PASSED -> hàng chuyển sang `AVAILABLE` có thể xuất kho; Nếu FAILED/NG -> hàng chuyển sang `BLOCKED` và bắt buộc cách ly. |
| 32 | **QC-03** | Xử Lý Mixed QC & Quy Tắc Cô Lập TRC-04 | `/inspections` & `/trace` | `POST /api/inspections/isolate-lot` | ✅ FULLY WORKING | Đã fix triệt để lỗi Mixed QC (nhiều trạng thái trên 1 lô): Khi 1 sample bị NG, toàn bộ số lượng còn lại của lô đó tự động bị khóa HOLD và di chuyển vào Zone Q để chờ thẩm định lại. |
| 33 | **TRC-01** | Phả Hệ & Truy Vết Chuỗi Cung Ứng (Genealogy Trace) | `/trace` | `GET /api/trace/lot/:lotId` | ✅ FULLY WORKING | Nhập mã Lot ID -> Hiển thị sơ đồ dòng chảy hoàn chỉnh: Nhà cung cấp -> PO nhận hàng -> Nhân viên nhận -> Vị trí kệ lưu trữ -> Phiếu kiểm định QC -> Đơn xuất kho -> Khách hàng nhận. |
| 34 | **SHP-01** | Quản Lý Chuyến Xe Giao Hàng (Shipments) | `/shipments` | `GET /api/shipments` | ⚠️ PARTIAL | Hiển thị danh sách chuyến xe giao hàng, biển số xe, tài xế, danh sách đơn ghép. Thiếu kết nối GPS tracking thời gian thực và chữ ký điện tử ePOD của tài xế. |
| 35 | **SHP-02** | Đồng Bộ Oracle ERP (ERP Integration) | `/shipments` | `POST /api/integrations/oracle/sync` | ⚠️ PARTIAL | Chức năng đồng bộ hiện tại hoạt động theo cơ chế Import/Export file chuẩn JSON/CSV định kỳ. Chưa có kết nối Trực tiếp thông qua Oracle EBS Web Service / REST API bảo mật. |
| 36 | **WO-01** | Kế Hoạch Sản Xuất / Đóng Gói Lại (Work Orders) | `/work-orders` | `GET /api/work-orders` | ℹ️ PLACEHOLDER | Màn hình hiển thị danh sách lệnh đóng gói combo / khuyến mãi từ nhà máy. Chưa hỗ trợ tạo lệnh mới hoặc tự động bóc tách Bill of Materials (BOM) trừ nguyên liệu. |

---

### D. NHÓM QUẢN TRỊ & HỆ THỐNG (ADMINISTRATION & SYSTEM)

| STT | Mã Tính Năng | Tên Tính Năng & Phân Hệ | Route Frontend | Backend API Endpoint | Trạng Thái | Đánh Giá Chi Tiết & Giới Hạn Nghiệp Vụ |
|:---:|:---|:---|:---|:---|:---:|:---|
| 37 | **USR-01** | Quản Lý Danh Sách Người Dùng (Users) | `/users` | `GET /api/users` | ✅ FULLY WORKING | Chỉ Admin mới có quyền truy cập: Xem danh sách tài khoản, Họ tên, Email, Vai trò (Role), Phòng ban, Trạng thái (Active/Inactive), Thời điểm đăng nhập cuối. |
| 38 | **USR-02** | Tạo Mới & Phân Quyền Người Dùng (RBAC) | `/users` | `POST /api/users` | ✅ FULLY WORKING | Tạo tài khoản mới, gán đúng 1 trong 5 vai trò hệ thống: `admin`, `warehouse_manager`, `inbound_operator`, `outbound_operator`, `qc_inspector`. Mật khẩu được mã hóa bcrypt 10 rounds. |
| 39 | **USR-03** | Khóa / Kích Hoạt Tài Khoản | `/users` | `PATCH /api/users/:id/status` | ✅ FULLY WORKING | Cho phép tạm dừng tài khoản khi nhân viên nghỉ việc hoặc vi phạm quy chế kho. Tài khoản bị khóa sẽ không thể lấy JWT token mới. |
| 40 | **AUD-01** | Nhật Ký Hoạt Động Bất Biến (Audit Trail History) | `/history` | `GET /api/history` | ✅ FULLY WORKING | Lưu vết 100% biến động kho: Ai thực hiện, lúc mấy giờ, IP nào, hành động là gì (Nhận hàng, Chuyển kệ, Xuất hàng, Sửa kiểm kê), Chi tiết trước và sau khi đổi. Không ai có thể xóa bảng này. |
| 41 | **REP-01** | Báo Cáo Phân Tích & Xuất Dữ Liệu | `/reports` | `GET /api/reports/turnover`<br>`GET /api/reports/variance` | ✅ FULLY WORKING | Xem báo cáo tốc độ quay vòng tồn kho, báo cáo sai lệch kiểm kê, tỷ lệ hoàn tất đơn hàng đúng hạn. Hỗ trợ nút bấm Xuất file Excel / CSV chuẩn. |
| 42 | **GUD-01** | Hướng Dẫn Nghiệp Vụ Tương Tác 3D | `/guide` | N/A (Frontend Static/State) | ✅ FULLY WORKING | Cung cấp tài liệu quy trình SOP chuẩn Masan và mô hình diễn họa 3D quy trình Inbound từ cửa Dock đến giá kệ kho. |
| 43 | **BDR-01** | Xử Lý 2 Kệ Lịch Sử Trộn SKU (Zone A R01/R02) | N/A (Database Core) | N/A | ⏳ PENDING APPROVAL | Hai kệ A-01 và A-02 đang lưu giữ dữ liệu lịch sử chứa 2 SKU khác nhau. Đã có kịch bản di chuyển (`POST /api/inventory/transfer`) nhưng đang chờ lệnh xác minh hiện trường vật lý của Ban giám đốc kho. |

---

## 3. TỔNG KẾT TỶ LỆ HOÀN THIỆN THEO PHÂN HỆ

```
┌───────────────────────────────────────────────────────────┐
│               TỔNG QUAN TÍNH NĂNG TOÀN HỆ THỐNG           │
├──────────────────────────┬───────┬─────────┬──────────────┤
│ Phân Hệ Nghiệp Vụ        │ Tổng  │ Sẵn Sàng│ Tỷ Lệ        │
├──────────────────────────┼───────┼─────────┼──────────────┤
│ Vận hành Kho (In/Out/CC) │ 23    │ 21      │ 91.3%        │
│ Không gian & Kệ Kho 3D   │ 6     │ 6       │ 100.0%       │
│ Chuỗi Cung Ứng & QC      │ 7     │ 4       │ 57.1%        │
│ Quản trị & Báo Cáo Audit │ 7     │ 6       │ 85.7%        │
├──────────────────────────┼───────┼─────────┼──────────────┤
│ TỔNG CỘNG HỆ THỐNG       │ 43    │ 37      │ 86.0%        │
└──────────────────────────┴───────┴─────────┴──────────────┘
```

- **Sẵn sàng kiểm thử thủ công ngay (Ready for Manual Test):** 37 tính năng (86.0%)
- **Cần lưu ý kiểm thử hạn chế (Partial):** 3 tính năng (Packing, Shipment, Oracle sync)
- **Tạm dừng / View-only (Placeholder):** 1 tính năng (Work Orders)
- **Chặn do thiếu phần cứng (Blocked Hardware):** 1 tính năng (PDA laser scanner)
- **Chờ phê duyệt nghiệp vụ (Pending Business Approval):** 1 tính năng (Zone A historical repair)
