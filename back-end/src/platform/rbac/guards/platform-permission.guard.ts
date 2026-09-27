import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PLATFORM_PATH,
  PLATFORM_PUBLIC_KEY,
  PLATFORM_REFRESH_AUTH_KEY,
} from '../../auth/auth.constants';
import { PlatformRequest } from '../../auth/auth.types';
import { PERMISSIONS_KEY } from '../platform-permissions.constants';

@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (!request.platformAuth) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Platform authentication is required.',
      });
    }
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }
    if (
      required.every((key) => request.platformAuth?.permissions.includes(key))
    ) {
      return true;
    }
    throw new ForbiddenException({
      code: 'PLATFORM_PERMISSION_DENIED',
      message: 'You do not have permission to perform this action.',
    });
  }
}
