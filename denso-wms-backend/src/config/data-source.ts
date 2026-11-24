import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { buildPgSslConfig } from './typeorm.config';

loadEnv();

// Standalone DataSource used only by the TypeORM CLI (migration:generate/run/revert).
// The running Nest app uses buildTypeOrmOptions() in typeorm.config.ts instead.
// A single default export only — the CLI errors if it finds more than one.
const rawHost = process.env.DB_HOST || 'localhost';
const host = rawHost.includes(':') && !rawHost.startsWith('[') ? rawHost.split(':')[0] : rawHost;
const port = parseInt(
  process.env.DB_PORT || (rawHost.includes(':') && !rawHost.startsWith('[') ? rawHost.split(':')[1] : '5432'),
  10,
);

const AppDataSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username: process.env.DB_USERNAME || 'bingbing',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'logidb',
  ssl: buildPgSslConfig(host),
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  synchronize: false,
});

export default AppDataSource;
