import { SetMetadata } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { TENANT_ROLES_KEY } from '../guards/tenant-role.guard';

export const TenantRoles = (...roles: TenantRole[]) =>
  SetMetadata(TENANT_ROLES_KEY, roles);
