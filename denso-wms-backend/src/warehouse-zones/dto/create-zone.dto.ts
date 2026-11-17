import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { RACK_PRODUCT_FAMILIES } from '../../inventory/rack-product-family.rules';

export class CreateZoneDto {
  @ApiPropertyOptional({ enum: RACK_PRODUCT_FAMILIES })
  @IsOptional() @IsIn(RACK_PRODUCT_FAMILIES) productFamily?: string | null;

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
