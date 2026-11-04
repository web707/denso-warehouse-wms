import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateManagedUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsEnum(UserRole) role: UserRole;
}

export class UpdateManagedUserDto {
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
}
