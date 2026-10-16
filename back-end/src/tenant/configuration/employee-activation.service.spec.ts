import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { auditContext } from '../audit/tenant-audit-context';
import { EmployeeActivationService } from './employee-activation.service';
import { EmployeeImportService } from './employee-import.service';

jest.mock('argon2');
const organizationId = '10000000-0000-4000-8000-000000000001';
const user = {
  id: '20000000-0000-4000-8000-000000000001',
  organizationId,
  employeeId: 'LEGACY-1',
  email: 'person@example.test',
  firstName: 'Alex',
  lastName: 'Tester',
  role: TenantRole.EXPENSE_SUBMITTER,
  organization: { registrationStatus: 'APPROVED', status: 'ACTIVE' },
};
const token = 'unit-test-activation-token';
function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: user.id }]),
    tenantUser: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    tenantAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    employeeImportRow: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([{ userId: user.id, rowNumber: 1 }])
        .mockResolvedValue([]),
    },
    tenantUser: {
      findMany: jest.fn().mockResolvedValue([user]),
      findFirst: jest.fn().mockResolvedValue(user),
    },
    $transaction: jest.fn(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    ),
  };
  const imports = { get: jest.fn().mockResolvedValue({ status: 'COMPLETED' }) };
  const service = new EmployeeActivationService(
    prisma as unknown as PrismaService,
    imports as unknown as EmployeeImportService,
  );
  return { tx, prisma, imports, service };
}
describe('legacy bulk account activation isolation', () => {
  beforeEach(() => {
    (argon2.hash as jest.Mock).mockResolvedValue('fixture-activation-hash');
  });
  it('issues only for a completed tenant-scoped import and stores token hashes rather than plaintext', async () => {
    const { service, imports, prisma, tx } = setup();
    const result = await auditContext.run(
      {
        organizationId,
        actorUserId: 'cm-user',
        actorName: 'CM',
        actorKind: 'USER',
        actorRole: TenantRole.CONFIGURATION_MANAGER,
      },
      () => service.issue(organizationId, 'job-1'),
    );
    expect(imports.get).toHaveBeenCalledWith(organizationId, 'job-1');
    expect(prisma.tenantUser.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        id: { in: [user.id] },
        credentialSetupRequired: true,
        status: 'INACTIVE',
      },
      select: { id: true, employeeId: true, email: true },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      employeeId: 'LEGACY-1',
      token: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
    });
    const sql = tx.$queryRaw.mock.calls[0] as unknown as [
      { values: unknown[] },
    ];
    expect(sql[0].values).toContain(
      createHash('sha256').update(result.items[0].token).digest('hex'),
    );
    expect(sql[0].values).toContain(organizationId);
    expect(sql[0].values).not.toContain(result.items[0].token);
    expect(JSON.stringify(tx.tenantAuditLog.create.mock.calls)).not.toContain(
      result.items[0].token,
    );
    expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      47 * 60 * 60 * 1000,
    );
  });
  it('does not issue tokens for another tenant import or an incomplete job', async () => {
    for (const failure of ['foreign', 'pending']) {
      const { service, imports, prisma } = setup();
      if (failure === 'foreign')
        imports.get.mockRejectedValueOnce(new NotFoundException());
      else imports.get.mockResolvedValueOnce({ status: 'PROCESSING' });
      await expect(service.issue(organizationId, 'job-1')).rejects.toThrow();
      expect(prisma.tenantUser.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });
  it('redeems a legacy ID with an expiring hashed token and atomic one-time credential update', async () => {
    const { service, prisma, tx } = setup();
    const result = await service.activate(
      user.employeeId,
      token,
      'fixture-new-password',
    );
    const hash = createHash('sha256').update(token).digest('hex');
    expect(prisma.tenantUser.findFirst).toHaveBeenCalledWith({
      where: {
        employeeId: user.employeeId,
        activationTokenHash: hash,
        activationExpiresAt: { gt: expect.any(Date) as unknown },
        credentialSetupRequired: true,
        status: 'INACTIVE',
      },
      include: { organization: true },
    });
    expect(tx.tenantUser.updateMany).toHaveBeenCalledWith({
      where: {
        id: user.id,
        activationTokenHash: hash,
        activationExpiresAt: { gt: expect.any(Date) as unknown },
        credentialSetupRequired: true,
        status: 'INACTIVE',
      },
      data: {
        passwordHash: 'fixture-activation-hash',
        status: 'ACTIVE',
        credentialSetupRequired: false,
        activationTokenHash: null,
        activationExpiresAt: null,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /fixture-new-password|fixture-activation-hash|unit-test-activation-token/,
    );
    expect(JSON.stringify(tx.tenantAuditLog.create.mock.calls)).not.toMatch(
      /fixture-new-password|fixture-activation-hash|unit-test-activation-token/,
    );
  });
  it.each(['SUSPENDED', 'CANCELLED'])(
    'denies activation in an unavailable tenant: %s',
    async (status) => {
      const { service, prisma } = setup();
      prisma.tenantUser.findFirst.mockResolvedValueOnce({
        ...user,
        organization: { registrationStatus: 'APPROVED', status },
      });
      await expect(
        service.activate(user.employeeId, token, 'fixture-new-password'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it('denies invalid, expired or mismatched-ID tokens without updating credentials', async () => {
    const { service, prisma } = setup();
    prisma.tenantUser.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.activate('OTHER-EMPLOYEE', token, 'fixture-new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a replay that loses the atomic redemption race and emits no successful audit', async () => {
    const { service, tx } = setup();
    tx.tenantUser.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.activate(user.employeeId, token, 'fixture-new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.tenantAuditLog.create).not.toHaveBeenCalled();
  });
});
