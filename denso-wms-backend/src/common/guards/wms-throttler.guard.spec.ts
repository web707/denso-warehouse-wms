import { WmsThrottlerGuard } from './wms-throttler.guard';

describe('WmsThrottlerGuard', () => {
  const guard = Object.create(WmsThrottlerGuard.prototype) as WmsThrottlerGuard & {
    getTracker(req: Record<string, any>): Promise<string>;
  };

  it('tracks authenticated requests by user id instead of shared NAT IP', async () => {
    const trackerA = await (guard as any).getTracker({
      ip: '203.0.113.10',
      user: { id: 'user-aaa' },
    });
    const trackerB = await (guard as any).getTracker({
      ip: '203.0.113.10',
      user: { id: 'user-bbb' },
    });

    expect(trackerA).toBe('user:user-aaa');
    expect(trackerB).toBe('user:user-bbb');
    expect(trackerA).not.toBe(trackerB);
  });

  it('tracks unauthenticated requests by client IP for brute-force protection', async () => {
    const tracker = await (guard as any).getTracker({
      ip: '198.51.100.42',
    });

    expect(tracker).toBe('ip:198.51.100.42');
  });
});
