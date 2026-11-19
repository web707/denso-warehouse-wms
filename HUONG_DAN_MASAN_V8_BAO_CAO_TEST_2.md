# MASAN CONSUMER WMS V8 — THEO “BÁO CÁO TEST 2”

Bản này phát triển từ Masan Consumer WMS V7.1. Các dữ liệu thực tế và liên kết kỹ thuật `DENSO-WH` trong database **không bị đổi tên hay reset**; mã này tiếp tục được dùng để giữ nguyên khóa dữ liệu cũ. Hiển thị thương hiệu vẫn là Masan Consumer.

## 1. Đối chiếu 5 ý trong báo cáo

| Báo cáo | Đã chỉnh trong source | Giới hạn cần hiểu |
|---|---|---|
| Trạng thái kệ bị lặp, có hộp đỏ | Bỏ chú giải trùng; 3D chỉ có **một** chú giải. Red chỉ báo quá tải **thực tế**. Backend kiểm tra tải trọng ô/tầng/kệ, thể tích, trùng ô khi nhập/chuyển/gán trực tiếp/import Excel/auto-assign. | Không được coi quá tải là tình trạng bình thường dù toàn kho đã đầy. Nếu dữ liệu cũ thật sự quá tải, màu đỏ vẫn phải cảnh báo. |
| Heatmap làm giao diện rối | Bỏ Heatmap và mọi API gọi Heatmap khỏi hai scene kho 3D; giữ hiển thị tải trọng, tồn kho và trạng thái kệ. | Endpoint thống kê Heatmap vẫn còn ở backend để tương thích công cụ khác, không còn được gọi từ 3D. |
| HSD thiếu / không biết nhập đâu | Đưa **HSD** và **nhóm bảo quản** lên đầu form PART; thêm **Sửa HSD** ngay trong Quản lý lô & FEFO; phân trang danh sách. | Dữ liệu cũ thiếu HSD **không tự được bịa/bổ sung**. Cần xác minh với bao bì hoặc chứng từ. |
| Hàng Masan chưa đủ và trộn nhóm bảo quản | Giữ đủ danh mục tham chiếu có trong tài liệu Masan, cho nhập SKU ngoài danh mục; thêm 7 nhóm bảo quản hàng hóa và 4 loại Zone. Không cho hóa phẩm chung kệ với thực phẩm hoặc thịt mát vào Zone thường. Gợi ý ô theo FEFO. | Danh mục Masan là **tài liệu mẫu**, không phải toàn bộ mã SKU của công ty. 15 PART tồn kho không tự biến thành 61 PART. Zone lạnh phải có cơ sở hạ tầng thật, giao diện không tạo lạnh bằng phần mềm. |
| Mô hình xe đưa hàng vào kho | Thêm **Luồng hàng 3D** 5 điểm: Dock nhập → Staging → QC/Quét mã → Kệ → Dock xuất, có nút phát/tạm dừng/phát lại. | Đây là mô phỏng quy trình, **không phải dữ liệu xe, camera, IoT hoặc GPS thực tế**. |

## 2. Phân loại bảo quản mới

- `dry_food`: Mì, cà phê hòa tan, đồ ăn khô, xúc xích tiệt trùng (theo nhãn sản phẩm thực tế); Zone `ambient`, kệ riêng.
- `condiments`: Nước mắm, nước tương, tương ớt, gia vị; Zone `ambient`, kệ riêng với các nhóm khác.
- `beverages`: Nước tăng lực, nước khoáng; Zone `ambient`, kệ riêng và kiểm tra giới hạn nặng.
- `chilled_food`: Thịt mát MEATDeli; Zone `chilled` **đã được trang bị lạnh thật**.
- `produce`: Rau, nông sản; Zone `produce` chuyên dụng, yêu cầu thực tế theo loại rau/quả.
- `household`: Bột giặt, nước giặt, nước lau sàn NET/Sopa; Zone `household` cách ly thực phẩm.
- `unknown`: Chưa xác minh nhóm. Không tự xếp kệ cho tới khi quản lý xác nhận.

Điều kiện bảo quản được ghi vào cơ sở dữ liệu bằng hai trường mới: `parts.storage_class` và `warehouse_zones.storage_mode`. Migration **chỉ thêm cột**, giữ dữ liệu cũ. Tất cả PART cũ được đánh dấu `unknown`; Zone cũ mặc định `ambient` cho tới khi kiểm tra lại. Không đổi Zone có tồn kho bằng dropdown; phải điều chuyển hết hàng trước.

> **Cảnh báo:** Dự đoán nhóm từ tên sản phẩm chỉ là gợi ý ban đầu. Quy định bảo quản, nhiệt độ, độ ẩm và yêu cầu cách ly phải dựa trên nhãn, bao bì hoặc hồ sơ QC thực tế. Không đưa MEATDeli vào kho thường chỉ vì phần mềm cho phép.

## 3. HSD và lô cũ/mới

- Form **Thêm / Sửa PART**: nhập `LotNumber`, `HSD` và chọn `Nhóm bảo quản`. HSD bắt buộc với thực phẩm/đồ uống được phân loại trong form.
- Trang **Quản lý lô & FEFO**: chọn “Sửa HSD” tại dòng sản phẩm, nhập ngày từ bao bì rồi bấm “Lưu HSD”. Quyền sửa theo vai trò kho.
- **Import Excel:** cột `expirationDate` và cột `storageClass` tùy chọn để nhập nhiều PART. Lúc nhập thẳng vào kệ, thực phẩm/đồ uống cần HSD và nhóm được xác nhận; thiếu sẽ có lỗi rõ ràng. Nếu chỉ import vào đơn hàng chưa gán kệ, có thể bổ sung sau.
- Khi hệ thống tự chọn ô, lô còn hạn ngắn được **ưu tiên** S01–S10 (tầng 1–2); lô hạn dài được ưu tiên S11–S20 (tầng 3–4). Đây là quy tắc chọn ô, **không** cam kết vị trí gần Dock theo khoảng cách vật lý chưa đo.
- Hai lô cùng SKU nhưng `LotNumber` hoặc `expirationDate` khác nhau không còn bị gộp trùng khi import. Chức năng gợi ý FEFO **không tự động xuất hàng hay thay thế QC**.

## 4. Chống quá tải và phân bổ tự động

- Không ghi giao dịch nếu ô trùng, vượt kg/ô, kg/tầng, kg/kệ hoặc thể tích kệ. Lối gán PART cũ nay cũng đi qua cùng bộ kiểm tra; import Excel vào kệ thuộc đơn hàng khác bị từ chối.
- Khi **nhập một PART chưa có kệ** mà bỏ trống kệ đích: backend tìm kệ/ô phù hợp theo Zone, loại hàng, thứ tự HSD và sức chứa. Nếu không có, trả lỗi và **không lưu một vị trí giả**.
- Nếu người dùng đã chỉ định rõ kệ/ô, backend không tự âm thầm chuyển sang nơi khác: sẽ báo cần chọn kệ khác.
- Một PART là một bản ghi tồn kho tại **một vị trí**. Nếu hàng mới khiến PART hiện tại vượt giới hạn, cần tạo lô/record riêng hoặc chuyển cả PART hợp lệ. Không tự tách 500 thùng ra nhiều kệ mà không ghi nhận nghiệp vụ.
- Kệ cũ quá tải (nếu có) vẫn hiển thị cảnh báo đỏ để quản lý xử lý, dù còn ô trống.

## 5. Cài đặt lên bản WMS đang chạy

1. **Sao lưu PostgreSQL** trước. Không xóa database, không chạy các lệnh seed demo lên dữ liệu thật.
2. Dừng backend. Giữ file `.env` thực tế đang dùng; **không chép đè** bằng `.env.example`.
3. Trong `denso-wms-backend`: `npm ci`, sau đó chạy `npm run migration:run`, `npm run build`, rồi khởi động lại backend bằng quy trình hiện tại.
4. Trong `denso-wms-frontend`: `npm ci`, `npm run build`; deploy lại thư mục `dist` (Vercel hoặc frontend hosting tương ứng).
5. Mở **Quản lý Zone**, tạo `ZONE-LANH` kiểu `chilled`, `ZONE-HOA-PHAM` kiểu `household`, và nếu cần `ZONE-NONG-SAN` kiểu `produce`; khởi tạo kệ cho các Zone mới.
6. Xem PART cũ còn `unknown`: xác minh nhóm trên nhãn / phiếu kho, cập nhật thông tin trước khi nhập/xếp tiếp. Điền HSD thiếu trong FEFO.
7. Kiểm thử giao dịch trên môi trường staging trước khi đưa lên production.

## 6. Kịch bản nghiệm thu

- [ ] Kệ 3D chỉ còn một chú giải, không còn Heatmap.
- [ ] Nhập Kokomi có HSD vào Zone thường, kệ trống phù hợp → tự chọn ô; 3D đổi từ trống sang có hàng.
- [ ] Đưa NET vào kệ thực phẩm hoặc Zone thường → backend từ chối.
- [ ] Đưa MEATDeli vào Zone thường → từ chối; chuyển vào Zone chilled hợp lệ → chấp nhận nếu còn sức chứa.
- [ ] Chọn ô đang dùng, vượt 500 kg/ô hoặc vượt kg/kệ → bị chặn, không ghi sai tồn.
- [ ] Nhập hết chỗ mà không còn vị trí hợp lệ → lỗi rõ, không tạo kệ “quá tải”.
- [ ] Sửa HSD trong FEFO → bảng đổi trạng thái; hai lô SKU giống nhau khác HSD vẫn tách riêng.
- [ ] Điều chuyển PART → ô nguồn trống, ô đích có hàng sau khi backend xác nhận.
- [ ] Nhấn “Phát mô phỏng” trong Luồng hàng 3D → pallet chạy đủ 5 bước, có thể dừng/phát lại.

## 7. Kiểm thử nguồn tại thời điểm đóng gói

- Kiểm tra parse 275 file JS/JSX/TS: **pass**.
- Test thuần 14 trường hợp phân nhóm/cách ly/HSD/thứ tự ô: **pass**.
- Không thể hoàn tất `npm ci --offline` vì thiếu gói trong cache. Do đó **chưa xác nhận full build, API tích hợp PostgreSQL và UI WebGL trong trình duyệt**. Cần kiểm thử theo mục 6 trước khi sử dụng thật.
