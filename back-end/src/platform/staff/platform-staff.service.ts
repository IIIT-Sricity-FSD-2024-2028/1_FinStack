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
import {
  assertEffectiveSuperAdmin,
  assertPermissionsWithinActorAuthority,
  PLATFORM_SUPER_ADMIN_ROLE_KEY,
} from '../common/platform-authority';
import { runPlatformSerializableTransaction } from '../common/platform-serializable-transaction';
import { AssignPlatformStaffRoleDto } from './dto/assign-platform-staff-role.dto';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { ListPlatformStaffQueryDto } from './dto/list-platform-staff-query.dto';
import { UpdatePlatformStaffDto } from './dto/update-platform-staff.dto';
import {
  PlatformStaffResponse,
  PlatformStaffRoleAssignmentResponse,
  safePlatformRoleSelect,
  safePlatformStaffSelect,
  safePlatformStaffRoleAssignmentSelect,
  toSafePlatformStaff,
  toSafePlatformStaffRoleAssignment,
} from './platform-staff.types';

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

  async findAssignedRoles(
    staffId: string,
  ): Promise<PlatformStaffRoleAssignmentResponse[]> {
    await this.assertStaffExists(staffId);
    const assignments = await this.prisma.platformStaffRole.findMany({
      where: { staffId },
      select: safePlatformStaffRoleAssignmentSelect,
      orderBy: [{ role: { name: 'asc' } }, { role: { key: 'asc' } }],
    });
    return assignments.map(toSafePlatformStaffRoleAssignment);
  }

  async assignRole(
    staffId: string,
    dto: AssignPlatformStaffRoleDto,
    authenticatedStaffId: string,
  ): Promise<PlatformStaffRoleAssignmentResponse> {
    try {
      return await this.withSerializableRetry(
        async (transaction) => {
          const [staff, role] = await Promise.all([
            transaction.platformStaff.findUnique({
              where: { id: staffId },
              select: { status: true },
            }),
            transaction.platformRole.findUnique({
              where: { id: dto.roleId },
              select: {
                ...safePlatformRoleSelect,
                rolePermissions: { select: { permissionId: true } },
              },
            }),
          ]);
          if (!staff) {
            throw this.notFound();
          }
          if (!role) {
            throw this.roleNotFound();
          }
          if (staff.status === PlatformStaffStatus.SUSPENDED) {
            throw new ConflictException({
              code: 'PLATFORM_STAFF_ROLE_ASSIGNMENT_SUSPENDED',
              message: 'Roles cannot be assigned to suspended platform staff.',
            });
          }
          if (!role.isActive) {
            throw new ConflictException({
              code: 'PLATFORM_ROLE_INACTIVE',
              message: 'Inactive platform roles cannot be assigned.',
            });
          }
          await assertPermissionsWithinActorAuthority(
            transaction,
            authenticatedStaffId,
            role.rolePermissions?.map(({ permissionId }) => permissionId) ?? [],
            {
              code: 'ROLE_ASSIGNMENT_EXCEEDS_ACTOR_AUTHORITY',
              message:
                'The role contains permissions outside your current authority.',
            },
          );
          if (role.key === PLATFORM_SUPER_ADMIN_ROLE_KEY) {
            await assertEffectiveSuperAdmin(transaction, authenticatedStaffId);
          }

          const assignment = await transaction.platformStaffRole.create({
            data: {
              staffId,
              roleId: role.id,
              assignedByStaffId: authenticatedStaffId,
            },
            select: safePlatformStaffRoleAssignmentSelect,
          });
          return toSafePlatformStaffRoleAssignment(assignment);
        },
        {
          code: 'PLATFORM_STAFF_ROLE_ASSIGNMENT_CONFLICT',
          message: 'The role assignment conflicted with another staff update.',
        },
      );
    } catch (error) {
      this.handleAssignmentWriteError(error);
    }
  }

  async removeRole(
    staffId: string,
    roleId: string,
    authenticatedStaffId: string,
  ): Promise<PlatformStaffRoleAssignmentResponse> {
    return this.withSerializableRetry(
      async (transaction) => {
        const [staff, role, assignment] = await Promise.all([
          transaction.platformStaff.findUnique({
            where: { id: staffId },
            select: { status: true },
          }),
          transaction.platformRole.findUnique({
            where: { id: roleId },
            select: safePlatformRoleSelect,
          }),
          transaction.platformStaffRole.findUnique({
            where: { staffId_roleId: { staffId, roleId } },
            select: safePlatformStaffRoleAssignmentSelect,
          }),
        ]);
        if (!staff) {
          throw this.notFound();
        }
        if (!role) {
          throw this.roleNotFound();
        }
        if (!assignment) {
          throw this.assignmentNotFound();
        }

        if (role.key === PLATFORM_SUPER_ADMIN_ROLE_KEY) {
          await assertEffectiveSuperAdmin(transaction, authenticatedStaffId);
        }

        if (
          staff.status === PlatformStaffStatus.ACTIVE &&
          role.key === PLATFORM_SUPER_ADMIN_ROLE_KEY &&
          role.isActive
        ) {
          const effectiveSuperAdmins = await transaction.platformStaff.count({
            where: {
              status: PlatformStaffStatus.ACTIVE,
              roles: {
                some: {
                  role: {
                    key: PLATFORM_SUPER_ADMIN_ROLE_KEY,
                    isActive: true,
                  },
                },
              },
            },
          });
          if (effectiveSuperAdmins <= 1) {
            throw new ConflictException({
              code: 'LAST_EFFECTIVE_SUPER_ADMIN',
              message:
                'The last effective active Super Admin cannot lose that role.',
            });
          }
        }

        const removed = await transaction.platformStaffRole.deleteMany({
          where: { staffId, roleId },
        });
        if (removed.count !== 1) {
          throw this.assignmentNotFound();
        }
        return toSafePlatformStaffRoleAssignment(assignment);
      },
      {
        code: 'PLATFORM_STAFF_ROLE_REMOVAL_CONFLICT',
        message: 'The role removal conflicted with another staff update.',
      },
    );
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
              role: {
                key: PLATFORM_SUPER_ADMIN_ROLE_KEY,
                isActive: true,
              },
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
                role: {
                  key: PLATFORM_SUPER_ADMIN_ROLE_KEY,
                  isActive: true,
                },
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

  async reactivate(
    id: string,
    authenticatedStaffId: string,
  ): Promise<PlatformStaffResponse> {
    return this.withSerializableRetry(
      async (transaction) => {
        const target = await transaction.platformStaff.findUnique({
          where: { id },
          select: {
            status: true,
            roles: {
              where: { role: { isActive: true } },
              select: {
                role: {
                  select: {
                    key: true,
                    rolePermissions: { select: { permissionId: true } },
                  },
                },
              },
            },
          },
        });
        if (!target) {
          throw this.notFound();
        }
        if (target.status !== PlatformStaffStatus.INACTIVE) {
          throw this.invalidTransition(
            target.status,
            PlatformStaffStatus.ACTIVE,
          );
        }

        await assertPermissionsWithinActorAuthority(
          transaction,
          authenticatedStaffId,
          target.roles.flatMap(({ role }) =>
            role.rolePermissions.map(({ permissionId }) => permissionId),
          ),
          {
            code: 'STAFF_REACTIVATION_EXCEEDS_ACTOR_AUTHORITY',
            message:
              'The staff member would regain permissions outside your current authority.',
          },
        );
        if (
          target.roles.some(
            ({ role }) => role.key === PLATFORM_SUPER_ADMIN_ROLE_KEY,
          )
        ) {
          await assertEffectiveSuperAdmin(transaction, authenticatedStaffId);
        }

        const updated = await transaction.platformStaff.updateMany({
          where: { id, status: PlatformStaffStatus.INACTIVE },
          data: { status: PlatformStaffStatus.ACTIVE },
        });
        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'PLATFORM_STAFF_REACTIVATION_CONFLICT',
            message: 'The platform staff status changed during reactivation.',
          });
        }
        const staff = await transaction.platformStaff.findUniqueOrThrow({
          where: { id },
          select: safePlatformStaffSelect,
        });
        return toSafePlatformStaff(staff);
      },
      {
        code: 'PLATFORM_STAFF_REACTIVATION_CONFLICT',
        message: 'The reactivation conflicted with another staff update.',
      },
    );
  }

  private withSerializableRetry<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    conflict = {
      code: 'PLATFORM_STAFF_DEACTIVATION_CONFLICT',
      message: 'The deactivation conflicted with another staff update.',
    },
  ): Promise<T> {
    return runPlatformSerializableTransaction(this.prisma, operation, conflict);
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

  private handleAssignmentWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PLATFORM_STAFF_ROLE_ALREADY_ASSIGNED',
        message: 'The platform role is already assigned to this staff member.',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException({
        code: 'PLATFORM_STAFF_ROLE_ASSIGNMENT_CONFLICT',
        message: 'The staff member or platform role changed during assignment.',
      });
    }
    throw error;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'PLATFORM_STAFF_NOT_FOUND',
      message: 'Platform staff member not found.',
    });
  }

  private async assertStaffExists(staffId: string): Promise<void> {
    const staff = await this.prisma.platformStaff.findUnique({
      where: { id: staffId },
      select: { id: true },
    });
    if (!staff) {
      throw this.notFound();
    }
  }

  private roleNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PLATFORM_ROLE_NOT_FOUND',
      message: 'Platform role not found.',
    });
  }

  private assignmentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PLATFORM_STAFF_ROLE_ASSIGNMENT_NOT_FOUND',
      message: 'Platform staff role assignment not found.',
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
