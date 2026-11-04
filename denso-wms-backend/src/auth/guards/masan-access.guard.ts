import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/** Backend authorization is authoritative; hiding buttons is not security. */
@Injectable()
export class MasanAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ method: string; path: string; user?: AuthenticatedUser }>();
    const path = req.path.split('?')[0];
    if (req.method === 'OPTIONS' || path === '/api/health' || /^\/api\/auth\/(login|refresh|forgot-password|reset-password)$/.test(path)) return true;
    if (!req.user?.role) throw new ForbiddenException('Không có quyền truy cập');

    const explicitlyAllowed = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (explicitlyAllowed?.length) {
      if (!explicitlyAllowed.includes(req.user.role)) throw new ForbiddenException('Vai trò không có quyền thực hiện tác vụ này');
      return true;
    }

    if (req.user.role === UserRole.ADMIN) return true;
    if (req.method === 'GET' || req.method === 'HEAD') return true;
    if (path.startsWith('/api/auth/')) throw new ForbiddenException('Chỉ quản trị viên được quản lý tài khoản');
    if (req.user.role === UserRole.WAREHOUSE_MANAGER) return true;
    if (req.user.role === UserRole.WAREHOUSE_STAFF) {
      // Staff: receive, issue, relocate, create QC observations only.
      return this.allowStaff(path, req.method);
    }
    throw new ForbiddenException('Tài khoản chỉ có quyền xem dữ liệu');
  }

  private allowStaff(path: string, method: string): boolean {
    const allowed = method === 'POST' && (
      path === '/api/inventory/transactions' || path === '/api/inspections'
    );
    if (!allowed) throw new ForbiddenException('Nhân viên chỉ được ghi nghiệp vụ nhập/xuất/điều chuyển và kiểm định');
    return true;
  }
}
