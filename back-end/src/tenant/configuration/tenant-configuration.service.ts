import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  department: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
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

  async createUser(organizationId: string, dto: CreateTenantUserDto) {
    await this.assertManager(organizationId, dto.managerId, null);
    try {
      const user = await this.prisma.tenantUser.create({
        data: {
          organizationId,
          employeeId: dto.employeeId.trim(),
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash: await argon2.hash(dto.initialPassword, { type: argon2.argon2id }),
          role: dto.role,
          department: dto.department?.trim() || 'General',
          managerId: dto.managerId || null,
        },
        select: safeUserSelect,
      });
      return this.toUserDto(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'TENANT_USER_DUPLICATE',
          message: 'Employee ID or email already exists in this organization.',
        });
      }
      throw error;
    }
  }

  async updateUser(organizationId: string, userId: string, dto: UpdateTenantUserDto) {
    await this.requireUser(organizationId, userId);
    try {
      const user = await this.prisma.tenantUser.update({
        where: { id: userId },
        data: {
          ...(dto.firstName === undefined ? {} : { firstName: dto.firstName.trim() }),
          ...(dto.lastName === undefined ? {} : { lastName: dto.lastName.trim() }),
          ...(dto.email === undefined ? {} : { email: dto.email.trim().toLowerCase() }),
          ...(dto.role === undefined ? {} : { role: dto.role }),
          ...(dto.department === undefined ? {} : { department: dto.department.trim() || 'General' }),
        },
        select: safeUserSelect,
      });
      return this.toUserDto(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'TENANT_USER_DUPLICATE', message: 'Email already exists in this organization.' });
      }
      throw error;
    }
  }

  async updateStatus(organizationId: string, actorId: string, userId: string, dto: UpdateTenantUserStatusDto) {
    const user = await this.requireUser(organizationId, userId);
    if (dto.status === TenantUserStatus.INACTIVE && user.status === TenantUserStatus.ACTIVE && user.role === TenantRole.CONFIGURATION_MANAGER) {
      const activeManagers = await this.prisma.tenantUser.count({
        where: { organizationId, role: TenantRole.CONFIGURATION_MANAGER, status: TenantUserStatus.ACTIVE },
      });
      if (activeManagers <= 1) {
        throw new ConflictException({
          code: 'LAST_ACTIVE_CONFIGURATION_MANAGER',
          message: 'The last active Configuration Manager cannot be deactivated.',
        });
      }
    }
    if (dto.status === TenantUserStatus.INACTIVE && actorId === userId) {
      throw new ConflictException({ code: 'SELF_DEACTIVATION_NOT_ALLOWED', message: 'You cannot deactivate your own account.' });
    }
    const updated = await this.prisma.tenantUser.update({
      where: { id: userId }, data: { status: dto.status }, select: safeUserSelect,
    });
    return this.toUserDto(updated);
  }

  async updateReporting(organizationId: string, userId: string, dto: UpdateTenantUserReportingDto) {
    await this.requireUser(organizationId, userId);
    await this.assertManager(organizationId, dto.managerId ?? null, userId);
    const updated = await this.prisma.tenantUser.update({
      where: { id: userId }, data: { managerId: dto.managerId ?? null }, select: safeUserSelect,
    });
    return this.toUserDto(updated);
  }

  async listRoles(organizationId: string) {
    const counts = await this.prisma.tenantUser.groupBy({
      by: ['role'], where: { organizationId }, _count: { _all: true },
    });
    const countByRole = new Map(counts.map((item) => [item.role, item._count._all]));
    return {
      items: Object.values(TenantRole).map((role) => ({
        key: role,
        name: role.split('_').map((part) => part[0] + part.slice(1).toLowerCase()).join(' '),
        description: roleDescriptions[role],
        capabilities: roleCapabilities[role],
        userCount: countByRole.get(role) ?? 0,
      })),
    };
  }

  async dashboard(organizationId: string) {
    const [organization, subscription, activeUsers, totalUsers] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true, createdAt: true } }),
      this.prisma.organizationSubscription.findFirst({
        where: { organizationId }, orderBy: { createdAt: 'desc' },
        select: { status: true, employeeCount: true, currentPeriodEnd: true, plan: { select: { id: true, name: true, key: true } } },
      }),
      this.prisma.tenantUser.count({ where: { organizationId, status: TenantUserStatus.ACTIVE } }),
      this.prisma.tenantUser.count({ where: { organizationId } }),
    ]);
    if (!organization) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
    return { organization, subscription, activeUsers, totalUsers };
  }

  private async requireUser(organizationId: string, userId: string) {
    const user = await this.prisma.tenantUser.findFirst({ where: { id: userId, organizationId } });
    if (!user) throw new NotFoundException({ code: 'TENANT_USER_NOT_FOUND', message: 'User not found in this organization.' });
    return user;
  }

  private async assertManager(organizationId: string, managerId: string | null | undefined, userId: string | null) {
    if (!managerId) return;
    if (managerId === userId) throw new ConflictException({ code: 'TENANT_USER_MANAGER_INVALID', message: 'A user cannot manage themselves.' });
    const manager = await this.prisma.tenantUser.findFirst({ where: { id: managerId, organizationId }, select: { id: true, managerId: true } });
    if (!manager) throw new NotFoundException({ code: 'TENANT_USER_MANAGER_NOT_FOUND', message: 'Manager must belong to this organization.' });
    if (!userId) return;
    let ancestor: string | null = manager.id;
    while (ancestor) {
      if (ancestor === userId) throw new ConflictException({ code: 'TENANT_USER_REPORTING_CYCLE', message: 'Reporting relationships cannot contain a cycle.' });
      const record = await this.prisma.tenantUser.findUnique({ where: { id: ancestor }, select: { managerId: true } });
      ancestor = record?.managerId ?? null;
    }
  }

  private toUserDto(user: Prisma.TenantUserGetPayload<{ select: typeof safeUserSelect }>) {
    return {
      id: user.id, employeeId: user.employeeId, firstName: user.firstName, lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role,
      status: user.status, department: user.department, managerId: user.managerId,
      manager: user.manager ? { id: user.manager.id, employeeId: user.manager.employeeId, fullName: `${user.manager.firstName} ${user.manager.lastName}` } : null,
      directReportCount: user._count.directReports, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
    };
  }
}

const roleDescriptions: Record<TenantRole, string> = {
  CONFIGURATION_MANAGER: 'Manages organization configuration, users, access, and subscription settings.',
  EXPENSE_SUBMITTER: 'Creates and submits expenses for review.',
  MANAGER: 'Reviews and decides on direct-report expense submissions.',
  FINANCE_OFFICER: 'Reviews finance workflows and reimbursement operations.',
  COMPLIANCE_OFFICER: 'Reviews policy and compliance workflow decisions.',
};

const roleCapabilities: Record<TenantRole, string[]> = {
  CONFIGURATION_MANAGER: ['Manage users', 'Configure organization', 'Manage subscription'],
  EXPENSE_SUBMITTER: ['Submit expenses', 'View own expenses'],
  MANAGER: ['Review team expenses', 'Approve or reject submissions'],
  FINANCE_OFFICER: ['Review finance queue', 'Manage reimbursements'],
  COMPLIANCE_OFFICER: ['Review compliance queue', 'Record compliance decisions'],
};
