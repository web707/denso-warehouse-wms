export const ROLE_LABELS = {
  admin: 'Quản trị hệ thống',
  warehouse_manager: 'Quản lý kho',
  director: 'Ban giám đốc',
  warehouse_staff: 'Nhân viên kho',
  user: 'Tài khoản xem dữ liệu',
};

export function canWrite(role, area = 'general') {
  if (role === 'admin' || role === 'warehouse_manager') return true;
  if (role === 'warehouse_staff') return area === 'inventory' || area === 'inspections';
  return false;
}
export function isReadOnly(role) { return !canWrite(role); }
