# Hướng dẫn ghi đóng gói trên MASAN WMS

Phiếu đóng gói ghi số lượng đã đóng cho từng dòng hàng đã soạn. Hệ thống liên kết mỗi dòng với đơn xuất, SKU, PART và lô cấp phát. Phiếu được lưu vào cơ sở dữ liệu cùng người ghi và thời điểm ghi. Số tồn vật lý thay đổi khi xác nhận xuất.

## Mở phiếu và ghi số lượng

1. Vào **Đơn xuất kho** trong WMS.
2. Tạo đơn bằng mã đơn, mã SKU và số lượng. Bấm **Giữ tồn theo FEFO**. Kiểm tra các lô được cấp phát và tồn khả dụng.
3. Bấm **Xác nhận soạn**. Khi đơn hiện **Đã soạn**, mở **Phiếu đóng gói** trên thẻ đơn.
4. Đối chiếu SKU, số lô và PART trên dòng với hàng thực đã lấy. Nhập lượng vừa đóng vào **Số lượng đóng gói** và bấm **Ghi đóng gói**. Quản trị viên và quản lý kho có quyền ghi.
5. Kiểm tra số đã đóng và trạng thái của phiếu. Tải lại trang, mở lại phiếu và đối chiếu lượng đã lưu.
6. Thực hiện **Xác nhận xuất** theo quy trình đã duyệt. Kiểm tra trạng thái **Đã xuất**, tồn vật lý và lịch sử xuất.

## Ví dụ QA

Ví dụ một PART có 100 đơn vị, đơn xin xuất 60, kết luận QC cho phép xuất. Sau giữ tồn, hệ thống vẫn có 100 tồn vật lý và 40 khả dụng. Ghi 30 lần đầu sẽ hiện **Đóng gói một phần** và 30/60. Ghi thêm 30 sẽ hiện **Đã đóng gói đủ** và 60/60. Sau xác nhận xuất, tồn vật lý còn 40.

| Thử trên QA | Kết quả mong đợi |
|---|---|
| Ghi 30 khi còn 60 | Hiện 30/60 và lưu audit |
| Ghi 31 khi chỉ còn 30 | Từ chối, tổng vẫn 30/60 |
| QC chuyển HOLD sau Picking | Hiện cảnh báo khi ghi Packing, tổng giữ nguyên |
| Gửi lại cùng yêu cầu do mất phản hồi | Cùng idempotency key và dữ liệu trả về bản ghi cũ |
| Tải lại sau khi ghi đủ | Phiếu vẫn hiện 60/60 |

Khi API báo lỗi, đọc thông báo và tải lại phiếu trước khi xác nhận thêm. Với lô HOLD, chuyển yêu cầu cho bộ phận QC kiểm tra theo quy trình.

## Quyết định còn mở

Theo dõi thùng vật lý, định dạng tem và quy trình quét barcode, giới hạn trọng lượng, niêm phong, mở lại thùng và bắt buộc hoàn thành Packing trước Dispatch cần phê duyệt nghiệp vụ. Màn hình hiện tại ghi lượng đóng theo PART. Người dùng tiếp tục áp dụng quy trình vận hành được duyệt.
