# MASAN CONSUMER WMS V8.2 – BỘ DỮ LIỆU TEST FEFO ĐẦY ĐỦ

> **DỮ LIỆU GIẢ LẬP 100%.** Tên sản phẩm tham chiếu `Danh_Muc_San_Pham_Masan.docx` do người dùng cung cấp; số lô, HSD, giá trị, khối lượng, số thùng và vị trí là tự dựng để test, không phải quy cách, ngày NSX hoặc HSD chính thức của Masan. **KHÔNG chạy trên database sản xuất.**

## Kết quả bộ test

- **15 mã demo cũ** `MASAN-DEMO-001..015` được bổ sung HSD và `storage_class` nếu đang thiếu. Giá trị HSD cũ năm 2021 (nhập lỗi từ file test) được thay bằng ngày demo có chủ đích. HSD hợp lệ được bạn nhập thủ công sẽ **giữ nguyên**.
- **61 SKU tham chiếu** được sinh dữ liệu kiểm thử độc lập với mã `MASAN-TEST-001..061`, gồm **88 lô** (23 SKU có nhiều lô), đầy đủ tên hàng, mã hàng, mã lô, HSD, nhóm bảo quản, số thùng, số lượng, trọng lượng, quy cách thùng, đơn hàng.
- **3 lô quá hạn**, **25 lô sắp hết hạn** và **60 lô còn hạn** được tính theo ngày mốc **2026-11-05**. Trạng thái sẽ thay đổi tự nhiên theo ngày máy tính.
- Các Zone `[TEST]` riêng được tạo cho thực phẩm khô, gia vị/nước chấm, đồ uống, thịt mát, nông sản, hóa phẩm; lô quá hạn chuyển vào **Zone demo cách ly** riêng. Kệ có mã `R01..` và ô S01–S20; không hơn 20 kệ/Zone, mỗi kệ chỉ xếp tối đa 10 lô test để chừa sức chứa.
- Trên trang FEFO có ô **"Chỉ dữ liệu test"** và nhãn `TEST` giúp phân biệt dữ liệu giả lập với hàng thật.

## Nạp đủ dữ liệu trên Windows

1. **Sao lưu PostgreSQL** và đảm bảo đang dùng **database LOCAL/STAGING**. Tuyệt đối không dùng trên database production. File `.env` trong `denso-wms-backend` phải trỏ đúng database test.
2. Chạy migration: mở terminal tại `denso-wms-backend` và chạy `npm install` (nếu chưa cài), sau đó `npm run migration:run`.
3. Nếu thiếu Division/loại kệ tham chiếu, chạy `npm run seed` **không thêm `--reset`** để tạo các danh mục nền.
4. Quay về thư mục gốc và chạy **`SEED_MASAN_FEFO_TEST.bat`**. Script chạy bước xem trước trước, sau đó hỏi bạn gõ `CHAY_TEST` mới thực sự ghi dữ liệu.
5. Mở ứng dụng, nhấn **Làm mới dữ liệu** hoặc tải lại trang, vào **Hàng cũ · mới (FEFO)**, chọn **Chỉ dữ liệu test** để xem các lô.
6. Vào **Quản lý Zone** để xem các Zone `[TEST]` và **Sơ đồ kho theo Zone** để kiểm tra vị trí 3D từng lô.

### Chạy bằng terminal thay vì BAT

```bat
cd denso-wms-backend
npm run seed:masan-demo
set MASAN_DEMO_SEED=YES
npm run seed:masan-demo -- --apply-demo
```

- Chạy lặp lại **không nhân đôi** các lô đã được tạo bởi script; không đụng đến các PART khác mã demo.
- Script ghi trong một database transaction: nếu phát hiện Zone/kệ test bị dùng bởi dữ liệu khác, nó sẽ dừng và rollback.
- Script **không** xóa dữ liệu hiện có, không thay đổi tài khoản và không chạy `TRUNCATE`.
- Một vài lô demo cũ từ trước có thể đang xếp lẫn nhóm bảo quản trong cùng kệ vì dữ liệu được import trước V8.2. Script không tự ý điều chuyển chúng (để không làm sai lịch sử giao dịch); cần đối chiếu và điều chuyển riêng trong website.
- Không tích hợp với database tại `localhost` của bạn từ phía ChatGPT. Bạn phải chạy lệnh tại máy có quyền truy cập PostgreSQL.

## Excel kèm theo

File `MASAN_FEFO_FULL_TEST_103_LO.xlsx` gồm:

| Sheet | Ý nghĩa |
|---|---|
| `Import` | 88 dòng đủ 20 cột tương thích template nhập file của WMS (sheet đầu tiên). |
| `Cap nhat 15 demo` | Bảng đối chiếu 15 mã demo cũ để seed cập nhật. Không dùng sheet này để import. |
| `Tong quan` | Số SKU, số lô, tình huống FEFO và cơ cấu nhóm bảo quản. |
| `Huong dan` | Hướng dẫn nhanh và giới hạn bảo mật dữ liệu. |

Bạn có thể chỉ **import Excel** thay vì chạy seed, nhưng trường hợp đó các lô sẽ **chưa gán kệ** (import đơn hàng không có `targetRackId`) và **không sửa được 15 lô cũ**. Để có đủ vị trí 3D, dùng script seed thay cho import Excel. **Không chạy cả hai** để tránh thao tác dư thừa.

## Checklist kiểm thử

- [ ] FEFO không còn `Thiếu HSD` đối với 15 mã demo cũ chưa được nhập ngày (nếu đã nạp thành công).
- [ ] Lô demo `MASAN-DEMO-001` không còn HSD sai năm 2021 nếu dữ liệu còn giống ảnh cũ.
- [ ] Có dòng `Hết hạn`, `Sắp hết hạn`, `Ưu tiên FEFO`, `Hàng mới hơn`.
- [ ] Cùng một SKU hiển thị 2–3 lô và `Lô 1/N theo HSD` đúng ngày.
- [ ] `Xem vị trí` tới kệ có hàng; các Zone và ô không bị trộn thực phẩm/hóa phẩm.
- [ ] Lô quá hạn nằm ở khu `[TEST] Cách ly`, dùng để minh họa cảnh báo.
- [ ] Chạy lại seed lần thứ hai không tạo thêm dòng mới.

**Giới hạn hiện tại:** trang FEFO mới gợi ý theo HSD. Backend hiện chưa tự chặn xuất theo HSD/QC. Việc hiển thị Zone cách ly `[TEST]` không có nghĩa là đã có một quy trình cách ly, chặn xuất được thực thi và xác thực trong API. Hãy chỉ dùng data này để demo, không sử dụng vận hành thực tế.
