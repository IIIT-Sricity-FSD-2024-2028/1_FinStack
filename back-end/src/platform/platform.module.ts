import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformAuthenticationGuard } from './auth/guards/platform-authentication.guard';
import { PlatformCatalogModule } from './catalog/platform-catalog.module';
import { PlatformBillingModule } from './billing/platform-billing.module';
import { PlatformHealthModule } from './health/platform-health.module';
import { PlatformOrganizationsModule } from './organizations/platform-organizations.module';
import { PlatformPermissionsModule } from './permissions/platform-permissions.module';
import { PlatformSubscriptionsModule } from './subscriptions/platform-subscriptions.module';
import { PlatformPermissionGuard } from './rbac/guards/platform-permission.guard';
import { PlatformRbacModule } from './rbac/platform-rbac.module';
import { PlatformRolesModule } from './roles/platform-roles.module';
import { PlatformStaffModule } from './staff/platform-staff.module';

@Module({
  imports: [
    DatabaseModule,
    PlatformAuthModule,
    PlatformHealthModule,
    PlatformOrganizationsModule,
    PlatformStaffModule,
    PlatformRolesModule,
    PlatformPermissionsModule,
    PlatformCatalogModule,
    PlatformBillingModule,
    PlatformSubscriptionsModule,
    PlatformRbacModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: PlatformAuthenticationGuard },
    { provide: APP_GUARD, useClass: PlatformPermissionGuard },
  ],
})
export class PlatformModule {}