import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
