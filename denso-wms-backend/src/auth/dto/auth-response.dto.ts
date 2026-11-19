import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true }) fullName: string | null;
  @ApiProperty({ nullable: true }) department?: string | null;
  @ApiProperty({ nullable: true }) phone?: string | null;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ isArray: true, type: String }) permissions?: string[];
  @ApiProperty() mustChangePassword?: boolean;
  @ApiProperty({ nullable: true }) lastLoginAt?: Date | null;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}
