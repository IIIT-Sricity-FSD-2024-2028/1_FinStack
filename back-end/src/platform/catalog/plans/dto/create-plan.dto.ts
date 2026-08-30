import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BillingInterval } from '@prisma/client';

export class CreatePlanDto {
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

  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'basePrice must be a positive decimal',
  })
  basePrice!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;
}
