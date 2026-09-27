import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TenantRole } from '@prisma/client';

export class CreateTenantUserDto {
  @IsString() @MinLength(1) @MaxLength(80) employeeId!: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @IsEmail() @MaxLength(320) email!: string;
  @IsString() @MinLength(8) @MaxLength(200) initialPassword!: string;
  @IsEnum(TenantRole) role!: TenantRole;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
  @IsOptional() @IsUUID() managerId?: string;
}
