import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_REFRESH_COOKIE_NAME } from '../auth.constants';
import { PlatformRequest } from '../auth.types';
import { PlatformSessionService } from '../platform-session.service';

@Injectable()
export class PlatformRefreshGuard implements CanActivate {
  private readonly cookieName: string;

  constructor(
    config: ConfigService,
    private readonly sessions: PlatformSessionService,
  ) {
    this.cookieName = config.get<string>(
      'PLATFORM_REFRESH_COOKIE_NAME',
      DEFAULT_REFRESH_COOKIE_NAME,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const cookies: unknown = request.cookies;
    const token =
      typeof cookies === 'object' && cookies !== null
        ? (cookies as Record<string, unknown>)[this.cookieName]
        : undefined;
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException({
        code: 'REFRESH_SESSION_REQUIRED',
        message: 'A platform refresh session is required.',
      });
    }
    request.platformRefreshAuth = await this.sessions.authenticate(token);
    return true;
  }
}
