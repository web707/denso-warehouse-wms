# MA TRẬN PHÂN QUYỀN VAI TRÒ & TÀI KHOẢN KIỂM THỬ
## (ROLES, PERMISSIONS & TEST ACCOUNTS SPECIFICATION)
**Hệ thống:** MASAN CONSUMER WMS  
**Môi trường áp dụng:** Staging (`http://localhost:4350`) & QA (`http://localhost:4340`)  

---

## 1. DANH SÁCH 5 VAI TRÒ CHUẨN TRONG HỆ THỐNG (RBAC ROLES)

| Tên Vai Trò (System Role) | Tên Tiếng Việt | Mô Tả Trách Nhiệm & Giới Hạn Nghiệp Vụ |
|:---|:---|:---|
| **`admin`** | Quản trị viên hệ thống | Toàn quyền kiểm soát hệ thống: Cấu hình kho, Quản lý tài khoản người dùng, xem toàn bộ báo cáo, nhật ký audit và thực hiện mọi giao dịch kho. |
| **`warehouse_manager`** | Quản lý / Thủ kho | Phụ trách toàn diện hoạt động vận hành kho: Duyệt kết quả kiểm kê định kỳ, điều phối sơ đồ kệ 3D, xem báo cáo tồn kho & phân tích hiệu suất, giám sát chuỗi cung ứng. Không có quyền tạo/xóa tài khoản admin. |
| **`inbound_operator`** | Nhân viên nhập kho | Chuyên trách cửa tiếp nhận (Dock Inbound): Tạo phiếu nhận hàng theo PO, lập biên bản sai lệch (thiếu/thừa/hỏng), thực hiện cất hàng vào kệ (Putaway), chuyển hàng nội bộ và tham gia đếm kiểm kê Vòng 1. |
| **`outbound_operator`** | Nhân viên xuất kho | Chuyên trách cửa xuất hàng (Dock Outbound): Tạo đơn xuất kho (Dispatch Orders), kích hoạt giữ tồn kho theo FEFO, nhặt hàng (Picking), xác nhận xuất xe tải (Shipping), hủy đơn hoàn trả tồn và tham gia đếm kiểm kê Vòng 2. |
| **`qc_inspector`** | Nhân viên kiểm định chất lượng | Chuyên trách phòng KCS / Kiểm soát chất lượng: Tiếp nhận mẫu hàng mới nhập, đánh giá tiêu chuẩn ISO 22000, đưa ra phán quyết ĐẠT (PASS -> AVAILABLE) hoặc KHÔNG ĐẠT (FAIL -> BLOCKED), kích hoạt cách ly lô theo TRC-04. |

---

## 2. MA TRẬN PHÂN QUYỀN TRUY CẬP MÀN HÌNH (SCREEN PERMISSION MATRIX)

| STT | Phân Hệ / Màn Hình | Đường Dẫn (Route) | `admin` | `warehouse_manager` | `inbound_operator` | `outbound_operator` | `qc_inspector` |
|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | **Dashboard Tổng quan** | `/` | ✅ Toàn quyền | ✅ Toàn quyền | ✅ Xem | ✅ Xem | ✅ Xem |
| 2 | **Nhận hàng theo PO** | `/inventory?tab=receiving` | ✅ Toàn quyền | ✅ Toàn quyền | ✅ Toàn quyền | ❌ Ẩn/Chặn | ❌ Ẩn/Chặn |
| 3 | **Giao dịch kho tiêu chuẩn** | `/inventory?tab=standard` | ✅ Toàn quyền | ✅ Toàn quyền | ✅ Nhập/Chuyển | ✅ Chuyển kệ | ❌ Ẩn/Chặn |
| 4 | **Đơn xuất kho & FEFO** | `/dispatch-orders` | ✅ Toàn quyền | ✅ Duyệt/Xem | ❌ Ẩn/Chặn | ✅ Toàn quyền | ❌ Ẩn/Chặn |
| 5 | **Kiểm kê định kỳ** | `/cycle-counts` | ✅ Duyệt tồn | ✅ Tạo đợt/Duyệt | ✅ Đếm Vòng 1 | ✅ Đếm Vòng 2 | ❌ Không đếm |
| 6 | **Sơ đồ kho 3D Canvas** | `/racks` | ✅ Toàn quyền | ✅ Toàn quyền | ✅ Xem/Chuyển | ✅ Xem kệ | ✅ Xem vị trí |
| 7 | **Quản lý phân khu Zone** | `/zones` | ✅ Sửa/Tạo | ✅ Xem/Cấu hình | ℹ️ Xem | ℹ️ Xem | ℹ️ Xem |
| 8 | **Quy tắc lưu kho** | `/packing-rules` | ✅ Sửa/Tạo | ✅ Cấu hình | ℹ️ Xem | ℹ️ Xem | ℹ️ Xem |
| 9 | **Kiểm định chất lượng QC** | `/inspections` | ✅ Toàn quyền | ✅ Xem kết quả | ❌ Ẩn | ❌ Ẩn | ✅ Phán quyết |
| 10 | **Truy vết phả hệ lô** | `/trace` | ✅ Toàn quyền | ✅ Toàn quyền | ℹ️ Tra cứu | ℹ️ Tra cứu | ✅ Tra cứu QC |
| 11 | **Danh mục Masan Catalog**| `/catalog` | ✅ Sửa/Tạo | ✅ Xem | ℹ️ Tra cứu | ℹ️ Tra cứu | ℹ️ Tra cứu |
| 12 | **Giám sát hạn dùng FEFO** | `/fefo` | ✅ Toàn quyền | ✅ Toàn quyền | ℹ️ Tra cứu | ✅ Xem ưu tiên | ✅ Khóa lô |
| 13 | **In nhãn QR & Barcode** | `/qr-labels` | ✅ Tạo/In | ✅ Tạo/In | ✅ Tạo/In | ✅ Tạo/In | ℹ️ Xem |
| 14 | **Báo cáo kho & Xuất CSV** | `/reports` | ✅ Toàn quyền | ✅ Toàn quyền | ❌ Ẩn | ❌ Ẩn | ❌ Ẩn |
| 15 | **Lịch sử kho Audit Trail** | `/history` | ✅ Xem nhật ký | ✅ Xem nhật ký | ❌ Ẩn | ❌ Ẩn | ❌ Ẩn |
| 16 | **Nhân sự & Phân quyền** | `/users` | ✅ Toàn quyền | ❌ Bị chặn (403)| ❌ Bị chặn (403)| ❌ Bị chặn (403)| ❌ Bị chặn (403)|

---

## 3. DANH SÁCH TÀI KHOẢN MẪU DÙNG CHO MANUAL TESTING

> **Ghi chú bảo mật an toàn doanh nghiệp:** Nhằm tuân thủ tuyệt đối tiêu chuẩn an toàn thông tin, các mật khẩu dưới đây chỉ áp dụng riêng cho môi trường kiểm thử (Staging / QA) được sinh ngẫu nhiên theo tiêu chuẩn mã hóa bcrypt 10 rounds và không bao giờ được tái sử dụng trên môi trường thật (Production).

### 3.1. Danh sách tài khoản trên môi trường STAGING (`http://localhost:4350`)

| Vai Trò Cần Test | Tên Nhân Viên | Email Đăng Nhập (Username) | Mật Khẩu Kiểm Thử (Staging Password) | Mục Đích Sử Dụng Trong Bài Test |
|:---|:---|:---|:---|:---|
| **Admin** | Nguyễn Văn Hùng (UAT Admin) | `staging.admin@masan.local` | `StgAdmin#9bff8857d81a!` | Quản lý toàn diện hệ thống, phân quyền `/users`, xem `/history`, duyệt kiểm kê. |
| **Warehouse Manager** | Trần Đình Khoa (Thủ kho Trưởng) | `staging.manager@masan.local` | `StgMgr#28ae47c81d22!` | Giám sát sơ đồ 3D, xem báo cáo `/reports`, phê duyệt cân chỉnh tồn sau kiểm kê Vòng 2. |
| **Inbound Operator** | Lê Minh Nhập (Nhân viên Nhập) | `staging.inbound@masan.local` | `StgInbound#73cd19f50e33!` | Kiểm thử nhận hàng theo PO, xử lý sai lệch thiếu/thừa/hỏng, Dock Quarantine, cất hàng, đếm kiểm kê Vòng 1. |
| **Outbound Operator** | Phạm Tuấn Xuất (Nhân viên Xuất)| `staging.outbound@masan.local`| `StgOutbound#45bb92a10d44!`| Kiểm thử tạo đơn xuất, giữ tồn FEFO (Soft Reservation), nhặt hàng, xuất xe tải, đếm kiểm kê Vòng 2 (SoD). |
| **QC Inspector** | Đỗ Bích Thảo (KCS Chất lượng) | `staging.qc@masan.local` | `StgQC#61ff83c94a55!` | Kiểm thử phán quyết chất lượng 147 tickets, duyệt PASS (AVAILABLE), báo hỏng NG (BLOCKED), cô lập lô TRC-04. |

---

### 3.2. Danh sách tài khoản trên môi trường QA (`http://localhost:4340`)

| Vai Trò | Email Đăng Nhập | Mật Khẩu Kiểm Thử (QA Password) | Ghi Chú Môi Trường |
|:---|:---|:---|:---|
| **QA Admin** | `qa.admin@masan.local` | `QaAdmin#88b1f7c00129!` | Dùng cho đối soát dữ liệu lịch sử và regression testing |
| **QA Manager** | `qa.manager@masan.local` | `QaMgr#44f129a0077b!` | Môi trường kiểm thử tính tương thích ngược |
| **QA Inbound** | `qa.inbound@masan.local` | `QaInbound#33c819d44a21!` | Môi trường kiểm thử luồng PO cũ |
| **QA Outbound** | `qa.outbound@masan.local` | `QaOutbound#55b882c91e10!` | Môi trường kiểm thử luồng Picking cũ |
| **QA QC** | `qa.qc@masan.local` | `QaQC#66a993e77f02!` | Môi trường kiểm thử 147 tickets QC ban đầu |

---

## 4. HƯỚNG DẪN THỰC THI KIỂM THỬ PHÂN QUYỀN (RBAC TESTING STEPS)

1. **Kiểm tra đăng nhập đúng vai trò:** Đăng nhập lần lượt 5 tài khoản trên, quan sát huy hiệu (Badge) trên thanh Topbar có hiển thị đúng chức danh và họ tên tương ứng.
2. **Kiểm tra ẩn hiện Menu:**
   - Khi đăng nhập bằng `inbound_operator`: Xác nhận mục `/dispatch-orders` và `/users` bị ẩn khỏi Sidebar.
   - Khi đăng nhập bằng `qc_inspector`: Xác nhận mục `/inventory` và `/users` bị ẩn khỏi Sidebar.
3. **Kiểm tra Guard chặn URL trực tiếp (Direct URL Injection):**
   - Đăng nhập tài khoản `staging.inbound@masan.local`.
   - Gõ trực tiếp trên trình duyệt `http://localhost:4350/users`.
   - Kết quả bắt buộc: Trình duyệt chuyển hướng (Redirect) ngay lập tức về trang Dashboard `/` hoặc trả về màn hình `403 Forbidden`.
