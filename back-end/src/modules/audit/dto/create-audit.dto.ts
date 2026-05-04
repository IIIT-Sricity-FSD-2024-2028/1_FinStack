import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAuditDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userEmployeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userRoleId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userRole: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  entityName: string;

  @ApiProperty({ enum: ['Success', 'Failure'] })
  @IsIn(['Success', 'Failure'])
  status: 'Success' | 'Failure';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
