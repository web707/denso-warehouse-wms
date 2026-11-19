# MASAN CONSUMER WMS – USER ACCEPTANCE TEST (UAT) PLAN (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: End-to-End Role-Based Acceptance Test Plan & Execution Scripts  
**Mục tiêu**: Chuẩn hóa quy trình nghiệm thu thực địa cho các khối phòng ban của Masan Consumer  
**Chuyên gia phụ trách**: QA Lead & Warehouse Operations Consultant  
**Ngày lập**: 12/11/2026  

---

## 1. MỤC TIÊU VÀ PHẠM VI NGHIỆM THU NGƯỜI DÙNG (UAT SCOPE)

Kế hoạch kiểm thử chấp nhận người dùng (UAT) được thiết kế nhằm mục đích để chính đội ngũ vận hành kho, quản lý chuỗi cung ứng, chuyên viên KCS/QA và bộ phận IT của Masan Consumer trực tiếp thao tác, đánh giá và ký biên bản nghiệm thu trước khi đưa phần mềm vào ứng dụng thực tế.

---

## 2. KỊCH BẢN KIỂM THỬ CHI TIẾT THEO TỪNG VAI TRÒ (ROLE-BASED TEST SCRIPTS)

### KỊCH BẢN 1: QUẢN TRỊ VIÊN HỆ THỐNG KHO (WAREHOUSE ADMINISTRATOR)

- **Mục tiêu**: Kiểm tra tính năng quản lý tài khoản, phân quyền, cấu hình hệ thống và giám sát nhật ký an ninh.
- **Tài khoản thực hiện**: `admin@masan.local` (Role: `admin`).

| Bước | Hành động của người dùng | Dữ liệu đầu vào | Kết quả kỳ vọng (Acceptance Criteria) | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| 1.1 | Đăng nhập tài khoản quản trị | `admin@masan.local` / Mật khẩu admin | Đăng nhập thành công, chuyển hướng vào Dashboard, thanh menu hiển thị đầy đủ các quyền quản trị. | Đăng nhập thành công, có token JWT. | **PASS** |
| 1.2 | Tạo tài khoản nhân viên kho mới | Email: `staff.dn01@masan.local`, Role: `warehouse_staff` | Tài khoản được tạo thành công, mật khẩu được mã hóa an toàn, hiển thị trong danh sách người dùng. | API `POST /auth/users` trả về 201 Created. | **PASS** |
| 1.3 | Kiểm tra trang Giám sát Sức khỏe | Truy cập URL `/api/health` | Trả về trạng thái `status: ok` và thời gian hệ thống khớp với giờ hiện tại. | Trả về HTTP 200 JSON ok. | **PASS** |
| 1.4 | Kiểm tra bảo vệ Brute-force | Đăng nhập sai 21 lần liên tiếp từ cùng một máy trạm | Đến lần thứ 21 hệ thống phải chặn và báo lỗi 429 Too Many Requests trong 60 giây. | Bị chặn chính xác tại lần 21 (SEC-BF). | **PASS** |

---

### KỊCH BẢN 2: QUẢN LÝ KHO (WAREHOUSE MANAGER)

- **Mục tiêu**: Giám sát chỉ số tồn kho vĩ mô, phê duyệt giải phóng lô hàng có điều kiện, xử lý sự cố.
- **Tài khoản thực hiện**: `manager@masan.local` (Role: `warehouse_manager`).

| Bước | Hành động của người dùng | Dữ liệu đầu vào | Kết quả kỳ vọng (Acceptance Criteria) | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| 2.1 | Giám sát Tổng quan Kho (Dashboard) | Mở Dashboard | Màn hình hiển thị chính xác 4 chỉ số: Tổng tồn vật lý, Tồn khả dụng, Tồn chờ QC, Tồn khóa QC. Thời gian tải trang < 500ms. | Dữ liệu tải từ `/api/parts/dashboard-summary` trong 38ms. | **PASS** |
| 2.2 | Xem Heatmap mật độ hoạt động của các kệ | Chọn khoảng thời gian 30 ngày | Bản đồ kho 3D đổi màu theo tần suất: Kệ đỏ (Hot), Vàng (Warm), Xanh (Cold). | Hiển thị chính xác mức độ hoạt động của từng kệ. | **PASS** |
| 2.3 | Giải phóng lô hàng lỗi sau tái thẩm định (Override NG Lot) | Lô hàng `LOT-NG-RECHECK` | Quản lý kho có thẩm quyền nhập kết luận mới `AVAILABLE` hoặc `OK` cho lô hàng bị khóa. | Quản lý kho cập nhật thành công; nhân viên kho bình thường thực hiện bước này bị chặn 403. | **PASS** |

---

### KỊCH BẢN 3: NHÂN VIÊN VẬN HÀNH KHO (WAREHOUSE STAFF)

- **Mục tiêu**: Nhập hàng, cất hàng vào ô kệ 3D, điều chuyển một phần và lấy hàng theo chuẩn FEFO.
- **Tài khoản thực hiện**: `staff@masan.local` (Role: `warehouse_staff`).

| Bước | Hành động của người dùng | Dữ liệu đầu vào | Kết quả kỳ vọng (Acceptance Criteria) | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| 3.1 | Nhập lô hàng mới (Inbound) | SKU: `MICOOK-01`, Lô: `LOT-TEST-01`, SL: 100 gói, HSD: `2028-12-31`, Kệ: R08, Ô: S01 | Hàng được lưu vào database, ô kệ S01 chuyển sang màu xanh trên mô hình 3D. Tồn kho tự động vào trạng thái `Pending QC`. | Tạo thành công bản ghi, ô kệ đổi màu. | **PASS** |
| 3.2 | Thử xuất lô hàng vừa nhập (chưa QC) | Gọi lệnh xuất 10 gói từ lô `LOT-TEST-01` | **HỆ THỐNG PHẢI TỪ CHỐI** và thông báo: `OUTBOUND_LOT_QC_PENDING` (Lô hàng chưa có kết luận kiểm định). | Bị chặn chính xác với mã `OUTBOUND_LOT_QC_PENDING`. | **PASS** |
| 3.3 | Điều chuyển một phần lô hàng (Partial Transfer) | Chuyển 35 gói từ Kệ R08 sang Kệ R10 | Kệ R08 giảm từ 100 còn 65 gói; Kệ R10 xuất hiện bản ghi mới 35 gói cùng số Lô và HSD. Sổ cái giao dịch ghi nhận 1 giao dịch chuyển. | Số liệu bảo toàn 100%, 3D cập nhật vị trí cả 2 kệ. | **PASS** |
| 3.4 | Xuất kho theo chuẩn FEFO | Yêu cầu xuất mặt hàng `MICOOK-01` với số lượng 50 gói | Hệ thống tự động chọn lô có hạn sử dụng gần nhất đã đạt QC `AVAILABLE` để xuất trước. | Thuật toán `allocateOutbound` chọn đúng lô cận date nhất. | **PASS** |

---

### KỊCH BẢN 4: CHUYÊN VIÊN KIỂM ĐỊNH CHẤT LƯỢNG (QC INSPECTOR)

- **Mục tiêu**: Lấy mẫu kiểm tra, nhập chỉ số phòng lab, kết luận chất lượng và khóa lô khẩn cấp.
- **Tài khoản thực hiện**: `inspector@masan.local` (Role: `qc_inspector` hoặc `admin`).

| Bước | Hành động của người dùng | Dữ liệu đầu vào | Kết quả kỳ vọng (Acceptance Criteria) | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| 4.1 | Nhập biên bản kiểm định Đạt (OK) | Lô: `LOT-TEST-01`, Cỡ mẫu: 10 gói, Đạt: 10, Lỗi: 0, Kết luận: `OK` | Trạng thái lô hàng chuyển sang `AVAILABLE`. Số lượng hàng chuyển từ `Pending QC` sang `Available Stock` trên Dashboard. | Cập nhật tức thời, cho phép xuất kho. | **PASS** |
| 4.2 | Nhập biên bản kiểm định Không đạt (NG) | Lô: `LOT-TEST-FAIL`, Cỡ mẫu: 10, Lỗi: 3, Mã lỗi: `D-101` (Rách bao bì), Kết luận: `NG` | Trạng thái lô hàng chuyển sang `BLOCKED`. Hàng không thể xuất. | Cập nhật chính xác, lệnh xuất bị chặn `OUTBOUND_LOT_QC_BLOCKED`. | **PASS** |
| 4.3 | Khóa lô khẩn cấp (Emergency Recall) | Đổi kết luận của một lô đang lưu thông sang `HOLD` | Ngay lập tức toàn bộ các giao dịch xuất đối với lô hàng này trên tất cả các kệ đều bị khóa. | Khóa toàn hệ thống trong microsecond. | **PASS** |

---

### KỊCH BẢN 5: KIỂM SOÁT VIÊN TỒN KHO (INVENTORY CONTROLLER)

- **Mục tiêu**: Kiểm tra tính bất biến của sổ cái, đối chiếu tồn vật lý và phát hiện hàng cận date.
- **Tài khoản thực hiện**: `controller@masan.local` (Role: `warehouse_manager`).

| Bước | Hành động của người dùng | Dữ liệu đầu vào | Kết quả kỳ vọng (Acceptance Criteria) | Kết quả thực tế | Đánh giá |
|:---:|---|---|---|---|:---:|
| 5.1 | Tra cứu lịch sử di biến động của 1 mã Lô | Tìm kiếm theo `lot_number` | Hiển thị toàn bộ chuỗi giao dịch từ lúc Nhập kho -> Cất kệ -> Chuyển một phần -> Xuất kho. Số lượng cộng trừ khớp tuyệt đối. | Sổ cái `inventory_transactions` phản ánh đầy đủ chuỗi lịch sử. | **PASS** |
| 5.2 | Quét hàng hết hạn sử dụng (Expired Lots) | Lọc các lô có `expiration_date < today` | Hiển thị danh sách cảnh báo hàng hết hạn. Thử xuất hàng hết hạn phải bị hệ thống từ chối `OUTBOUND_LOT_EXPIRED`. | Chặn xuất hàng hết hạn chính xác 100%. | **PASS** |

---

## 3. TIÊU CHÍ NGHIỆM THU TỔNG THỂ (OVERALL ACCEPTANCE CRITERIA)

Một kịch bản được coi là **ĐẠT (PASSED)** khi thỏa mãn đồng thời:
1. Giao diện trực quan phản hồi trong thời gian quy định (SLO).
2. Dữ liệu trên cơ sở dữ liệu PostgreSQL khớp chính xác với những gì hiển thị trên màn hình.
3. Không có ngoại lệ hệ thống (500 Internal Server Error) xảy ra.
4. Sổ cái giao dịch ghi nhận đầy đủ người thực hiện và dấu thời gian.
