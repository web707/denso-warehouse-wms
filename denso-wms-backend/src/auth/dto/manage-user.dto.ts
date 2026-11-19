import { IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateManagedUserDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải tối thiểu 8 ký tự' })
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  role: string;

  @IsOptional()
  @IsArray()
  customPermissions?: string[];

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class UpdateManagedUserDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsArray()
  customPermissions?: string[];

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class AdminResetPasswordDto {
  @IsOptional()
  @IsIn(['TEMP_PASSWORD', 'RESET_TOKEN'])
  mode?: 'TEMP_PASSWORD' | 'RESET_TOKEN';

  @IsOptional()
  @IsString()
  @MinLength(8)
  temporaryPassword?: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @IsBoolean()
  useToken?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' })
  newPassword: string;
}
