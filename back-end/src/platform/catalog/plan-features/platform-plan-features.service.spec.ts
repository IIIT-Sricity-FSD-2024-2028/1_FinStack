/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FeatureValueType, Prisma } from '@prisma/client';
import { PlatformPlanFeaturesService } from './platform-plan-features.service';

const basePlan = {
  id: 'plan-uuid',
  key: 'STARTER',
};

const baseFeature = {
  id: 'feature-uuid',
  key: 'MAX_USERS',
  valueType: FeatureValueType.INTEGER,
  isActive: true,
};

const basePlanFeature = {
  id: 'pf-uuid',
  planId: 'plan-uuid',
  featureId: 'feature-uuid',
  enabled: true,
  value: 10,
  feature: baseFeature,
  plan: basePlan,
};

function serviceWithPrisma(prisma: Record<string, unknown>) {
  return new PlatformPlanFeaturesService(prisma as never);
}

type TransactionCallback<TClient> = (tx: TClient) => Promise<unknown>;

function transactionWith<TClient>(txClient: TClient) {
  return jest.fn((callback: TransactionCallback<TClient>) =>
    callback(txClient),
  );
}

function prismaForFeatureValue(valueType: FeatureValueType) {
  const txClient = {
    planFeature: {
      create: jest.fn().mockResolvedValue(basePlanFeature),
    },
    platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  return {
    plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
    feature: {
      findUnique: jest.fn().mockResolvedValue({ ...baseFeature, valueType }),
    },
    $transaction: transactionWith(txClient),
  };
}

describe('PlatformPlanFeaturesService', () => {
  it('assigns feature successfully', async () => {
    const txCreate = jest.fn().mockResolvedValue(basePlanFeature);
    const txAuditLogCreate = jest.fn().mockResolvedValue({});
    const txClient = {
      planFeature: { create: txCreate },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: { findUnique: jest.fn().mockResolvedValue(baseFeature) },
      $transaction: transactionWith(txClient),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', enabled: true, value: 10 },
        'actor-id',
      ),
    ).resolves.toEqual(basePlanFeature);

    expect(txCreate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('fails the transaction if audit log creation fails during feature assignment', async () => {
    const txCreate = jest.fn().mockResolvedValue(basePlanFeature);
    const txAuditLogCreate = jest
      .fn()
      .mockRejectedValue(new Error('Audit failure'));
    const txClient = {
      planFeature: { create: txCreate },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: { findUnique: jest.fn().mockResolvedValue(baseFeature) },
      $transaction: transactionWith(txClient),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', enabled: true, value: 10 },
        'actor-id',
      ),
    ).rejects.toThrow('Audit failure');

    expect(txCreate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('throws ConflictException on duplicate assignment', async () => {
    const txClient = {
      planFeature: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    };
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: { findUnique: jest.fn().mockResolvedValue(baseFeature) },
      $transaction: transactionWith(txClient),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', enabled: true, value: 10 },
        'actor-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when plan is missing', async () => {
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign('missing-plan', { featureId: 'feature-uuid' }, 'actor-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when feature is missing', async () => {
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign('plan-uuid', { featureId: 'missing-feature' }, 'actor-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates BOOLEAN value type correctly', async () => {
    const prisma = prismaForFeatureValue(FeatureValueType.BOOLEAN);
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: true },
        'actor-id',
      ),
    ).resolves.toBeDefined();
    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: 'true' },
        'actor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates INTEGER value type correctly', async () => {
    const prisma = prismaForFeatureValue(FeatureValueType.INTEGER);
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: 10 },
        'actor-id',
      ),
    ).resolves.toBeDefined();
    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: 10.5 },
        'actor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates DECIMAL value type correctly', async () => {
    const prisma = prismaForFeatureValue(FeatureValueType.DECIMAL);
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: 10.5 },
        'actor-id',
      ),
    ).resolves.toBeDefined();
    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: '10' },
        'actor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates STRING value type correctly', async () => {
    const prisma = prismaForFeatureValue(FeatureValueType.STRING);
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: 'test' },
        'actor-id',
      ),
    ).resolves.toBeDefined();
    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', value: 10 },
        'actor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates plan feature successfully', async () => {
    const txUpdate = jest.fn().mockResolvedValue(basePlanFeature);
    const txAuditLogCreate = jest.fn().mockResolvedValue({});
    const txClient = {
      planFeature: { update: txUpdate },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      planFeature: {
        findUnique: jest.fn().mockResolvedValue(basePlanFeature),
      },
      $transaction: transactionWith(txClient),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.update('plan-uuid', 'feature-uuid', { value: 20 }, 'actor-id'),
    ).resolves.toEqual(basePlanFeature);

    expect(txUpdate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('fails the transaction if audit log creation fails during feature update', async () => {
    const txUpdate = jest.fn().mockResolvedValue(basePlanFeature);
    const txAuditLogCreate = jest
      .fn()
      .mockRejectedValue(new Error('Audit failure'));
    const txClient = {
      planFeature: { update: txUpdate },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      planFeature: {
        findUnique: jest.fn().mockResolvedValue(basePlanFeature),
      },
      $transaction: transactionWith(txClient),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.update('plan-uuid', 'feature-uuid', { value: 20 }, 'actor-id'),
    ).rejects.toThrow('Audit failure');

    expect(txUpdate).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('removes plan feature successfully', async () => {
    const txDelete = jest.fn().mockResolvedValue(basePlanFeature);
    const txAuditLogCreate = jest.fn().mockResolvedValue({});
    const txClient = {
      planFeature: { delete: txDelete },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      planFeature: {
        findUnique: jest.fn().mockResolvedValue(basePlanFeature),
      },
      $transaction: transactionWith(txClient),
    };
    const service = serviceWithPrisma(prisma);

    await service.remove('plan-uuid', 'feature-uuid', 'actor-id');

    expect(txDelete).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });

  it('fails the transaction if audit log creation fails during feature removal', async () => {
    const txDelete = jest.fn().mockResolvedValue(basePlanFeature);
    const txAuditLogCreate = jest
      .fn()
      .mockRejectedValue(new Error('Audit failure'));
    const txClient = {
      planFeature: { delete: txDelete },
      platformAuditLog: { create: txAuditLogCreate },
    };
    const prisma = {
      planFeature: {
        findUnique: jest.fn().mockResolvedValue(basePlanFeature),
      },
      $transaction: transactionWith(txClient),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.remove('plan-uuid', 'feature-uuid', 'actor-id'),
    ).rejects.toThrow('Audit failure');

    expect(txDelete).toHaveBeenCalled();
    expect(txAuditLogCreate).toHaveBeenCalled();
  });
});
