import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class LegacyThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path.toLowerCase();
    if (
      path === '/api/v1/platform' ||
      path.startsWith('/api/v1/platform/') ||
      path === '/api/v1/tenant' ||
      path.startsWith('/api/v1/tenant/')
    ) {
      return true;
    }
    return super.canActivate(context);
  }
}
