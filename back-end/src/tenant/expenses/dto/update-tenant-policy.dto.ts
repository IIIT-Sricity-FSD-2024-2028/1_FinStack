import { PartialType } from '@nestjs/swagger';
import { CreateTenantPolicyDto } from './create-tenant-policy.dto';

export class UpdateTenantPolicyDto extends PartialType(CreateTenantPolicyDto) {}
