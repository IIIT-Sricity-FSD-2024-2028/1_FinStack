import { ArrayUnique, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AssignSubscriptionDto {
  @IsUUID()
  organizationId!: string;

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
}
