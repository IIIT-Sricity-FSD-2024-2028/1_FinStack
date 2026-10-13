import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TenantRole, TenantUserStatus } from '@prisma/client';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class ListEmployeesDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/^[^\p{Cc}\p{Cf}]*$/u)
  @Matches(/^(?:\S+\s*){0,8}$/u)
  search?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/^[^\p{Cc}\p{Cf}]*$/u)
  department?: string;
  @IsOptional() @IsEnum(TenantRole) role?: TenantRole;
  @IsOptional() @IsEnum(TenantUserStatus) status?: TenantUserStatus;
}
