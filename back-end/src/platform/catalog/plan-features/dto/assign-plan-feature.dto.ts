import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class AssignPlanFeatureDto {
  @IsUUID()
  featureId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @IsOptional()
  @IsBoolean()
  isAddOn?: boolean = false;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  addOnPrice?: string;

  /**
   * Optional value — validated against Feature.valueType in the service.
   * Accepted as any JSON-compatible value (boolean, number, string, object, array, null).
   */
  @IsOptional()
  value?: unknown;
}
