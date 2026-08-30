import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlatformPlanFeaturesService } from './platform-plan-features.service';

const basePlan = {
  id: 'plan-uuid',
  key: 'STARTER',
};

const baseFeature = {
  id: 'feature-uuid',
  key: 'MAX_USERS',
  valueType: 'INTEGER',
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

describe('PlatformPlanFeaturesService', () => {
  it('assigns feature successfully', async () => {
    const create = jest.fn().mockResolvedValue(basePlanFeature);
    const auditLogCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: { findUnique: jest.fn().mockResolvedValue(baseFeature) },
      planFeature: { create },
      platformAuditLog: { create: auditLogCreate },
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.assign(
        'plan-uuid',
        { featureId: 'feature-uuid', enabled: true, value: 10 },
        'actor-id',
      ),
    ).resolves.toEqual(basePlanFeature);

    expect(create).toHaveBeenCalled();
  });

  it('throws ConflictException on duplicate assignment', async () => {
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: { findUnique: jest.fn().mockResolvedValue(baseFeature) },
      planFeature: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
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
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...baseFeature, valueType: 'BOOLEAN' }),
      },
      planFeature: { create: jest.fn().mockResolvedValue(basePlanFeature) },
      platformAuditLog: { create: jest.fn() },
    };
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
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...baseFeature, valueType: 'INTEGER' }),
      },
      planFeature: { create: jest.fn().mockResolvedValue(basePlanFeature) },
      platformAuditLog: { create: jest.fn() },
    };
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
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...baseFeature, valueType: 'DECIMAL' }),
      },
      planFeature: { create: jest.fn().mockResolvedValue(basePlanFeature) },
      platformAuditLog: { create: jest.fn() },
    };
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
    const prisma = {
      plan: { findUnique: jest.fn().mockResolvedValue(basePlan) },
      feature: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...baseFeature, valueType: 'STRING' }),
      },
      planFeature: { create: jest.fn().mockResolvedValue(basePlanFeature) },
      platformAuditLog: { create: jest.fn() },
    };
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
    const update = jest.fn().mockResolvedValue(basePlanFeature);
    const prisma = {
      planFeature: {
        findUnique: jest.fn().mockResolvedValue(basePlanFeature),
        update,
      },
      platformAuditLog: { create: jest.fn() },
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.update('plan-uuid', 'feature-uuid', { value: 20 }, 'actor-id'),
    ).resolves.toEqual(basePlanFeature);
    expect(update).toHaveBeenCalled();
  });

  it('removes plan feature successfully', async () => {
    const deleteMock = jest.fn().mockResolvedValue(basePlanFeature);
    const prisma = {
      planFeature: {
        findUnique: jest.fn().mockResolvedValue(basePlanFeature),
        delete: deleteMock,
      },
      platformAuditLog: { create: jest.fn() },
    };
    const service = serviceWithPrisma(prisma);

    await service.remove('plan-uuid', 'feature-uuid', 'actor-id');
    expect(deleteMock).toHaveBeenCalled();
  });
});
