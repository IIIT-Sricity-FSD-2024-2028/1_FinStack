import {
  appendAudit,
  auditSnapshot,
  auditedMutation,
} from '../audit/tenant-audit-write';
import { lockReporting } from './reporting-lock';
import { createWithGeneratedLoginId } from '../identity/tenant-login-id';
import { ListEmployeesDto } from './dto/list-employees.dto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenantRole, TenantUserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { UpdateTenantUserStatusDto } from './dto/update-tenant-user-status.dto';
import { UpdateTenantUserReportingDto } from './dto/update-tenant-user-reporting.dto';

const safeUserSelect = {
  id: true,
  organizationId: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  credentialSetupRequired: true,
  department: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: {
    select: { id: true, firstName: true, lastName: true, employeeId: true },
  },
  _count: { select: { directReports: true } },
} satisfies Prisma.TenantUserSelect;

@Injectable()
export class TenantConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(organizationId: string) {
    const records = await this.prisma.tenantUser.findMany({
      where: { organizationId },
      select: safeUserSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return { items: records.map((user) => this.toUserDto(user)) };
  }

  async listEmployees(organizationId: string, query: ListEmployeesDto) {
    // LIKE metacharacters are literal search text, never wildcard syntax.
    const literal = (value: string) => value.replace(/[\\%_]/g, '\\$&');
    const terms = (query.search || '').split(/\s+/).filter(Boolean);
    const where: Prisma.TenantUserWhereInput = {
      organizationId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.department
        ? {
            department: {
              equals: literal(query.department),
              mode: 'insensitive',
            },
          }
        : {}),
      AND: terms.map((term) => ({
        OR: ['employeeId', 'firstName', 'lastName', 'email'].map((field) => ({
          [field]: { contains: literal(term), mode: 'insensitive' },
        })),
      })),
    };
    const select = {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      department: true,
      credentialSetupRequired: true,
      manager: {
        where: { organizationId },
        select: { id: true, employeeId: true, firstName: true, lastName: true },
      },
    } satisfies Prisma.TenantUserSelect;
    // One consistent snapshot for count and page; no full list or N+1 loop.
    const [total, records] = await this.prisma.$transaction(
      [
        this.prisma.tenantUser.count({ where }),
        this.prisma.tenantUser.findMany({
          where,
          select,
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: records.map(({ manager, ...user }) => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`,
        manager: manager
          ? {
              id: manager.id,
              employeeId: manager.employeeId,
              fullName: `${manager.firstName} ${manager.lastName}`,
            }
          : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      hasPreviousPage: query.page > 1,
      hasNextPage: query.page * query.pageSize < total,
    };
  }

  async createUser(organizationId: string, dto: CreateTenantUserDto) {
    const passwordHash = await argon2.hash(dto.initialPassword, {
      type: argon2.argon2id,
    });
    try {
      const create = (employeeId: string) =>
        this.prisma.$transaction(async (tx) => {
          await lockReporting(tx, organizationId);
          await this.assertManager(tx, organizationId, dto.managerId, null);
          const user = await tx.tenantUser.create({
            data: {
              organizationId,
              employeeId,
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              email: dto.email.trim().toLowerCase(),
              passwordHash,
              role: dto.role,
              department: dto.department?.trim() || 'General',
              managerId: dto.managerId || null,
            },
            select: safeUserSelect,
          });
          await appendAudit(
            tx,
            organizationId,
            'employee.created',
            'employee',
            user.id,
            { before: null, after: auditSnapshot('employee', user) },
          );
          return this.toUserDto(user);
        });
      // Retain explicit legacy IDs for published clients; the new form omits it.
      if (dto.employeeId !== undefined)
        return await create(dto.employeeId.trim());
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });
      if (!organization) throw new NotFoundException('Organization not found.');
      return await createWithGeneratedLoginId(organization, create);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'TENANT_USER_DUPLICATE',
          message:
            'Employee ID is unavailable or email already exists in this organization.',
        });
      }
      throw error;
    }
  }

  async updateUser(
    organizationId: string,
    userId: string,
    dto: UpdateTenantUserDto,
  ) {
    await this.requireUser(organizationId, userId);
    try {
      return await auditedMutation(
        this.prisma,
        organizationId,
        'employee.updated',
        'employee',
        userId,
        async (tx) => {
          if (dto.role && dto.role !== TenantRole.CONFIGURATION_MANAGER) {
            const current = await tx.tenantUser.findFirstOrThrow({
              where: { id: userId, organizationId },
            });
            if (
              current.role === TenantRole.CONFIGURATION_MANAGER &&
              current.status === TenantUserStatus.ACTIVE &&
              (await tx.tenantUser.count({
                where: {
                  organizationId,
                  role: TenantRole.CONFIGURATION_MANAGER,
                  status: TenantUserStatus.ACTIVE,
                },
              })) <= 1
            ) {
              throw new ConflictException({
                code: 'LAST_ACTIVE_CONFIGURATION_MANAGER',
                message:
                  'Keep at least one active Configuration Manager before changing this role.',
              });
            }
          }
          const user = await tx.tenantUser.update({
            where: { id: userId },
            data: {
              ...(dto.firstName === undefined
                ? {}
                : { firstName: dto.firstName.trim() }),
              ...(dto.lastName === undefined
                ? {}
                : { lastName: dto.lastName.trim() }),
              ...(dto.email === undefined
                ? {}
                : { email: dto.email.trim().toLowerCase() }),
              ...(dto.role === undefined ? {} : { role: dto.role }),
              ...(dto.department === undefined
                ? {}
                : { department: dto.department.trim() || 'General' }),
            },
            select: safeUserSelect,
          });
          return this.toUserDto(user);
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'TENANT_USER_DUPLICATE',
          message: 'Email already exists in this organization.',
        });
      }
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    actorId: string,
    userId: string,
    dto: UpdateTenantUserStatusDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockReporting(tx, organizationId);
      const user = await tx.tenantUser.findFirst({
        where: { organizationId, id: userId },
      });
      if (!user)
        throw new NotFoundException('User not found in this organization.');
      if (
        dto.status === TenantUserStatus.INACTIVE &&
        user.status === TenantUserStatus.ACTIVE &&
        user.role === TenantRole.CONFIGURATION_MANAGER
      ) {
        const activeManagers = await tx.tenantUser.count({
          where: {
            organizationId,
            role: TenantRole.CONFIGURATION_MANAGER,
            status: TenantUserStatus.ACTIVE,
          },
        });
        if (activeManagers <= 1) {
          throw new ConflictException({
            code: 'LAST_ACTIVE_CONFIGURATION_MANAGER',
            message:
              'The last active Configuration Manager cannot be deactivated.',
          });
        }
      }
      if (dto.status === TenantUserStatus.INACTIVE && actorId === userId) {
        throw new ConflictException({
          code: 'SELF_DEACTIVATION_NOT_ALLOWED',
          message: 'You cannot deactivate your own account.',
        });
      }
      if (
        dto.status === TenantUserStatus.ACTIVE &&
        user.credentialSetupRequired
      ) {
        throw new ConflictException(
          'This imported account must complete secure credential setup before activation.',
        );
      }
      const updated = await tx.tenantUser.update({
        where: { id: userId },
        data: { status: dto.status },
        select: safeUserSelect,
      });
      if (user.status !== updated.status)
        await appendAudit(
          tx,
          organizationId,
          'employee.status_changed',
          'employee',
          userId,
          {
            before: auditSnapshot('employee', user),
            after: auditSnapshot('employee', updated),
          },
        );
      return this.toUserDto(updated);
    });
  }

  async updateReporting(
    organizationId: string,
    userId: string,
    dto: UpdateTenantUserReportingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockReporting(tx, organizationId);
      const user = await tx.tenantUser.findFirst({
        where: { organizationId, id: userId },
        select: safeUserSelect,
      });
      if (!user)
        throw new NotFoundException('User not found in this organization.');
      if (
        dto.expectedManagerId !== undefined &&
        dto.expectedManagerId !== user.managerId
      )
        throw new ConflictException({
          code: 'TENANT_REPORTING_CHANGED',
          message:
            'The reporting manager changed. Reload employee details before saving.',
        });
      const managerId = dto.managerId ?? null;
      if (managerId === user.managerId) return this.toUserDto(user);
      await this.assertManager(tx, organizationId, managerId, userId);
      const updated = await tx.tenantUser.update({
        where: { id: userId },
        data: { managerId },
        select: safeUserSelect,
      });
      await appendAudit(
        tx,
        organizationId,
        'employee.reporting_changed',
        'employee',
        userId,
        { before: { managerId: user.managerId }, after: { managerId } },
      );
      return this.toUserDto(updated);
    });
  }

  async listRoles(organizationId: string) {
    const counts = await this.prisma.tenantUser.groupBy({
      by: ['role'],
      where: { organizationId },
      _count: { _all: true },
    });
    const countByRole = new Map(
      counts.map((item) => [item.role, item._count._all]),
    );
    return {
      items: Object.values(TenantRole).map((role) => ({
        key: role,
        name: role
          .split('_')
          .map((part) => part[0] + part.slice(1).toLowerCase())
          .join(' '),
        description: roleDescriptions[role],
        capabilities: roleCapabilities[role],
        userCount: countByRole.get(role) ?? 0,
      })),
    };
  }

  async dashboard(organizationId: string) {
    const [organization, subscription, activeUsers, totalUsers] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true, slug: true, createdAt: true },
        }),
        this.prisma.organizationSubscription.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          select: {
            status: true,
            employeeCount: true,
            currentPeriodEnd: true,
            plan: { select: { id: true, name: true, key: true } },
          },
        }),
        this.prisma.tenantUser.count({
          where: { organizationId, status: TenantUserStatus.ACTIVE },
        }),
        this.prisma.tenantUser.count({ where: { organizationId } }),
      ]);
    if (!organization)
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found.',
      });
    return { organization, subscription, activeUsers, totalUsers };
  }

  private async requireUser(organizationId: string, userId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user)
      throw new NotFoundException({
        code: 'TENANT_USER_NOT_FOUND',
        message: 'User not found in this organization.',
      });
    return user;
  }

  private async assertManager(
    tx: Prisma.TransactionClient,
    organizationId: string,
    managerId: string | null | undefined,
    userId: string | null,
  ) {
    if (!managerId) return;
    if (managerId === userId)
      throw new ConflictException({
        code: 'TENANT_USER_MANAGER_INVALID',
        message: 'A user cannot manage themselves.',
      });
    const manager = await tx.tenantUser.findFirst({
      where: { id: managerId, organizationId },
      select: { id: true, status: true, credentialSetupRequired: true },
    });
    if (!manager)
      throw new NotFoundException({
        code: 'TENANT_USER_MANAGER_NOT_FOUND',
        message: 'Manager must belong to this organization.',
      });
    if (manager.status !== 'ACTIVE' || manager.credentialSetupRequired)
      throw new ConflictException({
        code: 'TENANT_USER_MANAGER_INACTIVE',
        message: 'Choose an active manager with completed credential setup.',
      });
    if (!userId) return;
    const [result] = await tx.$queryRaw<{ invalid: boolean }[]>`
      WITH RECURSIVE chain AS (
        SELECT id,"managerId",ARRAY[id] AS visited,false AS cycle,0 AS depth FROM "TenantUser" WHERE id=${managerId}::uuid AND "organizationId"=${organizationId}::uuid
        UNION ALL SELECT u.id,u."managerId",c.visited || u.id,u.id=ANY(c.visited),c.depth+1
        FROM "TenantUser" u JOIN chain c ON u.id=c."managerId"
        WHERE u."organizationId"=${organizationId}::uuid AND NOT c.cycle AND c.depth<1000
      ) SELECT COALESCE(bool_or(id=${userId}::uuid OR cycle OR (depth=1000 AND "managerId" IS NOT NULL)),false) AS invalid FROM chain`;
    if (result.invalid)
      throw new ConflictException({
        code: 'TENANT_USER_REPORTING_CYCLE',
        message:
          'Reporting relationships cannot contain a cycle or exceed the supported chain depth.',
      });
  }

  private toUserDto(
    user: Prisma.TenantUserGetPayload<{ select: typeof safeUserSelect }>,
  ) {
    return {
      id: user.id,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      status: user.status,
      credentialSetupRequired: user.credentialSetupRequired,
      department: user.department,
      managerId: user.managerId,
      manager: user.manager
        ? {
            id: user.manager.id,
            employeeId: user.manager.employeeId,
            fullName: `${user.manager.firstName} ${user.manager.lastName}`,
          }
        : null,
      directReportCount: user._count.directReports,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

const roleDescriptions: Record<TenantRole, string> = {
  CONFIGURATION_MANAGER:
    'Manages organization configuration, users, access, and subscription settings.',
  EXPENSE_SUBMITTER: 'Creates and submits expenses for review.',
  MANAGER: 'Reviews and decides on direct-report expense submissions.',
  FINANCE_OFFICER: 'Reviews finance workflows and reimbursement operations.',
  COMPLIANCE_OFFICER: 'Reviews policy and compliance workflow decisions.',
};

const roleCapabilities: Record<TenantRole, string[]> = {
  CONFIGURATION_MANAGER: [
    'Manage users',
    'Configure organization',
    'Manage subscription',
  ],
  EXPENSE_SUBMITTER: ['Submit expenses', 'View own expenses'],
  MANAGER: ['Review team expenses', 'Approve or reject submissions'],
  FINANCE_OFFICER: ['Review finance queue', 'Manage reimbursements'],
  COMPLIANCE_OFFICER: [
    'Review compliance queue',
    'Record compliance decisions',
  ],
};
