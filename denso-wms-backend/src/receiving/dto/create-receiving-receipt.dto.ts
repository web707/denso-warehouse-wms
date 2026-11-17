import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateReceivingReceiptDto {
  @IsOptional()
  @IsUUID()
  sourceDocumentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sourceLineNumber?: number;

  @ApiProperty({ example: 'PO-MASAN-2026-001' })
  @IsString()
  @IsNotEmpty()
  poNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({ example: 'CHINSU-NAMNGU-500ML' })
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @ApiProperty({ example: 'Nước mắm Nam Ngư Đệ Nhị 500ml' })
  @IsString()
  @IsNotEmpty()
  partName: string;

  @ApiProperty({ example: 'LOT-20261113-A1' })
  @IsString()
  @IsNotEmpty()
  lotNumber: string;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(1)
  expectedQuantityPcs: number;

  @ApiProperty({ example: 980 })
  @IsInt()
  @Min(0)
  receivedQuantityPcs: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  damagedQuantityPcs?: number;

  @ApiPropertyOptional({ example: 98 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cartonCount?: number;

  @ApiPropertyOptional({ example: 490 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetRackId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  targetSlot?: number;

  @ApiPropertyOptional({ example: 'Vỡ thùng do va chạm lúc dỡ pallet' })
  @IsOptional()
  @IsString()
  discrepancyReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expirationDate?: string;

  @ApiPropertyOptional({ example: 'dry_food' })
  @IsOptional()
  @IsString()
  storageClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryReceivingReceiptsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  discrepancyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offset?: string;
}

export class ApproveDiscrepancyDto {
  @ApiPropertyOptional({ example: 'Đã lập biên bản bù trừ đợt giao tiếp theo' })
  @IsOptional()
  @IsString()
  approvalNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalNotes?: string;
}
