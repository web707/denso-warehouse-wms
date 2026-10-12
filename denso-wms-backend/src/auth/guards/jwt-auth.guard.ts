import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { UserRole } from '../entities/user.entity';

/**
 * Hệ thống đã bỏ đăng nhập: ai truy cập cũng dùng được toàn bộ API.
 * Guard này giữ nguyên tên/chỗ gắn `@UseGuards(JwtAuthGuard)` ở các controller
 * để không phải sửa hàng loạt file, nhưng luôn cho phép đi qua và gắn
 * một người dùng mặc định vào request (để @CurrentUser() vẫn hoạt động).
 *
 * Muốn bật lại đăng nhập: khôi phục lớp này về `extends AuthGuard('jwt')`.
 */
export const PUBLIC_USER_ID = '00000000-0000-0000-0000-000000000000';

export const PUBLIC_USER: AuthenticatedUser = {
  id: PUBLIC_USER_ID,
  email: 'warehouse@denso-wms.local',
  fullName: 'Warehouse',
  role: UserRole.ADMIN,
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    request.user = PUBLIC_USER;
    return true;
  }
}
