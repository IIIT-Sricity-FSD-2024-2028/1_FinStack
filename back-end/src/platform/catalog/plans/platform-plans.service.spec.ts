import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlatformPlansService } from './platform-plans.service';

const basePlan = {
  id: 'plan-uuid',
  key: 'STARTER',
  name: 'Starter Plan',
  description: 'A basic starter plan',
  billingInterval: 'MONTHLY',
  basePrice: new Prisma.Decimal(9.99),
  currency: 'USD',
  trialDays: 14,
  status: 'INACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function serviceWithPrisma(prisma: Record<string, unknown>) {
  return new PlatformPlansService(prisma as never);
}

describe('PlatformPlansService', () => {
  it('lists plans with search, status filter, and pagination', async () => {
    const findMany = jest.fn().mockResolvedValue([basePlan]);
    const prisma = {
      plan: {
        findMany,
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest
        .fn()
        .mockImplementation((ops: Array<Promise<unknown>>) => Promise.all(ops)),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.findAll({
        page: 2,
        limit: 10,
        search: 'START',
        status: 'INACTIVE',
        sortBy: 'createdAt',
        order: 'desc',
      } as any),
    ).resolves.toMatchObject({
      items: [basePlan],
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    const findManyArg = findMany.mock.calls[0]?.[0];
    expect(findManyArg.skip).toBe(10);
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where.status).toBe('INACTIVE');
    expect(Array.isArray(findManyArg.where.OR)).toBe(true);
  });

  it('creates a plan successfully', async () => {
    const txCreate = jest.fn().mockResolvedValue(basePlan);
    const txAuditLogCreate = jest.fn().mockResolvedValue({});
    const txClient = {
      plan: { create: txCreate },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (Array.isArray(cb)) return Promise.all(cb);
        return cb(txClient);
      }),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.create(
        {
          key: 'STARTER',
          name: 'Starter Plan',
          billingInterval: 'MONTHLY',
          basePrice: '9.99',
        } as any,
        'actor-id',
      ),
    ).resolves.toEqual(basePlan);

    expect(txCreate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('fails the transaction if audit log creation fails during plan creation', async () => {
    const txCreate = jest.fn().mockResolvedValue(basePlan);
    const txAuditLogCreate = jest
      .fn()
      .mockRejectedValue(new Error('Audit failure'));
    const txClient = {
      plan: { create: txCreate },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (Array.isArray(cb)) return Promise.all(cb);
        return cb(txClient);
      }),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.create(
        {
          key: 'STARTER',
          name: 'Starter Plan',
          billingInterval: 'MONTHLY',
          basePrice: '9.99',
        } as any,
        'actor-id',
      ),
    ).rejects.toThrow('Audit failure');

    expect(txCreate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('throws ConflictException on duplicate key or name during creation', async () => {
    const txCreate = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const txClient = {
      plan: { create: txCreate },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (Array.isArray(cb)) return Promise.all(cb);
        return cb(txClient);
      }),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.create(
        {
          key: 'DUP',
          name: 'Dup',
          billingInterval: 'MONTHLY',
          basePrice: '0',
        } as any,
        'actor-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when plan is missing', async () => {
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (Array.isArray(cb)) return Promise.all(cb);
        return cb(prisma);
      }),
    };
    const service = serviceWithPrisma(prisma);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects activating an already ACTIVE plan', async () => {
    const prisma = {
      plan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...basePlan, status: 'ACTIVE' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (Array.isArray(cb)) return Promise.all(cb);
        return cb(prisma);
      }),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.activate('plan-uuid', 'actor-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects deactivating an already INACTIVE plan', async () => {
    const prisma = {
      plan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...basePlan, status: 'INACTIVE' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (Array.isArray(cb)) return Promise.all(cb);
        return cb(prisma);
      }),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.deactivate('plan-uuid', 'actor-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
