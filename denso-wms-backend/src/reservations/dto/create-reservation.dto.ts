import {
  IsString,
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @MaxLength(100)
  orderReference: string;

  @IsUUID()
  partId: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsInt()
  @Min(1)
  quantityPcs: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
