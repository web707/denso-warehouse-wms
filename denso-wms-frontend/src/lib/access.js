export const ROLE_LABELS = {
  super_admin: 'Quản trị viên cấp cao',
  admin: 'Quản trị viên hệ thống',
  warehouse_manager: 'Quản lý kho vận',
  inbound_staff: 'Nhân viên nhập kho',
  outbound_staff: 'Nhân viên xuất kho',
  inventory_auditor: 'Kiểm toán tồn kho',
  qc_inspector: 'Kiểm định chất lượng (QC)',
  warehouse_coordinator: 'Điều phối viên kho',
  viewer: 'Tài khoản xem dữ liệu',

  // Legacy mappings
  director: 'Ban giám đốc',
  warehouse_staff: 'Nhân viên kho',
  user: 'Người dùng',
};

export const ROLE_BADGE_STYLES = {
  super_admin: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  admin: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  warehouse_manager: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  inbound_staff: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  outbound_staff: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  inventory_auditor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  qc_inspector: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  warehouse_coordinator: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  viewer: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  director: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  warehouse_staff: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  user: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export const ENTERPRISE_ROLES = [
  'super_admin',
  'warehouse_manager',
  'inbound_staff',
  'outbound_staff',
  'inventory_auditor',
  'qc_inspector',
  'warehouse_coordinator',
  'viewer',
];

export const PERMISSIONS = {
  INVENTORY_READ: 'inventory.read',
  INVENTORY_RECEIVE: 'inventory.receive',
  INVENTORY_PUTAWAY: 'inventory.putaway',
  INVENTORY_TRANSFER: 'inventory.transfer',
  INVENTORY_PICK: 'inventory.pick',
  INVENTORY_DISPATCH: 'inventory.dispatch',
  INVENTORY_COUNT: 'inventory.count',
  INVENTORY_ADJUST_APPROVE: 'inventory.adjust.approve',
  QC_INSPECT: 'qc.inspect',
  QC_RELEASE: 'qc.release',
  QC_BLOCK: 'qc.block',
  ORDERS_READ: 'orders.read',
  ORDERS_CREATE: 'orders.create',
  ORDERS_APPROVE: 'orders.approve',
  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_CREATE: 'documents.create',
  REPORTS_READ: 'reports.read',
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DISABLE: 'users.disable',
  USERS_PASSWORD_RESET: 'users.password.reset',
  ROLES_MANAGE: 'roles.manage',
  AUDIT_READ: 'audit.read',
};

export const PERMISSION_GROUPS = [
  {
    name: 'Kho hàng & Vận hành sàn',
    description: 'Quyền kiểm tra, nhập, cất, điều chuyển, nhặt hàng và kiểm kê kho',
    permissions: [
      { code: 'inventory.read', label: 'Xem tồn kho & vị trí kệ', desc: 'Xem mô hình 3D, danh sách tồn kho, vị trí kệ, lô hàng và lịch sử giao dịch.' },
      { code: 'inventory.receive', label: 'Tiếp nhận hàng (Inbound)', desc: 'Tạo phiếu tiếp nhận hàng tại cửa Dock theo Purchase Order (PO).' },
      { code: 'inventory.putaway', label: 'Cất hàng vào kệ (Putaway)', desc: 'Chuyển hàng từ sàn đệm Dock vào vị trí ô kệ chính xác.' },
      { code: 'inventory.transfer', label: 'Điều chuyển vị trí hàng', desc: 'Chuyển hàng giữa các ô kệ hoặc phân khu kho.' },
      { code: 'inventory.pick', label: 'Nhặt hàng xuất kho (Picking)', desc: 'Lấy hàng từ vị trí lưu trữ theo danh sách nhặt hàng FEFO.' },
      { code: 'inventory.dispatch', label: 'Xác nhận xuất kho (Shipping)', desc: 'Ký duyệt bàn giao hàng cho tài xế và xuất kho thành phẩm.' },
      { code: 'inventory.count', label: 'Ghi nhận kiểm kê thực tế', desc: 'Thực hiện đếm và nhập số lượng tồn thực tế (Vòng 1 & Vòng 2).' },
      { code: 'inventory.adjust.approve', label: 'Duyệt điều chỉnh tồn kho', desc: 'Phê duyệt sai lệch kiểm kê và cập nhật lại số lượng tồn kho sổ sách.' },
    ],
  },
  {
    name: 'Kiểm định chất lượng (QC)',
    description: 'Quyền kiểm tra KCS, phán quyết đạt chuẩn và cách ly sản phẩm',
    permissions: [
      { code: 'qc.inspect', label: 'Kiểm định chất lượng (QC)', desc: 'Tiếp nhận mẫu thử, kiểm tra thông số và ghi nhận biên bản KCS.' },
      { code: 'qc.release', label: 'Giải phóng hàng QC (Đạt)', desc: 'Chuyển trạng thái lô hàng từ Chờ kiểm định (HOLD) sang Đạt chuẩn (AVAILABLE).' },
      { code: 'qc.block', label: 'Khóa hàng / Cách ly (Lỗi)', desc: 'Chuyển trạng thái lô hàng lỗi sang Cách ly/Khóa xuất (BLOCKED).' },
    ],
  },
  {
    name: 'Đơn hàng & Kế hoạch',
    description: 'Quyền tạo đơn hàng, duyệt phân bổ và quản lý xuất kho',
    permissions: [
      { code: 'orders.read', label: 'Xem danh sách đơn hàng', desc: 'Tra cứu thông tin đơn bán hàng, đơn xuất và kế hoạch giao.' },
      { code: 'orders.create', label: 'Tạo đơn xuất / Đơn hàng', desc: 'Lập đơn xuất kho mới và chỉ định yêu cầu khách hàng.' },
      { code: 'orders.approve', label: 'Phê duyệt phân bổ đơn', desc: 'Duyệt đơn và kích hoạt thuật toán giữ tồn kho theo FEFO.' },
    ],
  },
  {
    name: 'Chứng từ điện tử & Báo cáo',
    description: 'Quyền tạo, tải lên chứng từ và trích xuất báo cáo vận hành WMS',
    permissions: [
      { code: 'documents.read', label: 'Xem chứng từ kho số hóa', desc: 'Xem biên bản giao nhận, phiếu xuất nhập, kết quả OCR.' },
      { code: 'documents.create', label: 'Tải lên & Tạo chứng từ', desc: 'Đăng tải hóa đơn, phiếu giao hàng hoặc tạo chứng từ mới.' },
      { code: 'reports.read', label: 'Xem báo cáo & Xuất dữ liệu', desc: 'Xem dashboard tổng quan, chỉ số KPI và xuất file CSV/Excel.' },
    ],
  },
  {
    name: 'Quản trị nhân sự & Phân quyền',
    description: 'Quyền quản lý tài khoản, gán vai trò, cấp quyền và bảo mật',
    permissions: [
      { code: 'users.read', label: 'Xem danh sách nhân sự', desc: 'Tra cứu danh sách tài khoản, thông tin nhân sự và vai trò.' },
      { code: 'users.create', label: 'Tạo tài khoản nhân sự', desc: 'Thêm mới tài khoản cho nhân viên kho và phân công vai trò ban đầu.' },
      { code: 'users.update', label: 'Cập nhật tài khoản & Phân quyền', desc: 'Sửa thông tin, thay đổi vai trò hoặc cấp thêm quyền hạn cho nhân sự.' },
      { code: 'users.disable', label: 'Khóa / Mở khóa tài khoản', desc: 'Vô hiệu hóa quyền truy cập hoặc kích hoạt lại tài khoản nhân viên.' },
      { code: 'users.password.reset', label: 'Đặt lại mật khẩu nhân sự', desc: 'Tạo token bảo mật hoặc cấp mật khẩu tạm thời cho nhân viên.' },
      { code: 'roles.manage', label: 'Quản lý ma trận vai trò', desc: 'Cấu hình và hiệu chỉnh danh mục quyền hạn của các vai trò hệ thống.' },
    ],
  },
  {
    name: 'Kiểm toán & Truy vết (Audit)',
    description: 'Quyền tra cứu nhật ký kiểm toán hệ thống và bảo mật',
    permissions: [
      { code: 'audit.read', label: 'Xem nhật ký kiểm toán (Audit)', desc: 'Truy vết toàn bộ nhật ký thay đổi dữ liệu, sự kiện bảo mật và đăng nhập.' },
    ],
  },
];

export const ROLE_DEFAULT_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  admin: Object.values(PERMISSIONS),
  warehouse_manager: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_PUTAWAY,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_PICK,
    PERMISSIONS.INVENTORY_DISPATCH,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.INVENTORY_ADJUST_APPROVE,
    PERMISSIONS.QC_INSPECT,
    PERMISSIONS.QC_RELEASE,
    PERMISSIONS.QC_BLOCK,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_CREATE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  inbound_staff: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_PUTAWAY,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_CREATE,
  ],
  outbound_staff: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_PICK,
    PERMISSIONS.INVENTORY_DISPATCH,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_CREATE,
  ],
  inventory_auditor: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.QC_INSPECT,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  qc_inspector: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.QC_INSPECT,
    PERMISSIONS.QC_RELEASE,
    PERMISSIONS.QC_BLOCK,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.REPORTS_READ,
  ],
  warehouse_coordinator: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_PUTAWAY,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_PICK,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.DOCUMENTS_CREATE,
    PERMISSIONS.REPORTS_READ,
  ],
  viewer: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.REPORTS_READ,
  ],
  director: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  warehouse_staff: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_PUTAWAY,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_PICK,
    PERMISSIONS.INVENTORY_DISPATCH,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.QC_INSPECT,
    PERMISSIONS.DOCUMENTS_READ,
  ],
  user: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.REPORTS_READ,
  ],
};

export function hasPermission(user, permission) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'admin') return true;

  if (Array.isArray(user.permissions) && user.permissions.includes(permission)) {
    return true;
  }

  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS['viewer'] || [];
  return defaults.includes(permission);
}

export function canAccessRoute(user, route) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'admin') return true;

  switch (route) {
    case '/users':
      return hasPermission(user, PERMISSIONS.USERS_READ);
    case '/history':
      return hasPermission(user, PERMISSIONS.AUDIT_READ);
    case '/reports':
      return hasPermission(user, PERMISSIONS.REPORTS_READ);
    case '/inspections':
      return hasPermission(user, PERMISSIONS.QC_INSPECT);
    case '/cycle-counts':
      return hasPermission(user, PERMISSIONS.INVENTORY_COUNT) || hasPermission(user, PERMISSIONS.INVENTORY_ADJUST_APPROVE);
    case '/dispatch-orders':
      return hasPermission(user, PERMISSIONS.ORDERS_READ) || hasPermission(user, PERMISSIONS.INVENTORY_DISPATCH);
    case '/documents':
      return hasPermission(user, PERMISSIONS.DOCUMENTS_READ);
    case '/inventory':
      return hasPermission(user, PERMISSIONS.INVENTORY_READ);
    case '/racks':
    case '/zones':
    case '/orders':
    case '/catalog':
    case '/fefo':
    case '/qr-labels':
    case '/supply-chain-3d':
    case '/work-orders':
    case '/shipments':
    case '/trace':
    case '/packing-rules':
    case '/':
      return true;
    default:
      return true;
  }
}

export function canWrite(role, area = 'general') {
  const normRole = (role || '').toLowerCase();
  if (normRole === 'super_admin' || normRole === 'admin' || normRole === 'warehouse_manager') return true;
  if (normRole === 'inbound_staff') return area === 'inventory' || area === 'receiving';
  if (normRole === 'outbound_staff') return area === 'inventory' || area === 'dispatch';
  if (normRole === 'qc_inspector') return area === 'inspections';
  if (normRole === 'warehouse_staff') return area === 'inventory' || area === 'inspections';
  return false;
}

export function isReadOnly(role) {
  return !canWrite(role);
}
