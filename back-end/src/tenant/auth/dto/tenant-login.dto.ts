import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TenantLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  organizationId!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  employeeId?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}