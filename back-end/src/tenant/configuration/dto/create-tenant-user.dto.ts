import {
  IsEmail,
  Matches,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TenantRole } from '@prisma/client';

export class CreateTenantUserDto {
  // Deprecated compatibility input. New clients omit it for server generation.
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/)
  employeeId?: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}\p{Cf}]+$/u)
  firstName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}\p{Cf}]+$/u)
  lastName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
  @IsString() @MinLength(8) @MaxLength(200) initialPassword!: string;
  @IsEnum(TenantRole) role!: TenantRole;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[^\p{Cc}\p{Cf}]*$/u)
  department?: string;
  @IsOptional() @IsUUID() managerId?: string;
}
