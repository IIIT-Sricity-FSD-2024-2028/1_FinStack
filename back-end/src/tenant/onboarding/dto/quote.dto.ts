import { ArrayUnique, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class QuoteDto {
  @IsUUID() planId!: string;
  @IsInt() @Min(1) employeeCount!: number;
  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  featureIds?: string[];
}
