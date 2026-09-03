import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ManagerExpenseActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
