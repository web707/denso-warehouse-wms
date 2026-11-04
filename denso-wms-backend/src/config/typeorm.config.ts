import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const host = config.get<string>('database.host') || '';
  const isRemote = host && host !== 'localhost' && host !== '127.0.0.1';
  const useSsl = isRemote || process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';

  return {
    type: 'postgres',
    host: config.get<string>('database.host'),
    port: config.get<number>('database.port'),
    username: config.get<string>('database.username'),
    password: config.get<string>('database.password'),
    database: config.get<string>('database.name'),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
    logging: config.get<string>('nodeEnv') === 'development' ? ['error', 'warn'] : ['error'],
  };
}
