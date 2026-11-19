# MA TRẬN PHÂN QUYỀN RBAC & PHÂN TÁCH TRÁCH NHIỆM SoD
**Hệ thống:** MASAN CONSUMER WMS · TRUNG TÂM ĐIỀU HÀNH KHO 3D  
**Phiên bản:** v7.0.0 Enterprise  
**Ngày kiểm toán:** 17/11/2026  

---

## 1. MA TRẬN PHÂN QUYỀN THỰC TẾ TRÊN API VÀ 3D UI

| Nghiệp vụ / Endpoint | Admin (`admin`) | Quản lý kho (`warehouse_manager`) | Nhân viên kho (`warehouse_staff`) | Kiểm soát viên (`inventory_controller`) |
| :--- | :---: | :---: | :---: | :---: |
| **Xem Sơ đồ kho 3D & Chi tiết ô** | Cho phép | Cho phép | Cho phép | Cho phép |
| **Xem Nhiệm vụ & Năng lực dãy kệ** | Cho phép | Cho phép | Cho phép | Cho phép |
| **Điều chuyển hàng (`POST /transactions`)** | Cho phép | Cho phép | Cho phép | Cho phép |
| **Tạo lệnh xuất kho (`POST /dispatches`)** | Cho phép | Cho phép | **Chặn (403)** | **Chặn (403)** |
| **Xác nhận soạn hàng (`POST /dispatches/:id/pick`)** | Cho phép | Cho phép | Cho phép | Cho phép |
| **Mở đợt kiểm kê (`POST /cycle-counts`)** | Cho phép | Cho phép | **Chặn (403)** | **Chặn (403)** |
| **Nhập số liệu đếm (`POST /cycle-counts/:id/count`)** | Cho phép | Cho phép | Cho phép (Khi được phân công) | Cho phép (Khi được phân công) |
| **Phê duyệt kiểm kê (`POST /cycle-counts/:id/approve`)** | Cho phép | Cho phép (Không tự duyệt) | **Chặn (403)** | **Chặn (403)** |
| **Quản trị người dùng & Phân vai trò** | Cho phép | **Chặn (403)** | **Chặn (403)** | **Chặn (403)** |

## 2. NGUYÊN TẮC BẢO MẬT: BACKEND IS AUTHORITATIVE
Hệ thống tuân thủ triệt để nguyên tắc:
- Không bao giờ dựa vào việc ẩn nút hay disable button trên giao diện frontend để bảo mật.
- Mọi thao tác đều được kiểm tra token JWT, giải mã quyền và xác thực qua Guard `MasanAccessGuard` và `RolesGuard` tại tầng Controller của NestJS.
