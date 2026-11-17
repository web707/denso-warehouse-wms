import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ready only after PostgreSQL accepts a query', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const health = new HealthController({ query } as unknown as DataSource);

    await expect(health.check()).resolves.toMatchObject({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('blocks readiness when the configured migration differs', async () => {
    const previous = process.env.DB_EXPECTED_MIGRATION;
    process.env.DB_EXPECTED_MIGRATION = 'ReleaseMigration';
    try {
      const query = jest.fn().mockResolvedValue([{ name: 'OldMigration' }]);
      const health = new HealthController({ query } as unknown as DataSource);
      await expect(health.check()).rejects.toMatchObject({ response: { code: 'DATABASE_SCHEMA_MISMATCH' } });
      query.mockResolvedValue([{ name: 'ReleaseMigration' }]);
      await expect(health.check()).resolves.toMatchObject({ status: 'ok' });
    } finally {
      if (previous === undefined) delete process.env.DB_EXPECTED_MIGRATION;
      else process.env.DB_EXPECTED_MIGRATION = previous;
    }
  });

  it('reports unavailability without including database error details', async () => {
    const query = jest.fn().mockRejectedValue(new Error('internal connection detail'));
    const health = new HealthController({ query } as unknown as DataSource);

    await expect(health.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(health.check()).rejects.toMatchObject({ response: { code: 'DATABASE_UNAVAILABLE' } });
  });
});
