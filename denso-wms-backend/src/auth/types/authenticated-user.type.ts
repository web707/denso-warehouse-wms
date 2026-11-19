import { UserRole } from '../entities/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string | null;
  department?: string | null;
  role: UserRole;
  permissions?: string[];
  mustChangePassword?: boolean;
}
