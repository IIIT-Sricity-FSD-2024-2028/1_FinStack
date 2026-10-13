import {
  IsEmail,
  IsEnum,
  ValidateIf,
  Matches,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TenantRole } from '@prisma/client';

export class UpdateTenantUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}\p{Cf}]+$/u)
  firstName?: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}\p{Cf}]+$/u)
  lastName?: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(320)
  email?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TenantRole)
  role?: TenantRole;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  @Matches(/^[^\p{Cc}\p{Cf}]*$/u)
  department?: string;
}
