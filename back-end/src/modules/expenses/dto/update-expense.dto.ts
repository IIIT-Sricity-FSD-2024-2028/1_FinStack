import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';
import { CreateExpenseDto } from './create-expense.dto';
import { ExpenseHistoryRecord } from '../../../data/store';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerDecision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  managerDecisionAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerDecisionNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  financeDecision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  financeDecisionAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  financeDecisionNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complianceDecision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  complianceDecisionAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complianceDecisionNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  escalatedByManager?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  history?: ExpenseHistoryRecord[];
}
