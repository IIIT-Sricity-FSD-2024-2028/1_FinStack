import { Routes } from '@nestjs/core';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformBillingModule } from './billing/platform-billing.module';
import { PlatformCatalogModule } from './catalog/platform-catalog.module';
import { PlatformHealthModule } from './health/platform-health.module';
import { PlatformOrganizationsModule } from './organizations/platform-organizations.module';
import { PlatformPermissionsModule } from './permissions/platform-permissions.module';
import { PlatformRolesModule } from './roles/platform-roles.module';
import { PlatformStaffModule } from './staff/platform-staff.module';
import { PlatformSubscriptionsModule } from './subscriptions/platform-subscriptions.module';

export const platformRoutes: Routes = [
  { path: 'api/v1/platform', module: PlatformHealthModule },
  { path: 'api/v1/platform', module: PlatformAuthModule },
  { path: 'api/v1/platform', module: PlatformOrganizationsModule },
  { path: 'api/v1/platform', module: PlatformStaffModule },
  { path: 'api/v1/platform', module: PlatformRolesModule },
  { path: 'api/v1/platform', module: PlatformPermissionsModule },
  { path: 'api/v1/platform', module: PlatformCatalogModule },
  { path: 'api/v1/platform', module: PlatformSubscriptionsModule },
  { path: 'api/v1/platform', module: PlatformBillingModule },
];
