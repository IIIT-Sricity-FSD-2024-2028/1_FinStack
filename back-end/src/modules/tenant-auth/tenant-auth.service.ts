import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { TenantLoginDto } from './dto/tenant-login.dto';

@Injectable()
export class TenantAuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: TenantLoginDto) {
    const organization = await this.resolveCanonicalOrganization(
      dto.organizationId,
    );

    const users = this.usersRepo.findAll();
    const acceptedOrganizationIds = this.getAcceptedOrganizationIds(
      organization,
      dto.organizationId,
    );
    const user = users.find(
      (u) =>
        acceptedOrganizationIds.includes(u.organizationId) &&
        u.employeeId === dto.employeeId &&
        u.password === dto.password &&
        u.status !== 'Inactive' &&
        u.accountStatus === 'approved',
    );
    if (!user) {
      throw new UnauthorizedException(
        'Invalid organization ID, employee ID, or password',
      );
    }
    const roles = Array.isArray(user.roles)
      ? user.roles
      : user.roles
        ? [user.roles]
        : [];
    const payload = {
      sub: user.id,
      employeeId: user.employeeId,
      organizationId: organization.id,
      roles: roles,
    };
    const responseUser = {
      ...user,
      organizationId: organization.id,
      organizationDisplayId: user.organizationId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: process.env.TENANT_JWT_SECRET || 'fallback_tenant_secret',
        expiresIn: '8h',
      }),
      user: responseUser,
    };
  }

  private async resolveCanonicalOrganization(
    organizationIdentifier: string,
  ): Promise<Organization> {
    const identifier = organizationIdentifier.trim();
    const normalized = identifier.toLowerCase();
    const predicates: Prisma.OrganizationWhereInput[] = [
      { slug: normalized },
      { externalCustomerRef: identifier },
    ];

    if (this.isUuid(identifier)) {
      predicates.unshift({ id: identifier });
    }

    const organization = await this.prisma.organization.findFirst({
      where: { OR: predicates },
    });

    if (!organization) {
      throw new UnauthorizedException(
        'Organization is not provisioned in the canonical platform data',
      );
    }

    return organization;
  }

  private getAcceptedOrganizationIds(
    organization: Organization,
    submittedIdentifier: string,
  ): string[] {
    return [
      organization.id,
      organization.slug,
      organization.externalCustomerRef,
      submittedIdentifier.trim(),
      submittedIdentifier.trim().toLowerCase(),
    ].filter((value): value is string => Boolean(value));
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
