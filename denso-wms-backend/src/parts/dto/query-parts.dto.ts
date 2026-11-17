import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryPartsDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() containerId?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) limit?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
