import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { RACK_PRODUCT_FAMILIES } from '../../inventory/rack-product-family.rules';

export class CreateContainerDto {
  @ApiProperty()
  @IsUUID()
  containerTypeId: string;

  @ApiProperty({
    description: 'Lô linh kiện mà kệ kho này phục vụ',
  })
  @IsUUID()
  orderId: string;

  @ApiProperty({ example: 'Rack R01' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'DENSO-WH' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: 'Chủ đề kệ. Để trống để hệ thống chọn theo nhóm hàng đầu tiên.' })
  @IsOptional()
  @IsIn([...RACK_PRODUCT_FAMILIES])
  productFamily?: string | null;

  @ApiPropertyOptional({ example: 'ZONE-A' })
  @IsOptional()
  @IsString()
  zoneCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxCbmOverride?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxPayloadKgOverride?: number;
}
