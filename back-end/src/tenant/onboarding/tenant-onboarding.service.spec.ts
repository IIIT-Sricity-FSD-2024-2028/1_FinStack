import { ConflictException } from '@nestjs/common';
import { Prisma, TenantRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { PlatformSubscriptionsService } from '../../platform/subscriptions/platform-subscriptions.service';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';

jest.mock('argon2');
const dto: RegisterOrganizationDto = {
  name: 'Acme Research',
  primaryEmail: 'office@acme.example.com',
  email: 'cm@acme.example.com',
  firstName: 'Config',
  lastName: 'Manager',
  registrationCountry: 'IN',
  registrationExemptionReason: 'Fictional unit test organization',
  authorizedContactTitle: 'Director',
  password: 'fixture-password-only',
  employeeCount: 3,
  planId: '20000000-0000-4000-8000-000000000001',
};
function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    organization: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(data),
      ),
    },
    plan: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: dto.planId, status: 'ACTIVE' }),
    },
    tenantUser: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          id: 'immutable-cm-uuid',
        }),
      ),
    },
    platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    ),
  };
  const subscriptions = {
    assignInTransaction: jest.fn().mockResolvedValue({}),
  };
  const service = new TenantOnboardingService(
    prisma as unknown as PrismaService,
    subscriptions as unknown as PlatformSubscriptionsService,
  );
  return { tx, prisma, subscriptions, service };
}
describe('registration-generated Configuration Manager identity', () => {
  beforeEach(() => {
    (argon2.hash as jest.Mock).mockResolvedValue('fixture-hash');
  });
  it('creates the stable organization UUID on the server and returns the generated ID without secrets', async () => {
    const { service, tx } = setup();
    const result = await service.register(dto);
    expect(result.organizationId).toMatch(/^[a-f0-9-]{36}$/);
    expect(result.employeeId).toMatch(
      new RegExp(
        `^ACM-${result.organizationId.replaceAll('-', '').toUpperCase()}-[A-F0-9]{20}$`,
      ),
    );
    expect(tx.tenantUser.create.mock.calls[0][0].data).toMatchObject({
      organizationId: result.organizationId,
      role: TenantRole.CONFIGURATION_MANAGER,
      passwordHash: 'fixture-hash',
    });
    expect(result.registrationStatus).toBe('PENDING_ORGANIZATION_REVIEW');
    expect(JSON.stringify(result)).not.toMatch(
      /fixture-password|fixture-hash|activationToken/,
    );
    expect(JSON.stringify(tx.platformAuditLog.create.mock.calls)).not.toMatch(
      /fixture-password|fixture-hash/,
    );
  });
  it('retries a generated ID collision using a fresh complete registration transaction with the same server-owned tenant UUID', async () => {
    const { service, tx, prisma, subscriptions } = setup();
    tx.tenantUser.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '6.19.1',
        meta: { modelName: 'TenantUser', target: ['employeeId'] },
      }),
    );
    await service.register(dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    const [first, second] = tx.tenantUser.create.mock.calls.map(
      ([args]) => args.data,
    );
    expect(first.organizationId).toBe(second.organizationId);
    expect(first.employeeId).not.toBe(second.employeeId);
    expect(subscriptions.assignInTransaction).toHaveBeenCalledTimes(1);
  });
  it('does not retry an email conflict', async () => {
    const { service, tx, prisma } = setup();
    tx.tenantUser.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '6.19.1',
        meta: { modelName: 'TenantUser', target: ['organizationId', 'email'] },
      }),
    );
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('keeps domain review and duplicate organization protection intact', async () => {
    const { service, tx, prisma } = setup();
    tx.organization.findFirst.mockResolvedValueOnce({ id: 'existing-org' });
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.organization.create).not.toHaveBeenCalled();
    expect(tx.tenantUser.create).not.toHaveBeenCalled();
  });
});
