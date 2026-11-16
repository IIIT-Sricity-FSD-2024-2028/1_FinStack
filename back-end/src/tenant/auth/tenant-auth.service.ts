import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { TENANT_WORKSPACES } from './tenant-workspace';
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
  // Equalize the expensive password-verification path for unknown accounts.
  private readonly invalidPasswordHash = argon2.hash(randomBytes(32));
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TenantTokenService,
  ) {}

  async login(dto: TenantLoginDto): Promise<TenantAuthResponse> {
    const user = await this.prisma.tenantUser.findUnique({
      where: { employeeId: dto.employeeId.trim() },
      include: { organization: true },
    });

    let valid = false;

    try {
      valid = await argon2.verify(
        (user?.credentialSetupRequired ? undefined : user?.passwordHash) ||
          (await this.invalidPasswordHash),
        dto.password,
      );
    } catch {
      valid = false;
    }

    if (
      !user ||
      !valid ||
      user.status !== TenantUserStatus.ACTIVE ||
      user.credentialSetupRequired ||
      !this.organizationAllowsAccess(user.organization)
    ) {
      throw this.invalidCredentials();
    }

    const identity = this.identity(user);
    const workspaceContext = this.workspaceContext(user);

    return {
      accessToken: await this.tokens.sign({
        ...identity,
        credentialVersion: user.credentialVersion ?? 0,
      }),
      expiresIn: this.tokens.accessTokenTtlSeconds,
      user: identity,
      ...workspaceContext,
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
        include: {
          organization: true,
          manager: {
            select: {
              id: true,
              organizationId: true,
              employeeId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (
        !user ||
        user.organizationId !== claims.orgId ||
        (user.credentialVersion ?? 0) !== (claims.cv ?? 0) ||
        user.status !== TenantUserStatus.ACTIVE ||
        user.credentialSetupRequired ||
        !this.organizationAllowsAccess(user.organization)
      ) {
        throw new Error('Invalid tenant identity.');
      }

      const identity = this.identity(user);
      if (user.role === TenantRole.EXPENSE_SUBMITTER) {
        identity.department = user.department;
        identity.organizationName = user.organization.name;
        // A manager relation must never project another tenant's identity.
        identity.manager = null;
        if (user.manager?.organizationId === user.organizationId) {
          identity.manager = {
            id: user.manager.id,
            employeeId: user.manager.employeeId,
            firstName: user.manager.firstName,
            lastName: user.manager.lastName,
          };
        }
      }

      return {
        ...this.workspaceContext(user),
        user: identity,
        organizationId: user.organizationId,
      };
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TENANT_ACCESS_TOKEN',
        message: 'The tenant access token is invalid or expired.',
      });
    }
  }

  private organizationAllowsAccess(organization: {
    registrationStatus: string;
    status: string;
  }) {
    if (!organization) return false;
    // Preserve historical provisioning access; all public submissions are explicitly pending.
    if (organization.registrationStatus === 'LEGACY_APPROVED')
      return ['PROVISIONING', 'ACTIVE', 'TRIAL'].includes(organization.status);
    return (
      organization.registrationStatus === 'APPROVED' &&
      ['ACTIVE', 'TRIAL'].includes(organization.status)
    );
  }

  private workspaceContext(user: { role: TenantUserIdentity['role'] }) {
    const workspace = TENANT_WORKSPACES[user.role];
    if (!workspace) throw this.invalidCredentials();
    return { effectiveRoles: [user.role], workspace };
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
      message: 'Employee ID or password is incorrect.',
    });
  }
}
