import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'admin', description: 'Tên tài khoản hoặc email' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'admin@masan.local' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @MinLength(1)
  password: string;
}
