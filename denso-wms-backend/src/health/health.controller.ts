import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly database: DataSource) {}

  @Get()
  async check(): Promise<{ status: string; timestamp: string }> {
    const expected = process.env.DB_EXPECTED_MIGRATION?.trim();
    let compatible = true;
    try {
      if (expected) {
        const [schema] = await this.database.query(
          'SELECT name FROM migrations ORDER BY id DESC LIMIT 1',
        );
        compatible = schema?.name === expected;
      } else {
        await this.database.query('SELECT 1');
      }
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng' });
    }
    if (!compatible) {
      throw new ServiceUnavailableException({ code: 'DATABASE_SCHEMA_MISMATCH', message: 'Phiên bản schema chưa phù hợp' });
    }
    return { status: 'ok', timestamp: new Date().toISOString(), ...(process.env.WMS_DEMO_MODE === 'true' ? { mode: 'demo' } : {}) };
  }
}
