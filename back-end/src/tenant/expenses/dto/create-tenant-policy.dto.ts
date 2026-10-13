import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  ValidateIf,
  IsString,
  MaxLength,
  Matches,
  IsUUID,
} from 'class-validator';
import { IsPolicyAmount } from './policy-amount';

export class CreateTenantPolicyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/\S/, { message: 'Name cannot be blank.' })
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @IsPolicyAmount()
  maxAmount: string | number;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'Currency must be a three-letter code.',
  })
  currency?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  approval?: string;

  @ApiPropertyOptional({ enum: ['Active', 'Inactive'] })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  receiptRequired?: boolean;
}
