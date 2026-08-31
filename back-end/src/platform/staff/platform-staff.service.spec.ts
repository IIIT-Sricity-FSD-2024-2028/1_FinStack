import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PlatformStaffStatus, Prisma } from '@prisma/client';
import { PlatformStaffService } from './platform-staff.service';

const baseStaff = {
  id: 'b85ec943-b23a-477c-9030-935d8a8edb78',
  firstName: 'Platform',
  lastName: 'Staff',
  email: 'staff@example.test',
  status: PlatformStaffStatus.ACTIVE,
  lastLoginAt: null,
  createdAt: new Date('2026-08-25T00:00:00.000Z'),
  updatedAt: new Date('2026-08-25T00:00:00.000Z'),
};

const baseRole = {
  id: 'b2314442-9af1-42e8-8e01-d10e08b79880',
  key: 'SUPPORT_AGENT',
  name: 'Customer Support Agent',
  description: 'Support access',
  isSystemPreset: true,
  isActive: true,
};

const baseAssignment = {
  staffId: baseStaff.id,
  role: baseRole,
  assignedAt: new Date('2026-08-25T01:00:00.000Z'),
  assignedByStaffId: '896de305-f304-438e-812c-77256fd6710b',
};

function serviceWith(
  prisma: Record<string, unknown>,
  passwords: Record<string, unknown> = { hash: jest.fn() },
  sessions: Record<string, unknown> = { revokeAllForStaff: jest.fn() },
) {
  return new PlatformStaffService(
    prisma as never,
    passwords as never,
    sessions as never,
  );
}

describe('PlatformStaffService', () => {
  it('lists safe staff with search, status, sorting, and pagination', async () => {
    let capturedFindManyArgs: unknown;
    const findMany = jest.fn((args: unknown) => {
      capturedFindManyArgs = args;
      return Promise.resolve([baseStaff]);
    });
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      platformStaff: { findMany, count },
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
        search: 'platform',
        status: PlatformStaffStatus.ACTIVE,
        sortBy: 'email',
        order: 'asc',
      }),
    ).resolves.toMatchObject({
      items: [baseStaff],
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    const args = capturedFindManyArgs as {
      select: Record<string, boolean>;
      skip: number;
      take: number;
      where: { status: PlatformStaffStatus; OR: unknown[] };
    };
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.where.status).toBe(PlatformStaffStatus.ACTIVE);
    expect(args.where.OR).toHaveLength(3);
    expect(args.select).not.toHaveProperty('passwordHash');
  });

  it('creates active staff with existing password hashing and explicit fields', async () => {
    const create = jest.fn().mockResolvedValue(baseStaff);
    const hash = jest.fn().mockResolvedValue('argon2id-hash');
    const service = serviceWith({ platformStaff: { create } }, { hash });

    const result = await service.create({
      firstName: ' Platform ',
      lastName: ' Staff ',
      email: 'STAFF@EXAMPLE.TEST',
      initialPassword: 'Initial-password-2026!',
    });

    expect(hash).toHaveBeenCalledWith('Initial-password-2026!');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          firstName: 'Platform',
          lastName: 'Staff',
          email: 'staff@example.test',
          passwordHash: 'argon2id-hash',
          status: PlatformStaffStatus.ACTIVE,
        },
      }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('maps duplicate staff email to a controlled conflict', async () => {
    const service = serviceWith(
      {
        platformStaff: {
          create: jest.fn().mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Unique failed', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          ),
        },
      },
      { hash: jest.fn().mockResolvedValue('hash') },
    );

    await expect(
      service.create({
        firstName: 'Platform',
        lastName: 'Staff',
        email: 'staff@example.test',
        initialPassword: 'Initial-password-2026!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns a controlled not-found error for missing staff', async () => {
    const service = serviceWith({
      platformStaff: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.findOne(baseStaff.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists assigned roles with a safe stable projection', async () => {
    let capturedFindManyArgs: unknown;
    const service = serviceWith({
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue({ id: baseStaff.id }),
      },
      platformStaffRole: {
        findMany: jest.fn((args: unknown) => {
          capturedFindManyArgs = args;
          return Promise.resolve([baseAssignment]);
        }),
      },
    });

    await expect(service.findAssignedRoles(baseStaff.id)).resolves.toEqual([
      baseAssignment,
    ]);
    const args = capturedFindManyArgs as {
      orderBy: Array<Record<string, unknown>>;
      select: Record<string, unknown>;
    };
    expect(args.orderBy).toEqual([
      { role: { name: 'asc' } },
      { role: { key: 'asc' } },
    ]);
    expect(args.select).not.toHaveProperty('staff');
    expect(args.select).not.toHaveProperty('rolePermissions');
  });

  it('assigns an active role with authenticated actor attribution', async () => {
    const create = jest.fn().mockResolvedValue(baseAssignment);
    const transaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.INACTIVE }),
      },
      platformRole: { findUnique: jest.fn().mockResolvedValue(baseRole) },
      platformStaffRole: { create },
    };
    const service = serviceWith({
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    });

    await expect(
      service.assignRole(
        baseStaff.id,
        { roleId: baseRole.id },
        baseAssignment.assignedByStaffId,
      ),
    ).resolves.toEqual(baseAssignment);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          staffId: baseStaff.id,
          roleId: baseRole.id,
          assignedByStaffId: baseAssignment.assignedByStaffId,
        },
      }),
    );
  });

  it('allows role assignment only when target permissions are within actor authority', async () => {
    const permissionId = 'ca55aa6f-b715-44d3-8903-bb213d5f6a08';
    const strongerRole = {
      ...baseRole,
      rolePermissions: [{ permissionId }],
    };
    const allowedTransaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
        findFirst: jest.fn().mockResolvedValue({
          roles: [{ role: { rolePermissions: [{ permissionId }] } }],
        }),
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(strongerRole),
      },
      platformStaffRole: {
        create: jest.fn().mockResolvedValue(baseAssignment),
      },
    };
    const deniedTransaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
        findFirst: jest.fn().mockResolvedValue({ roles: [] }),
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(strongerRole),
      },
      platformStaffRole: { create: jest.fn() },
    };

    await expect(
      serviceWith({
        $transaction: jest.fn(
          (
            operation: (client: typeof allowedTransaction) => Promise<unknown>,
          ) => operation(allowedTransaction),
        ),
      }).assignRole(
        baseStaff.id,
        { roleId: strongerRole.id },
        baseAssignment.assignedByStaffId,
      ),
    ).resolves.toEqual(baseAssignment);
    await expect(
      serviceWith({
        $transaction: jest.fn(
          (operation: (client: typeof deniedTransaction) => Promise<unknown>) =>
            operation(deniedTransaction),
        ),
      }).assignRole(baseStaff.id, { roleId: strongerRole.id }, baseStaff.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deniedTransaction.platformStaffRole.create).not.toHaveBeenCalled();
  });

  it('rejects assignment to suspended staff or from an inactive role', async () => {
    const suspendedTransaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.SUSPENDED }),
      },
      platformRole: { findUnique: jest.fn().mockResolvedValue(baseRole) },
    };
    const suspendedService = serviceWith({
      $transaction: jest.fn(
        (
          operation: (client: typeof suspendedTransaction) => Promise<unknown>,
        ) => operation(suspendedTransaction),
      ),
    });
    const inactiveRoleTransaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
      },
      platformRole: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...baseRole, isActive: false }),
      },
    };
    const inactiveRoleService = serviceWith({
      $transaction: jest.fn(
        (
          operation: (
            client: typeof inactiveRoleTransaction,
          ) => Promise<unknown>,
        ) => operation(inactiveRoleTransaction),
      ),
    });

    await expect(
      suspendedService.assignRole(
        baseStaff.id,
        { roleId: baseRole.id },
        baseAssignment.assignedByStaffId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      inactiveRoleService.assignRole(
        baseStaff.id,
        { roleId: baseRole.id },
        baseAssignment.assignedByStaffId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps duplicate role assignment to a controlled conflict', async () => {
    const transaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
      },
      platformRole: { findUnique: jest.fn().mockResolvedValue(baseRole) },
      platformStaffRole: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    };
    const service = serviceWith({
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    });

    await expect(
      service.assignRole(
        baseStaff.id,
        { roleId: baseRole.id },
        baseAssignment.assignedByStaffId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks a non-Super-Admin from assigning Super Admin to themselves', async () => {
    const superAdminRole = {
      ...baseRole,
      key: 'PLATFORM_SUPER_ADMIN',
      name: 'Platform Super Admin',
    };
    const transaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(superAdminRole),
      },
      platformStaffRole: { create: jest.fn() },
    };
    const service = serviceWith({
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    });

    await expect(
      service.assignRole(
        baseStaff.id,
        { roleId: superAdminRole.id },
        baseStaff.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.platformStaffRole.create).not.toHaveBeenCalled();
  });

  it('allows an effective Super Admin to assign the Super Admin role', async () => {
    const superAdminRole = {
      ...baseRole,
      key: 'PLATFORM_SUPER_ADMIN',
      name: 'Platform Super Admin',
    };
    const assignment = { ...baseAssignment, role: superAdminRole };
    const transaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: baseAssignment.assignedByStaffId }),
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(superAdminRole),
      },
      platformStaffRole: {
        create: jest.fn().mockResolvedValue(assignment),
      },
    };
    const service = serviceWith({
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    });

    await expect(
      service.assignRole(
        baseStaff.id,
        { roleId: superAdminRole.id },
        baseAssignment.assignedByStaffId,
      ),
    ).resolves.toEqual(assignment);
  });

  it('blocks a non-Super-Admin from removing a Super Admin assignment', async () => {
    const superAdminRole = {
      ...baseRole,
      key: 'PLATFORM_SUPER_ADMIN',
      name: 'Platform Super Admin',
    };
    const assignment = { ...baseAssignment, role: superAdminRole };
    const transaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn(),
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(superAdminRole),
      },
      platformStaffRole: {
        findUnique: jest.fn().mockResolvedValue(assignment),
        deleteMany: jest.fn(),
      },
    };
    const service = serviceWith({
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    });

    await expect(
      service.removeRole(baseStaff.id, superAdminRole.id, 'non-super-admin-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.platformStaff.count).not.toHaveBeenCalled();
    expect(transaction.platformStaffRole.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks removal of the last effective Super Admin assignment', async () => {
    const superAdminRole = {
      ...baseRole,
      key: 'PLATFORM_SUPER_ADMIN',
      name: 'Platform Super Admin',
    };
    const assignment = { ...baseAssignment, role: superAdminRole };
    const transaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: baseAssignment.assignedByStaffId }),
        count: jest.fn().mockResolvedValue(1),
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(superAdminRole),
      },
      platformStaffRole: {
        findUnique: jest.fn().mockResolvedValue(assignment),
        deleteMany: jest.fn(),
      },
    };
    const service = serviceWith({
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    });

    await expect(
      service.removeRole(
        baseStaff.id,
        superAdminRole.id,
        baseAssignment.assignedByStaffId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.platformStaffRole.deleteMany).not.toHaveBeenCalled();
  });

  it('removes a Super Admin assignment when another remains', async () => {
    const superAdminRole = {
      ...baseRole,
      key: 'PLATFORM_SUPER_ADMIN',
      name: 'Platform Super Admin',
    };
    const assignment = { ...baseAssignment, role: superAdminRole };
    const transaction = {
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.ACTIVE }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: baseAssignment.assignedByStaffId }),
        count: jest.fn().mockResolvedValue(2),
      },
      platformRole: {
        findUnique: jest.fn().mockResolvedValue(superAdminRole),
      },
      platformStaffRole: {
        findUnique: jest.fn().mockResolvedValue(assignment),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (
          operation: (client: typeof transaction) => Promise<unknown>,
          options?: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) => {
          void options;
          return operation(transaction);
        },
      ),
    };
    const service = serviceWith(prisma);

    await expect(
      service.removeRole(
        baseStaff.id,
        superAdminRole.id,
        baseAssignment.assignedByStaffId,
      ),
    ).resolves.toEqual(assignment);
    expect(transaction.platformStaffRole.deleteMany).toHaveBeenCalledWith({
      where: { staffId: baseStaff.id, roleId: superAdminRole.id },
    });
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('blocks deactivation of the last effective active Super Admin', async () => {
    const transaction = {
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue({
          id: baseStaff.id,
          status: PlatformStaffStatus.ACTIVE,
          roles: [{ roleId: 'super-admin-role' }],
        }),
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const sessions = { revokeAllForStaff: jest.fn() };
    const service = serviceWith(prisma, undefined, sessions);

    await expect(
      service.deactivate(baseStaff.id, 'different-staff-id'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.platformStaff.updateMany).not.toHaveBeenCalled();
    expect(sessions.revokeAllForStaff).not.toHaveBeenCalled();
  });

  it('atomically deactivates a Super Admin when another remains', async () => {
    const inactive = { ...baseStaff, status: PlatformStaffStatus.INACTIVE };
    const transaction = {
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue({
          id: baseStaff.id,
          status: PlatformStaffStatus.ACTIVE,
          roles: [{ roleId: 'super-admin-role' }],
        }),
        count: jest.fn().mockResolvedValue(2),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(inactive),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (
          operation: (client: typeof transaction) => Promise<unknown>,
          options?: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) => {
          void options;
          return operation(transaction);
        },
      ),
    };
    const sessions = {
      revokeAllForStaff: jest.fn().mockResolvedValue(undefined),
    };
    const service = serviceWith(prisma, undefined, sessions);

    await expect(
      service.deactivate(baseStaff.id, 'different-staff-id'),
    ).resolves.toMatchObject({ status: PlatformStaffStatus.INACTIVE });
    expect(sessions.revokeAllForStaff).toHaveBeenCalledWith(
      baseStaff.id,
      transaction,
    );
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('reactivates only inactive staff and does not recreate sessions', async () => {
    const transaction = {
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue({
          status: PlatformStaffStatus.INACTIVE,
          roles: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...baseStaff,
          status: PlatformStaffStatus.ACTIVE,
        }),
      },
    };
    const sessions = { revokeAllForStaff: jest.fn() };
    const service = serviceWith(
      {
        $transaction: jest.fn(
          (operation: (client: typeof transaction) => Promise<unknown>) =>
            operation(transaction),
        ),
      },
      undefined,
      sessions,
    );

    await expect(
      service.reactivate(baseStaff.id, baseAssignment.assignedByStaffId),
    ).resolves.toMatchObject({ status: PlatformStaffStatus.ACTIVE });
    expect(transaction.platformStaff.updateMany).toHaveBeenCalledWith({
      where: { id: baseStaff.id, status: PlatformStaffStatus.INACTIVE },
      data: { status: PlatformStaffStatus.ACTIVE },
    });
    expect(sessions.revokeAllForStaff).not.toHaveBeenCalled();
  });

  it('reactivates staff only when restored permissions are within actor authority', async () => {
    const permissionId = '0f575087-fe13-426f-941d-2eadc9a8f857';
    const target = {
      status: PlatformStaffStatus.INACTIVE,
      roles: [
        {
          role: {
            key: 'CUSTOM_OPERATIONS',
            rolePermissions: [{ permissionId }],
          },
        },
      ],
    };
    const allowedTransaction = {
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue(target),
        findFirst: jest.fn().mockResolvedValue({
          roles: [{ role: { rolePermissions: [{ permissionId }] } }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseStaff),
      },
    };
    const deniedTransaction = {
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue(target),
        findFirst: jest.fn().mockResolvedValue({ roles: [] }),
        updateMany: jest.fn(),
      },
    };

    await expect(
      serviceWith({
        $transaction: jest.fn(
          (
            operation: (client: typeof allowedTransaction) => Promise<unknown>,
          ) => operation(allowedTransaction),
        ),
      }).reactivate(baseStaff.id, baseAssignment.assignedByStaffId),
    ).resolves.toEqual(baseStaff);
    await expect(
      serviceWith({
        $transaction: jest.fn(
          (operation: (client: typeof deniedTransaction) => Promise<unknown>) =>
            operation(deniedTransaction),
        ),
      }).reactivate(baseStaff.id, baseAssignment.assignedByStaffId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deniedTransaction.platformStaff.updateMany).not.toHaveBeenCalled();
  });

  it('requires an effective Super Admin to reactivate a Super Admin target', async () => {
    const permissionId = '9f30bfd2-8276-4304-b440-bd4ea5bed09f';
    const target = {
      status: PlatformStaffStatus.INACTIVE,
      roles: [
        {
          role: {
            key: 'PLATFORM_SUPER_ADMIN',
            rolePermissions: [{ permissionId }],
          },
        },
      ],
    };
    const transaction = {
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue(target),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            roles: [{ role: { rolePermissions: [{ permissionId }] } }],
          })
          .mockResolvedValueOnce(null),
        updateMany: jest.fn(),
      },
    };

    await expect(
      serviceWith({
        $transaction: jest.fn(
          (operation: (client: typeof transaction) => Promise<unknown>) =>
            operation(transaction),
        ),
      }).reactivate(baseStaff.id, baseAssignment.assignedByStaffId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.platformStaff.updateMany).not.toHaveBeenCalled();
  });

  it('rejects suspended staff reactivation', async () => {
    const transaction = {
      platformStaff: {
        findUnique: jest.fn().mockResolvedValue({
          status: PlatformStaffStatus.SUSPENDED,
          roles: [],
        }),
      },
    };
    const service = serviceWith({
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    });

    await expect(
      service.reactivate(baseStaff.id, baseAssignment.assignedByStaffId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
