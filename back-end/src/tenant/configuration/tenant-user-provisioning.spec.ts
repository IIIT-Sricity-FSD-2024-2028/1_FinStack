import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, TenantRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { auditContext, AuditActor } from '../audit/tenant-audit-context';
import { TenantConfigurationService } from './tenant-configuration.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';

jest.mock('argon2');
const organizationId = '10000000-0000-4000-8000-000000000001';
const managerId = '20000000-0000-4000-8000-000000000001';
const dto: CreateTenantUserDto = {
  firstName: ' Alex ',
  lastName: ' Tester ',
  email: ' ALEX@example.test ',
  initialPassword: 'fixture-password-only',
  role: TenantRole.EXPENSE_SUBMITTER,
  department: 'Research',
  managerId,
};
const actor: AuditActor = {
  organizationId,
  actorUserId: 'cm-user',
  actorName: 'CM',
  actorKind: 'USER',
  actorRole: TenantRole.CONFIGURATION_MANAGER,
};
function unique(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '6.19.1',
    meta: { target, modelName: 'TenantUser' },
  });
}
function setup() {
  const create = jest.fn(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      ...data,
      id: 'immutable-user-uuid',
      status: 'ACTIVE',
      credentialSetupRequired: false,
      manager: {
        id: managerId,
        employeeId: 'OLD-MGR',
        firstName: 'Reporting',
        lastName: 'Manager',
      },
      _count: { directReports: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    tenantUser: {
      create,
      findFirst: jest.fn().mockResolvedValue({
        id: managerId,
        status: 'ACTIVE',
        credentialSetupRequired: false,
      }),
    },
    tenantAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    organization: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: organizationId, name: 'Acme Research' }),
    },
    tenantUser: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    ),
  };
  const service = new TenantConfigurationService(
    prisma as unknown as PrismaService,
  );
  const run = (input: CreateTenantUserDto = dto) =>
    auditContext.run(actor, () => service.createUser(organizationId, input));
  return { prisma, tx, create, service, run };
}
describe('tenant-safe individual provisioning', () => {
  beforeEach(() => {
    (argon2.hash as jest.Mock).mockResolvedValue('fixture-hash');
  });
  it('generates from the authenticated tenant and preserves the manager, role, password setup and safe audit', async () => {
    const { prisma, tx, create, run } = setup();
    const result = await run();
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    expect(result).toMatchObject({
      id: 'immutable-user-uuid',
      employeeId: expect.stringMatching(
        /^ACM-10000000000040008000000000000001-[A-F0-9]{20}$/,
      ) as unknown,
      managerId,
      role: TenantRole.EXPENSE_SUBMITTER,
      credentialSetupRequired: false,
    });
    expect(tx.tenantUser.findFirst).toHaveBeenCalledWith({
      where: { id: managerId, organizationId },
      select: expect.any(Object) as unknown,
    });
    expect(create.mock.calls[0][0].data).toMatchObject({
      organizationId,
      passwordHash: 'fixture-hash',
      email: 'alex@example.test',
      firstName: 'Alex',
      managerId,
      department: 'Research',
    });
    expect(argon2.hash).toHaveBeenCalledWith(dto.initialPassword, {
      type: argon2.argon2id,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /password|fixture-hash|activationToken/i,
    );
    expect(JSON.stringify(tx.tenantAuditLog.create.mock.calls)).not.toMatch(
      /fixture-password|fixture-hash|activationToken/i,
    );
    expect(tx.tenantAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          eventCode: 'employee.created',
        }) as unknown,
      }),
    );
  });
  it('restarts the entire transaction for an employeeId collision rather than using an aborted transaction', async () => {
    const { prisma, create, run } = setup();
    create.mockRejectedValueOnce(unique(['employeeId']));
    await run();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data.employeeId).not.toBe(
      create.mock.calls[1][0].data.employeeId,
    );
  });
  it('returns conflict for a duplicate email without attempting new IDs', async () => {
    const { prisma, create, run } = setup();
    create.mockRejectedValueOnce(unique(['organizationId', 'email']));
    await expect(run()).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('preserves explicit legacy IDs and reports duplicates without silently replacing them', async () => {
    const { prisma, create, run } = setup();
    expect(await run({ ...dto, employeeId: ' OLD-123 ' })).toMatchObject({
      employeeId: 'OLD-123',
    });
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    create.mockRejectedValueOnce(unique(['employeeId']));
    await expect(run({ ...dto, employeeId: 'OLD-123' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('denies a cross-tenant reporting manager before creating an account', async () => {
    const { tx, create, run } = setup();
    tx.tenantUser.findFirst.mockResolvedValueOnce(null);
    await expect(run()).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
  it('denies inactive or setup-incomplete reporting managers', async () => {
    for (const manager of [
      { id: managerId, status: 'INACTIVE', credentialSetupRequired: false },
      { id: managerId, status: 'ACTIVE', credentialSetupRequired: true },
    ]) {
      const { tx, create, run } = setup();
      tx.tenantUser.findFirst.mockResolvedValueOnce(manager);
      await expect(run()).rejects.toBeInstanceOf(ConflictException);
      expect(create).not.toHaveBeenCalled();
    }
  });
  it('cannot provision for a missing tenant', async () => {
    const { prisma, create, run } = setup();
    prisma.organization.findUnique.mockResolvedValueOnce(null);
    await expect(run()).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
  it('keeps cross-tenant employee updates inaccessible', async () => {
    const { prisma, service } = setup();
    await expect(
      service.updateUser(organizationId, 'other-tenant-user', {
        firstName: 'Changed',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tenantUser.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-tenant-user', organizationId },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
