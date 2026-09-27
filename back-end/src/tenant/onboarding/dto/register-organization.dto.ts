import {
  IsEmail,
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

export class RegisterOrganizationDto {
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;
  @IsEmail() @MaxLength(320) primaryEmail!: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @IsEmail() @MaxLength(320) email!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
  @IsUUID() planId!: string;
  @IsInt() @Min(1) employeeCount!: number;
  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  featureIds?: string[];
}
