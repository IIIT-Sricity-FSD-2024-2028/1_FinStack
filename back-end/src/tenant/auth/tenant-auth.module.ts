import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { TenantAuthService } from './tenant-auth.service';
import { TenantAuthenticationGuard } from './guards/tenant-authentication.guard';
import { TenantRoleGuard } from './guards/tenant-role.guard';
import { TenantTokenService } from './tenant-token.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), DatabaseModule],
  providers: [
    TenantAuthService,
    TenantTokenService,
    TenantAuthenticationGuard,
    TenantRoleGuard,
  ],
  exports: [TenantAuthService, TenantAuthenticationGuard, TenantRoleGuard],
})
export class TenantAuthModule {}
