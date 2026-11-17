import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class OpenCycleDto {
  @IsUUID()
  partId: string;

  @IsUUID()
  firstCounter: string;

  @IsOptional() @IsUUID()
  secondCounter?: string;
}

export class RecordCycleDto {
  @IsInt() @Min(0) @Max(2147483647)
  quantity: number;

  @IsInt() @Min(0) @Max(2147483647)
  cartons: number;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999)
  weight: number;
}

export class ReviewCycleDto {
  @IsString() @Length(1, 500)
  reason: string;
}
