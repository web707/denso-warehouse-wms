import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class GlobalJwtGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ path: string; method: string }>();
    const path = request.path;
    if (request.method === 'OPTIONS' || /^\/api\/auth\/(login|refresh|forgot-password|reset-password)$/.test(path) || path === '/api/health') {
      return true;
    }
    return super.canActivate(context);
  }
}
