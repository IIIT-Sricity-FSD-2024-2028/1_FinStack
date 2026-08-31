import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '@prisma/client';

export class AssignSubscriptionDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Plan ID' })
  @IsUUID()
  @IsNotEmpty()
  planId!: string;

  @ApiPropertyOptional({ description: 'Trial days', default: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;
}

export class UpdateSubscriptionPlanDto {
  @ApiProperty({ description: 'New Plan ID' })
  @IsUUID()
  @IsNotEmpty()
  planId!: string;

  @ApiPropertyOptional({ description: 'Reason for the plan change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Cancel immediately instead of at period end',
  })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;

  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SuspendSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for suspension' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListSubscriptionsDto {
  @ApiPropertyOptional({
    description: 'Status filter',
    enum: SubscriptionStatus,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Search by organization, plan, or subscription ID',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: [
      'createdAt',
      'updatedAt',
      'currentPeriodEnd',
      'status',
      'organizationName',
      'planName',
    ],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn([
    'createdAt',
    'updatedAt',
    'currentPeriodEnd',
    'status',
    'organizationName',
    'planName',
  ])
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'currentPeriodEnd'
    | 'status'
    | 'organizationName'
    | 'planName';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
