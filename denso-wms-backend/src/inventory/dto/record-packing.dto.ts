import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class RecordPackingDto {
  @IsUUID()
  partId: string;

  @IsInt() @Min(1) @Max(2147483647)
  quantity: number;
}
