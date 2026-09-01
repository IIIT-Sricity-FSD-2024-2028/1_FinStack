import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantUserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { TenantLoginDto } from './dto/tenant-login.dto';
import {
  TenantAuthContext,
  TenantAuthResponse,
  TenantUserIdentity,
} from './tenant-auth.types';
import { TenantTokenService } from './tenant-token.service';

@Injectable()
export class TenantAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TenantTokenService,
  ) {}

  async login(dto: TenantLoginDto): Promise<TenantAuthResponse> {
    if (!dto.email && !dto.employeeId) throw this.invalidCredentials();
    const user = dto.email
      ? await this.prisma.tenantUser.findUnique({
          where: {
            organizationId_email: {
              organizationId: dto.organizationId,
              email: dto.email.trim().toLowerCase(),
            },
          },
        })
      : await this.prisma.tenantUser.findUnique({
          where: {
            organizationId_employeeId: {
              organizationId: dto.organizationId,
              employeeId: dto.employeeId!.trim(),
            },
          },
        });
    let valid = false;
    if (user) {
      try {
        valid = await argon2.verify(user.passwordHash, dto.password);
      } catch {
        valid = false;
      }
    }
    if (!user || !valid || user.status !== TenantUserStatus.ACTIVE)
      throw this.invalidCredentials();
    const identity = this.identity(user);
    return {
      accessToken: await this.tokens.sign(identity),
      expiresIn: this.tokens.accessTokenTtlSeconds,
      user: identity,
      organizationId: user.organizationId,
    };
  }

  async authenticate(token: string): Promise<TenantAuthContext> {
    try {
      const claims = await this.tokens.verify(token);
      if (claims.type !== 'tenant-access' || !claims.sub || !claims.orgId) {
        throw new Error('Invalid tenant token claims.');
      }
      const user = await this.prisma.tenantUser.findUnique({
        where: { id: claims.sub },
      });
      if (
        !user ||
        user.organizationId !== claims.orgId ||
        user.status !== TenantUserStatus.ACTIVE
      )
        throw new Error('Invalid tenant identity.');
      return { user: this.identity(user), organizationId: user.organizationId };
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TENANT_ACCESS_TOKEN',
        message: 'The tenant access token is invalid or expired.',
      });
    }
  }

  private identity(user: {
    id: string;
    organizationId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: TenantUserIdentity['role'];
    status: TenantUserIdentity['status'];
  }): TenantUserIdentity {
    return {
      id: user.id,
      organizationId: user.organizationId,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_TENANT_CREDENTIALS',
      message: 'Invalid organization, email, or password.',
    });
  }
}
