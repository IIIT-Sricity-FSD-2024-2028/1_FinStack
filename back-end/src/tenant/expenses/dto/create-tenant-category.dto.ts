import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  ValidateIf,
  IsString,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateTenantCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/\S/, { message: 'Name cannot be blank.' })
  name: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  limit?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'Currency must be a three-letter code.',
  })
  currency?: string;

  @ApiPropertyOptional({ enum: ['Active', 'Inactive'] })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  requiresReceipt?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
