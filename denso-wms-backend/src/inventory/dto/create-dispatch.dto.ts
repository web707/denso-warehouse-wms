import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreateDispatchDto {
  @IsString() @Length(1, 100)
  reference: string;

  @IsString() @Length(1, 120)
  sku: string;

  @IsInt() @Min(1) @Max(2147483647)
  quantity: number;
}
