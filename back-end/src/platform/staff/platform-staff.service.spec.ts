import {
  BadRequestException,
  ConflictException,
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
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ status: PlatformStaffStatus.INACTIVE })
      .mockResolvedValueOnce({
        ...baseStaff,
        status: PlatformStaffStatus.ACTIVE,
      });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const sessions = { revokeAllForStaff: jest.fn() };
    const service = serviceWith(
      { platformStaff: { findUnique, updateMany } },
      undefined,
      sessions,
    );

    await expect(service.reactivate(baseStaff.id)).resolves.toMatchObject({
      status: PlatformStaffStatus.ACTIVE,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: baseStaff.id, status: PlatformStaffStatus.INACTIVE },
      data: { status: PlatformStaffStatus.ACTIVE },
    });
    expect(sessions.revokeAllForStaff).not.toHaveBeenCalled();
  });

  it('rejects suspended staff reactivation', async () => {
    const service = serviceWith({
      platformStaff: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: PlatformStaffStatus.SUSPENDED }),
      },
    });

    await expect(service.reactivate(baseStaff.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
