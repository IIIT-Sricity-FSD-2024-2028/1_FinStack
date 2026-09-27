import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PlatformStaffStatus, Prisma } from '@prisma/client';
import { PlatformRolesService } from './platform-roles.service';

const roleId = 'c1e23768-5bdb-4a26-9a7a-65e334ac11b1';
const permissionId = '52dc91fd-5319-45eb-94d1-49a253937fd4';
const actorId = '8181126a-1082-4018-8582-1ce6ad0abeda';
const createdAt = new Date('2026-08-29T00:00:00.000Z');

const customRole = {
  id: roleId,
  key: 'CUSTOM_OPERATIONS',
  name: 'Custom Operations',
  description: 'Custom operations role',
  isSystemPreset: false,
  isActive: true,
  createdAt,
  updatedAt: createdAt,
};

const permission = {
  id: permissionId,
  key: 'platform.organization.archive',
  description: 'Archive organizations',
};

const assignment = {
  roleId,
  permission,
  assignedAt: createdAt,
};

function serviceWith(prisma: Record<string, unknown>) {
  return new PlatformRolesService(prisma as never);
}

function transactionPrisma(transaction: Record<string, unknown>) {
  return {
    $transaction: jest.fn(
      (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  };
}

describe('PlatformRolesService', () => {
  it('lists safe roles with pagination, filters, and stable sorting', async () => {
    let findManyArgs: unknown;
    const prisma = {
      platformRole: {
        findMany: jest.fn((args: unknown) => {
          findManyArgs = args;
          return Promise.resolve([customRole]);
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
    };
    const service = serviceWith(prisma);

    await expect(
      service.findAll({
        page: 2,
        limit: 10,
        search: 'operations',
        isActive: true,
        isSystemPreset: false,
        sortBy: 'name',
        order: 'asc',
      }),
    ).resolves.toMatchObject({
      items: [customRole],
      page: 2,
      limit: 10,
      total: 1,
    });
    expect(findManyArgs).toMatchObject({
      where: { isActive: true, isSystemPreset: false },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 10,
      take: 10,
    });
    expect(
      (findManyArgs as { where: { OR: unknown[] } }).where.OR,
    ).toHaveLength(3);
  });

  it('creates an active non-system role without assigning permissions', async () => {
    let createArgs: unknown;
    const create = jest.fn((args: unknown) => {
      createArgs = args;
      return Promise.resolve(customRole);
    });
    const service = serviceWith({ platformRole: { create } });

    await expect(
      service.create({
        key: ' custom_operations ',
        name: ' Custom Operations ',
        description: ' Custom operations role ',
      }),
    ).resolves.toEqual(customRole);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          key: 'CUSTOM_OPERATIONS',
          name: 'Custom Operations',
          description: 'Custom operations role',
          isSystemPreset: false,
          isActive: true,
        },
      }),
    );
    expect(
      (createArgs as { data: Record<string, unknown> }).data,
    ).not.toHaveProperty('rolePermissions');
  });

  it('maps duplicate role keys or names to a controlled conflict', async () => {
    const service = serviceWith({
      platformRole: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    });

    await expect(
      service.create({ key: customRole.key, name: customRole.name }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates only custom role metadata and rejects system role updates', async () => {
    let updateArgs: unknown;
    const update = jest.fn((args: unknown) => {
      updateArgs = args;
      return Promise.resolve({ ...customRole, name: 'Renamed Operations' });
    });
    const service = serviceWith({
      platformRole: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(customRole)
          .mockResolvedValueOnce({ ...customRole, isSystemPreset: true }),
        update,
      },
    });

    await expect(
      service.update(roleId, { name: ' Renamed Operations ' }),
    ).resolves.toMatchObject({ name: 'Renamed Operations' });
    expect((updateArgs as { data: Record<string, unknown> }).data).toEqual({
      name: 'Renamed Operations',
      description: undefined,
    });
    await expect(
      service.update(roleId, { name: 'Forbidden' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deactivates and reactivates a custom role but rejects invalid transitions', async () => {
    const inactiveRole = { ...customRole, isActive: false };
    const transaction = {
      platformRole: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(customRole)
          .mockResolvedValueOnce(inactiveRole)
          .mockResolvedValueOnce(customRole),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce(inactiveRole)
          .mockResolvedValueOnce(customRole),
      },
    };
    const service = serviceWith(transactionPrisma(transaction));

    await expect(service.deactivate(roleId)).resolves.toMatchObject({
      isActive: false,
    });
    await expect(service.reactivate(roleId, actorId)).resolves.toMatchObject({
      isActive: true,
    });
    await expect(service.reactivate(roleId, actorId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects lifecycle mutations for a system preset role', async () => {
    const transaction = {
      platformRole: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...customRole, isSystemPreset: true }),
      },
    };
    const service = serviceWith(transactionPrisma(transaction));

    await expect(service.deactivate(roleId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows a grant only when the active actor has the permission through an active role', async () => {
    const create = jest.fn().mockResolvedValue(assignment);
    const transaction = {
      platformRole: { findUnique: jest.fn().mockResolvedValue(customRole) },
      permission: { findUnique: jest.fn().mockResolvedValue(permission) },
      platformStaff: {
        findFirst: jest.fn().mockResolvedValue({
          roles: [
            {
              role: {
                rolePermissions: [{ permissionId }],
              },
            },
          ],
        }),
      },
      platformRolePermission: { create },
    };
    const service = serviceWith(transactionPrisma(transaction));

    await expect(
      service.assignPermission(roleId, { permissionId }, actorId),
    ).resolves.toEqual(assignment);
    expect(transaction.platformStaff.findFirst).toHaveBeenCalledWith({
      where: { id: actorId, status: PlatformStaffStatus.ACTIVE },
      select: {
        roles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                rolePermissions: { select: { permissionId: true } },
              },
            },
          },
        },
      },
    });
  });

  it('reactivates a role only when its permissions are within actor authority', async () => {
    const inactiveRole = {
      ...customRole,
      isActive: false,
      rolePermissions: [{ permissionId }],
    };
    const allowedTransaction = {
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(inactiveRole),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(customRole),
      },
      platformStaff: {
        findFirst: jest.fn().mockResolvedValue({
          roles: [{ role: { rolePermissions: [{ permissionId }] } }],
        }),
      },
    };
    let deniedAuthorityArgs: unknown;
    const deniedTransaction = {
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(inactiveRole),
        updateMany: jest.fn(),
      },
      platformStaff: {
        findFirst: jest.fn((args: unknown) => {
          deniedAuthorityArgs = args;
          return Promise.resolve({ roles: [] });
        }),
      },
    };

    await expect(
      serviceWith(transactionPrisma(allowedTransaction)).reactivate(
        roleId,
        actorId,
      ),
    ).resolves.toMatchObject({ isActive: true });
    await expect(
      serviceWith(transactionPrisma(deniedTransaction)).reactivate(
        roleId,
        actorId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deniedTransaction.platformRole.updateMany).not.toHaveBeenCalled();
    expect(
      (
        deniedAuthorityArgs as {
          select: { roles: { where: Record<string, unknown> } };
        }
      ).select.roles.where,
    ).toEqual({ role: { isActive: true } });
  });

  it('blocks grants when the actor does not currently possess the permission', async () => {
    const transaction = {
      platformRole: { findUnique: jest.fn().mockResolvedValue(customRole) },
      permission: { findUnique: jest.fn().mockResolvedValue(permission) },
      platformStaff: { findFirst: jest.fn().mockResolvedValue(null) },
      platformRolePermission: { create: jest.fn() },
    };
    const service = serviceWith(transactionPrisma(transaction));

    await expect(
      service.assignPermission(roleId, { permissionId }, actorId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.platformRolePermission.create).not.toHaveBeenCalled();
  });

  it('blocks grants to inactive or system roles before writing', async () => {
    for (const role of [
      { ...customRole, isActive: false },
      { ...customRole, isSystemPreset: true },
    ]) {
      const transaction = {
        platformRole: { findUnique: jest.fn().mockResolvedValue(role) },
        permission: { findUnique: jest.fn().mockResolvedValue(permission) },
        platformStaff: { findFirst: jest.fn() },
        platformRolePermission: { create: jest.fn() },
      };
      const service = serviceWith(transactionPrisma(transaction));

      await expect(
        service.assignPermission(roleId, { permissionId }, actorId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transaction.platformStaff.findFirst).not.toHaveBeenCalled();
    }
  });

  it('removes a permission from an inactive custom role without a grant-subset check', async () => {
    const transaction = {
      platformRole: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...customRole, isActive: false }),
      },
      permission: { findUnique: jest.fn().mockResolvedValue(permission) },
      platformRolePermission: {
        findUnique: jest.fn().mockResolvedValue(assignment),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = serviceWith(transactionPrisma(transaction));

    await expect(
      service.removePermission(roleId, permissionId),
    ).resolves.toEqual(assignment);
    expect(transaction.platformRolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId, permissionId },
    });
    expect(transaction).not.toHaveProperty('platformStaff');
  });
});
