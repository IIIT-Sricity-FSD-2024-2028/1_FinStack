import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CONFIGURATION_CATALOG_VERSION } from '../configuration-template-catalog';
import { IsPolicyAmount } from './policy-amount';

export class ActivateCategoryTemplatesDto {
  @Equals(CONFIGURATION_CATALOG_VERSION)
  version: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsString({ each: true })
  templateKeys: string[];
}

export class PolicyTemplateSelectionDto {
  @IsString()
  templateKey: string;

  @IsUUID()
  categoryId: string;

  @IsPolicyAmount()
  maxAmount: string | number;

  @Matches(/^[A-Z]{3}$/)
  currency: string;

  @IsBoolean()
  receiptRequired: boolean;

  @IsInt()
  @IsIn([0, 1, 2])
  approvalLevels: number;
}

export class ActivatePolicyTemplatesDto {
  @Equals(CONFIGURATION_CATALOG_VERSION)
  version: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique(
    (value: PolicyTemplateSelectionDto | null | undefined) =>
      value?.templateKey,
  )
  @ValidateNested({ each: true })
  @Type(() => PolicyTemplateSelectionDto)
  policies: PolicyTemplateSelectionDto[];
}
