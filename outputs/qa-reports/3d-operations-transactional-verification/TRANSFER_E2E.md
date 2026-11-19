# BÁO CÁO KIỂM ĐỊNH ĐIỀU CHUYỂN HÀNG HÓA THỰC TẾ (TRANSFER E2E)
**Hệ thống:** MASAN CONSUMER WMS · TRUNG TÂM ĐIỀU HÀNH KHO 3D  
**Môi trường:** Staging QA Clone (Port API: 5089, Port Frontend: 4380, Database: PostgreSQL 55434)  
**Ngày kiểm định:** 17/11/2026  
**Trạng thái kiểm định:** **100% PASS**

---

## 1. MỤC TIÊU KIỂM ĐỊNH
Chứng minh tính năng điều chuyển hàng hóa trực tiếp từ giao diện 3D Control Center thực hiện ghi nhận giao dịch xuống backend CSDL thực tế, kiểm soát tải trọng, dung lượng ô kệ, tách tách kiện nguyên vẹn (stock split) và đồng bộ lại mô hình 3D mà không làm sai lệch tồn kho.

## 2. DỮ LIỆU ĐẦU VÀO VÀ ĐỐI TƯỢNG ĐIỀU CHUYỂN
- **Phân khu kiểm định:** ZONE-A (Khu vực Nước mắm và Gia vị Masan)
- **Kệ nguồn:** Kệ R01 (Container ID: `b530a998-a483-46ef-9988-e52db3d46eaa`)
- **Ô lưu trữ nguồn:** Ô S03 (Index 2 - Bay 3, Tầng 1)
- **Hàng hóa:** Nam Ngư Nhãn Vàng (`DQA-NAMNGU-VANG`)
- **Số lô (Lot):** `DQA-NAMNGU-VANG-L3`
- **Số lượng ban đầu:** 38 đơn vị (PCS)
- **Quy cách ban đầu:** 4 thùng (7.6 kg, 0.048 m³)
- **Kệ đích:** Kệ R02 (Container ID: `c98735a4-5ab4-465a-bc55-f5f61a7db97e`)
- **Ô lưu trữ đích:** Ô S19 (Index 18 - Bay 4, Tầng 4, ô trống khả dụng)
- **Số lượng điều chuyển:** 19 đơn vị (50% tồn lô nguồn)

## 3. CÁC BƯỚC THỰC THI & PHẢN HỒI BACKEND

### Bước 1: Chọn ô trên 3D & Mở Hộp thoại Điều chuyển
- Người dùng truy cập Trung tâm điều hành 3D, chọn dãy **Kệ R01**, chọn **Ô S03**.
- Panel chi tiết vị trí hiển thị đầy đủ thông tin: SKU `DQA-NAMNGU-VANG`, Trạng thái QC: *Đạt chuẩn xuất kho*, Nút *Điều chuyển hàng sang ô khác* khả dụng.
- Người dùng nhấn nút, hộp thoại `QuickTransferModal` xuất hiện:
  - Cho phép nhập số lượng tùy chọn (1 đến 38 pcs).
  - Tự động tính toán số thùng và khối lượng tương ứng.
  - Người dùng nhập 19 pcs, chọn đích: Kệ R02 - Ô S19.

### Bước 2: Giao dịch Backend NestJS & PostgreSQL
Yêu cầu POST gửi tới: `/api/inventory/transactions` với header `Idempotency-Key`.
- **Mã kết quả HTTP:** `201 Created`
- **Mã giao dịch sinh ra (Transaction ID):** `f5a1d7e6-4fdf-47b6-896f-7c9aeb3dc62b`
- **Loại giao dịch:** `transfer`
- **Người thực hiện:** `staging.manager@masan.local` (Quản lý kho Masan)

```json
{
  "id": "f5a1d7e6-4fdf-47b6-896f-7c9aeb3dc62b",
  "type": "transfer",
  "partId": "5f519510-c5a0-4e73-905c-721c2f6f977e",
  "fromRackId": "b530a998-a483-46ef-9988-e52db3d46eaa",
  "fromSlot": 2,
  "toRackId": "c98735a4-5ab4-465a-bc55-f5f61a7db97e",
  "toSlot": 18,
  "quantityPcs": 19,
  "cartonCount": 2,
  "weightKg": "3.80"
}
```

### Bước 3: Đối soát CSDL PostgreSQL (Trực tiếp Port 55434)
1. **Kiểm tra bản ghi Giao dịch (`inventory_transactions`):**
   - Đã chèn 1 dòng với ID `f5a1d7e6-4fdf-47b6-896f-7c9aeb3dc62b`.
   - Lưu trữ snapshot trạng thái trước và sau của cả lô nguồn và lô đích.
2. **Kiểm tra Tồn nguồn (`parts`):**
   - Bản ghi nguồn `5f519510-c5a0-4e73-905c-721c2f6f977e` giảm chính xác từ 38 PCS -> **19 PCS**.
3. **Kiểm tra Tồn đích (`parts`):**
   - Bản ghi mới được tạo nguyên vẹn trên Kệ R02, Slot 18 với đúng **19 PCS**.

### Bước 4: Tải lại trang 3D & Kiểm tra Đồng bộ Trực quan
- Trình duyệt tải lại giao diện 3D Control Center.
- Trên Kệ R02, Ô S19 (Bay 4, Tầng 4) đã hiển thị pallet kiện hàng Nam Ngư Nhãn Vàng (19 đơn vị).
- Kệ R01 Ô S03 cập nhật còn 19 đơn vị.
- Thanh năng lực dãy kệ (Aisle Capacity) tự động cập nhật tỷ lệ lấp đầy của R01 và R02 tương ứng.

## 4. KẾT LUẬN
- **Nghiệp vụ Điều chuyển:** Đạt chuẩn ACID, không có hiện tượng mất hàng hoặc nhân đôi hàng.
- **Tương tác 3D:** Kết nối thông suốt 2 chiều giữa cảnh 3D và CSDL backend.
