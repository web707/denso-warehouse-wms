# MASAN CONSUMER WMS – HARDWARE & DEVICE COMPATIBILITY AUDIT (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Mobile Devices, Barcode / QR Scanning & Industrial PDA Integration Audit  
**Chuyên gia phụ trách**: Industrial IoT & Hardware Integration Lead, QA Lead  
**Ngày lập**: 12/11/2026  

---

## 1. KIỂM THỬ THIẾT BỊ VẬT LÝ THỰC TẾ (PHYSICAL HARDWARE AUDIT)

### 1.1. Thực nghiệm kết nối qua Android Debug Bridge (ADB)
Lệnh kiểm tra phần cứng thiết bị di động:
```bash
adb devices -l
```
- **Kết quả trả về**: Danh sách rỗng (`List of devices attached: [trống]`).
- **KẾT LUẬN MINH BẠCH**: **BLOCKED (KHÔNG CÓ THIẾT BỊ VẬT LÝ KẾT NỐI)**.
- **Cam kết kỹ thuật**: Báo cáo **TUYỆT ĐỐI KHÔNG GIẢ MẠO KẾT QUẢ TEST PASS** cho phần cứng, camera vật lý hoặc máy quét cầm tay chuyên dụng khi không có thiết bị thật trong môi trường máy chủ.

---

## 2. PHÂN TÍCH PHẦN MỀM TẠO VÀ ĐỌC MÃ VẠCH TRÊN WEB FRONTEND

Khảo sát mã nguồn giao diện tại `src/pages/QRLabels.jsx`:
- **Tạo mã QR**: Sử dụng thư viện `qrcode.react` render SVG chuẩn vector cho mã định danh vị trí kệ (`/location?subinventory=...`) và truy xuất nguồn gốc (`/trace?lot=...`).
- **Tạo mã vạch 1D**: Sử dụng `JsBarcode` render định dạng `CODE128` cho mã hàng và số lô.
- **In ấn nhãn (Thermal Printing)**: Hỗ trợ CSS in khổ tem nhiệt chuẩn 4x6 inch và 50x30 mm.

---

## 3. ĐÁNH GIÁ CÔNG NGHỆ QUÉT: CAMERA ĐIỆN THOẠI VS MÁY QUÉT LASER CHUYÊN DỤNG

Trong kho vận Masan Consumer, việc chọn công nghệ quét mã ảnh hưởng trực tiếp đến năng suất lao động:

| Tiêu chí kỹ thuật | Quét bằng Camera Điện thoại (Smartphone / WebRTC) | Quét bằng Máy PDA Công nghiệp (Zebra / Honeywell Laser) |
|---|---|---|
| **Công nghệ cảm biến** | Cảm biến hình ảnh CMOS + Thuật toán phần mềm (JS BarcodeDetector) | Đầu đọc laser quang học chuyên dụng / 2D Imager Engine |
| **Độ trễ quét (Scan Latency)** | **300 ms – 1.000 ms** (Cần lấy nét tự động, điều kiện sáng) | **20 ms – 50 ms** (Tức thời, phản hồi bằng tia laser và tiếng beep) |
| **Khoảng cách quét** | 10 cm – 40 cm | **15 cm – 15 mét** (Extended-range laser đọc được kệ cao tầng 4-5) |
| **Khả năng đọc mã hỏng** | Kém (Mã mờ, rách, bọc màng co nilon bóng thường không đọc được) | Rất cao (Thuật toán phần cứng đọc được mã rách 30%, in mờ, qua màng co PE) |
| **Tác động công thái học (Ergonomics)** | Nhanh mỏi tay, hao pin nhanh (camera chạy liên tục làm nóng máy) | Thiết kế dạng báng súng (Gun Grip), pin dung lượng lớn thay thế nóng (Hot-swap) |
| **Độ bền công nghiệp** | Rơi vỡ sau vài lần va đập | Chuẩn IP65/IP67, chịu rơi từ độ cao 1.8m xuống nền bê tông kho |

---

## 4. CƠ CHẾ TÍCH HỢP MÁY PDA CÔNG NGHIỆP (ZEBRA / HONEYWELL DATAWEDGE)

Các dòng máy PDA kho phổ biến (Zebra TC21/TC26/TC57, Honeywell ScanPal EDA51/EDA52, Datalogic Memor) chạy hệ điều hành Android Enterprise tích hợp sẵn dịch vụ quét mã nền:
- **Zebra DataWedge**
- **Honeywell Enterprise Browser / Scanning Service**

### Nguyên lý hoạt động: "Keyboard Wedge Mode" (Phím ảo)
```
[ Tia Laser Quét Barcode ] 
           │
           ▼
[ Phần cứng Scanner Engine giải mã thành chuỗi ký tự ]
           │
           ▼
[ DataWedge Profile tự động chèn chuỗi ký tự vào Input Field đang focus ]
           │
           ▼
[ DataWedge tự động bắn phím "ENTER" hoặc "TAB" ]
           │
           ▼
[ Web App lắng nghe sự kiện onKeyDown (Enter) để kích hoạt API ngay lập tức ]
```

### KHIẾM KHUYẾT TRÊN GIAO DIỆN HIỆN TẠI VÀ ĐỀ XUẤT NÂNG CẤP FRONTEND:
- **Hiện trạng Web UI**: Nhân viên kho bắt buộc phải dùng ngón tay chạm chuột/chạm màn hình để **focus vào đúng ô input** trước khi bấm cò quét. Nếu ô input mất focus, chuỗi mã quét sẽ bị rơi vào khoảng không.
- **Giải pháp Enterprise (Global Barcode Listener)**:
  Xây dựng một Custom React Hook `useBarcodeScanner.js`:
  ```javascript
  // Lắng nghe toàn cục sự kiện bàn phím tốc độ cao (<50ms giữa các ký tự)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      const now = Date.now();
      if (now - lastKeyTime > 100) buffer = ''; // Quá 100ms là người gõ tay, reset buffer
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          handleGlobalBarcodeScanned(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  ```
  Nhờ đó, thủ kho cầm máy PDA có thể quét nhãn kệ, nhãn thùng hàng bất kỳ lúc nào mà không cần chạm tay vào màn hình cảm ứng!

---

## 5. PHÂN TÍCH TIÊU CHUẨN MÃ VẠCH GS1-128 / GS1-DATAMATRIX CHO MASAN

Masan Consumer là thành viên của GS1 Vietnam. Tiêu chuẩn mã vạch trong chuỗi cung ứng Masan yêu cầu hỗ trợ **Application Identifiers (AI)**:
- `(01)`: Mã GTIN sản phẩm (14 số).
- `(10)`: Số Lô sản xuất (Batch / Lot Number, tối đa 20 ký tự).
- `(17)`: Ngày hết hạn (Expiration Date: `YYMMDD`).
- `(21)`: Số seri quản lý cá thể (Serial Number).
- `(00)`: Mã số công-ten-nơ vận chuyển theo xê-ri (SSCC) cho Pallet.

**Khuyến nghị**: Backend và Frontend cần tích hợp bộ thư viện phân tích cú pháp chuỗi GS1 (`gs1-barcode-parser`) để khi quét một mã GS1-128 phức hợp, hệ thống tự động bóc tách được đồng thời cả SKU, Lot, và HSD mà không yêu cầu thủ kho quét 3 lần riêng biệt.
