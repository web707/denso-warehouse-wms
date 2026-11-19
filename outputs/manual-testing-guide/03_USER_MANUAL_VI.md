# TÀI LIỆU HƯỚNG DẪN SỬ DỤNG HỆ THỐNG MASAN CONSUMER WMS
## (USER MANUAL - ENTERPRISE EDITION)
**Dành cho:** Ban Giám Đốc Kho, Nhân Viên Nhập Kho, Nhân Viên Xuất Kho, Nhân Viên Kiểm Định QC, Thủ Kho & Quản Trị Hệ Thống.  
**Địa chỉ truy cập Staging:** `http://localhost:4350`  
**Địa chỉ truy cập QA:** `http://localhost:4340`  

---

## MỤC LỤC
1. [Giới thiệu tổng quan & Đăng nhập](#1-giới-thiệu-tổng-quan--đăng-nhập)
2. [Hướng dẫn dành cho Nhân Viên Nhập Kho (Inbound Operator)](#2-hướng-dẫn-dành-cho-nhân-viên-nhập-kho-inbound-operator)
3. [Hướng dẫn dành cho Nhân Viên Kiểm Định Chất Lượng (QC Inspector)](#3-hướng-dẫn-dành-cho-nhân-viên-kiểm-định-chất-lượng-qc-inspector)
4. [Hướng dẫn dành cho Nhân Viên Xuất Kho (Outbound Operator)](#4-hướng-dẫn-dành-cho-nhân-viên-xuất-kho-outbound-operator)
5. [Hướng dẫn dành cho Nhân Viên Kiểm Kê (Cycle Count Auditor)](#5-hướng-dẫn-dành-cho-nhân-viên-kiểm-kê-cycle-count-auditor)
6. [Hướng dẫn dành cho Quản Lý Kho & Admin (Manager & Administrator)](#6-hướng-dẫn-dành-cho-quản-lý-kho--admin-manager--administrator)
7. [Các lỗi thường gặp và cách xử lý (Troubleshooting)](#7-các-lỗi-thường-gặp-và-cách-xử-lý-troubleshooting)

---

## 1. GIỚI THIỆU TỔNG QUAN & ĐĂNG NHẬP

Hệ thống MASAN CONSUMER WMS là nền tảng quản lý kho thành phẩm tiêu chuẩn công nghiệp phục vụ các nhà máy và trung tâm phân phối của Masan Consumer (chuyên trách các ngành hàng Nước mắm Nam Ngư, Nước tương Chinsu, Mì Omachi, Mì Kokomi, Cà phê Vinacafe, Nước tăng lực Wakeup 247).

### 1.1. Cách Đăng Nhập
1. Mở trình duyệt web (Google Chrome hoặc Microsoft Edge) và truy cập vào địa chỉ: `http://localhost:4350`.
2. Màn hình đăng nhập hiện ra:
   - **Tên đăng nhập (Username/Email):** Nhập tài khoản tương ứng với vai trò của bạn.
   - **Mật khẩu (Password):** Nhập mật khẩu đã được cấp.
3. Bấm nút **"Đăng Nhập"** (hoặc nhấn phím `Enter`).
4. Hệ thống sẽ cấp mã phiên bảo mật JWT và điều hướng bạn vào màn hình **Dashboard tổng quan**.

---

## 2. HƯỚNG DẪN DÀNH CHO NHÂN VIÊN NHẬP KHO (INBOUND OPERATOR)

### 2.1. Tiếp nhận hàng theo Đơn Mua Hàng (PO Receiving)
1. Tại thanh menu bên trái, nhấp vào **"Giao dịch kho"** (`/inventory`).
2. Mặc định hệ thống sẽ mở tab **"Nhập kho theo PO"** (PO Receiving).
3. Tại khung nhập liệu phía trên, điền đầy đủ các thông tin:
   - **Mã PO:** Ví dụ `PO-2026-MSN-001` (Số đơn đặt hàng từ nhà máy Masan).
   - **Nhà cung cấp:** Ví dụ `Masan Consumer Corp - Masan HD Factory`.
   - **Sản phẩm (SKU):** Chọn sản phẩm từ danh sách thả xuống (Ví dụ: `MSN-FMCG-001` - Nước mắm Nam Ngư Đệ Nhị 900ml).
   - **Số lượng theo PO:** Nhập số lượng dự kiến trên chứng từ (Ví dụ: `500` thùng).
   - **Số lượng thực nhận:** Nhập số lượng thực tế đếm được tại cửa Dock (Ví dụ: `500` thùng).
   - **Số lô (Lot ID):** Nhập mã lô ghi trên thùng hàng (Ví dụ: `LOT-NN-202611-01`).
   - **Ngày sản xuất (Mfg Date) & Hạn sử dụng (Exp Date):** Chọn ngày từ lịch (Bắt buộc HSD phải lớn hơn ngày hiện tại ít nhất 6 tháng).
4. **Xử lý Sai lệch (Nếu có):**
   - **Nhận thiếu:** Nếu số lượng thực nhận < số lượng PO, hệ thống sẽ tự động tính số lượng thiếu hụt.
   - **Nhận hàng hỏng (Damaged):** Nếu phát hiện thùng bị móp méo, rách vỡ hoặc chảy nước, nhập số lượng thùng hỏng vào ô **"Hàng hỏng / Damaged"** (Ví dụ: `5` thùng).
   - **Ghi chú sai lệch:** Nhập lý do (Ví dụ: `Thùng hàng bị ướt do vận chuyển trời mưa`).
   - *Lưu ý quan trọng:* Toàn bộ hàng hỏng sẽ được hệ thống tự động đưa vào vị trí cách ly **`DOCK-QUARANTINE`** tại Zone Q và gắn thẻ chờ QC kiểm tra.
5. Bấm nút **"Xác Nhận Nhận Hàng"** (Confirm Receiving).
6. Một thông báo thành công màu xanh lá sẽ hiện ra kèm mã đơn nhận và mã biên bản sai lệch (nếu có).

### 2.2. Cất hàng vào kệ (Putaway)
1. Sau khi nhận hàng, hàng đang nằm tại khu vực đệm (Staging / Dock). Nhân viên dùng xe nâng di chuyển hàng vào kệ lưu trữ.
2. Trên màn hình **"Giao dịch kho"**, chuyển sang tab **"Điều chuyển & Cất hàng"** (Transfer/Putaway).
3. Chọn vị trí nguồn: `DOCK-STAGING`.
4. Chọn vị trí đích: Chọn kệ thuộc đúng Zone phù hợp:
   - Nước mắm, nước tương: Chọn kệ Zone A (`A-01` đến `A-05`).
   - Mì ăn liền: Chọn kệ Zone B (`B-01` đến `B-06`).
   - Cà phê, đồ uống: Chọn kệ Zone C (`C-01` đến `C-05`).
5. **Quy tắc Vàng:** Hệ thống áp dụng nghiêm ngặt quy tắc `WMS_ONE_SKU_PER_RACK` (1 kệ chỉ chứa duy nhất 1 loại SKU). Nếu bạn cố tình đưa Nước mắm vào kệ đang chứa Mì Omachi, hệ thống sẽ báo lỗi màu đỏ và từ chối giao dịch.
6. Nhập số lượng cần cất và bấm **"Thực Hiện Điều Chuyển"**.

---

## 3. HƯỚNG DẪN DÀNH CHO NHÂN VIÊN KIỂM ĐỊNH CHẤT LƯỢNG (QC INSPECTOR)

### 3.1. Tiếp nhận và kiểm tra mẫu kiểm định
1. Tại menu bên trái, nhấp vào **"Kiểm tra chất lượng"** (`/inspections`).
2. Màn hình hiển thị danh sách tất cả các phiếu kiểm định chất lượng (Inspection Tickets).
3. Sử dụng bộ lọc trạng thái để chọn xem các phiếu đang ở trạng thái **`PENDING`** (Chờ kiểm tra).
4. Nhấp vào dòng phiếu cần kiểm tra để xem thông tin chi tiết: Tên sản phẩm, Số lô, Vị trí kệ, Số lượng và Ngày nhập kho.

### 3.2. Đưa ra phán quyết chất lượng (Inspection Verdict)
1. Sau khi lấy mẫu và kiểm nghiệm các tiêu chuẩn vi sinh, cảm quan và bao bì theo tiêu chuẩn Masan ISO 22000:
2. Tại bảng chi tiết phiếu kiểm định, chọn 1 trong 2 quyết định:
   - **ĐẠT TIÊU CHUẨN (PASS / OK):**
     - Nhấp nút **"Phê duyệt Đạt (Pass)"**.
     - Nhập ghi chú kiểm định: `Mẫu đạt tiêu chuẩn độ đạm, bao bì nguyên vẹn, cảm quan tốt`.
     - Bấm **"Xác nhận phán quyết"**.
     - *Kết quả:* Lô hàng sẽ được chuyển sang trạng thái **`AVAILABLE`** (Khả dụng) và sẵn sàng để phân bổ xuất kho.
   - **KHÔNG ĐẠT / HỎNG (FAIL / NG):**
     - Nhấp nút **"Từ chối / Báo hỏng (Fail)"**.
     - Bắt buộc chọn nguyên nhân: `Nhiễm tạp chất`, `Bao bì rách vỡ`, `Sai màu sắc/mùi vị`, `Quá hạn bảo quản`.
     - Nhập chi tiết nguyên nhân và bấm **"Xác nhận phán quyết"**.
     - *Kết quả:* Lô hàng chuyển sang trạng thái **`BLOCKED`**. Toàn bộ số lượng còn lại của lô này sẽ bị khóa tức thì và tự động kích hoạt lệnh chuyển vào khu cách ly `Zone Q`.

### 3.3. Quy tắc kiểm soát Mixed QC (Lô trộn chất lượng)
- Nếu một phần của lô hàng bị phát hiện lỗi, quy tắc an toàn Masan (TRC-04) yêu cầu **cô lập toàn bộ lô hàng** đó, không cho phép xuất bất kỳ sản phẩm nào thuộc cùng lô cho đến khi có kết luận kiểm nghiệm độc lập từ Phòng Quản lý Chất lượng Tập đoàn.

---

## 4. HƯỚNG DẪN DÀNH CHO NHÂN VIÊN XUẤT KHO (OUTBOUND OPERATOR)

### 4.1. Tạo Đơn Xuất Kho (Create Dispatch Order)
1. Tại menu bên trái, nhấp vào **"Đơn xuất kho"** (`/dispatch-orders`).
2. Nhấp nút **"+ Tạo Đơn Xuất Mới"** ở góc trên bên phải.
3. Điền thông tin đơn hàng:
   - **Mã đơn xuất:** Hệ thống tự gợi ý hoặc nhập theo số SO (Ví dụ: `DO-2026-VMART-001`).
   - **Khách hàng:** Nhập tên khách hàng (Ví dụ: `Hệ thống Siêu thị WinMart Miền Nam`).
   - **Loại đơn:** Chọn `Đơn phân phối siêu thị`, `Đơn đại lý cấp 1` hoặc `Xuất chuyển kho nội bộ`.
   - **Chọn SKU & Số lượng:** Chọn SKU (Ví dụ: `MSN-FMCG-003` - Mì Kokomi Đại 90g) và nhập số lượng cần xuất (Ví dụ: `150` thùng).
4. Bấm **"Lưu Đơn Hàng"**. Đơn hàng được tạo ở trạng thái `DRAFT` (Nháp).

### 4.2. Khóa giữ tồn kho theo chuẩn FEFO (Soft Reservation)
1. Tại danh sách đơn xuất, tìm đơn hàng vừa tạo (đang ở trạng thái `DRAFT`).
2. Nhấp vào nút **"Giữ tồn kho (Reserve)"**.
3. **Cơ chế FEFO hoạt động tự động:**
   - Hệ thống sẽ tự động quét cơ sở dữ liệu để tìm các kệ chứa SKU này có trạng thái `AVAILABLE`.
   - Thuật toán sắp xếp theo Hạn sử dụng: Lô có hạn dùng gần nhất (gần hết hạn nhất) sẽ được ưu tiên xuất trước.
   - Hệ thống chuyển số lượng tồn từ `available_quantity` sang `reserved_quantity`.
   - Đơn hàng chuyển sang trạng thái **`RESERVED`**.
   - *Lưu ý:* Nếu kho không đủ hàng khả dụng, hệ thống sẽ báo lỗi `Insufficient Available Stock` và hiển thị chính xác số lượng còn thiếu.

### 4.3. Nhặt hàng theo chỉ dẫn (Picking)
1. Khi đơn hàng ở trạng thái `RESERVED`, nhấp nút **"Xem danh sách nhặt hàng (Pick List)"**.
2. Bảng chỉ dẫn sẽ liệt kê chi tiết cho nhân viên lấy hàng:
   - Đến kệ nào (Ví dụ: Kệ `B-01`).
   - Vị trí tầng/khoang nào.
   - Số lô nào cần lấy (Ví dụ: `LOT-KKM-202610-01`).
   - Số lượng chính xác cần nhặt (Ví dụ: `150` thùng).
3. Nhân viên đến đúng vị trí, nhặt đủ hàng ra khu vực tập kết cửa xuất (Outbound Dock).
4. Bấm nút **"Xác Nhận Đã Nhặt Hàng (Confirm Pick)"**. Đơn chuyển sang trạng thái **`PICKED`**.

### 4.4. Xác nhận Xuất kho & Giao hàng (Shipping)
1. Nhân viên kiểm tra đối chiếu số lượng thực tế tại cửa xuất với tài xế xe tải.
2. Nhấp nút **"Xác Nhận Xuất Hàng (Ship Order)"**.
3. Điền biển số xe tải và tên tài xế vận chuyển.
4. Bấm **"Hoàn Tất Xuất Kho"**.
5. **Cơ chế trừ tồn:**
   - Hệ thống trừ thẳng số lượng vật lý trên kệ tương ứng.
   - Xóa bỏ trạng thái giữ tồn `reserved_quantity`.
   - Đơn chuyển sang trạng thái **`SHIPPED`**.
   - Hệ thống tự động ghi nhật ký vào `history_events` và tạo phiếu xuất kho để in cho tài xế.

### 4.5. Hủy đơn xuất (Cancel Order)
- Nếu khách hàng hủy đơn khi đơn đang ở trạng thái `DRAFT` hoặc `RESERVED`:
- Bấm nút **"Hủy Đơn (Cancel)"** và nhập lý do.
- Toàn bộ số lượng tồn đang bị khóa giữ sẽ được hệ thống hoàn trả ngay lập tức về tồn khả dụng (Available To Promise - ATP).

---

## 5. HƯỚNG DẪN DÀNH CHO NHÂN VIÊN KIỂM KÊ (CYCLE COUNT AUDITOR)

### 5.1. Khởi tạo đợt kiểm kê định kỳ
1. Tại menu bên trái, nhấp vào **"Kiểm kê định kỳ"** (`/cycle-counts`).
2. Nhấp nút **"+ Tạo Đợt Kiểm Kê Mới"**.
3. Nhập tên đợt kiểm kê (Ví dụ: `Kiểm kê định kỳ Tuần 46 - Zone A`).
4. Chọn phạm vi kiểm kê: Chọn `Zone A`, `Zone B`, `Zone C` hoặc `Toàn bộ kho`.
5. Bấm **"Khởi Tạo Đợt Kiểm Kê"**. Đợt kiểm kê được tạo ở trạng thái `OPEN`.

### 5.2. Đếm mù Vòng 1 (Blind Count Round 1)
1. Nhân viên kiểm kê được phân công nhận phiếu kiểm kê trên tay hoặc mở giao diện web.
2. **Nguyên tắc Đếm Mù:** Trên màn hình đếm vòng 1, hệ thống hoàn toàn **ẨN** số lượng tồn trong máy tính. Nhân viên chỉ nhìn thấy danh sách Vị trí kệ và Mã SKU.
3. Nhân viên đi đếm thực tế từng thùng tại kệ, đếm được bao nhiêu thì nhập chính xác con số đó vào cột **"Thực Đếm Vòng 1"**.
4. Bấm **"Gửi Kết Quả Vòng 1"** (Submit Round 1).

### 5.3. Đếm Vòng 2 & Nguyên tắc Phân lập Nhiệm vụ (SoD)
1. Nếu kết quả Vòng 1 có sai lệch so với tồn hệ thống vượt ngưỡng cho phép (> 2% hoặc lệch > 5 thùng), đợt kiểm kê sẽ tự động yêu cầu **Đếm Vòng 2**.
2. **Quy tắc Kiểm Soát SoD (Bắt buộc):**
   - Người thực hiện đếm Vòng 2 **PHẢI LÀ NGƯỜI KHÁC** so với người đã đếm Vòng 1.
   - Nếu cùng một tài khoản đăng nhập cố tình bấm đếm Vòng 2, hệ thống sẽ báo lỗi từ chối: `Segregation of Duties Violation: Round 2 counter must be different from Round 1 counter`.
3. Người kiểm đếm thứ hai đăng nhập tài khoản của mình, tiến hành đếm độc lập và nhập kết quả vào cột **"Thực Đếm Vòng 2"**.
4. Bấm **"Gửi Kết Quả Vòng 2"** (Submit Round 2).

### 5.4. Đối chiếu & Phê duyệt Điều chỉnh Tồn Kho
1. Thủ kho hoặc Quản lý kho (Role: `warehouse_manager` hoặc `admin`) đăng nhập hệ thống.
2. Mở đợt kiểm kê cần duyệt.
3. Hệ thống hiển thị bảng tổng hợp đối chiếu 3 cột:
   - Cột 1: **Tồn trên sổ sách hệ thống (System Qty)**
   - Cột 2: **Kết quả đếm Vòng 1 (Round 1 Qty)**
   - Cột 3: **Kết quả đếm Vòng 2 (Round 2 Qty)**
   - Cột 4: **Chênh lệch cuối cùng (Variance)**
4. Nếu chênh lệch hợp lý và đã có biên bản giải trình, Quản lý nhấp nút **"Phê Duyệt & Điều Chỉnh Tồn (Approve & Adjust)"**.
5. Hệ thống sẽ tự động cập nhật lại số lượng tồn kho trên kệ bằng với số lượng thực đếm, ghi nhận biến động kiểm kê và đóng phiếu ở trạng thái **`COMPLETED`**.

---

## 6. HƯỚNG DẪN DÀNH CHO QUẢN LÝ KHO & ADMIN (MANAGER & ADMINISTRATOR)

### 6.1. Giám sát kho qua Sơ đồ 3D tương tác (Interactive 3D Rack Map)
1. Tại menu bên trái, nhấp vào **"Sơ đồ kho 3D"** (`/racks`).
2. Màn hình hiển thị toàn bộ không gian kho dạng không gian 3 chiều:
   - **Thao tác chuột:**
     - Giữ chuột trái và kéo: Xoay góc nhìn toàn cảnh kho.
     - Lăn con trỏ chuột: Thu phóng (Zoom in / Zoom out) từng dãy kệ.
     - Giữ chuột phải và kéo: Di chuyển tịnh tiến góc nhìn (Pan).
3. **Ý nghĩa màu sắc kệ:**
   - 🟩 **Màu xanh lá:** Kệ đang hoạt động bình thường, công suất sử dụng hợp lý.
   - 🟧 **Màu cam/vàng:** Kệ sắp đầy (Công suất lưu trữ vượt quá 90%).
   - 🟥 **Màu đỏ:** Kệ thuộc khu cách ly QC hoặc đang chứa lô hàng bị lỗi/khóa.
   - ⬜ **Màu xám:** Kệ trống, sẵn sàng tiếp nhận hàng mới.
4. **Xem chi tiết & Điều chuyển nhanh:**
   - Nhấp chuột trái vào bất kỳ khối kệ 3D nào.
   - Một bảng trượt bên phải (Drawer) sẽ mở ra hiển thị: Tên kệ, Phân khu Zone, SKU đang chứa, Số lượng tồn, Số lô và Hạn sử dụng.
   - Bấm nút **"Điều chuyển nhanh"** nếu muốn chuyển hàng sang kệ khác trực tiếp từ màn hình 3D.

### 6.2. Quản lý Người dùng & Phân quyền Truy Cập (User Management & RBAC)
1. Tại menu bên trái, nhấp vào **"Nhân sự & phân quyền"** (`/users`) *(Chỉ hiển thị với quyền Admin)*.
2. Danh sách toàn bộ nhân viên kho sẽ hiển thị kèm theo Vai trò và Trạng thái hoạt động.
3. **Tạo tài khoản mới:**
   - Bấm nút **"+ Thêm Người Dùng"**.
   - Nhập: Họ và tên, Email đăng nhập, Mật khẩu khởi tạo.
   - Chọn vai trò (Role):
     - `admin`: Toàn quyền hệ thống.
     - `warehouse_manager`: Quản lý kho, duyệt kiểm kê, xem báo cáo, giám sát 3D.
     - `inbound_operator`: Chỉ thực hiện nhận hàng PO, cất hàng, xem danh mục.
     - `outbound_operator`: Chỉ tạo đơn xuất, giữ tồn, nhặt hàng, xuất hàng.
     - `qc_inspector`: Chỉ kiểm tra chất lượng, phán quyết OK/NG, cách ly lô.
   - Bấm **"Tạo Tài Khoản"**.
4. **Khóa tài khoản:** Khi nhân viên nghỉ việc, nhấp vào nút **"Khóa (Deactivate)"** bên cạnh tên nhân viên để vô hiệu hóa quyền đăng nhập tức thì.

### 6.3. Truy vết Lịch Sử & Kiểm Tra Nhật Ký Bất Biến (Audit Trail)
1. Tại menu bên trái, nhấp vào **"Lịch sử kho"** (`/history`).
2. Màn hình hiển thị toàn bộ nhật ký sự kiện của kho theo thứ tự thời gian mới nhất:
   - **Thời gian:** Ngày giờ chính xác đến từng giây.
   - **Người thực hiện:** Tên và email của nhân viên.
   - **Hành động:** `PO_RECEIPT`, `PUTAWAY`, `SOFT_RESERVATION`, `PICKING`, `SHIPPING`, `QC_VERDICT`, `CYCLE_COUNT_ADJUST`.
   - **Chi tiết thay đổi:** Số lượng trước và sau giao dịch, mã kệ, số lô.
   - Bảng này được thiết kế bất biến (append-only), không ai trong hệ thống (kể cả Admin) có thể xóa hoặc sửa nhật ký audit này.

---

## 7. CÁC LỖI THƯỜNG GẶP VÀ CÁCH XỬ LÝ (TROUBLESHOOTING)

| Tình huống / Thông báo lỗi | Nguyên nhân | Cách khắc phục xử lý |
|:---|:---|:---|
| **`Rack already contains SKU ... One SKU per rack policy violation`** | Bạn đang cố tình nhập hoặc chuyển một SKU vào kệ đã có chứa một SKU khác. | Chọn một kệ trống khác hoặc kệ đang chứa đúng cùng loại SKU đó. |
| **`Insufficient Available Stock for SKU ...`** | Đơn xuất yêu cầu số lượng lớn hơn số lượng hàng khả dụng trong kho (do hàng chưa qua QC hoặc đã bị đơn khác giữ tồn). | Kiểm tra xem có lô hàng nào đang chờ QC duyệt không, hoặc giảm số lượng xuất trên đơn hàng. |
| **`Segregation of Duties Violation: Round 2 counter must be different`** | Nhân viên đếm Vòng 2 trùng với người đã đếm Vòng 1 trong đợt kiểm kê. | Đăng xuất và nhờ một nhân viên kiểm kê độc lập khác đăng nhập để nhập kết quả Vòng 2. |
| **`Lot is under Quarantine / Blocked by QC`** | Lô hàng đang bị đánh giá Không đạt (NG) hoặc phát hiện mẫu lỗi nên bị khóa tự động theo quy tắc TRC-04. | Liên hệ phòng Quản lý chất lượng (QC) để thẩm định lại, không được phép xuất kho lô này. |
| **`Rack capacity exceeded`** | Số lượng thùng hàng đưa vào kệ vượt quá sức chứa tối đa thiết kế của kệ đó. | Giảm số lượng thùng hoặc chia nhỏ để đưa sang 2 kệ khác nhau. |
