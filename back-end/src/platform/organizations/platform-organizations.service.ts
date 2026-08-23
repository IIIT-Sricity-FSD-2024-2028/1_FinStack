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

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.create({
        data: {
          name: dto.name.trim(),
          slug: this.optionalLower(dto.slug),
          primaryEmail: dto.primaryEmail.toLowerCase(),
          primaryContactName: this.optionalTrim(dto.primaryContactName),
          primaryContactEmail: this.optionalLower(dto.primaryContactEmail),
          billingEmail: this.optionalLower(dto.billingEmail),
          country: this.optionalTrim(dto.country),
          defaultCurrency: dto.defaultCurrency?.toUpperCase() ?? 'INR',
          timezone: this.optionalTrim(dto.timezone),
          status: dto.status ?? OrganizationStatus.PROVISIONING,
          statusChangedAt: new Date(),
          externalCustomerRef: this.optionalTrim(dto.externalCustomerRef),
          metadata: this.toPrismaJson(dto.metadata),
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    await this.findOne(id);
    try {
      return await this.prisma.organization.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: this.optionalLower(dto.slug),
          primaryEmail: this.optionalLower(dto.primaryEmail),
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
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  suspend(id: string): Promise<Organization> {
    return this.transition(id, OrganizationStatus.SUSPENDED, [
      OrganizationStatus.PROVISIONING,
      OrganizationStatus.TRIAL,
      OrganizationStatus.ACTIVE,
    ]);
  }

  reactivate(id: string): Promise<Organization> {
    return this.transition(id, OrganizationStatus.ACTIVE, [
      OrganizationStatus.SUSPENDED,
    ]);
  }

  cancel(id: string): Promise<Organization> {
    return this.transition(id, OrganizationStatus.CANCELLED, [
      OrganizationStatus.PROVISIONING,
      OrganizationStatus.TRIAL,
      OrganizationStatus.ACTIVE,
      OrganizationStatus.SUSPENDED,
    ]);
  }

  archive(id: string): Promise<Organization> {
    return this.transition(id, OrganizationStatus.ARCHIVED, [
      OrganizationStatus.CANCELLED,
    ]);
  }

  private async transition(
    id: string,
    nextStatus: OrganizationStatus,
    allowedCurrentStatuses: OrganizationStatus[],
  ): Promise<Organization> {
    const organization = await this.findOne(id);
    if (!allowedCurrentStatuses.includes(organization.status)) {
      throw new BadRequestException({
        code: 'INVALID_ORGANIZATION_STATUS_TRANSITION',
        message: `Cannot transition organization from ${organization.status} to ${nextStatus}.`,
      });
    }

    const now = new Date();
    return this.prisma.organization.update({
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
