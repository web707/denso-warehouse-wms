import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

loadEnv();

// Standalone DataSource used only by the TypeORM CLI (migration:generate/run/revert).
// The running Nest app uses buildTypeOrmOptions() in typeorm.config.ts instead.
// A single default export only — the CLI errors if it finds more than one.
const host = process.env.DB_HOST || 'localhost';
const isRemote = host && host !== 'localhost' && host !== '127.0.0.1';
const useSsl = isRemote || process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';

const AppDataSource = new DataSource({
  type: 'postgres',
  host,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'bingbing',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'logidb',
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  synchronize: false,
});

export default AppDataSource;
