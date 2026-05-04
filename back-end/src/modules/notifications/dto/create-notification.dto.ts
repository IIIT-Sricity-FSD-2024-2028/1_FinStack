import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RoleId } from '../../../data/store';

export class CreateNotificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  unread?: boolean;

  @ApiPropertyOptional({ enum: ['info', 'success', 'warning', 'danger'] })
  @IsOptional()
  @IsIn(['info', 'success', 'warning', 'danger'])
  type?: 'info' | 'success' | 'warning' | 'danger';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientEmployeeId?: string;

  @ApiPropertyOptional({ enum: ['expense_submitter', 'manager', 'finance_officer', 'compliance_officer', 'configuration_manager', ''] })
  @IsOptional()
  @IsIn(['expense_submitter', 'manager', 'finance_officer', 'compliance_officer', 'configuration_manager', ''])
  recipientRole?: RoleId | '';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedExpenseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dedupeKey?: string;
}
