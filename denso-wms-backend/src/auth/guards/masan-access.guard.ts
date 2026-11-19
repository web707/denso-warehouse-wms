import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UserRole } from '../entities/user.entity';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { Permission, getEffectivePermissions } from '../types/permissions';

/**
 * Enterprise Authoritative RBAC & Permissions Guard.
 * Enforces both role-based and granular permission-based access control.
 * Backend authorization is authoritative; hiding UI buttons is never security.
 */
@Injectable()
export class MasanAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      body?: Record<string, unknown>;
      user?: AuthenticatedUser & { permissions?: string[] };
    }>();

    const path = req.path.split('?')[0];

    // Public endpoints
    if (
      req.method === 'OPTIONS' ||
      path === '/api/health' ||
      /^\/api\/auth\/(login|refresh|forgot-password|reset-password|roles-metadata)$/.test(path)
    ) {
      return true;
    }

    if (!req.user || !req.user.role) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Yêu cầu đăng nhập để truy cập tài nguyên này',
      });
    }

    const normRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = normRole === 'super_admin' || normRole === 'admin';

    // 1. Explicit @RequirePermissions decorator check
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredPermissions && requiredPermissions.length > 0) {
      if (isSuperAdmin) return true;
      const effective = getEffectivePermissions(req.user.role, req.user.permissions);
      const missing = requiredPermissions.filter((p) => !effective.includes(p));
      if (missing.length > 0) {
        throw new ForbiddenException({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Tài khoản không được cấp quyền hạn thực hiện thao tác này',
          requiredPermissions,
          missingPermissions: missing,
        });
      }
      return true;
    }

    // 2. Explicit @Roles decorator check
    const explicitlyAllowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (explicitlyAllowedRoles && explicitlyAllowedRoles.length > 0) {
      if (isSuperAdmin) return true;
      const allowedStrings = explicitlyAllowedRoles.map((r) => r.toLowerCase());
      if (!allowedStrings.includes(normRole)) {
        throw new ForbiddenException({
          code: 'ROLE_FORBIDDEN',
          message: 'Vai trò hiện tại không có quyền truy cập chức năng này',
          requiredRoles: explicitlyAllowedRoles,
        });
      }
      return true;
    }

    // Super admin has full system access
    if (isSuperAdmin) return true;

    // 3. Fallback granular check based on REST path and HTTP method
    const effectivePermissions = getEffectivePermissions(req.user.role, req.user.permissions);
    return this.checkPathPermissions(path, req.method, req.body, effectivePermissions);
  }

  private checkPathPermissions(
    path: string,
    method: string,
    body: Record<string, unknown> | undefined,
    permissions: string[],
  ): boolean {
    const isGet = method === 'GET' || method === 'HEAD';

    // User & Security Management
    if (path.startsWith('/api/auth/users') || path.startsWith('/api/auth/roles')) {
      if (isGet) {
        if (!permissions.includes(Permission.USERS_READ)) {
          throw new ForbiddenException('Yêu cầu quyền xem danh sách nhân sự (users.read)');
        }
        return true;
      }
      if (method === 'POST') {
        if (path.includes('/reset-password')) {
          if (!permissions.includes(Permission.USERS_PASSWORD_RESET)) {
            throw new ForbiddenException('Yêu cầu quyền đặt lại mật khẩu nhân sự (users.password.reset)');
          }
          return true;
        }
        if (!permissions.includes(Permission.USERS_CREATE)) {
          throw new ForbiddenException('Yêu cầu quyền tạo tài khoản nhân sự (users.create)');
        }
        return true;
      }
      if (method === 'PATCH' || method === 'PUT') {
        if (!permissions.includes(Permission.USERS_UPDATE) && !permissions.includes(Permission.USERS_DISABLE)) {
          throw new ForbiddenException('Yêu cầu quyền cập nhật tài khoản (users.update)');
        }
        return true;
      }
      throw new ForbiddenException('Thao tác quản trị người dùng không được phép');
    }

    if (path.startsWith('/api/auth/audit') || path.startsWith('/api/history')) {
      if (!permissions.includes(Permission.AUDIT_READ)) {
        throw new ForbiddenException('Yêu cầu quyền xem nhật ký kiểm toán (audit.read)');
      }
      return true;
    }

    // Inventory & Warehouse operations
    if (path.startsWith('/api/inventory') || path.startsWith('/api/receiving') || path.startsWith('/api/containers')) {
      if (isGet) {
        if (!permissions.includes(Permission.INVENTORY_READ)) {
          throw new ForbiddenException('Yêu cầu quyền xem tồn kho (inventory.read)');
        }
        return true;
      }

      if (path.startsWith('/api/receiving')) {
        if (!permissions.includes(Permission.INVENTORY_RECEIVE)) {
          throw new ForbiddenException('Yêu cầu quyền tiếp nhận hàng Inbound (inventory.receive)');
        }
        return true;
      }

      // Check specific transaction type if available
      const txType = ((body?.type || body?.transactionType || '') as string).toUpperCase();
      if (txType === 'RECEIVE' || txType === 'INBOUND') {
        if (!permissions.includes(Permission.INVENTORY_RECEIVE)) {
          throw new ForbiddenException('Yêu cầu quyền tiếp nhận hàng (inventory.receive)');
        }
        return true;
      }
      if (txType === 'PUTAWAY') {
        if (!permissions.includes(Permission.INVENTORY_PUTAWAY)) {
          throw new ForbiddenException('Yêu cầu quyền cất hàng vào kệ (inventory.putaway)');
        }
        return true;
      }
      if (txType === 'TRANSFER' || txType === 'RELOCATE') {
        if (!permissions.includes(Permission.INVENTORY_TRANSFER)) {
          throw new ForbiddenException('Yêu cầu quyền điều chuyển vị trí (inventory.transfer)');
        }
        return true;
      }
      if (txType === 'PICK' || txType === 'PICKING') {
        if (!permissions.includes(Permission.INVENTORY_PICK)) {
          throw new ForbiddenException('Yêu cầu quyền nhặt hàng xuất kho (inventory.pick)');
        }
        return true;
      }
      if (txType === 'DISPATCH' || txType === 'SHIP') {
        if (!permissions.includes(Permission.INVENTORY_DISPATCH)) {
          throw new ForbiddenException('Yêu cầu quyền xác nhận xuất hàng (inventory.dispatch)');
        }
        return true;
      }
      if (txType === 'ADJUST' || txType === 'ADJUSTMENT') {
        if (!permissions.includes(Permission.INVENTORY_ADJUST_APPROVE)) {
          throw new ForbiddenException('Yêu cầu quyền duyệt điều chỉnh tồn kho (inventory.adjust.approve)');
        }
        return true;
      }

      // Default inventory write
      const canWriteInventory =
        permissions.includes(Permission.INVENTORY_RECEIVE) ||
        permissions.includes(Permission.INVENTORY_PUTAWAY) ||
        permissions.includes(Permission.INVENTORY_TRANSFER);
      if (!canWriteInventory) {
        throw new ForbiddenException('Không có quyền ghi dữ liệu kho hàng');
      }
      return true;
    }

    // Cycle Counting
    if (path.startsWith('/api/cycle-counting')) {
      if (isGet) {
        if (!permissions.includes(Permission.INVENTORY_READ)) {
          throw new ForbiddenException('Yêu cầu quyền xem dữ liệu kho (inventory.read)');
        }
        return true;
      }
      if (path.includes('/approve') || path.includes('/reconcile')) {
        if (!permissions.includes(Permission.INVENTORY_ADJUST_APPROVE)) {
          throw new ForbiddenException('Yêu cầu quyền duyệt sai lệch kiểm kê (inventory.adjust.approve)');
        }
        return true;
      }
      if (!permissions.includes(Permission.INVENTORY_COUNT)) {
        throw new ForbiddenException('Yêu cầu quyền nhập số liệu kiểm kê (inventory.count)');
      }
      return true;
    }

    // Quality Control (Inspections)
    if (path.startsWith('/api/inspections')) {
      if (isGet) {
        if (!permissions.includes(Permission.INVENTORY_READ) && !permissions.includes(Permission.QC_INSPECT)) {
          throw new ForbiddenException('Yêu cầu quyền xem kiểm định chất lượng');
        }
        return true;
      }
      if (path.includes('/release') || path.includes('/pass')) {
        if (!permissions.includes(Permission.QC_RELEASE)) {
          throw new ForbiddenException('Yêu cầu quyền giải phóng hàng QC (qc.release)');
        }
        return true;
      }
      if (path.includes('/block') || path.includes('/quarantine')) {
        if (!permissions.includes(Permission.QC_BLOCK)) {
          throw new ForbiddenException('Yêu cầu quyền khóa hàng cách ly (qc.block)');
        }
        return true;
      }
      if (!permissions.includes(Permission.QC_INSPECT)) {
        throw new ForbiddenException('Yêu cầu quyền ghi nhận kiểm định (qc.inspect)');
      }
      return true;
    }

    // Orders & Dispatch Orders
    if (path.startsWith('/api/orders') || path.startsWith('/api/dispatch-orders') || path.startsWith('/api/shipments')) {
      if (isGet) {
        if (!permissions.includes(Permission.ORDERS_READ)) {
          throw new ForbiddenException('Yêu cầu quyền xem đơn hàng (orders.read)');
        }
        return true;
      }
      if (path.includes('/approve') || path.includes('/allocate')) {
        if (!permissions.includes(Permission.ORDERS_APPROVE)) {
          throw new ForbiddenException('Yêu cầu quyền phê duyệt đơn xuất (orders.approve)');
        }
        return true;
      }
      if (path.includes('/dispatch') || path.includes('/ship')) {
        if (!permissions.includes(Permission.INVENTORY_DISPATCH)) {
          throw new ForbiddenException('Yêu cầu quyền xuất kho (inventory.dispatch)');
        }
        return true;
      }
      if (!permissions.includes(Permission.ORDERS_CREATE)) {
        throw new ForbiddenException('Yêu cầu quyền tạo đơn hàng (orders.create)');
      }
      return true;
    }

    // Documents
    if (path.startsWith('/api/documents')) {
      if (isGet) {
        if (!permissions.includes(Permission.DOCUMENTS_READ)) {
          throw new ForbiddenException('Yêu cầu quyền xem chứng từ (documents.read)');
        }
        return true;
      }
      if (!permissions.includes(Permission.DOCUMENTS_CREATE)) {
        throw new ForbiddenException('Yêu cầu quyền tải lên chứng từ (documents.create)');
      }
      return true;
    }

    // Reports & Export
    if (path.startsWith('/api/reports') || path.startsWith('/api/export')) {
      if (!permissions.includes(Permission.REPORTS_READ)) {
        throw new ForbiddenException('Yêu cầu quyền xem báo cáo (reports.read)');
      }
      return true;
    }

    // Allow read-only GET requests for standard reference data (parts, catalog, zones, divisions)
    if (isGet) return true;

    throw new ForbiddenException('Tài khoản không có quyền thực hiện thao tác này trên hệ thống');
  }
}
