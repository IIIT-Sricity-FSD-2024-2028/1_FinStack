import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PLATFORM_PATH,
  PLATFORM_PUBLIC_KEY,
  PLATFORM_REFRESH_AUTH_KEY,
} from '../auth.constants';
import { PlatformRequest } from '../auth.types';
import { PlatformAuthService } from '../platform-auth.service';

@Injectable()
export class PlatformAuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: PlatformAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const path = request.path.toLowerCase();
    if (path !== PLATFORM_PATH && !path.startsWith(`${PLATFORM_PATH}/`)) {
      return true;
    }
    if (
      this.reflector.getAllAndOverride<boolean>(PLATFORM_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>(PLATFORM_REFRESH_AUTH_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Platform authentication is required.',
      });
    }
    request.platformAuth =
      await this.authService.authenticateAccessToken(token);
    return true;
  }
}
