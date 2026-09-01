import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PlatformRbacModule } from '../rbac/platform-rbac.module';
import { PlatformAuthenticationGuard } from './guards/platform-authentication.guard';
import { PlatformRefreshGuard } from './guards/platform-refresh.guard';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformPasswordService } from './platform-password.service';
import { PlatformSessionService } from './platform-session.service';
import { PlatformTokenService } from './platform-token.service';

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PlatformRbacModule,
  ],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    PlatformPasswordService,
    PlatformSessionService,
    PlatformTokenService,
    PlatformAuthenticationGuard,
    PlatformRefreshGuard,
  ],
  exports: [
    PlatformAuthService,
    PlatformAuthenticationGuard,
    PlatformPasswordService,
    PlatformSessionService,
  ],
})
export class PlatformAuthModule {}
