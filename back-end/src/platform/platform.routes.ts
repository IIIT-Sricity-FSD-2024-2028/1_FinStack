import { Routes } from '@nestjs/core';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformAuditModule } from './audit/platform-audit.module';
import { PlatformHealthModule } from './health/platform-health.module';
import { PlatformNotificationsModule } from './notifications/platform-notifications.module';
import { PlatformOrganizationsModule } from './organizations/platform-organizations.module';

export const platformRoutes: Routes = [
  { path: 'api/v1/platform', module: PlatformHealthModule },
  { path: 'api/v1/platform', module: PlatformAuthModule },
  { path: 'api/v1/platform', module: PlatformOrganizationsModule },
  { path: 'api/v1/platform', module: PlatformAuditModule },
  { path: 'api/v1/platform', module: PlatformNotificationsModule },
];
