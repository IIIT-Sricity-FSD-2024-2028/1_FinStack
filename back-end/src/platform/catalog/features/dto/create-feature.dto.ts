import { FeatureValueType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'key must be uppercase letters, digits, or underscores',
  })
  key!: string;

  @IsString()
  @Length(2, 150)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FeatureValueType)
  valueType!: FeatureValueType;
}
