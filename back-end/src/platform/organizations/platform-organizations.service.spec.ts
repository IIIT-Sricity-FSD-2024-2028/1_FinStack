import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationStatus, Prisma } from '@prisma/client';
import { PlatformOrganizationsService } from './platform-organizations.service';

const baseOrganization = {
  id: 'b85ec943-b23a-477c-9030-935d8a8edb78',
  name: 'Acme Finance',
  slug: 'acme-finance',
  primaryEmail: 'admin@acme.test',
  primaryContactName: null,
  primaryContactEmail: null,
  billingEmail: null,
  country: 'India',
  defaultCurrency: 'INR',
  timezone: 'Asia/Kolkata',
  status: OrganizationStatus.ACTIVE,
  externalCustomerRef: null,
  metadata: null,
  statusChangedAt: null,
  suspendedAt: null,
  cancelledAt: null,
  archivedAt: null,
  createdAt: new Date('2026-08-23T00:00:00.000Z'),
  updatedAt: new Date('2026-08-23T00:00:00.000Z'),
};

function serviceWithPrisma(prisma: Record<string, unknown>) {
  return new PlatformOrganizationsService(prisma as never);
}

describe('PlatformOrganizationsService', () => {
  it('lists organizations with search, status filter, and pagination metadata', async () => {
    const findMany = jest.fn((args: unknown) => {
      void args;
      return Promise.resolve([baseOrganization]);
    });
    const prisma = {
      organization: {
        findMany,
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.findAll({
        page: 2,
        limit: 10,
        search: 'acme',
        status: OrganizationStatus.ACTIVE,
        sortBy: 'createdAt',
        order: 'desc',
      }),
    ).resolves.toMatchObject({
      items: [baseOrganization],
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    const findManyArg = findMany.mock.calls[0]?.[0] as {
      skip: number;
      take: number;
      where: { status?: OrganizationStatus; OR?: unknown[] };
    };
    expect(findManyArg.skip).toBe(10);
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where.status).toBe(OrganizationStatus.ACTIVE);
    expect(Array.isArray(findManyArg.where.OR)).toBe(true);
  });

  it('updates metadata without accepting lifecycle status changes', async () => {
    const update = jest.fn((args: unknown) => {
      void args;
      return Promise.resolve({
        ...baseOrganization,
        metadata: { segment: 'enterprise' },
      });
    });
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(baseOrganization),
        update,
      },
    };
    const service = serviceWithPrisma(prisma);

    await service.update(baseOrganization.id, {
      metadata: { segment: 'enterprise' },
    });

    const updateArg = update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
      where: { id: string };
    };
    expect(updateArg.where.id).toBe(baseOrganization.id);
    expect(updateArg.data).not.toHaveProperty('status');
  });

  it('creates organizations in provisioning regardless of lifecycle input shape', async () => {
    const create = jest.fn((args: unknown) => {
      void args;
      return Promise.resolve({
        ...baseOrganization,
        status: OrganizationStatus.PROVISIONING,
      });
    });
    const service = serviceWithPrisma({
      organization: { create },
    });

    await service.create({
      name: 'Acme Finance',
      primaryEmail: 'ADMIN@ACME.TEST',
    });

    const createArg = create.mock.calls[0]?.[0] as {
      data: { status?: OrganizationStatus; primaryEmail?: string };
    };
    expect(createArg.data.status).toBe(OrganizationStatus.PROVISIONING);
    expect(createArg.data.primaryEmail).toBe('admin@acme.test');
  });

  it('rejects invalid lifecycle transitions', async () => {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseOrganization,
          status: OrganizationStatus.ARCHIVED,
        }),
      },
    };
    const service = serviceWithPrisma(prisma);

    await expect(service.suspend(baseOrganization.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reactivates only suspended organizations', async () => {
    const suspended = {
      ...baseOrganization,
      status: OrganizationStatus.SUSPENDED,
    };
    const update = jest.fn((args: unknown) => {
      void args;
      return Promise.resolve({
        ...suspended,
        status: OrganizationStatus.ACTIVE,
      });
    });
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(suspended),
        update,
      },
    };
    const service = serviceWithPrisma(prisma);

    await service.reactivate(baseOrganization.id);

    const updateArg = update.mock.calls[0]?.[0] as {
      data: { status?: OrganizationStatus; statusChangedAt?: unknown };
      where: { id: string };
    };
    expect(updateArg.where.id).toBe(baseOrganization.id);
    expect(updateArg.data.status).toBe(OrganizationStatus.ACTIVE);
    expect(updateArg.data.statusChangedAt).toBeInstanceOf(Date);
  });

  it('throws a consistent not-found error for missing organizations', async () => {
    const service = serviceWithPrisma({
      organization: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.findOne(baseOrganization.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps unique constraint failures to conflict errors', async () => {
    const service = serviceWithPrisma({
      organization: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    });

    await expect(
      service.create({
        name: 'Acme Finance',
        primaryEmail: 'admin@acme.test',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
