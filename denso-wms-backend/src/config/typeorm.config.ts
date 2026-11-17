import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as fs from 'fs';
import { join } from 'path';
import { checkServerIdentity, type PeerCertificate } from 'node:tls';

export function buildPgSslConfig(host?: string) {
  const isRemote = !!host && host !== 'localhost' && host !== '127.0.0.1';
  const sslMode = process.env.DB_SSL_MODE || (process.env.DB_SSL === 'true' ? 'require' : 'disable');
  const caCertPath = process.env.DB_SSL_CA_PATH;
  const isProd = process.env.NODE_ENV === 'production';

  if (sslMode === 'disable' && !isRemote && !isProd) {
    return false;
  }
  if (!(sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' || isRemote || isProd)) {
    return false;
  }

  const strict = isProd || sslMode === 'verify-full' || sslMode === 'verify-ca';
  const verifyHostname = isProd || sslMode === 'verify-full';
  if (verifyHostname && !host) {
    throw new Error('DB_HOST is required for PostgreSQL hostname verification');
  }
  const ca = caCertPath ? fs.readFileSync(caCertPath, 'utf8') : undefined;
  return {
    ...(ca ? { ca } : {}),
    rejectUnauthorized: strict || !!ca || process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    ...(verifyHostname ? { checkServerIdentity: (_name: string, certificate: PeerCertificate) => checkServerIdentity(host!, certificate) }
      : sslMode === 'verify-ca' ? { checkServerIdentity: () => undefined } : {}),
  };
}

export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const host = config.get<string>('database.host') || '';
  const sslConfig = buildPgSslConfig(host);

  return {
    type: 'postgres',
    host: config.get<string>('database.host'),
    port: config.get<number>('database.port'),
    username: config.get<string>('database.username'),
    password: config.get<string>('database.password') || undefined,
    database: config.get<string>('database.name'),
    ssl: sslConfig,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
    extra: {
      max: config.get<number>('database.poolMax') ?? 25,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    },
    logging: config.get<string>('nodeEnv') === 'development' ? ['error', 'warn'] : ['error'],
  };
}
