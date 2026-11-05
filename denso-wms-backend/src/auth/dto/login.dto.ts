import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Tên tài khoản hoặc email', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'admin@masan.local', description: 'Email đăng nhập', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @MinLength(1)
  password: string;
}
