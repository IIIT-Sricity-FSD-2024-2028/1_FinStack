import { InvoiceStatus, SubscriptionPaymentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListInvoicesQueryDto {
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
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  from?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsIn(['createdAt', 'dueDate', 'totalAmount', 'status'])
  sortBy: 'createdAt' | 'dueDate' | 'totalAmount' | 'status' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class ListPaymentsQueryDto {
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
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SubscriptionPaymentStatus)
  status?: SubscriptionPaymentStatus;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  from?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsIn(['createdAt', 'paidAt', 'amount', 'status'])
  sortBy: 'createdAt' | 'paidAt' | 'amount' | 'status' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class RevenueOverviewQueryDto {
  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  from?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(String(value)))
  @IsDate()
  to?: Date;
}
