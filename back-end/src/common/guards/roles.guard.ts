import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Platform endpoints will receive their own authentication and permission
    // guard in the next vertical slice. The legacy role-header contract must
    // never become the platform security boundary.
    const requestPath = request.path.toLowerCase();
    if (
      requestPath === '/api/v1/platform' ||
      requestPath.startsWith('/api/v1/platform/')
    ) {
      return true;
    }

    const roleHeader = request.header('role');
    const role = this.normalizeRole(roleHeader);

    if (!role) {
      throw new ForbiddenException('A valid role header is required.');
    }

    if (role === Role.SUPERUSER) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length) {
      if (requiredRoles.includes(role)) {
        return true;
      }
      throw new ForbiddenException(
        'You are not authorized to access this resource.',
      );
    }

    if (role === Role.ADMIN) {
      return true;
    }

    if (role === Role.USER && request.method === 'GET') {
      return true;
    }

    if (role === Role.USER && this.isAllowedUserWrite(request)) {
      return true;
    }

    throw new ForbiddenException('Users can only access GET endpoints.');
  }

  private isAllowedUserWrite(request: Request): boolean {
    const path = request.path.toLowerCase();
    const method = request.method.toUpperCase();

    if (path.startsWith('/expenses')) {
      return ['POST', 'PATCH', 'DELETE'].includes(method);
    }

    if (path.startsWith('/notifications')) {
      return ['PATCH', 'DELETE'].includes(method);
    }

    if (path.startsWith('/users')) {
      return method === 'PATCH';
    }

    return false;
  }

  private normalizeRole(value: string | undefined): Role | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (Object.values(Role).includes(normalized as Role)) {
      return normalized as Role;
    }

    return null;
  }
}
