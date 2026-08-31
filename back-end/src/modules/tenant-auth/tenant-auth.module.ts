import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantAuthService } from './tenant-auth.service';
import { TenantAuthenticationGuard } from './guards/tenant-authentication.guard';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [TenantAuthController],
  providers: [TenantAuthService, TenantAuthenticationGuard],
  exports: [TenantAuthenticationGuard, JwtModule],
})
export class TenantAuthModule {}
