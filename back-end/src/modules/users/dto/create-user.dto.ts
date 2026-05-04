import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RoleId } from '../../../data/store';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ isArray: true, enum: ['expense_submitter', 'manager', 'finance_officer', 'compliance_officer', 'configuration_manager'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['expense_submitter', 'manager', 'finance_officer', 'compliance_officer', 'configuration_manager'], { each: true })
  roles: RoleId[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerEmployeeId?: string;

  @ApiPropertyOptional({ enum: ['Active', 'Inactive'] })
  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

  @ApiPropertyOptional({ enum: ['approved', 'pending', 'rejected'] })
  @IsOptional()
  @IsIn(['approved', 'pending', 'rejected'])
  accountStatus?: 'approved' | 'pending' | 'rejected';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  firstLoginRequired?: boolean;
}
