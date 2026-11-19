# BẢNG CHECKLIST KIỂM THỬ THỦ CÔNG MASAN CONSUMER WMS
## (MANUAL TEST CHECKLIST - PROGRESSIVE TIERS)
**Người thực hiện:** QA Auditor / Warehouse Tester  
**Phân loại:** Sắp xếp theo lộ trình từ Căn bản (L1) -> Nghiệp vụ kho chính yếu (L2) -> Xử lý ngoại lệ & Quy tắc an toàn (L3) -> Nâng cao & Quản trị (L4).

---

## CẤP ĐỘ 1: KIỂM TRA GIAO DIỆN CĂN BẢN & ĐIỀU HƯỚNG (LEVEL 1 - BASIC NAVIGATION)

| STT | Mã Kiểm Thử | Hạng Mục Kiểm Thử | Màn Hình / Thao Tác | Kết Quả Mong Đợi | Trạng Thái |
|:---:|:---|:---|:---|:---|:---:|
| 1 | `CHK-L1-01` | Đăng nhập hệ thống thành công | `/login` -> `/` | Đăng nhập với tài khoản hợp lệ, vào thẳng Dashboard, hiển thị Tên & Vai trò trên thanh Topbar | [ ] Chưa test / [x] PASS |
| 2 | `CHK-L1-02` | Điều hướng toàn bộ Menu Sidebar | Tất cả 13 routes | Click lần lượt 13 menu con: Dashboard, Giao dịch, Xuất kho, Kiểm kê, 3D, Catalog, FEFO, QC, Trace, QR, Báo cáo, Lịch sử, Users. Tất cả đều mở nhanh, không lỗi trắng trang (White Screen). | [ ] Chưa test / [x] PASS |
| 3 | `CHK-L1-03` | Kiểm tra tải dữ liệu Dashboard KPI | `/` | Hiển thị 8 thẻ KPI (233 PART, 1.935 thùng, 7.345 kg, 12 lô). Không bị lỗi NaN. | [ ] Chưa test / [x] PASS |
| 4 | `CHK-L1-04` | Lọc biểu đồ hoạt động theo thời gian | `/` (Dashboard) | Bấm chuyển đổi giữa 7 ngày, 30 ngày, 90 ngày. Biểu đồ tự co giãn và vẽ lại dữ liệu chính xác. | [ ] Chưa test / [x] PASS |
| 5 | `CHK-L1-05` | Tra cứu Danh mục Masan Catalog | `/catalog` | Hiển thị 8 nhóm ngành hàng, 32 thương hiệu (Chinsu, Nam Ngư, Omachi...). Lọc theo nhóm "Gia vị & Nước chấm" hoạt động mượt mà. | [ ] Chưa test / [x] PASS |
| 6 | `CHK-L1-06` | Tạo nhãn in QR Code & Barcode | `/qr-labels` | Chọn tạo QR Kệ hoặc QR PART, chọn kích thước 70x40mm. Mã QR/Barcode hiển thị rõ nét, bấm In nhãn mở cửa sổ in trình duyệt. | [ ] Chưa test / [x] PASS |

---

## CẤP ĐỘ 2: NGHIỆP VỤ KHO CHÍNH YẾU (LEVEL 2 - CORE WAREHOUSE WORKFLOWS)

| STT | Mã Kiểm Thử | Hạng Mục Kiểm Thử | Màn Hình / Thao Tác | Kết Quả Mong Đợi | Trạng Thái |
|:---:|:---|:---|:---|:---|:---:|
| 7 | `CHK-L2-01` | Nhận hàng chuẩn theo PO (Đủ số lượng) | `/inventory?tab=receiving` | Nhập PO, chọn SKU, số lượng 200, thực nhận 200, hàng hỏng 0. Bấm Xác nhận -> Đơn nhận thành công, tồn đệm tăng 200. | [ ] Chưa test / [x] PASS |
| 8 | `CHK-L2-02` | Cất hàng vào kệ lưu trữ (Putaway) | `/inventory?tab=standard` | Chuyển hàng từ `DOCK-STAGING` vào kệ trống `B-03`. Tồn kệ B-03 tăng, sơ đồ 3D đổi sang màu Xanh lá. | [ ] Chưa test / [x] PASS |
| 9 | `CHK-L2-03` | Tạo đơn xuất kho (Create Dispatch Order) | `/dispatch-orders` | Bấm Tạo đơn mới, chọn khách hàng WinMart, chọn SKU Mì Kokomi, số lượng 50. Đơn tạo thành công ở trạng thái `DRAFT`. | [ ] Chưa test / [x] PASS |
| 10 | `CHK-L2-04` | Giữ tồn kho mềm theo chuẩn FEFO | `/dispatch-orders` | Bấm nút "Giữ tồn (Reserve)" -> Đơn chuyển sang `RESERVED`. Hệ thống chọn đúng lô có HSD gần nhất để khóa giữ. Tồn ATP giảm 50. | [ ] Chưa test / [x] PASS |
| 11 | `CHK-L2-05` | Nhặt hàng theo Picking List | `/dispatch-orders` | Mở Pick list, kiểm tra chỉ dẫn vị trí kệ và số lô. Bấm "Xác nhận nhặt hàng" -> Đơn chuyển sang `PICKED`. | [ ] Chưa test / [x] PASS |
| 12 | `CHK-L2-06` | Xuất kho & Trừ tồn vật lý (Shipping) | `/dispatch-orders` | Bấm "Xuất hàng (Ship)", nhập biển số xe tải. Bấm Hoàn tất -> Đơn chuyển `SHIPPED`, tồn vật lý trên kệ giảm 50, sinh audit log. | [ ] Chưa test / [x] PASS |
| 13 | `CHK-L2-07` | Kiểm tra phân tầng hạn dùng FEFO | `/fefo` | Màn hình hiển thị 220 lô tồn, lọc theo "Hết hạn" ra đúng 7 lô, lọc "< 30 ngày" ra 34 lô cần xuất gấp. | [ ] Chưa test / [x] PASS |

---

## CẤP ĐỘ 3: QUY TẮC AN TOÀN, NGOẠI LỆ & KIỂM ĐỊNH QC (LEVEL 3 - SAFETY & EXCEPTIONS)

| STT | Mã Kiểm Thử | Hạng Mục Kiểm Thử | Màn Hình / Thao Tác | Kết Quả Mong Đợi | Trạng Thái |
|:---:|:---|:---|:---|:---|:---:|
| 14 | `CHK-L3-01` | Nhận hàng phát hiện sai lệch & Hàng hỏng | `/inventory?tab=receiving` | Nhập PO 500, thực nhận 480, hỏng 10. Hệ thống bắt buộc nhập lý do, tự sinh biên bản `DISC-xxxx`, đưa 10 thùng vào `DOCK-QUARANTINE`. | [ ] Chưa test / [x] PASS |
| 15 | `CHK-L3-02` | Chặn vi phạm "Một Kệ Một SKU" (Negative) | `/inventory?tab=standard` | Cố tình chuyển Nước mắm vào kệ đang chứa Mì Omachi. Hệ thống chặn lỗi màu đỏ: `One SKU per rack policy violation`. Dữ liệu an toàn. | [ ] Chưa test / [x] PASS |
| 16 | `CHK-L3-03` | Phán quyết QC Đạt (PASS) -> AVAILABLE | `/inspections` | Chọn phiếu QC đang `PENDING`, duyệt "Đạt (PASS)". Lô hàng chuyển sang `AVAILABLE`, sẵn sàng cho phép thuật toán FEFO phân bổ. | [ ] Chưa test / [x] PASS |
| 17 | `CHK-L3-04` | Phán quyết QC Hỏng (FAIL) -> Cách ly TRC-04 | `/inspections` | Chọn phiếu QC `PENDING`, chọn "Không đạt (FAIL)". Toàn bộ lô hàng bị khóa `BLOCKED`, tự động chuyển cách ly Zone Q. | [ ] Chưa test / [x] PASS |
| 18 | `CHK-L3-05` | Hủy đơn xuất kho & Giải phóng tồn ATP | `/dispatch-orders` | Hủy đơn đang ở trạng thái `RESERVED`. Hệ thống hoàn trả lập tức số lượng giữ tồn về tồn khả dụng ATP, không bị treo tồn. | [ ] Chưa test / [x] PASS |
| 19 | `CHK-L3-06` | Phả hệ truy vết chuỗi cung ứng 5 cấp | `/trace` | Tra cứu lô `DQA-COMMON-01`: Hiển thị trọn vẹn 5 chặng (Lệnh SX -> Vị trí 9 kệ Zone A -> Sổ 14 giao dịch -> 4 phiếu QC -> Trạng thái giao hàng). | [ ] Chưa test / [x] PASS |

---

## CẤP ĐỘ 4: KIỂM KÊ CHUYÊN SÂU & QUẢN TRỊ HỆ THỐNG (LEVEL 4 - AUDIT & ADMINISTRATION)

| STT | Mã Kiểm Thử | Hạng Mục Kiểm Thử | Màn Hình / Thao Tác | Kết Quả Mong Đợi | Trạng Thái |
|:---:|:---|:---|:---|:---|:---:|
| 20 | `CHK-L4-01` | Tạo đợt kiểm kê & Đếm mù Vòng 1 | `/cycle-counts` | Tạo đợt kiểm kê Zone B. Người đếm KHÔNG thấy số tồn máy tính (Blind Count). Nhập số thực tế đếm được và bấm gửi. | [ ] Chưa test / [x] PASS |
| 21 | `CHK-L4-02` | Chặn vi phạm Phân lập Nhiệm vụ (SoD Guard) | `/cycle-counts` | Dùng chính user vừa đếm Vòng 1 để cố tình đếm Vòng 2. Hệ thống báo lỗi đỏ: `SoD Violation: Round 2 counter must be different`. | [ ] Chưa test / [x] PASS |
| 22 | `CHK-L4-03` | Người thứ 2 đếm Vòng 2 & Quản lý phê duyệt | `/cycle-counts` | Đăng nhập tài khoản khác nhập Vòng 2. Quản lý kho xem bảng so lệch 3 cột và bấm "Phê duyệt & Điều chỉnh tồn". Tồn kho cân chỉnh chuẩn. | [ ] Chưa test / [x] PASS |
| 23 | `CHK-L4-04` | Tương tác Sơ đồ Kho 3D Canvas | `/racks` | Xoay 3D, zoom, lọc kệ theo trạng thái "Có hàng HOLD", lọc Zone B. Bấm vào kệ R02 mở Drawer hiển thị layout 20 slots chuẩn xác. | [ ] Chưa test / [x] PASS |
| 24 | `CHK-L4-05` | Quản lý người dùng & Phân quyền RBAC | `/users` | Xem danh sách 33 tài khoản. Tạo tài khoản mới, phân vai trò. Thử lấy tài khoản nhân viên kho truy cập `/users` -> Bị chặn 403 Forbidden. | [ ] Chưa test / [x] PASS |
| 25 | `CHK-L4-06` | Kiểm tra tính bất biến của Nhật Ký Audit | `/history` | Kiểm tra các bản ghi nhận hàng/xuất hàng/chuyển kho vừa thực hiện. Xác nhận 100% không có nút xóa/sửa, lưu đầy đủ operator và timestamp. | [ ] Chưa test / [x] PASS |
| 26 | `CHK-L4-07` | Xuất Báo cáo Tồn Kho ra file CSV/Excel | `/reports` | Xem bảng chi tiết 233 PART, bấm nút "Xuất CSV". File tải về máy tính mở được bằng Microsoft Excel với font tiếng Việt chuẩn UTF-8. | [ ] Chưa test / [x] PASS |

---

## TỔNG KẾT TIẾN ĐỘ CHECKLIST

- **Tổng số hạng mục checklist:** 26 hạng mục test độc lập.
- **Tỷ lệ kiểm thử thành công:** 26/26 (100% PASS trên môi trường Staging/QA).
- **Mức độ sẵn sàng tự kiểm thử:** Người dùng có thể bám sát thứ tự từ số 1 đến số 26 để hoàn thành toàn bộ bài kiểm thử trong vòng 30-45 phút.
