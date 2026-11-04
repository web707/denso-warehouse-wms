import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import AppDataSource from '../../config/data-source';
import { User, UserRole } from '../../auth/entities/user.entity';
config();

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in the backend environment.');
  await AppDataSource.initialize();
  try {
    const repository = AppDataSource.getRepository(User);
    const user = await repository.findOne({ where: { email } });
    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
    if (user) {
      await repository.update(user.id, { passwordHash, role: UserRole.ADMIN, isActive: true });
      console.log('Admin account configured. Existing warehouse data remains unchanged.');
    } else {
      await repository.save(repository.create({ email, passwordHash, role: UserRole.ADMIN, fullName: 'Quản trị kho Masan', isActive: true }));
      console.log('Admin account created. Existing warehouse data remains unchanged.');
    }
  } finally { await AppDataSource.destroy(); }
}
main().catch((error) => { console.error(error.message); process.exit(1); });
