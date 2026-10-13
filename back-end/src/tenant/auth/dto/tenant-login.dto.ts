import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class TenantLoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Employee ID is required.' })
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/, {
    message: 'Employee ID format is invalid.',
  })
  employeeId!: string;

  // Login accepts existing passwords; strength rules belong to provisioning/reset.
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  @MaxLength(200)
  password!: string;
}
