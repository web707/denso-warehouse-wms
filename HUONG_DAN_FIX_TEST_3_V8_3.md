# MASAN CONSUMER WMS v8.3 — Sửa theo Báo cáo Test 3

## Phạm vi và cách sử dụng

Bản này kế thừa source V8.2. **Không xóa hoặc reset PostgreSQL.** Nội dung đổi là frontend, backend PART, và thêm script nạp test tự chọn. Vẫn phải cài dependencies và triển khai lại frontend/backend.

### Đối chiếu 6 yêu cầu

| # | Mục trong báo cáo | Thay đổi trong V8.3 |
|---|---|---|
| 1 | Dữ liệu test 1 Zone | Thêm `SEED_MASAN_1_ZONE_3_RACKS.bat`: `ZONE-TEST-3R`, R01 20 ô mì tôm, R02 20 ô nước mắm, R03 20 ô đồ uống. 60 bản ghi test riêng, có lô/HSD. Không tự xóa dữ liệu test đa Zone cũ. |
| 2 | Quy trình tham chiếu | Nhãn chữ nhỏ, chuyển về mép trái ngay trên công đoạn 01 Tiếp nhận. |
| 3 | Danh mục click ra kho | Click tên sản phẩm / số bản ghi để xem các lô cùng tên; từng lô có kho/Zone/kệ/ô và link Mở kệ. |
| 4 | Không thêm được hàng | Bỏ trạng thái vô hiệu hóa im lặng, kiểm tra và hiển thị lỗi sát trường. Nếu chọn kệ thì backend tạo PART + gán ô + ghi lịch sử trong **cùng transaction**. |
| 5 | Luồng hàng 3D | Đồng bộ năm bước với dashboard: Tiếp nhận (Dock+Staging), Kiểm định, Lưu kho, Soạn hàng (FEFO/Pick & Pack), Xuất kho. Bổ sung xe, khối trạm và tuyến di chuyển mang tính minh họa. |
| 6 | R08 khác giữa Zone và chi tiết | Hai mô hình dùng cùng dữ liệu **preferredRackSlot** đã lưu. Mỗi khối thể hiện một vị trí lưu hàng, không phải số thùng. Khối lượng, số thùng thật được báo trong panel. PART chưa có ô được cảnh báo thay vì vẽ bừa. Trạng thái kệ tổng hợp dùng cùng quy tắc. |

### Sửa thêm sau khi rà soát

- Chặn trường hợp 5 PCS / 50 thùng (EA) — không hợp lý. Để nhập 50 thùng có 24 cái/thùng, cần khai báo 1.200 PCS **nếu** quy cách trên chứng từ thực tế đúng như vậy. Không tự suy đoán số cái mỗi thùng.
- `Division` và `DC Prefix` có lỗi rõ. Nếu chỉ có một cấu hình hợp lệ, form có thể điền mặc định. Người dùng vẫn cần xác nhận.
- Số lô và đơn giá là các trường tùy chọn; để trống không khóa nút. Hàng thực phẩm/đồ uống đã chọn xếp vào kệ vẫn cần HSD hợp lệ.
- Nhãn kệ trong form hiển thị Zone để tránh nhầm R10 ở các khu khác nhau.
- Kệ chưa có `preferredRackSlot`: sẽ hiển thị cảnh báo và không giả định vị trí. Không tự sửa dữ liệu quá khứ.
- Kệ full 20/20 ô vẫn là **Đầy**, không bị nhầm với **Quá tải** nếu tải trọng kg ở mức an toàn.
- Khi chọn Zone test 3 kệ sẽ không đề xuất tạo thêm 17 kệ.

## Nạp dữ liệu 1 Zone / 3 kệ

1. Sao lưu DB hiện tại (`pg_dump` hoặc công cụ quản trị PostgreSQL).
2. Tạo/sử dụng **database thử nghiệm riêng**, ví dụ `masan_wms_test`. Trong `denso-wms-backend/.env` phải có `DB_NAME` chứa chữ `test` hoặc `demo`.
3. Nếu cần, chạy migration và cấu hình gốc (HG/10, loại kệ RACK20-A) trước. Script demo sẽ từ chối chạy nếu thiếu.
4. Cài Node.js dependencies bằng `npm install` tại `denso-wms-backend` nếu chưa có `node_modules`.
5. Ở thư mục gốc mở `SEED_MASAN_1_ZONE_3_RACKS.bat`, xem preview, nhập `CHAY_TEST` để ghi vào DB test.
6. Khởi động lại backend và frontend, mở **Sơ đồ kho theo Zone**, chọn `ZONE-TEST-3R`.
7. Kiểm tra R01/R02/R03 mỗi kệ 20/20 ô, phân nhóm tương ứng. Click sang chi tiết để đối chiếu.

Script chỉ thêm dữ liệu **[TEST]**, có kiểm tra trùng lô/ô và rollback toàn transaction nếu va chạm. Chạy lặp không nhân đôi lô; không xóa Zone test cũ.

**Lưu ý:** Bộ FEFO đa Zone của V8.2 vẫn tồn tại trong source dưới dạng `SEED_MASAN_FEFO_MULTI_ZONE_OPTIONAL.bat`. Đừng chạy cả hai bộ demo vào cùng database nếu mục tiêu chỉ là kiểm thử 1 Zone. Dữ liệu đã nạp từ trước trong PostgreSQL không thể tự biến mất khi cài bản code mới; cần audit trước khi muốn dọn.

## Kiểm tra trên máy lập trình

```bat
cd denso-wms-backend
npm install
npm run build
npm run migration:run

cd ..\denso-wms-frontend
npm install
npm run build
```

Kiểm tra không cần dependencies:

```bat
node tests\verify_test3_core.cjs
```

## Lưu ý về kiểm thử

Ở môi trường tạo file này: kiểm tra syntax 273 file JS/JSX/TS, 8 bài kiểm tra lõi đều qua, ZIP integrity check qua. Không có node_modules nên `tsc`/full build backend còn báo thiếu module phụ thuộc. **Chưa chạy full build, PostgreSQL transaction, Vercel, hay WebGL trên trình duyệt thực tế**. Phải nghiệm thu trên bản test trước khi triển khai chính thức.

**Không được coi mô phỏng luồng hàng 3D là tracking xe/robot hay kết nối IoT/TMS thực tế.**
