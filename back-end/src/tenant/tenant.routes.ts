import { Routes } from '@nestjs/core';
import { TenantModule } from './tenant.module';
export const tenantRoutes: Routes = [
  { path: 'api/v1/tenant', module: TenantModule },
];
