import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  WAREHOUSE_MANAGER = 'warehouse_manager',
  INBOUND_STAFF = 'inbound_staff',
  OUTBOUND_STAFF = 'outbound_staff',
  INVENTORY_AUDITOR = 'inventory_auditor',
  QC_INSPECTOR = 'qc_inspector',
  WAREHOUSE_COORDINATOR = 'warehouse_coordinator',
  VIEWER = 'viewer',

  // Legacy mappings
  ADMIN = 'admin',
  WAREHOUSE_STAFF = 'warehouse_staff',
  DIRECTOR = 'director',
  USER = 'user',
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

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  @Column({ type: 'text', array: true, nullable: true })
  permissions: string[] | null;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'login_attempts', type: 'int', default: 0 })
  loginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;
}
