import { IsOptional, IsString, Length } from 'class-validator';

/**
 * key and valueType are intentionally excluded — they are immutable after creation.
 * Changing valueType would invalidate existing PlanFeature values.
 */
export class UpdateFeatureDto {
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
