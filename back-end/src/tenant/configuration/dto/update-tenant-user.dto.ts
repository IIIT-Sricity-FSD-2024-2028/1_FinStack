import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class UpdateTenantUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) lastName?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsEnum(TenantRole) role?: TenantRole;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
}
