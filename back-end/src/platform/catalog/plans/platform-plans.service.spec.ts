/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingInterval, PlanStatus, Prisma } from '@prisma/client';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansQueryDto } from './dto/list-plans-query.dto';
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

type TransactionCallback<TClient> = (tx: TClient) => Promise<unknown>;

function transactionWith<TClient>(txClient: TClient) {
  return jest.fn((callback: TransactionCallback<TClient>) =>
    callback(txClient),
  );
}

describe('PlatformPlansService', () => {
  it('lists plans with search, status filter, and pagination', async () => {
    const findMany = jest
      .fn<Promise<(typeof basePlan)[]>, [Prisma.PlanFindManyArgs]>()
      .mockResolvedValue([basePlan]);
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

    const query: ListPlansQueryDto = {
      page: 2,
      limit: 10,
      search: 'START',
      status: PlanStatus.INACTIVE,
      sortBy: 'createdAt',
      order: 'desc',
    };

    await expect(service.findAll(query)).resolves.toMatchObject({
      items: [basePlan],
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    const findManyArg = findMany.mock.calls[0]?.[0];
    const where = findManyArg.where;
    expect(where).toBeDefined();
    if (!where) throw new Error('Expected plan query filters.');
    expect(findManyArg.skip).toBe(10);
    expect(findManyArg.take).toBe(10);
    expect(where.status).toBe('INACTIVE');
    expect(Array.isArray(where.OR)).toBe(true);
  });

  it('lists active tenant plans with assigned feature values', async () => {
    const prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...basePlan,
            status: 'ACTIVE',
            planFeatures: [
              {
                enabled: true,
                value: 25,
                createdAt: new Date(),
                feature: {
                  key: 'MAX_USERS',
                  name: 'Maximum Users',
                  valueType: 'INTEGER',
                  isActive: true,
                },
              },
            ],
          },
        ]),
      },
    };
    const service = serviceWithPrisma(prisma);

    await expect(service.findActivePlansForTenant()).resolves.toMatchObject({
      items: [
        {
          key: 'STARTER',
          features: [
            {
              key: 'MAX_USERS',
              name: 'Maximum Users',
              valueType: 'INTEGER',
              value: 25,
              enabled: true,
            },
          ],
        },
      ],
      total: 1,
    });

    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        include: expect.objectContaining({
          planFeatures: expect.any(Object),
        }),
      }),
    );
  });

  it('filters inactive feature assignments from tenant plan payloads', async () => {
    const prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...basePlan,
            status: 'ACTIVE',
            planFeatures: [
              {
                enabled: true,
                value: true,
                createdAt: new Date(),
                feature: {
                  key: 'AI_RISK_SCORING',
                  name: 'AI Risk Scoring',
                  valueType: 'BOOLEAN',
                  isActive: false,
                },
              },
            ],
          },
        ]),
      },
    };
    const service = serviceWithPrisma(prisma);

    const result = await service.findActivePlansForTenant();

    expect(result.items[0].features).toEqual([]);
  });

  it('creates a plan successfully', async () => {
    const txCreate = jest.fn().mockResolvedValue(basePlan);
    const txAuditLogCreate = jest.fn().mockResolvedValue({});
    const txClient = {
      plan: { create: txCreate },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = { $transaction: transactionWith(txClient) };
    const service = serviceWithPrisma(prisma);

    const dto: CreatePlanDto = {
      key: 'STARTER',
      name: 'Starter Plan',
      billingInterval: BillingInterval.MONTHLY,
      basePrice: '9.99',
    };

    await expect(service.create(dto, 'actor-id')).resolves.toEqual(basePlan);

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
    const prisma = { $transaction: transactionWith(txClient) };
    const service = serviceWithPrisma(prisma);

    const dto: CreatePlanDto = {
      key: 'STARTER',
      name: 'Starter Plan',
      billingInterval: BillingInterval.MONTHLY,
      basePrice: '9.99',
    };

    await expect(service.create(dto, 'actor-id')).rejects.toThrow(
      'Audit failure',
    );

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
    const prisma = { $transaction: transactionWith(txClient) };
    const service = serviceWithPrisma(prisma);

    const dto: CreatePlanDto = {
      key: 'DUP',
      name: 'Dup',
      billingInterval: BillingInterval.MONTHLY,
      basePrice: '0',
    };

    await expect(service.create(dto, 'actor-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NotFoundException when plan is missing', async () => {
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(null) },
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
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.deactivate('plan-uuid', 'actor-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
