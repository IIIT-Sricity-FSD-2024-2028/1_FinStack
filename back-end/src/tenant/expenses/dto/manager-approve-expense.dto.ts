import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ManagerApproveExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  financeOfficerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
