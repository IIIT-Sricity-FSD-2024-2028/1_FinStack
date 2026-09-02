import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { assertPermissionsWithinActorAuthority } from '../common/platform-authority';
import { runPlatformSerializableTransaction } from '../common/platform-serializable-transaction';
import { AssignPlatformRolePermissionDto } from './dto/assign-platform-role-permission.dto';
import { CreatePlatformRoleDto } from './dto/create-platform-role.dto';
import { ListPlatformRolesQueryDto } from './dto/list-platform-roles-query.dto';
import { UpdatePlatformRoleDto } from './dto/update-platform-role.dto';
import {
  PlatformRoleManagementResponse,
  PlatformRolePermissionResponse,
  safePermissionSelect,
  safePlatformRoleManagementSelect,
  safePlatformRolePermissionSelect,
  toSafePlatformRole,
  toSafePlatformRolePermission,
} from './platform-roles.types';

export interface PaginatedPlatformRoles {
  items: PlatformRoleManagementResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class PlatformRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListPlatformRolesQueryDto,
  ): Promise<PaginatedPlatformRoles> {
    const where = this.buildWhere(query);
    const orderBy: Prisma.PlatformRoleOrderByWithRelationInput = {
      [query.sortBy]: query.order,
    };
    const [roles, total] = await this.prisma.$transaction([
      this.prisma.platformRole.findMany({
        where,
        select: safePlatformRoleManagementSelect,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.platformRole.count({ where }),
    ]);

    return {
      items: roles.map(toSafePlatformRole),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async findOne(id: string): Promise<PlatformRoleManagementResponse> {
    const role = await this.prisma.platformRole.findUnique({
      where: { id },
      select: safePlatformRoleManagementSelect,
    });
    if (!role) {
      throw this.roleNotFound();
    }
    return toSafePlatformRole(role);
  }

  async create(
    dto: CreatePlatformRoleDto,
  ): Promise<PlatformRoleManagementResponse> {
    try {
      const role = await this.prisma.platformRole.create({
        data: {
          key: dto.key.trim().toUpperCase(),
          name: dto.name.trim(),
          description: this.optionalTrim(dto.description),
          isSystemPreset: false,
          isActive: true,
        },
        select: safePlatformRoleManagementSelect,
      });
      return toSafePlatformRole(role);
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async update(
    id: string,
    dto: UpdatePlatformRoleDto,
  ): Promise<PlatformRoleManagementResponse> {
    const existing = await this.findOne(id);
    this.assertCustomRole(existing);

    try {
      const role = await this.prisma.platformRole.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description:
            dto.description === null
              ? null
              : this.optionalTrim(dto.description),
        },
        select: safePlatformRoleManagementSelect,
      });
      return toSafePlatformRole(role);
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  deactivate(id: string): Promise<PlatformRoleManagementResponse> {
    return this.transition(id, false);
  }

  reactivate(
    id: string,
    authenticatedStaffId: string,
  ): Promise<PlatformRoleManagementResponse> {
    return this.transition(id, true, authenticatedStaffId);
  }

  async findPermissions(
    roleId: string,
  ): Promise<PlatformRolePermissionResponse[]> {
    await this.assertRoleExists(roleId);
    const assignments = await this.prisma.platformRolePermission.findMany({
      where: { roleId },
      select: safePlatformRolePermissionSelect,
      orderBy: [{ permission: { key: 'asc' } }, { permissionId: 'asc' }],
    });
    return assignments.map(toSafePlatformRolePermission);
  }

  async assignPermission(
    roleId: string,
    dto: AssignPlatformRolePermissionDto,
    authenticatedStaffId: string,
  ): Promise<PlatformRolePermissionResponse> {
    try {
      return await runPlatformSerializableTransaction(
        this.prisma,
        async (transaction) => {
          const [role, permission] = await Promise.all([
            transaction.platformRole.findUnique({
              where: { id: roleId },
              select: safePlatformRoleManagementSelect,
            }),
            transaction.permission.findUnique({
              where: { id: dto.permissionId },
              select: safePermissionSelect,
            }),
          ]);
          if (!role) {
            throw this.roleNotFound();
          }
          if (!permission) {
            throw this.permissionNotFound();
          }
          this.assertCustomRole(role);
          if (!role.isActive) {
            throw new ConflictException({
              code: 'PLATFORM_ROLE_INACTIVE',
              message: 'Permissions cannot be assigned to an inactive role.',
            });
          }

          await assertPermissionsWithinActorAuthority(
            transaction,
            authenticatedStaffId,
            [permission.id],
            {
              code: 'PERMISSION_GRANT_NOT_ALLOWED',
              message: 'You may only grant permissions you currently possess.',
            },
          );

          const assignment = await transaction.platformRolePermission.create({
            data: { roleId, permissionId: permission.id },
            select: safePlatformRolePermissionSelect,
          });
          return toSafePlatformRolePermission(assignment);
        },
        {
          code: 'PLATFORM_ROLE_PERMISSION_ASSIGNMENT_CONFLICT',
          message:
            'The permission assignment conflicted with another role update.',
        },
      );
    } catch (error) {
      this.handlePermissionAssignmentError(error);
    }
  }

  async removePermission(
    roleId: string,
    permissionId: string,
  ): Promise<PlatformRolePermissionResponse> {
    return runPlatformSerializableTransaction(
      this.prisma,
      async (transaction) => {
        const [role, permission, assignment] = await Promise.all([
          transaction.platformRole.findUnique({
            where: { id: roleId },
            select: safePlatformRoleManagementSelect,
          }),
          transaction.permission.findUnique({
            where: { id: permissionId },
            select: safePermissionSelect,
          }),
          transaction.platformRolePermission.findUnique({
            where: { roleId_permissionId: { roleId, permissionId } },
            select: safePlatformRolePermissionSelect,
          }),
        ]);
        if (!role) {
          throw this.roleNotFound();
        }
        if (!permission) {
          throw this.permissionNotFound();
        }
        this.assertCustomRole(role);
        if (!assignment) {
          throw this.assignmentNotFound();
        }

        const removed = await transaction.platformRolePermission.deleteMany({
          where: { roleId, permissionId },
        });
        if (removed.count !== 1) {
          throw this.assignmentNotFound();
        }
        return toSafePlatformRolePermission(assignment);
      },
      {
        code: 'PLATFORM_ROLE_PERMISSION_REMOVAL_CONFLICT',
        message: 'The permission removal conflicted with another role update.',
      },
    );
  }

  private async transition(
    id: string,
    nextIsActive: boolean,
    authenticatedStaffId?: string,
  ): Promise<PlatformRoleManagementResponse> {
    return runPlatformSerializableTransaction(
      this.prisma,
      async (transaction) => {
        const role = await transaction.platformRole.findUnique({
          where: { id },
          select: {
            ...safePlatformRoleManagementSelect,
            rolePermissions: { select: { permissionId: true } },
          },
        });
        if (!role) {
          throw this.roleNotFound();
        }
        this.assertCustomRole(role);
        if (role.isActive === nextIsActive) {
          throw new BadRequestException({
            code: 'INVALID_PLATFORM_ROLE_STATUS_TRANSITION',
            message: `Platform role is already ${nextIsActive ? 'active' : 'inactive'}.`,
          });
        }
        if (nextIsActive) {
          if (!authenticatedStaffId) {
            throw new Error(
              'Role reactivation requires an authenticated actor.',
            );
          }
          await assertPermissionsWithinActorAuthority(
            transaction,
            authenticatedStaffId,
            role.rolePermissions?.map(({ permissionId }) => permissionId) ?? [],
            {
              code: 'ROLE_REACTIVATION_EXCEEDS_ACTOR_AUTHORITY',
              message:
                'The role would restore permissions outside your current authority.',
            },
          );
        }

        const updated = await transaction.platformRole.updateMany({
          where: { id, isActive: !nextIsActive },
          data: { isActive: nextIsActive },
        });
        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'PLATFORM_ROLE_STATUS_CONFLICT',
            message: 'The platform role status changed during the operation.',
          });
        }
        const result = await transaction.platformRole.findUniqueOrThrow({
          where: { id },
          select: safePlatformRoleManagementSelect,
        });
        return toSafePlatformRole(result);
      },
      {
        code: 'PLATFORM_ROLE_STATUS_CONFLICT',
        message: 'The role status change conflicted with another role update.',
      },
    );
  }

  private buildWhere(
    query: ListPlatformRolesQueryDto,
  ): Prisma.PlatformRoleWhereInput {
    const where: Prisma.PlatformRoleWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.isSystemPreset !== undefined) {
      where.isSystemPreset = query.isSystemPreset;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.platformRole.findUnique({
      where: { id: roleId },
      select: { id: true },
    });
    if (!role) {
      throw this.roleNotFound();
    }
  }

  private assertCustomRole(role: { isSystemPreset: boolean }): void {
    if (role.isSystemPreset) {
      throw new ConflictException({
        code: 'SYSTEM_PLATFORM_ROLE_IMMUTABLE',
        message: 'System preset roles cannot be modified at runtime.',
      });
    }
  }

  private optionalTrim(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PLATFORM_ROLE_UNIQUE_CONSTRAINT',
        message: 'A platform role with the same key or name already exists.',
      });
    }
    throw error;
  }

  private handlePermissionAssignmentError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PLATFORM_ROLE_PERMISSION_ALREADY_ASSIGNED',
        message: 'The permission is already assigned to this platform role.',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException({
        code: 'PLATFORM_ROLE_PERMISSION_ASSIGNMENT_CONFLICT',
        message: 'The platform role or permission changed during assignment.',
      });
    }
    throw error;
  }

  private roleNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PLATFORM_ROLE_NOT_FOUND',
      message: 'Platform role not found.',
    });
  }

  private permissionNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PLATFORM_PERMISSION_NOT_FOUND',
      message: 'Platform permission not found.',
    });
  }

  private assignmentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PLATFORM_ROLE_PERMISSION_ASSIGNMENT_NOT_FOUND',
      message: 'Platform role permission assignment not found.',
    });
  }
}
