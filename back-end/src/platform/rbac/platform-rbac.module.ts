import { Module } from '@nestjs/common';
import { PlatformPermissionGuard } from './guards/platform-permission.guard';
import { PlatformPermissionResolverService } from './platform-permission-resolver.service';

@Module({
  providers: [PlatformPermissionResolverService, PlatformPermissionGuard],
  exports: [PlatformPermissionResolverService, PlatformPermissionGuard],
})
export class PlatformRbacModule {}
