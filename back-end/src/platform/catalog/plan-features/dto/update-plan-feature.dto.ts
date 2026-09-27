import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePlanFeatureDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isAddOn?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  addOnPrice?: string;

  /**
   * Optional updated value — validated against Feature.valueType in the service.
   */
  @IsOptional()
  value?: unknown;
}
