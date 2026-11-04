import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum UserRole {
  ADMIN = 'admin',
  WAREHOUSE_MANAGER = 'warehouse_manager',
  DIRECTOR = 'director',
  WAREHOUSE_STAFF = 'warehouse_staff',
  USER = 'user', // Legacy accounts remain read-only until assigned a role.
}

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext' })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
