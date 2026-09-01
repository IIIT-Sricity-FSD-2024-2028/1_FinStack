import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantRequest } from '../tenant-auth.types';
import { TenantAuthService } from '../tenant-auth.service';

@Injectable()
export class TenantAuthenticationGuard implements CanActivate {
  constructor(private readonly auth: TenantAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const [scheme, token] = request.header('authorization')?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token)
      throw new UnauthorizedException({
        code: 'TENANT_AUTHENTICATION_REQUIRED',
        message: 'Tenant authentication is required.',
      });
    request.tenantAuth = await this.auth.authenticate(token);
    return true;
  }
}
