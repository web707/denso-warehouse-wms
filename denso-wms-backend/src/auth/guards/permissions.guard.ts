import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, getEffectivePermissions } from '../types/permissions';
import { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser & { permissions?: string[] } }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Yêu cầu xác thực tài khoản');
    }

    const normRole = (user.role || '').toLowerCase();
    if (normRole === 'admin' || normRole === 'super_admin') {
      return true;
    }

    const effective = getEffectivePermissions(user.role, user.permissions);

    const hasAll = requiredPermissions.every((required) => effective.includes(required));
    if (!hasAll) {
      const missing = requiredPermissions.filter((r) => !effective.includes(r));
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Tài khoản không được cấp quyền hạn thực hiện thao tác này',
        requiredPermissions,
        missingPermissions: missing,
      });
    }

    return true;
  }
}
