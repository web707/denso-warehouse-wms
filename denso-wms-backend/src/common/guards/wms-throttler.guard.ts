import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Tracks rate limits per authenticated user (`user:<id>`) so multiple
 * warehouse operators sharing a corporate NAT/proxy IP do not exhaust each
 * other's quota. Unauthenticated routes (login, forgot-password, reset-password,
 * refresh) fall back to the client IP (honouring Express `trust proxy` when
 * configured) so brute-force protection remains intact.
 */
@Injectable()
export class WmsThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req?.user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    const ip = req?.ip || req?.socket?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}
