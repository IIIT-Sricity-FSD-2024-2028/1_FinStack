import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoleId } from '../../../data/store';

const tenantRoles = [
  'expense_submitter',
  'manager',
  'finance_officer',
  'compliance_officer',
  'configuration_manager',
] as const;

export class TenantRegisterOrganizationDto {
  @ApiProperty()
  @IsString()
  @Length(2, 180)
  organizationName!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  organizationEmail!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  companySize?: string;

  @ApiProperty()
  @IsString()
  @Length(2, 160)
  adminName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_]+$/)
  @MaxLength(80)
  adminEmployeeId!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  adminEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiProperty({ description: 'Selected Product Catalog plan ID' })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ isArray: true, enum: tenantRoles })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(tenantRoles, { each: true })
  enabledRoles?: RoleId[];
}
