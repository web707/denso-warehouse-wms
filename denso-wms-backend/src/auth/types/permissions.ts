export enum Permission {
  // Inventory & Warehouse Floor
  INVENTORY_READ = 'inventory.read',
  INVENTORY_RECEIVE = 'inventory.receive',
  INVENTORY_PUTAWAY = 'inventory.putaway',
  INVENTORY_TRANSFER = 'inventory.transfer',
  INVENTORY_PICK = 'inventory.pick',
  INVENTORY_DISPATCH = 'inventory.dispatch',
  INVENTORY_COUNT = 'inventory.count',
  INVENTORY_ADJUST_APPROVE = 'inventory.adjust.approve',

  // Quality Control
  QC_INSPECT = 'qc.inspect',
  QC_RELEASE = 'qc.release',
  QC_BLOCK = 'qc.block',

  // Orders
  ORDERS_READ = 'orders.read',
  ORDERS_CREATE = 'orders.create',
  ORDERS_APPROVE = 'orders.approve',

  // Documents
  DOCUMENTS_READ = 'documents.read',
  DOCUMENTS_CREATE = 'documents.create',

  // Reports
  REPORTS_READ = 'reports.read',

  // User Management
  USERS_READ = 'users.read',
  USERS_CREATE = 'users.create',
  USERS_UPDATE = 'users.update',
  USERS_DISABLE = 'users.disable',
  USERS_PASSWORD_RESET = 'users.password.reset',
  ROLES_MANAGE = 'roles.manage',

  // Audit
  AUDIT_READ = 'audit.read',
}

export const ALL_PERMISSIONS = Object.values(Permission);

export interface PermissionMeta {
  code: Permission;
  label: string;
  category: string;
  description: string;
}

export const PERMISSION_METADATA: Record<Permission, { label: string; category: string; description: string }> = {
  [Permission.INVENTORY_READ]: { label: 'Xem tồn kho & vị trí kệ', category: 'Kho hàng', description: 'Xem sơ đồ 3D, danh sách tồn kho, vị trí kệ, lô hàng và lịch sử giao dịch.' },
  [Permission.INVENTORY_RECEIVE]: { label: 'Tiếp nhận hàng (Inbound)', category: 'Kho hàng', description: 'Tạo phiếu tiếp nhận hàng tại cửa Dock theo Purchase Order (PO).' },
  [Permission.INVENTORY_PUTAWAY]: { label: 'Cất hàng vào kệ (Putaway)', category: 'Kho hàng', description: 'Chuyển hàng từ sàn đệm Dock vào vị trí ô kệ chính xác.' },
  [Permission.INVENTORY_TRANSFER]: { label: 'Điều chuyển vị trí hàng', category: 'Kho hàng', description: 'Chuyển hàng giữa các ô kệ hoặc phân khu kho.' },
  [Permission.INVENTORY_PICK]: { label: 'Nhặt hàng xuất kho (Picking)', category: 'Kho hàng', description: 'Lấy hàng từ vị trí lưu trữ theo danh sách nhặt hàng FEFO.' },
  [Permission.INVENTORY_DISPATCH]: { label: 'Xác nhận xuất kho (Shipping)', category: 'Kho hàng', description: 'Ký duyệt bàn giao hàng cho tài xế và xuất kho thành phẩm.' },
  [Permission.INVENTORY_COUNT]: { label: 'Ghi nhận kiểm kê thực tế', category: 'Kho hàng', description: 'Thực hiện đếm và nhập số lượng tồn thực tế (Vòng 1 & Vòng 2).' },
  [Permission.INVENTORY_ADJUST_APPROVE]: { label: 'Duyệt điều chỉnh tồn kho', category: 'Kho hàng', description: 'Phê duyệt sai lệch kiểm kê và cập nhật lại số lượng tồn kho sổ sách.' },

  [Permission.QC_INSPECT]: { label: 'Kiểm định chất lượng (QC)', category: 'Kiểm định QC', description: 'Tiếp nhận mẫu thử, kiểm tra thông số và ghi nhận biên bản KCS.' },
  [Permission.QC_RELEASE]: { label: 'Giải phóng hàng QC (Đạt)', category: 'Kiểm định QC', description: 'Chuyển trạng thái lô hàng từ Chờ kiểm định (HOLD) sang Đạt chuẩn (AVAILABLE).' },
  [Permission.QC_BLOCK]: { label: 'Khóa hàng / Cách ly (Không đạt)', category: 'Kiểm định QC', description: 'Chuyển trạng thái lô hàng lỗi sang Cách ly/Khóa xuất (BLOCKED).' },

  [Permission.ORDERS_READ]: { label: 'Xem danh sách đơn hàng', category: 'Đơn hàng', description: 'Tra cứu thông tin đơn bán hàng, đơn xuất và kế hoạch giao.' },
  [Permission.ORDERS_CREATE]: { label: 'Tạo đơn xuất / Đơn hàng', category: 'Đơn hàng', description: 'Lập đơn xuất kho mới và chỉ định yêu cầu khách hàng.' },
  [Permission.ORDERS_APPROVE]: { label: 'Phê duyệt phân bổ đơn', category: 'Đơn hàng', description: 'Duyệt đơn và kích hoạt thuật toán giữ tồn kho theo FEFO.' },

  [Permission.DOCUMENTS_READ]: { label: 'Xem chứng từ kho số hóa', category: 'Chứng từ', description: 'Xem biên bản giao nhận, phiếu xuất nhập, kết quả OCR.' },
  [Permission.DOCUMENTS_CREATE]: { label: 'Tải lên & Tạo chứng từ', category: 'Chứng từ', description: 'Đăng tải hóa đơn, phiếu giao hàng hoặc tạo chứng từ mới.' },

  [Permission.REPORTS_READ]: { label: 'Xem báo cáo & Xuất dữ liệu', category: 'Báo cáo', description: 'Xem dashboard tổng quan, chỉ số KPI và xuất file CSV/Excel.' },

  [Permission.USERS_READ]: { label: 'Xem danh sách nhân sự', category: 'Quản trị nhân sự', description: 'Tra cứu danh sách tài khoản, thông tin nhân sự và vai trò.' },
  [Permission.USERS_CREATE]: { label: 'Tạo tài khoản nhân sự', category: 'Quản trị nhân sự', description: 'Thêm mới tài khoản cho nhân viên kho và phân công vai trò ban đầu.' },
  [Permission.USERS_UPDATE]: { label: 'Cập nhật tài khoản & Phân quyền', category: 'Quản trị nhân sự', description: 'Sửa thông tin, thay đổi vai trò hoặc cấp thêm quyền hạn cho nhân sự.' },
  [Permission.USERS_DISABLE]: { label: 'Khóa / Mở khóa tài khoản', category: 'Quản trị nhân sự', description: 'Vô hiệu hóa quyền truy cập hoặc kích hoạt lại tài khoản nhân viên.' },
  [Permission.USERS_PASSWORD_RESET]: { label: 'Đặt lại mật khẩu nhân sự', category: 'Quản trị nhân sự', description: 'Tạo token bảo mật hoặc cấp mật khẩu tạm thời cho nhân viên.' },
  [Permission.ROLES_MANAGE]: { label: 'Quản lý ma trận vai trò', category: 'Quản trị nhân sự', description: 'Cấu hình và hiệu chỉnh danh mục quyền hạn của các vai trò hệ thống.' },

  [Permission.AUDIT_READ]: { label: 'Xem nhật ký kiểm toán (Audit)', category: 'Kiểm toán', description: 'Truy vết toàn bộ nhật ký thay đổi dữ liệu, sự kiện bảo mật và đăng nhập.' },
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,

  warehouse_manager: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_RECEIVE,
    Permission.INVENTORY_PUTAWAY,
    Permission.INVENTORY_TRANSFER,
    Permission.INVENTORY_PICK,
    Permission.INVENTORY_DISPATCH,
    Permission.INVENTORY_COUNT,
    Permission.INVENTORY_ADJUST_APPROVE,
    Permission.QC_INSPECT,
    Permission.QC_RELEASE,
    Permission.QC_BLOCK,
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_APPROVE,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_CREATE,
    Permission.REPORTS_READ,
    Permission.AUDIT_READ,
  ],

  inbound_staff: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_RECEIVE,
    Permission.INVENTORY_PUTAWAY,
    Permission.INVENTORY_TRANSFER,
    Permission.INVENTORY_COUNT,
    Permission.ORDERS_READ,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_CREATE,
  ],

  outbound_staff: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_TRANSFER,
    Permission.INVENTORY_PICK,
    Permission.INVENTORY_DISPATCH,
    Permission.INVENTORY_COUNT,
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_CREATE,
  ],

  inventory_auditor: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_COUNT,
    Permission.QC_INSPECT,
    Permission.ORDERS_READ,
    Permission.DOCUMENTS_READ,
    Permission.REPORTS_READ,
    Permission.AUDIT_READ,
  ],

  qc_inspector: [
    Permission.INVENTORY_READ,
    Permission.QC_INSPECT,
    Permission.QC_RELEASE,
    Permission.QC_BLOCK,
    Permission.DOCUMENTS_READ,
    Permission.REPORTS_READ,
  ],

  warehouse_coordinator: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_PUTAWAY,
    Permission.INVENTORY_TRANSFER,
    Permission.INVENTORY_PICK,
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_CREATE,
    Permission.REPORTS_READ,
  ],

  viewer: [
    Permission.INVENTORY_READ,
    Permission.ORDERS_READ,
    Permission.DOCUMENTS_READ,
    Permission.REPORTS_READ,
  ],

  // Legacy mappings
  director: [
    Permission.INVENTORY_READ,
    Permission.ORDERS_READ,
    Permission.DOCUMENTS_READ,
    Permission.REPORTS_READ,
    Permission.AUDIT_READ,
  ],
  warehouse_staff: [
    Permission.INVENTORY_READ,
    Permission.INVENTORY_RECEIVE,
    Permission.INVENTORY_PUTAWAY,
    Permission.INVENTORY_TRANSFER,
    Permission.INVENTORY_PICK,
    Permission.INVENTORY_DISPATCH,
    Permission.INVENTORY_COUNT,
    Permission.QC_INSPECT,
    Permission.DOCUMENTS_READ,
  ],
  user: [
    Permission.INVENTORY_READ,
    Permission.ORDERS_READ,
    Permission.DOCUMENTS_READ,
    Permission.REPORTS_READ,
  ],
};

export function getEffectivePermissions(role: string, customPermissions?: string[] | null): string[] {
  const normRole = (role || 'viewer').toLowerCase().replace('-', '_');
  const defaults = ROLE_DEFAULT_PERMISSIONS[normRole] || ROLE_DEFAULT_PERMISSIONS['viewer'];
  const baseSet = new Set<string>(defaults);

  if (Array.isArray(customPermissions)) {
    customPermissions.forEach((p) => {
      if (ALL_PERMISSIONS.includes(p as Permission)) {
        baseSet.add(p);
      }
    });
  }

  return Array.from(baseSet);
}
