const bcrypt = require('./denso-wms-backend/node_modules/bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('./denso-wms-backend/node_modules/pg');

async function setupStaging() {
  const db = new Client({
    host: '127.0.0.1',
    port: 55433,
    user: 'wms_local',
    database: 'wms_staging_test'
  });
  await db.connect();

  // Generate strong random passwords
  const passwords = {
    admin: 'StgAdmin#' + crypto.randomBytes(6).toString('hex') + '!',
    manager: 'StgMgr#' + crypto.randomBytes(6).toString('hex') + '!',
    staff: 'StgStf#' + crypto.randomBytes(6).toString('hex') + '!',
    qc: 'StgQC#' + crypto.randomBytes(6).toString('hex') + '!',
    inventory: 'StgInv#' + crypto.randomBytes(6).toString('hex') + '!'
  };

  const users = [
    { email: 'staging.admin@masan.local', pass: passwords.admin, role: 'admin', name: 'Staging UAT Admin' },
    { email: 'staging.manager@masan.local', pass: passwords.manager, role: 'warehouse_manager', name: 'Staging Warehouse Manager' },
    { email: 'staging.staff@masan.local', pass: passwords.staff, role: 'warehouse_staff', name: 'Staging Warehouse Staff' },
    { email: 'staging.qc@masan.local', pass: passwords.qc, role: 'warehouse_manager', name: 'Staging Quality Inspector' },
    { email: 'staging.inventory@masan.local', pass: passwords.inventory, role: 'warehouse_staff', name: 'Staging Inventory Controller' },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.pass, 10);
    await db.query(`
      INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
      VALUES (uuid_generate_v4(), $1, $2, $3, $4, true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $4, is_active = true, updated_at = NOW()
    `, [u.email, hash, u.name, u.role]);
    console.log('Seeded UAT user:', u.email, 'Role:', u.role);
  }

  // Save staging env file locally
  const envContent = [
    'NODE_ENV=staging',
    'PORT=5050',
    'CORS_ORIGIN=http://localhost:4350',
    'APP_PUBLIC_URL=http://localhost:4350',
    'DB_HOST=127.0.0.1',
    'DB_PORT=55433',
    'DB_USERNAME=wms_local',
    'DB_PASSWORD=',
    'DB_NAME=wms_staging_test',
    'JWT_ACCESS_SECRET=stg_access_secret_' + crypto.randomBytes(16).toString('hex'),
    'JWT_REFRESH_SECRET=stg_refresh_secret_' + crypto.randomBytes(16).toString('hex'),
    'JWT_ACCESS_EXPIRATION=3600s',
    'JWT_REFRESH_EXPIRATION=7d',
    'BCRYPT_ROUNDS=10',
    'WMS_ONE_SKU_PER_RACK=true',
    'THROTTLE_TTL=60',
    'THROTTLE_LIMIT_IP=100',
    'THROTTLE_LIMIT_USER=600'
  ].join('\n');

  fs.writeFileSync('denso-wms-backend/.env.staging', envContent);

  // Store credentials securely in a private json for the test harness
  fs.writeFileSync('.staging-creds.json', JSON.stringify({
    users: users.map(u => ({ email: u.email, role: u.role, name: u.name })),
    passwords
  }, null, 2));

  console.log('Staging accounts created and .env.staging configured successfully.');
  await db.end();
}

setupStaging().catch(e => { console.error(e); process.exit(1); });
