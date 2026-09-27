import {
  ArrayUnique,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  employeeCount?: number;

  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  featureIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
