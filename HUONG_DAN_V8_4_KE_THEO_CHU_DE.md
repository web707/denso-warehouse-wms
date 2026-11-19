# MASAN CONSUMER WMS V8.4 — Mỗi kệ một chủ đề sản phẩm

## Mục đích

- **Một kệ vật lý (R01, R02, ...)** có 20 ô S01–S20; các lô trong một kệ phải thuộc **cùng một chủ đề hàng hóa**.
- Các SKU/lô khác nhau trong cùng chủ đề được phép ở chung một kệ, nếu đủ tải trọng/thể tích, đúng Zone bảo quản, còn ô trống và có HSD đúng quy tắc.
- Ví dụ demo 1 Zone: R01 **gia vị & nước chấm**, R02 **mì/phở**, R03 **đồ uống**. Mỗi kệ demo có 20 ô có hàng. Đây là dữ liệu **thử nghiệm**, không phải tồn kho thật.
- Hàng lạnh / nông sản / hóa phẩm không tự trộn chung Zone ambient thực phẩm; cần Zone phù hợp trước khi gán chủ đề và xếp hàng.

## Nâng cấp an toàn

1. Sao lưu database PostgreSQL. Triển khai cả backend và frontend mới.
2. Chạy migration **1788100000000-AddRackProductFamily.ts** bằng lệnh migrations hiện có của backend trước khi khởi động hệ thống. Đây là migration **chỉ thêm cột `containers.product_family`**, không xóa, không di chuyển tồn kho.
3. Vào **Sơ đồ kho theo Zone → chi tiết kệ**. Quản lý kho/admin có thể chọn `Chủ đề kệ`. Kệ chưa được cấu hình sẽ tự khóa động vào chủ đề của sản phẩm đầu tiên khi thêm hàng (qua quy tắc kiểm tra dựa vào các sản phẩm trong kệ).
4. Backend chặn tạo/gán/import/nhập/điều chuyển/tự phân bổ nếu kệ đã có mặt hàng khác chủ đề. Các kệ đã trộn sẵn được **đánh dấu cần kiểm tra**, không tự dồn hay xóa hàng.
5. Trên 3D tổng quan, mỗi kệ có nhãn chủ đề và màu thống nhất; trong chi tiết, chế độ **Màu theo chủ đề kệ** được chọn mặc định. Có thể đổi sang màu theo PART.

## Demo mới / test

- Chỉ chạy `SEED_MASAN_1_ZONE_3_RACKS.bat` trên **PostgreSQL thử nghiệm riêng** có `DB_NAME` chứa `test`/`demo`, đã chạy migration và cài dependencies.
- R01: 20 lô nước mắm/gia vị; R02: 20 lô mì; R03: 20 lô đồ uống. Không tạo thêm Zone hay 17 kệ khác.
- Seed **không xóa dữ liệu**. Nếu bạn đã chạy bản demo cũ (R01 mì, R02 nước mắm), lệnh sẽ **từ chối ghi đè**. Hãy dùng database test sạch hoặc điều chuyển thủ công có kiểm soát; đừng chạy trên production.

## Những gì không tự thực hiện

- Không phân tách một PART ra nhiều ô; mỗi PART vẫn được quản lý bằng một vị trí cố định như bản V8.3.
- Không di chuyển hàng lịch sử sang kệ khác chỉ vì bật chế độ mới. Việc phân loại/gán chủ đề cho kệ có sẵn vẫn cần người dùng kiểm tra nghiệp vụ.
- Không thay thế thử nghiệm E2E với database/thực tế WebGL; cần nghiệm thu trước khi triển khai production.
