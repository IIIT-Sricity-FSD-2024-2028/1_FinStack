import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Organization, OrganizationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ReviewOrganizationDto } from './dto/review-organization.dto';
import {
  organizationDomain,
  organizationDomainAliases,
} from './organization-domain';

export interface PaginatedOrganizations {
  items: Organization[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class PlatformOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListOrganizationsQueryDto,
  ): Promise<PaginatedOrganizations> {
    const page = query.page;
    const limit = query.limit;
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        orderBy: { [query.sortBy]: query.order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!organization) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found.',
      });
    }
    return organization;
  }

  async create(
    dto: CreateOrganizationDto,
    actorStaffId: string,
  ): Promise<Organization> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const email = dto.primaryEmail.trim().toLowerCase();
        const domain = organizationDomain(email);
        if (domain)
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${domain}))`;
        const existing = await tx.organization.findFirst({
          where: {
            OR: [
              { primaryEmail: { equals: email, mode: 'insensitive' } },
              ...(domain
                ? [
                    { normalizedDomain: domain },
                    ...organizationDomainAliases(domain).map((alias) => ({
                      primaryEmail: {
                        endsWith: '@' + alias,
                        mode: 'insensitive' as const,
                      },
                    })),
                  ]
                : []),
            ],
          },
          select: { id: true },
        });
        if (existing)
          throw new ConflictException({
            code: 'ORGANIZATION_UNIQUE_CONSTRAINT',
            message:
              'An organization with these identity details already exists. Shared domains require a reviewed identity arrangement.',
          });
        const organization = await tx.organization.create({
          data: {
            name: dto.name.trim(),
            slug: this.optionalLower(dto.slug),
            primaryEmail: email,
            normalizedDomain: domain,
            primaryContactName: this.optionalTrim(dto.primaryContactName),
            primaryContactEmail: this.optionalLower(dto.primaryContactEmail),
            billingEmail: this.optionalLower(dto.billingEmail),
            country: this.optionalTrim(dto.country),
            defaultCurrency: dto.defaultCurrency?.toUpperCase() ?? 'INR',
            timezone: this.optionalTrim(dto.timezone),
            status: OrganizationStatus.PROVISIONING,
            statusChangedAt: new Date(),
            externalCustomerRef: this.optionalTrim(dto.externalCustomerRef),
            metadata: this.toPrismaJson(dto.metadata),
          },
        });
        await tx.platformAuditLog.create({
          data: {
            actorStaffId,
            action: 'organization.provisioned',
            resourceType: 'Organization',
            resourceId: organization.id,
            newValue: {
              name: organization.name,
              status: organization.status,
              registrationStatus: organization.registrationStatus,
            },
            metadata: { source: 'AUTHORIZED_ADMIN', domainVerified: false },
          },
        });
        return organization;
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    actorStaffId?: string,
  ): Promise<Organization> {
    const current = await this.findOne(id);
    if (current.registrationSubmittedAt) {
      const fields = [
        'name',
        'country',
        'primaryEmail',
        'primaryContactName',
        'primaryContactEmail',
      ] as const;
      if (
        fields.some(
          (field) =>
            dto[field] !== undefined && dto[field]?.trim() !== current[field],
        )
      ) {
        throw new ConflictException({
          code: 'REGISTRATION_IDENTITY_LOCKED',
          message:
            'Submitted registration identity cannot be changed through metadata editing. Contact platform operations for a reviewed correction.',
        });
      }
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const domain =
          dto.primaryEmail === undefined
            ? null
            : organizationDomain(dto.primaryEmail);
        if (dto.primaryEmail !== undefined) {
          if (domain)
            await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${domain}))`;
          const duplicate = await tx.organization.findFirst({
            where: {
              id: { not: id },
              OR: [
                {
                  primaryEmail: {
                    equals: dto.primaryEmail.trim(),
                    mode: 'insensitive',
                  },
                },
                ...(domain
                  ? [
                      { normalizedDomain: domain },
                      ...organizationDomainAliases(domain).map((alias) => ({
                        primaryEmail: {
                          endsWith: '@' + alias,
                          mode: 'insensitive' as const,
                        },
                      })),
                    ]
                  : []),
              ],
            },
            select: { id: true },
          });
          if (duplicate)
            throw new ConflictException({
              code: 'ORGANIZATION_UNIQUE_CONSTRAINT',
              message:
                'An organization with these identity details already exists.',
            });
        }
        const updated = await tx.organization.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            slug: this.optionalLower(dto.slug),
            primaryEmail: this.optionalLower(dto.primaryEmail),
            ...(dto.primaryEmail === undefined
              ? {}
              : { normalizedDomain: domain }),
            primaryContactName: this.optionalTrim(dto.primaryContactName),
            primaryContactEmail: this.optionalLower(dto.primaryContactEmail),
            billingEmail: this.optionalLower(dto.billingEmail),
            country: this.optionalTrim(dto.country),
            defaultCurrency: dto.defaultCurrency?.toUpperCase(),
            timezone: this.optionalTrim(dto.timezone),
            externalCustomerRef: this.optionalTrim(dto.externalCustomerRef),
            metadata: this.toPrismaJson(dto.metadata),
          },
        });
        await tx.platformAuditLog.create({
          data: {
            actorStaffId,
            action: 'organization.updated',
            resourceType: 'Organization',
            resourceId: id,
            oldValue: {
              name: current.name,
              primaryEmail: current.primaryEmail,
            },
            newValue: {
              name: updated.name,
              primaryEmail: updated.primaryEmail,
            },
            metadata: { fields: Object.keys(dto) },
          },
        });
        return updated;
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async review(
    id: string,
    dto: ReviewOrganizationDto,
    actorStaffId: string,
  ): Promise<Organization> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.organization.findUnique({ where: { id } });
      if (!current)
        throw new NotFoundException({
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found.',
        });
      if (
        current.registrationStatus !== 'PENDING_ORGANIZATION_REVIEW' ||
        current.status !== 'PROVISIONING'
      ) {
        throw new ConflictException({
          code: 'REGISTRATION_ALREADY_REVIEWED',
          message: 'Only a pending, provisioning registration may be reviewed.',
        });
      }
      const now = new Date();
      const status =
        dto.decision === 'APPROVED'
          ? OrganizationStatus.ACTIVE
          : OrganizationStatus.CANCELLED;
      const changed = await tx.organization.updateMany({
        where: {
          id,
          registrationStatus: 'PENDING_ORGANIZATION_REVIEW',
          status: 'PROVISIONING',
        },
        data: {
          registrationStatus: dto.decision,
          reviewedAt: now,
          reviewedByStaffId: actorStaffId,
          reviewNote: dto.note,
          status,
          statusChangedAt: now,
          ...(dto.decision === 'REJECTED' ? { cancelledAt: now } : {}),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException({
          code: 'REGISTRATION_REVIEW_CONFLICT',
          message:
            'Another reviewer changed this registration. Refresh before continuing.',
        });
      await tx.platformAuditLog.create({
        data: {
          actorStaffId,
          action: 'organization.registration.' + dto.decision.toLowerCase(),
          resourceType: 'Organization',
          resourceId: id,
          oldValue: {
            registrationStatus: current.registrationStatus,
            status: current.status,
          },
          newValue: {
            registrationStatus: dto.decision,
            status,
            note: dto.note,
            domainVerified: false,
          },
        },
      });
      return tx.organization.findUniqueOrThrow({ where: { id } });
    });
  }

  suspend(id: string, actorStaffId?: string): Promise<Organization> {
    return this.transition(
      id,
      OrganizationStatus.SUSPENDED,
      [
        OrganizationStatus.PROVISIONING,
        OrganizationStatus.TRIAL,
        OrganizationStatus.ACTIVE,
      ],
      actorStaffId,
    );
  }

  reactivate(id: string, actorStaffId?: string): Promise<Organization> {
    return this.transition(
      id,
      OrganizationStatus.ACTIVE,
      [OrganizationStatus.SUSPENDED],
      actorStaffId,
    );
  }

  cancel(id: string, actorStaffId?: string): Promise<Organization> {
    return this.transition(
      id,
      OrganizationStatus.CANCELLED,
      [
        OrganizationStatus.PROVISIONING,
        OrganizationStatus.TRIAL,
        OrganizationStatus.ACTIVE,
        OrganizationStatus.SUSPENDED,
      ],
      actorStaffId,
    );
  }

  archive(id: string, actorStaffId?: string): Promise<Organization> {
    return this.transition(
      id,
      OrganizationStatus.ARCHIVED,
      [OrganizationStatus.CANCELLED],
      actorStaffId,
    );
  }

  private async transition(
    id: string,
    nextStatus: OrganizationStatus,
    allowedCurrentStatuses: OrganizationStatus[],
    actorStaffId?: string,
  ): Promise<Organization> {
    const organization = await this.findOne(id);
    if (
      nextStatus === OrganizationStatus.ACTIVE &&
      !['LEGACY_APPROVED', 'APPROVED'].includes(organization.registrationStatus)
    ) {
      throw new ConflictException({
        code: 'ORGANIZATION_REVIEW_REQUIRED',
        message: 'Organization approval is required before activation.',
      });
    }
    if (!allowedCurrentStatuses.includes(organization.status)) {
      throw new BadRequestException({
        code: 'INVALID_ORGANIZATION_STATUS_TRANSITION',
        message: `Cannot transition organization from ${organization.status} to ${nextStatus}.`,
      });
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id },
        data: {
          status: nextStatus,
          statusChangedAt: now,
          suspendedAt:
            nextStatus === OrganizationStatus.SUSPENDED
              ? now
              : organization.suspendedAt,
          cancelledAt:
            nextStatus === OrganizationStatus.CANCELLED
              ? now
              : organization.cancelledAt,
          archivedAt:
            nextStatus === OrganizationStatus.ARCHIVED
              ? now
              : organization.archivedAt,
        },
      });
      await tx.platformAuditLog.create({
        data: {
          actorStaffId,
          action: 'organization.' + nextStatus.toLowerCase(),
          resourceType: 'Organization',
          resourceId: id,
          oldValue: { status: organization.status },
          newValue: { status: nextStatus },
        },
      });
      return updated;
    });
  }

  private buildWhere(
    query: ListOrganizationsQueryDto,
  ): Prisma.OrganizationWhereInput {
    const where: Prisma.OrganizationWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { primaryEmail: { contains: search, mode: 'insensitive' } },
        { primaryContactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private optionalTrim(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private optionalLower(value: string | undefined): string | undefined {
    return this.optionalTrim(value)?.toLowerCase();
  }

  private toPrismaJson(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonObject | undefined {
    return value as Prisma.InputJsonObject | undefined;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'ORGANIZATION_UNIQUE_CONSTRAINT',
        message: 'An organization with the same unique field already exists.',
      });
    }
    throw error;
  }
}
