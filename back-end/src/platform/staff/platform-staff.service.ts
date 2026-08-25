import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlatformStaffStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformPasswordService } from '../auth/platform-password.service';
import { PlatformSessionService } from '../auth/platform-session.service';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { ListPlatformStaffQueryDto } from './dto/list-platform-staff-query.dto';
import { UpdatePlatformStaffDto } from './dto/update-platform-staff.dto';
import {
  PlatformStaffResponse,
  safePlatformStaffSelect,
  toSafePlatformStaff,
} from './platform-staff.types';

const SUPER_ADMIN_ROLE_KEY = 'PLATFORM_SUPER_ADMIN';
const SERIALIZABLE_RETRY_LIMIT = 3;

export interface PaginatedPlatformStaff {
  items: PlatformStaffResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class PlatformStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PlatformPasswordService,
    private readonly sessions: PlatformSessionService,
  ) {}

  async findAll(
    query: ListPlatformStaffQueryDto,
  ): Promise<PaginatedPlatformStaff> {
    const where = this.buildWhere(query);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.platformStaff.findMany({
        where,
        select: safePlatformStaffSelect,
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.platformStaff.count({ where }),
    ]);

    return {
      items: records.map(toSafePlatformStaff),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async findOne(id: string): Promise<PlatformStaffResponse> {
    const staff = await this.prisma.platformStaff.findUnique({
      where: { id },
      select: safePlatformStaffSelect,
    });
    if (!staff) {
      throw this.notFound();
    }
    return toSafePlatformStaff(staff);
  }

  async create(dto: CreatePlatformStaffDto): Promise<PlatformStaffResponse> {
    const passwordHash = await this.passwords.hash(dto.initialPassword);
    try {
      const staff = await this.prisma.platformStaff.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          status: PlatformStaffStatus.ACTIVE,
        },
        select: safePlatformStaffSelect,
      });
      return toSafePlatformStaff(staff);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async update(
    id: string,
    dto: UpdatePlatformStaffDto,
  ): Promise<PlatformStaffResponse> {
    await this.findOne(id);
    try {
      const staff = await this.prisma.platformStaff.update({
        where: { id },
        data: {
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          email: dto.email?.trim().toLowerCase(),
        },
        select: safePlatformStaffSelect,
      });
      return toSafePlatformStaff(staff);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async deactivate(
    id: string,
    authenticatedStaffId: string,
  ): Promise<PlatformStaffResponse> {
    return this.withSerializableRetry(async (transaction) => {
      const target = await transaction.platformStaff.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          roles: {
            where: {
              role: { key: SUPER_ADMIN_ROLE_KEY, isActive: true },
            },
            select: { roleId: true },
          },
        },
      });
      if (!target) {
        throw this.notFound();
      }
      if (target.id === authenticatedStaffId) {
        throw new ConflictException({
          code: 'PLATFORM_STAFF_SELF_DEACTIVATION',
          message: 'You cannot deactivate your own platform staff account.',
        });
      }
      if (target.status !== PlatformStaffStatus.ACTIVE) {
        throw this.invalidTransition(
          target.status,
          PlatformStaffStatus.INACTIVE,
        );
      }

      if (target.roles.length > 0) {
        const effectiveSuperAdmins = await transaction.platformStaff.count({
          where: {
            status: PlatformStaffStatus.ACTIVE,
            roles: {
              some: {
                role: { key: SUPER_ADMIN_ROLE_KEY, isActive: true },
              },
            },
          },
        });
        if (effectiveSuperAdmins <= 1) {
          throw new ConflictException({
            code: 'LAST_EFFECTIVE_SUPER_ADMIN',
            message:
              'The last effective active Super Admin cannot be deactivated.',
          });
        }
      }

      const updated = await transaction.platformStaff.updateMany({
        where: { id, status: PlatformStaffStatus.ACTIVE },
        data: { status: PlatformStaffStatus.INACTIVE },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'PLATFORM_STAFF_DEACTIVATION_CONFLICT',
          message: 'The platform staff status changed during deactivation.',
        });
      }

      await this.sessions.revokeAllForStaff(id, transaction);
      const staff = await transaction.platformStaff.findUniqueOrThrow({
        where: { id },
        select: safePlatformStaffSelect,
      });
      return toSafePlatformStaff(staff);
    });
  }

  async reactivate(id: string): Promise<PlatformStaffResponse> {
    const target = await this.prisma.platformStaff.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!target) {
      throw this.notFound();
    }
    if (target.status !== PlatformStaffStatus.INACTIVE) {
      throw this.invalidTransition(target.status, PlatformStaffStatus.ACTIVE);
    }

    const updated = await this.prisma.platformStaff.updateMany({
      where: { id, status: PlatformStaffStatus.INACTIVE },
      data: { status: PlatformStaffStatus.ACTIVE },
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: 'PLATFORM_STAFF_REACTIVATION_CONFLICT',
        message: 'The platform staff status changed during reactivation.',
      });
    }
    return this.findOne(id);
  }

  private async withSerializableRetry<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isSerializationFailure(error)) {
          throw error;
        }
        if (attempt === SERIALIZABLE_RETRY_LIMIT) {
          throw new ConflictException({
            code: 'PLATFORM_STAFF_DEACTIVATION_CONFLICT',
            message: 'The deactivation conflicted with another staff update.',
          });
        }
      }
    }
    throw new Error('Serializable transaction retry limit was not enforced.');
  }

  private buildWhere(
    query: ListPlatformStaffQueryDto,
  ): Prisma.PlatformStaffWhereInput {
    const where: Prisma.PlatformStaffWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PLATFORM_STAFF_EMAIL_CONFLICT',
        message: 'A platform staff member with this email already exists.',
      });
    }
    throw error;
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'PLATFORM_STAFF_NOT_FOUND',
      message: 'Platform staff member not found.',
    });
  }

  private invalidTransition(
    current: PlatformStaffStatus,
    next: PlatformStaffStatus,
  ): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_PLATFORM_STAFF_STATUS_TRANSITION',
      message: `Cannot transition platform staff from ${current} to ${next}.`,
    });
  }
}
