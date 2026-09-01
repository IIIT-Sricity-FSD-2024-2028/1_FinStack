import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AssignPlanFeatureDto {
  @IsUUID()
  featureId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  /**
   * Optional value — validated against Feature.valueType in the service.
   * Accepted as any JSON-compatible value (boolean, number, string, object, array, null).
   */
  @IsOptional()
  value?: unknown;
}
