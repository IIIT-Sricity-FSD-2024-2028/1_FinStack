import {
  IsEmail,
  IsISO31661Alpha2,
  Max,
  ArrayUnique,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterOrganizationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsISO31661Alpha2()
  registrationCountry!: string;
  @IsOptional() @IsString() @MaxLength(160) registrationIdentifier?: string;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  registrationExemptionReason?: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  authorizedContactTitle!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(320)
  primaryEmail!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
  @IsUUID() planId!: string;
  @IsInt() @Min(1) @Max(1000000) employeeCount!: number;
  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  featureIds?: string[];
}
