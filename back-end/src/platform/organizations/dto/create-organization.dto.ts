import { OrganizationStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @Length(2, 180)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;

  @IsEmail()
  @MaxLength(320)
  primaryEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  primaryContactName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  primaryContactEmail?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  billingEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalCustomerRef?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
