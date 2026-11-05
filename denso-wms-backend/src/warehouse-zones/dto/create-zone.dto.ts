import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateZoneDto {
  @ApiPropertyOptional({ description: 'Điều kiện bảo quản vùng kho' })
  @IsOptional()
  @IsIn(['ambient', 'chilled', 'produce', 'household'])
  storageMode?: string;

  @ApiProperty({ example: 'DENSO-WH' }) @IsString() warehouseCode: string;
  @ApiProperty({ example: 'ZONE-B' }) @IsString() code: string;
  @ApiProperty({ example: 'Khu linh kiện điện' }) @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
