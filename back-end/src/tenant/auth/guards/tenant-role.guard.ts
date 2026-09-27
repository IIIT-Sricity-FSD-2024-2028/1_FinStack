import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRole } from '@prisma/client';
import { TenantRequest } from '../tenant-auth.types';

export const TENANT_ROLES_KEY = 'tenant:roles';

@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantRole[]>(
      TENANT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<TenantRequest>();
    if (request.tenantAuth && required.includes(request.tenantAuth.user.role))
      return true;
    throw new ForbiddenException({
      code: 'TENANT_ROLE_REQUIRED',
      message:
        'This action is limited to the organization Configuration Manager.',
    });
  }
}
