import { IsNotEmpty, IsString } from 'class-validator';

export class TenantLoginDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
