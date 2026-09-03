import { PartialType } from '@nestjs/swagger';
import { CreateTenantCategoryDto } from './create-tenant-category.dto';

export class UpdateTenantCategoryDto extends PartialType(
  CreateTenantCategoryDto,
) {}
