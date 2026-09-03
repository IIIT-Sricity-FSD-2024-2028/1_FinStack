import { PartialType } from '@nestjs/swagger';
import { CreateTenantExpenseDto } from './create-tenant-expense.dto';

export class UpdateTenantExpenseDto extends PartialType(
  CreateTenantExpenseDto,
) {}
