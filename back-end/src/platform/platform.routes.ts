import { Routes } from '@nestjs/core';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformCatalogModule } from './catalog/platform-catalog.module';
import { PlatformBillingModule } from './billing/platform-billing.module';
import { PlatformHealthModule } from './health/platform-health.module';
import { PlatformOrganizationsModule } from './organizations/platform-organizations.module';
import { PlatformSubscriptionsModule } from './subscriptions/platform-subscriptions.module';

export const platformRoutes: Routes = [
  { path: 'api/v1/platform', module: PlatformHealthModule },
  { path: 'api/v1/platform', module: PlatformAuthModule },
  { path: 'api/v1/platform', module: PlatformOrganizationsModule },
  { path: 'api/v1/platform', module: PlatformCatalogModule },
  { path: 'api/v1/platform', module: PlatformBillingModule },
  { path: 'api/v1/platform', module: PlatformSubscriptionsModule },
];
