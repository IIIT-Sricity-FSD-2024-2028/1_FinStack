import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { WorkflowStatus } from '../../../data/store';

export class CreateExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  managerEmployeeId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  assignedFinanceOfficerId?: string | null;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  merchant: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';

  @ApiPropertyOptional({ enum: ['manager_review', 'finance_review', 'compliance_review', 'approved_for_payment', 'payment_processing', 'returned', 'rejected', 'paid'] })
  @IsOptional()
  @IsIn(['manager_review', 'finance_review', 'compliance_review', 'approved_for_payment', 'payment_processing', 'returned', 'rejected', 'paid'])
  workflowStatus?: WorkflowStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptFileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  extraction_confidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  risk_score?: number;
}
