/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FeatureValueType, Prisma } from '@prisma/client';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { ListFeaturesQueryDto } from './dto/list-features-query.dto';
import { PlatformFeaturesService } from './platform-features.service';

const baseFeature = {
  id: 'feature-uuid',
  key: 'MAX_USERS',
  name: 'Max Users',
  description: 'Maximum number of users',
  valueType: 'INTEGER',
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function serviceWithPrisma(prisma: Record<string, unknown>) {
  return new PlatformFeaturesService(prisma as never);
}

type TransactionCallback<TClient> = (tx: TClient) => Promise<unknown>;

function transactionWith<TClient>(txClient: TClient) {
  return jest.fn((callback: TransactionCallback<TClient>) =>
    callback(txClient),
  );
}

describe('PlatformFeaturesService', () => {
  it('lists features with search, status filter, and pagination', async () => {
    const findMany = jest
      .fn<Promise<(typeof baseFeature)[]>, [Prisma.FeatureFindManyArgs]>()
      .mockResolvedValue([baseFeature]);

    const prisma = {
      feature: {
        findMany,
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest
        .fn()
        .mockImplementation((ops: Array<Promise<unknown>>) => Promise.all(ops)),
    };

    const service = serviceWithPrisma(prisma);

    const query: ListFeaturesQueryDto = {
      page: 1,
      limit: 20,
      search: 'MAX',
      isActive: false,
      sortBy: 'createdAt',
      order: 'desc',
    };

    await expect(service.findAll(query)).resolves.toMatchObject({
      items: [baseFeature],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });

    const findManyArg = findMany.mock.calls[0]?.[0];
    const where = findManyArg.where;

    expect(where).toBeDefined();

    if (!where) {
      throw new Error('Expected feature query filters.');
    }

    expect(findManyArg.skip).toBe(0);
    expect(findManyArg.take).toBe(20);
    expect(where.isActive).toBe(false);
    expect(Array.isArray(where.OR)).toBe(true);
  });

  it('creates a feature successfully', async () => {
    const txCreate = jest.fn().mockResolvedValue(baseFeature);
    const txAuditLogCreate = jest.fn().mockResolvedValue({});

    const txClient = {
      feature: { create: txCreate },
      platformAuditLog: { create: txAuditLogCreate },
    };

    const prisma = {
      $transaction: transactionWith(txClient),
    };

    const service = serviceWithPrisma(prisma);

    const dto: CreateFeatureDto = {
      key: 'MAX_USERS',
      name: 'Max Users',
      valueType: FeatureValueType.INTEGER,
    };

    await expect(service.create(dto, 'actor-id')).resolves.toEqual(baseFeature);

    expect(txCreate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('fails the transaction if audit log creation fails during feature creation', async () => {
    const txCreate = jest.fn().mockResolvedValue(baseFeature);

    const txAuditLogCreate = jest
      .fn()
      .mockRejectedValue(new Error('Audit failure'));

    const txClient = {
      feature: { create: txCreate },
      platformAuditLog: { create: txAuditLogCreate },
    };

    const prisma = {
      $transaction: transactionWith(txClient),
    };

    const service = serviceWithPrisma(prisma);

    const dto: CreateFeatureDto = {
      key: 'MAX_USERS',
      name: 'Max Users',
      valueType: FeatureValueType.INTEGER,
    };

    await expect(service.create(dto, 'actor-id')).rejects.toThrow(
      'Audit failure',
    );

    expect(txCreate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('throws NotFoundException when feature is missing', async () => {
    const prisma = {
      feature: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const service = serviceWithPrisma(prisma);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects activating an already active feature', async () => {
    const prisma = {
      feature: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...baseFeature, isActive: true }),
      },
    };

    const service = serviceWithPrisma(prisma);

    await expect(
      service.activate('feature-uuid', 'actor-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects deactivating an already inactive feature', async () => {
    const prisma = {
      feature: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...baseFeature, isActive: false }),
      },
    };

    const service = serviceWithPrisma(prisma);

    await expect(
      service.deactivate('feature-uuid', 'actor-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects immutable key/valueType update', async () => {
    const update = jest
      .fn<Promise<typeof baseFeature>, [Prisma.FeatureUpdateArgs]>()
      .mockResolvedValue(baseFeature);

    const txClient = {
      feature: { update },
      platformAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      feature: {
        findUnique: jest.fn().mockResolvedValue(baseFeature),
      },
      $transaction: transactionWith(txClient),
    };

    const service = serviceWithPrisma(prisma);

    await service.update(
      'feature-uuid',
      { name: 'New Name' },
      'actor-id',
    );

    const updateArg = update.mock.calls[0]?.[0];

    expect(updateArg.data).toHaveProperty('name');
    expect(updateArg.data).not.toHaveProperty('key');
    expect(updateArg.data).not.toHaveProperty('valueType');
  });
});