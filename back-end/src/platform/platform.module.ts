import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformAuthenticationGuard } from './auth/guards/platform-authentication.guard';
import { PlatformCatalogModule } from './catalog/platform-catalog.module';
import { PlatformHealthModule } from './health/platform-health.module';
import { PlatformOrganizationsModule } from './organizations/platform-organizations.module';
import { PlatformPermissionGuard } from './rbac/guards/platform-permission.guard';
import { PlatformRbacModule } from './rbac/platform-rbac.module';

@Module({
  imports: [
    DatabaseModule,
    PlatformRbacModule,
    PlatformAuthModule,
    PlatformHealthModule,
    PlatformOrganizationsModule,
    PlatformCatalogModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: PlatformAuthenticationGuard },
    { provide: APP_GUARD, useClass: PlatformPermissionGuard },
  ],
})
export class PlatformModule {}
