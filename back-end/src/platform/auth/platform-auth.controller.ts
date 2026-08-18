import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import { DEFAULT_REFRESH_COOKIE_NAME } from './auth.constants';
import {
  PlatformAuthContext,
  PlatformAuthResponse,
  PlatformRefreshContext,
} from './auth.types';
import {
  CurrentPlatformAuth,
  CurrentPlatformRefresh,
} from './decorators/current-platform-auth.decorator';
import { Public } from './decorators/public.decorator';
import { RefreshAuthenticated } from './decorators/refresh-authenticated.decorator';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformRefreshGuard } from './guards/platform-refresh.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformSessionService } from './platform-session.service';

@ApiTags('Platform authentication')
@Controller('auth')
export class PlatformAuthController {
  private readonly cookieName: string;
  private readonly secureCookie: boolean;

  constructor(
    private readonly authService: PlatformAuthService,
    private readonly sessions: PlatformSessionService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>(
      'PLATFORM_REFRESH_COOKIE_NAME',
      DEFAULT_REFRESH_COOKIE_NAME,
    );
    this.secureCookie = config.get<string>('NODE_ENV') === 'production';
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate an active platform staff member' })
  async login(
    @Body() dto: PlatformLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlatformAuthResponse> {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @RefreshAuthenticated()
  @UseGuards(PlatformRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a platform refresh session' })
  async refresh(
    @CurrentPlatformRefresh() context: PlatformRefreshContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlatformAuthResponse> {
    const result = await this.authService.refresh(context);
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @RefreshAuthenticated()
  @UseGuards(PlatformRefreshGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current platform refresh session' })
  async logout(
    @CurrentPlatformRefresh() context: PlatformRefreshContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(context.sessionId);
    response.clearCookie(this.cookieName, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Return the current platform identity and access' })
  me(@CurrentPlatformAuth() context: PlatformAuthContext): PlatformAuthContext {
    return context;
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(this.cookieName, refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.sessions.refreshTokenTtlDays * 86_400_000,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: this.secureCookie,
      path: '/api/v1/platform/auth',
    };
  }
}
