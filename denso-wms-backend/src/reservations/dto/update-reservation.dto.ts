import { IsString, IsOptional } from 'class-validator';

export class UpdateReservationDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
