import { PlatformStaffStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListPlatformStaffQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PlatformStaffStatus)
  status?: PlatformStaffStatus;

  @IsOptional()
  @IsIn(['firstName', 'lastName', 'email', 'status', 'createdAt', 'updatedAt'])
  sortBy:
    'firstName' | 'lastName' | 'email' | 'status' | 'createdAt' | 'updatedAt' =
    'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
