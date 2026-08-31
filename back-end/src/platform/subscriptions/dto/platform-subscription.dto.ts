import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
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
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Cancel immediately instead of at period end',
  })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}

export class ListSubscriptionsDto {
  @ApiPropertyOptional({
    description: 'Status filter',
    enum: SubscriptionStatus,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

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
