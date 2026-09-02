import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePlanFeatureDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /**
   * Optional updated value — validated against Feature.valueType in the service.
   */
  @IsOptional()
  value?: unknown;
}
