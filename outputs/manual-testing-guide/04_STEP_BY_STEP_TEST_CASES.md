# KỊCH BẢN KIỂM THỬ THỦ CÔNG TỪNG BƯỚC (STEP-BY-STEP TEST CASES)
## HỆ THỐNG MASAN CONSUMER WMS – ENTERPRISE EDITION
**Môi trường thực hiện:** Staging (`http://localhost:4350`) & QA (`http://localhost:4340`)  
**Tác giả:** QA Lead & Senior Full-Stack Test Engineer  
**Phiên bản:** 1.0 (Phủ 100% các luồng nghiệp vụ cốt lõi)

---

## MỤC LỤC BÀI TEST
1. [TC-DSH: Kiểm thử Màn hình Giám sát Tổng quan (Dashboard)](#1-tc-dsh-kiểm-thử-màn-hình-giám-sát-tổng-quan-dashboard)
2. [TC-RCV: Kiểm thử Tiếp nhận hàng theo PO & Xử lý Sai lệch](#2-tc-rcv-kiểm-thử-tiếp-nhận-hàng-theo-po--xử-lý-sai-lệch)
3. [TC-QCI: Kiểm thử Phán quyết Chất lượng & Cô lập Lô hỏng](#3-tc-qci-kiểm-thử-phán-quyết-chất-lượng--cô-lập-lô-hỏng)
4. [TC-PTW: Kiểm thử Cất hàng & Quy tắc Một Kệ Một SKU](#4-tc-ptw-kiểm-thử-cất-hàng--quy-tắc-một-kệ-một-sku)
5. [TC-OUT: Kiểm thử Xuất kho, Soft Reservation & Thuật toán FEFO](#5-tc-out-kiểm-thử-xuất-kho-soft-reservation--thuật-toán-fefo)
6. [TC-CYC: Kiểm thử Kiểm kê Định kỳ, Đếm mù & Quy tắc SoD](#6-tc-cyc-kiểm-thử-kiểm-kê-định-kỳ-đếm-mù--quy-tắc-sod)
7. [TC-3DM: Kiểm thử Sơ đồ Kho 3D Tương tác & Điều chuyển Nhanh](#7-tc-3dm-kiểm-thử-sơ-đồ-kho-3d-tương-tác--điều-chuyển-nhanh)
8. [TC-SEC: Kiểm thử Quản lý Người dùng, Phân quyền RBAC & Audit Trail](#8-tc-sec-kiểm-thử-quản-lý-người-dùng-phân-quyền-rbac--audit-trail)

---

## 1. TC-DSH: KIỂM THỬ MÀN HÌNH GIÁM SÁT TỔNG QUAN (DASHBOARD)

### Test Case TC-DSH-01: Kiểm tra hiển thị đầy đủ các chỉ số KPI và biểu đồ
- **Mã Test:** `TC-DSH-01`
- **Mục đích:** Xác minh màn hình Dashboard tải đúng dữ liệu tổng hợp từ PostgreSQL và render đầy đủ các widget KPI.
- **URL màn hình:** `http://localhost:4350/`
- **Tài khoản / Vai trò:** Bất kỳ (`admin`, `warehouse_manager`, `inbound_operator`, `outbound_operator`, `qc_inspector`).
- **Dữ liệu chuẩn bị:** Dữ liệu seed mặc định trong database.
- **Thứ tự các bước thực hiện (Click Sequence):**
  1. Mở trình duyệt, truy cập `http://localhost:4350/`.
  2. Quan sát hàng thẻ thống kê (KPI Cards) phía trên cùng.
  3. Quan sát biểu đồ sức chứa các Zone A, B, C và Zone Q.
  4. Quan sát danh sách các cảnh báo hàng cận hạn FEFO và lô chờ QC.
- **Kết quả mong đợi:**
  - Hiển thị 8 thẻ KPI: Tổng số lượng tồn (cases), Tổng giá trị tồn (VND), Số SKU active (6 SKU), Công suất sử dụng kho (%), Đơn xuất chờ xử lý, Lô chờ QC kiểm định.
  - Các số liệu không hiển thị `NaN` hay `undefined`.
  - Biểu đồ phân bổ Zone hiển thị thanh tiến độ trực quan.
- **Tiêu chuẩn PASS:** Tất cả các card KPI hiển thị số liệu thực tế từ database, không có lỗi console.

---

## 2. TC-RCV: KIỂM THỬ TIẾP NHẬN HÀNG THEO PO & XỬ LÝ SAI LỆCH

### Test Case TC-RCV-01: Nhận hàng đủ theo PO (Standard Receiving)
- **Mã Test:** `TC-RCV-01`
- **Mục đích:** Xác minh quy trình nhận hàng đúng số lượng theo PO từ nhà máy Masan.
- **URL màn hình:** `http://localhost:4350/inventory`
- **Tài khoản / Vai trò:** `inbound_operator` hoặc `admin`.
- **Dữ liệu test:**
  - Mã PO: `PO-TEST-001`
  - Nhà cung cấp: `Masan Hải Dương Factory`
  - SKU: `MSN-FMCG-001` (Nước mắm Nam Ngư Đệ Nhị 900ml)
  - Số lượng PO: `200`
  - Thực nhận: `200`
  - Hàng hỏng: `0`
  - Lot ID: `LOT-NN-TEST-01`
  - NSX: `2026-11-01`, HSD: `2027-11-01`
- **Thứ tự các bước thực hiện:**
  1. Đăng nhập hệ thống, chọn menu **"Giao dịch kho"** (`/inventory`).
  2. Đảm bảo đang ở tab **"Nhập kho theo PO"**.
  3. Nhập lần lượt các trường: Mã PO, Nhà cung cấp, chọn SKU `MSN-FMCG-001`.
  4. Nhập Số lượng PO: `200`, Thực nhận: `200`, Hàng hỏng: `0`.
  5. Nhập Lot ID: `LOT-NN-TEST-01`, chọn NSX và HSD.
  6. Nhấp nút màu xanh **"Xác Nhận Nhận Hàng"**.
- **Kết quả mong đợi:**
  - Hệ thống hiển thị thông báo Toast xanh: `Nhận hàng thành công`.
  - Đơn nhận hàng xuất hiện trong bảng danh sách đơn nhập với trạng thái `RECEIVED`.
  - Tồn kho tạm tại vị trí đệm `DOCK-STAGING` tăng thêm 200 thùng.
- **Tiêu chuẩn PASS:** Bản ghi được tạo trong bảng `wms_orders` và `order_items`, không phát sinh biên bản sai lệch.

---

### Test Case TC-RCV-02: Nhận hàng sai lệch (Thiếu & Hỏng) và kích hoạt Dock Quarantine
- **Mã Test:** `TC-RCV-02`
- **Mục đích:** Xác minh hệ thống tự động sinh biên bản sai lệch và cách ly hàng hỏng tại Zone Q.
- **URL màn hình:** `http://localhost:4350/inventory`
- **Tài khoản / Vai trò:** `inbound_operator` hoặc `admin`.
- **Dữ liệu test:**
  - Mã PO: `PO-DISC-002`
  - Nhà cung cấp: `Masan Bình Dương Factory`
  - SKU: `MSN-FMCG-004` (Mì Omachi Xốt Bò Hầm)
  - Số lượng PO: `500`
  - Thực nhận: `480` (Thiếu 20 thùng)
  - Hàng hỏng: `10` (Trong 480 thùng có 10 thùng bị móp méo/rách bao)
  - Lý do sai lệch: `Thùng hàng bị ướt và đè bẹp trong quá trình vận chuyển`
  - Lot ID: `LOT-OMA-DISC-01`
- **Thứ tự các bước thực hiện:**
  1. Tại màn hình `/inventory`, nhập Mã PO: `PO-DISC-002`.
  2. Chọn SKU `MSN-FMCG-004`.
  3. Nhập PO Qty: `500`, Received Qty: `480`. Quan sát trường Chênh lệch tự hiển thị `-20`.
  4. Nhập Damaged Qty: `10`.
  5. Quan sát ô nhập "Lý do sai lệch" bắt buộc hiển thị viền đỏ nếu để trống. Nhập lý do vào ô.
  6. Nhấp nút **"Xác Nhận Nhận Hàng"**.
- **Kết quả mong đợi:**
  - Thông báo nhận hàng kèm cảnh báo sai lệch: `Biên bản sai lệch DISC-xxxx đã được tạo`.
  - 470 thùng nguyên vẹn chuyển vào `DOCK-STAGING`.
  - 10 thùng hàng hỏng tự động chuyển vào `DOCK-QUARANTINE` (Zone Q) với trạng thái QC `PENDING` / `HOLD`.
- **Tiêu chuẩn PASS:** Xuất hiện biên bản sai lệch trong danh mục, 10 thùng hỏng bị cô lập không được phép xuất.

---

## 3. TC-QCI: KIỂM THỬ PHÁN QUYẾT CHẤT LƯỢNG & CÔ LẬP LÔ HỎNG

### Test Case TC-QCI-01: Phán quyết lô ĐẠT (PASS) chuyển sang AVAILABLE
- **Mã Test:** `TC-QCI-01`
- **Mục đích:** QC xác nhận mẫu đạt chuẩn, giải phóng hàng cho phép xuất kho.
- **URL màn hình:** `http://localhost:4350/inspections`
- **Tài khoản / Vai trò:** `qc_inspector` hoặc `admin`.
- **Thứ tự các bước thực hiện:**
  1. Đăng nhập tài khoản QC Inspector.
  2. Nhấp vào menu **"Kiểm tra chất lượng"** (`/inspections`).
  3. Chọn một phiếu kiểm định đang có trạng thái `PENDING`.
  4. Nhấp vào nút **"Xem xét kiểm định (Inspect)"**.
  5. Chọn kết quả: **"Đạt (Pass / OK)"**.
  6. Nhập ghi chú: `Mẫu kiểm nghiệm vi sinh và bao bì đạt chuẩn ISO 22000`.
  7. Nhấp nút **"Lưu phán quyết"**.
- **Kết quả mong đợi:**
  - Trạng thái phiếu kiểm định chuyển thành `PASSED`.
  - Trạng thái QC của lô hàng trong kho chuyển từ `PENDING` thành `AVAILABLE`.
  - Số lượng hàng này được cộng vào Tồn khả dụng (ATP).
- **Tiêu chuẩn PASS:** Database cập nhật `qc_status = 'PASSED'`, có lịch sử ghi nhận trong audit log.

---

### Test Case TC-QCI-02: Phán quyết lô KHÔNG ĐẠT (FAIL/NG) và kích hoạt quy tắc TRC-04
- **Mã Test:** `TC-QCI-02`
- **Mục đích:** Xác minh quy tắc TRC-04: Lô có mẫu NG sẽ bị khóa toàn bộ và chuyển vào Zone Q.
- **URL màn hình:** `http://localhost:4350/inspections`
- **Tài khoản / Vai trò:** `qc_inspector`.
- **Thứ tự các bước thực hiện:**
  1. Tại màn hình `/inspections`, chọn một phiếu kiểm định `PENDING`.
  2. Nhấp **"Xem xét kiểm định"**.
  3. Chọn kết quả: **"Không đạt (Fail / NG)"**.
  4. Chọn lý do: `Bao bì bị xì hơi, không đạt độ kín chân không`.
  5. Bấm **"Xác nhận phán quyết"**.
- **Kết quả mong đợi:**
  - Trạng thái phiếu kiểm định chuyển sang `FAILED`.
  - Toàn bộ số lượng còn lại của lô này chuyển sang `BLOCKED`.
  - Hệ thống tự động tạo yêu cầu di chuyển toàn bộ lô này vào khu cách ly Zone Q.
- **Tiêu chuẩn PASS:** Lô bị khóa hoàn toàn, khi tạo đơn xuất kho hệ thống không cho phép chọn lô này.

---

## 4. TC-PTW: KIỂM THỬ CẤT HÀNG & QUY TẮC MỘT KỆ MỘT SKU

### Test Case TC-PTW-01: Cất hàng vào kệ trống đúng Zone
- **Mã Test:** `TC-PTW-01`
- **Mục đích:** Di chuyển hàng từ khu vực đệm vào kệ lưu trữ chính thức.
- **URL màn hình:** `http://localhost:4350/inventory` (Tab Điều chuyển)
- **Tài khoản / Vai trò:** `inbound_operator` hoặc `warehouse_manager`.
- **Thứ tự các bước thực hiện:**
  1. Vào menu **"Giao dịch kho"**, chuyển sang tab **"Điều chuyển & Cất hàng"**.
  2. Chọn Vị trí nguồn: `DOCK-STAGING`.
  3. Chọn SKU và Lot ID tương ứng.
  4. Chọn Kệ đích: Chọn một kệ đang trống (Ví dụ: Kệ `B-03` cho mì gói).
  5. Nhập số lượng cần cất: `100`.
  6. Nhấp nút **"Xác Nhận Điều Chuyển"**.
- **Kết quả mong đợi:**
  - Toast thông báo thành công: `Điều chuyển thành công 100 cases vào kệ B-03`.
  - Tồn trên kệ B-03 hiển thị 100 cases.
  - Trên sơ đồ 3D, kệ B-03 đổi màu từ Xám sang Xanh lá.
- **Tiêu chuẩn PASS:** Hàng được chuyển đúng vị trí, kiểm tra sức chứa kệ không vượt mức tối đa.

---

### Test Case TC-PTW-02: Vi phạm quy tắc Một Kệ Một SKU (Negative Test)
- **Mã Test:** `TC-PTW-02`
- **Mục đích:** Xác minh hệ thống ngăn chặn hành vi đưa 2 SKU khác nhau vào cùng một kệ.
- **URL màn hình:** `http://localhost:4350/inventory`
- **Tài khoản / Vai trò:** `inbound_operator`.
- **Thứ tự các bước thực hiện:**
  1. Tìm một kệ đang chứa sẵn sản phẩm Mì Omachi (Ví dụ kệ `B-01`).
  2. Tại form điều chuyển, chọn Vị trí nguồn có chứa sản phẩm Nước mắm Nam Ngư (`MSN-FMCG-001`).
  3. Chọn Kệ đích là `B-01`.
  4. Nhập số lượng `50` và bấm nút **"Xác Nhận Điều Chuyển"**.
- **Kết quả mong đợi:**
  - Hệ thống từ chối giao dịch và hiển thị thông báo lỗi màu đỏ:  
    `Rack already contains SKU MSN-FMCG-004. One SKU per rack policy violation.`
  - Không có dữ liệu nào bị thay đổi trong database.
- **Tiêu chuẩn PASS:** Giao dịch bị chặn, bảo toàn nguyên tắc phân vùng độc lập 1 kệ 1 SKU.

---

## 5. TC-OUT: KIỂM THỬ XUẤT KHO, SOFT RESERVATION & THUẬT TOÁN FEFO

### Test Case TC-OUT-01: Tạo đơn xuất và Soft Reservation tự động theo FEFO
- **Mã Test:** `TC-OUT-01`
- **Mục đích:** Xác minh hệ thống tự động quét và khóa giữ lô hàng có hạn dùng gần nhất (FEFO).
- **URL màn hình:** `http://localhost:4350/dispatch-orders`
- **Tài khoản / Vai trò:** `outbound_operator` hoặc `admin`.
- **Dữ liệu test:**
  - SKU: `MSN-FMCG-003` (Mì Kokomi Đại 90g)
  - Số lượng yêu cầu: `50` thùng
  - Khách hàng: `WinMart Distribution Center`
- **Thứ tự các bước thực hiện:**
  1. Đăng nhập Outbound Operator, truy cập `/dispatch-orders`.
  2. Bấm nút **"+ Tạo Đơn Xuất Mới"**.
  3. Nhập Khách hàng `WinMart DC`, chọn SKU `MSN-FMCG-003`, số lượng `50`. Bấm **"Lưu Đơn"**.
  4. Đơn hàng hiển thị trong danh sách ở trạng thái `DRAFT`.
  5. Nhấp nút **"Giữ tồn kho (Reserve)"** trên dòng đơn hàng này.
- **Kết quả mong đợi:**
  - Đơn hàng chuyển trạng thái sang **`RESERVED`**.
  - Kiểm tra chi tiết đơn: Lô được phân bổ là lô có HSD gần nhất (ví dụ: lô hết hạn tháng 01/2027 được ưu tiên trước lô hết hạn tháng 06/2027).
  - Tồn khả dụng (ATP) của SKU này giảm đúng 50 thùng, trong khi Tồn giữ (Reserved) tăng 50 thùng. Tồn vật lý trên kệ chưa thay đổi.
- **Tiêu chuẩn PASS:** Thuật toán FEFO chọn chính xác lot_id có exp_date nhỏ nhất, soft reservation khóa đúng số lượng.

---

### Test Case TC-OUT-02: Nhặt hàng (Picking) và Xuất kho hoàn tất (Shipping)
- **Mã Test:** `TC-OUT-02`
- **Mục đích:** Hoàn thành chu trình xuất hàng từ lúc lấy hàng tại kệ đến khi giao cho xe tải.
- **URL màn hình:** `http://localhost:4350/dispatch-orders`
- **Tài khoản / Vai trò:** `outbound_operator`.
- **Thứ tự các bước thực hiện:**
  1. Trên đơn hàng vừa `RESERVED` ở TC-OUT-01, nhấp nút **"Xem danh sách nhặt hàng"**.
  2. Kiểm tra chỉ dẫn nhặt hàng: Tên kệ, Vị trí slot, Số lượng.
  3. Bấm **"Xác Nhận Đã Nhặt Hàng (Confirm Pick)"**. Đơn chuyển sang `PICKED`.
  4. Nhấp nút **"Xác Nhận Xuất Hàng (Ship Order)"**.
  5. Điền thông tin xe tải: Biển số xe `29C-888.99`, Tài xế `Nguyễn Văn A`.
  6. Bấm **"Hoàn Tất Xuất Kho"**.
- **Kết quả mong đợi:**
  - Đơn hàng chuyển sang trạng thái **`SHIPPED`**.
  - Tồn vật lý trên kệ bị trừ đúng 50 thùng.
  - Số lượng `reserved_quantity` được giải phóng về 0.
  - Một dòng nhật ký xuất kho được ghi tự động vào `/history`.
- **Tiêu chuẩn PASS:** Tồn kho vật lý giảm chính xác, trạng thái đơn là SHIPPED, có đầy đủ audit record.

---

### Test Case TC-OUT-03: Hủy đơn xuất và giải phóng giữ tồn kho (Release Reservation)
- **Mã Test:** `TC-OUT-03`
- **Mục đích:** Xác minh việc hủy đơn giải phóng ngay lập tức số lượng giữ tồn về tồn khả dụng.
- **URL màn hình:** `http://localhost:4350/dispatch-orders`
- **Tài khoản / Vai trò:** `outbound_operator` hoặc `admin`.
- **Thứ tự các bước thực hiện:**
  1. Tạo một đơn xuất mới cho 30 thùng Nước tương Chinsu (`MSN-FMCG-002`).
  2. Bấm nút **"Giữ tồn kho (Reserve)"**. Quan sát ATP giảm 30 thùng.
  3. Bấm nút **"Hủy Đơn (Cancel)"**.
  4. Nhập lý do hủy: `Khách hàng thay đổi kế hoạch giao hàng`.
  5. Xác nhận hủy.
- **Kết quả mong đợi:**
  - Đơn hàng chuyển sang trạng thái `CANCELLED`.
  - Tồn khả dụng (ATP) của SKU Chinsu lập tức tăng lại 30 thùng.
  - `reserved_quantity` giảm về 0.
- **Tiêu chuẩn PASS:** Hoàn trả giữ tồn chính xác 100%, không bị thất thoát hoặc treo tồn khả dụng.

---

## 6. TC-CYC: KIỂM THỬ KIỂM KÊ ĐỊNH KỲ, ĐẾM MÙ & QUY TẮC SOD

### Test Case TC-CYC-01: Khởi tạo đợt kiểm kê và Đếm mù Vòng 1
- **Mã Test:** `TC-CYC-01`
- **Mục đích:** Kiểm tra quy trình đếm mù: người đếm không nhìn thấy tồn hệ thống.
- **URL màn hình:** `http://localhost:4350/cycle-counts`
- **Tài khoản / Vai trò:** `inbound_operator` hoặc `warehouse_manager`.
- **Thứ tự các bước thực hiện:**
  1. Truy cập `/cycle-counts`. Bấm **"+ Tạo Đợt Kiểm Kê Mới"**.
  2. Nhập tên: `Kiểm kê Test Blind Count Vòng 1`, chọn phạm vi: `Zone B`.
  3. Bấm **"Khởi Tạo"**. Đợt kiểm kê có trạng thái `OPEN`.
  4. Nhấp vào đợt kiểm kê vừa tạo để mở bảng kiểm đếm.
  5. **Xác nhận giao diện đếm mù:** Cột số lượng tồn trên hệ thống bị ẩn hoặc hiển thị dấu sao (`***`).
  6. Tại kệ B-01, nhập số lượng đếm được: Ví dụ nhập `245` (giả sử hệ thống đang có `250`).
  7. Bấm **"Gửi Kết Quả Vòng 1"**.
- **Kết quả mong đợi:**
  - Kết quả Vòng 1 được ghi nhận.
  - Do có chênh lệch 5 thùng (>2%), hệ thống tự động yêu cầu **"Cần kiểm đếm Vòng 2"**.
- **Tiêu chuẩn PASS:** Tồn hệ thống được bảo mật trong suốt quá trình đếm Vòng 1, kích hoạt đúng yêu cầu Vòng 2.

---

### Test Case TC-CYC-02: Kiểm tra Quy tắc Phân lập Nhiệm vụ (SoD Violation Test)
- **Mã Test:** `TC-CYC-02`
- **Mục đích:** Đảm bảo hệ thống CHẶN không cho phép cùng 1 người đếm cả 2 vòng.
- **URL màn hình:** `http://localhost:4350/cycle-counts`
- **Tài khoản / Vai trò:** Cùng tài khoản đã thực hiện đếm Vòng 1 ở TC-CYC-01.
- **Thứ tự các bước thực hiện:**
  1. Vẫn dùng tài khoản vừa đếm Vòng 1, bấm vào nút **"Nhập Kết Quả Vòng 2"**.
  2. Nhập số lượng đếm Vòng 2: `248`.
  3. Bấm **"Gửi Kết Quả Vòng 2"**.
- **Kết quả mong đợi:**
  - Hệ thống hiển thị cảnh báo lỗi vi phạm SoD màu đỏ:  
    `Segregation of Duties Violation: Round 2 counter must be different from Round 1 counter.`
  - Giao dịch bị từ chối, kết quả vòng 2 không được lưu.
- **Tiêu chuẩn PASS:** Cơ chế SoD bảo vệ thành công tính minh bạch của dữ liệu kiểm kê.

---

### Test Case TC-CYC-03: Đếm Vòng 2 hợp lệ và Phê duyệt Điều chỉnh Tồn
- **Mã Test:** `TC-CYC-03`
- **Mục đích:** Hoàn tất Vòng 2 bằng tài khoản độc lập và Thủ kho phê duyệt cân đối tồn kho.
- **URL màn hình:** `http://localhost:4350/cycle-counts`
- **Tài khoản / Vai trò:** 
  - Bước đếm Vòng 2: Dùng tài khoản nhân viên khác (Ví dụ: `outbound_operator`).
  - Bước phê duyệt: Dùng tài khoản `warehouse_manager` hoặc `admin`.
- **Thứ tự các bước thực hiện:**
  1. Đăng xuất tài khoản cũ, đăng nhập bằng tài khoản nhân viên kiểm kê thứ 2.
  2. Mở đợt kiểm kê, nhập số lượng Vòng 2: `248`. Bấm **"Gửi Kết Quả Vòng 2"**. (Lưu thành công).
  3. Đăng xuất, đăng nhập bằng tài khoản `warehouse_manager`.
  4. Mở đợt kiểm kê, quan sát bảng so sánh 3 cột: Hệ thống (250), Vòng 1 (245), Vòng 2 (248), Sai lệch (-2 thùng).
  5. Nhấp nút **"Phê Duyệt & Điều Chỉnh Tồn Kho (Approve & Adjust)"**.
- **Kết quả mong đợi:**
  - Trạng thái đợt kiểm kê chuyển sang `COMPLETED`.
  - Tồn kho thực tế tại kệ B-01 được cập nhật chính xác thành `248` thùng.
  - Ghi nhận lịch sử điều chỉnh kiểm kê trong Audit Log.
- **Tiêu chuẩn PASS:** Chu trình kiểm kê 2 vòng khép kín thành công, tồn kho được cân chỉnh chính xác.

---

## 7. TC-3DM: KIỂM THỬ SƠ ĐỒ KHO 3D TƯƠNG TÁC & ĐIỀU CHUYỂN NHANH

### Test Case TC-3DM-01: Thao tác xoay, zoom và xem chi tiết kệ trên sơ đồ 3D
- **Mã Test:** `TC-3DM-01`
- **Mục đích:** Xác minh không gian đồ họa Three.js / Canvas hoạt động mượt mà, phản hồi đúng tương tác chuột.
- **URL màn hình:** `http://localhost:4350/racks`
- **Tài khoản / Vai trò:** Bất kỳ vai trò nào.
- **Thứ tự các bước thực hiện:**
  1. Truy cập menu **"Sơ đồ kho 3D"** (`/racks`).
  2. Dùng chuột trái nhấn giữ và di chuyển để xoay góc nhìn 360 độ quanh kho.
  3. Lăn con lăn chuột để phóng to cận cảnh các kệ Zone A và Zone B.
  4. Nhấp chuột trái trực tiếp vào khối 3D của kệ `A-01`.
- **Kết quả mong đợi:**
  - Sơ đồ 3D phản hồi mượt mà không bị giật lag (đạt >= 30 FPS).
  - Khối kệ được click hiển thị viền sáng (Highlight).
  - Bảng trượt Drawer bên phải mở ra, hiển thị đầy đủ thông tin: Mã kệ `A-01`, Tên sản phẩm đang chứa, Số lượng tồn, Số lô và % công suất sử dụng.
- **Tiêu chuẩn PASS:** 3D Canvas hoạt động ổn định, Drawer mở đúng thông tin của kệ được chọn.

---

## 8. TC-SEC: KIỂM THỬ QUẢN LÝ NGƯỜI DÙNG, PHÂN QUYỀN RBAC & AUDIT TRAIL

### Test Case TC-SEC-01: Kiểm soát phân quyền truy cập theo vai trò (RBAC Guard)
- **Mã Test:** `TC-SEC-01`
- **Mục đích:** Xác minh các màn hình quản trị bị khóa chặt chẽ đối với các tài khoản không có quyền Admin.
- **URL màn hình:** `http://localhost:4350/users`
- **Tài khoản / Vai trò:** `inbound_operator` hoặc `qc_inspector`.
- **Thứ tự các bước thực hiện:**
  1. Đăng nhập với tài khoản `inbound_operator`.
  2. Quan sát thanh menu bên trái: Mục **"Nhân sự & phân quyền"** (`/users`) hoàn toàn KHÔNG xuất hiện.
  3. Cố tình gõ trực tiếp URL `http://localhost:4350/users` vào thanh địa chỉ trình duyệt và nhấn Enter.
- **Kết quả mong đợi:**
  - Hệ thống kích hoạt cơ chế bảo vệ Route (Protected Route Guard).
  - Trình duyệt tự động chuyển hướng người dùng về trang chủ `/` hoặc hiển thị thông báo `403 Forbidden - Không có quyền truy cập`.
- **Tiêu chuẩn PASS:** Người dùng không có quyền không thể truy cập trái phép màn hình quản trị.

---

### Test Case TC-SEC-02: Kiểm tra tính bất biến của Nhật Ký Hoạt Động (Audit Trail)
- **Mã Test:** `TC-SEC-02`
- **Mục đích:** Đảm bảo mọi giao dịch kho đều được ghi nhận đầy đủ và không có nút xóa/sửa trên giao diện.
- **URL màn hình:** `http://localhost:4350/history`
- **Tài khoản / Vai trò:** `admin` hoặc `warehouse_manager`.
- **Thứ tự các bước thực hiện:**
  1. Sau khi thực hiện một giao dịch nhận hàng hoặc xuất hàng, truy cập `/history`.
  2. Tìm kiếm dòng sự kiện vừa thực hiện ở đầu danh sách.
  3. Kiểm tra các trường: Thời gian (timestamp), Tên nhân viên (operator), Loại hành động (action), Chi tiết thay đổi.
  4. Quan sát toàn bộ bảng và giao diện: Xác nhận **HOÀN TOÀN KHÔNG CÓ** nút "Xóa" (Delete) hoặc "Chỉnh sửa" (Edit) đối với các dòng nhật ký này.
- **Kết quả mong đợi:**
  - Sự kiện mới xuất hiện tức thì với đầy đủ dữ liệu ngữ cảnh.
  - Bảng nhật ký mang tính chất chỉ đọc (Read-only append-only audit log).
- **Tiêu chuẩn PASS:** Dữ liệu kiểm toán nguyên vẹn, đảm bảo tính pháp lý và truy vết doanh nghiệp.
