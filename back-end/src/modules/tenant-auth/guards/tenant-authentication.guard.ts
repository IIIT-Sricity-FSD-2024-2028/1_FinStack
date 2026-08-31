import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class TenantAuthenticationGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Tenant authentication token missing');
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.TENANT_JWT_SECRET || 'fallback_tenant_secret',
      });
      request['user'] = {
        id: payload.sub,
        employeeId: payload.employeeId,
        organizationId: payload.organizationId,
        roles: payload.roles,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired tenant token');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
