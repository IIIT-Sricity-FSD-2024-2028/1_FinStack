import { UnauthorizedException } from '@nestjs/common';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { TenantAuthService } from './tenant-auth.service';
import { generateTenantLoginId } from '../identity/tenant-login-id';
import { TENANT_WORKSPACES } from './tenant-workspace';

jest.mock('argon2');

describe('TenantAuthService', () => {
  const user = {
    id: 'user-1',
    organizationId: 'org-1',
    employeeId: 'CFG-1234',
    firstName: 'Config',
    lastName: 'User',
    email: 'config@example.test',
    passwordHash: 'hash',
    role: TenantRole.CONFIGURATION_MANAGER,
    status: TenantUserStatus.ACTIVE,
    organization: { registrationStatus: 'LEGACY_APPROVED', status: 'ACTIVE' },
  };
  const prisma = {
    tenantUser: { findUnique: jest.fn() },
  };
  const tokens = {
    sign: jest.fn().mockResolvedValue('token'),
    verify: jest.fn(),
    accessTokenTtlSeconds: 28800,
  };
  let service: TenantAuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    (argon2.hash as jest.Mock).mockResolvedValue('dummy-hash');
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    prisma.tenantUser.findUnique = jest.fn().mockResolvedValue(user);
    service = new TenantAuthService(
      prisma as unknown as ConstructorParameters<typeof TenantAuthService>[0],
      tokens as unknown as ConstructorParameters<typeof TenantAuthService>[1],
    );
  });

  it('resolves every active tenant role and its default workspace by global employee ID', async () => {
    for (const role of Object.values(TenantRole)) {
      prisma.tenantUser.findUnique = jest
        .fn()
        .mockResolvedValue({ ...user, role });
      const result = await service.login({
        employeeId: ' CFG-1234 ',
        password: 'Old!7',
      });
      expect(prisma.tenantUser.findUnique).toHaveBeenCalledWith({
        where: { employeeId: 'CFG-1234' },
        include: { organization: true },
      });
      expect(result).toMatchObject({
        accessToken: 'token',
        organizationId: user.organizationId,
        effectiveRoles: [role],
        workspace: TENANT_WORKSPACES[role],
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(argon2.verify).toHaveBeenCalledWith('hash', 'Old!7');
    }
  });

  it('authenticates generated IDs for two same-name tenants using stored UUIDs, never the display hint', async () => {
    for (const organizationId of [
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
    ]) {
      const employeeId = generateTenantLoginId({
        id: organizationId,
        name: 'Acme',
      });
      const candidate = {
        ...user,
        id: 'user-' + organizationId,
        organizationId,
        employeeId,
        credentialVersion: 3,
      };
      prisma.tenantUser.findUnique.mockResolvedValueOnce(candidate);
      const result = await service.login({
        employeeId,
        password: 'fixture-password',
      });
      expect(prisma.tenantUser.findUnique).toHaveBeenLastCalledWith({
        where: { employeeId },
        include: { organization: true },
      });
      expect(result).toMatchObject({
        organizationId,
        user: { id: candidate.id, employeeId },
      });
      expect(tokens.sign).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: candidate.id,
          organizationId,
          credentialVersion: 3,
        }),
      );
    }
  });
  it('blocks pending, rejected and suspended organizations before issuing access', async () => {
    for (const organization of [
      { registrationStatus: 'PENDING_ORGANIZATION_REVIEW', status: 'ACTIVE' },
      { registrationStatus: 'REJECTED', status: 'ACTIVE' },
      { registrationStatus: 'APPROVED', status: 'SUSPENDED' },
    ]) {
      prisma.tenantUser.findUnique = jest
        .fn()
        .mockResolvedValue({ ...user, organization });
      await expect(
        service.login({ employeeId: user.employeeId, password: 'valid' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('returns the same generic response for unknown, inactive and incorrect credentials', async () => {
    for (const candidate of [
      null,
      { ...user, status: TenantUserStatus.INACTIVE },
      user,
    ]) {
      prisma.tenantUser.findUnique = jest.fn().mockResolvedValue(candidate);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      try {
        await service.login({ employeeId: user.employeeId, password: 'wrong' });
        throw new Error('Expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'INVALID_TENANT_CREDENTIALS',
          message: 'Employee ID or password is incorrect.',
        });
      }
    }
    expect(tokens.sign).not.toHaveBeenCalled();
    expect(argon2.verify).toHaveBeenCalledWith('dummy-hash', 'wrong');
  });

  it('rejects inactive accounts even with a correct password', async () => {
    prisma.tenantUser.findUnique = jest
      .fn()
      .mockResolvedValue({ ...user, status: TenantUserStatus.INACTIVE });
    await expect(
      service.login({ employeeId: user.employeeId, password: 'valid' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns no token for malformed stored hashes or unsupported roles', async () => {
    (argon2.verify as jest.Mock).mockRejectedValue(new Error('bad hash'));
    await expect(
      service.login({ employeeId: user.employeeId, password: 'valid' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    prisma.tenantUser.findUnique = jest
      .fn()
      .mockResolvedValue({ ...user, role: 'UNSUPPORTED' });
    await expect(
      service.login({ employeeId: user.employeeId, password: 'valid' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // Workspace resolution must happen before issuing a token.
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('re-reads role, organization and workspace from PostgreSQL for /me', async () => {
    tokens.verify = jest.fn().mockResolvedValue({
      sub: user.id,
      orgId: user.organizationId,
      type: 'tenant-access',
    });
    await expect(service.authenticate('valid-token')).resolves.toMatchObject({
      organizationId: user.organizationId,
      effectiveRoles: [user.role],
      workspace: TENANT_WORKSPACES[user.role],
      user: { id: user.id },
    });
    prisma.tenantUser.findUnique = jest
      .fn()
      .mockResolvedValue({ ...user, role: TenantRole.MANAGER });
    await expect(service.authenticate('valid-token')).resolves.toMatchObject({
      effectiveRoles: [TenantRole.MANAGER],
      workspace: TENANT_WORKSPACES.MANAGER,
    });
    prisma.tenantUser.findUnique = jest
      .fn()
      .mockResolvedValue({ ...user, status: TenantUserStatus.INACTIVE });
    await expect(service.authenticate('valid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    prisma.tenantUser.findUnique = jest.fn().mockResolvedValue(user);
    tokens.verify = jest.fn().mockResolvedValue({
      sub: user.id,
      orgId: 'other-tenant',
      type: 'tenant-access',
    });
    await expect(
      service.authenticate('wrong-tenant-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    tokens.verify = jest.fn().mockRejectedValue(new Error('expired'));
    await expect(service.authenticate('expired-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns the authenticated submitter organization and only safe same-tenant manager fields', async () => {
    tokens.verify.mockResolvedValue({
      sub: user.id,
      orgId: user.organizationId,
      type: 'tenant-access',
    });
    prisma.tenantUser.findUnique.mockResolvedValue({
      ...user,
      role: TenantRole.EXPENSE_SUBMITTER,
      department: 'Engineering',
      organization: { ...user.organization, name: 'Own organization' },
      manager: {
        id: 'manager-1',
        organizationId: user.organizationId,
        employeeId: 'MGR-1',
        firstName: 'Morgan',
        lastName: 'Reviewer',
        passwordHash: 'must-not-leak',
      },
    });
    const result = await service.authenticate('valid-token');
    expect(result.user).toMatchObject({
      department: 'Engineering',
      organizationName: 'Own organization',
    });
    expect(result.user.manager).toEqual({
      id: 'manager-1',
      employeeId: 'MGR-1',
      firstName: 'Morgan',
      lastName: 'Reviewer',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(prisma.tenantUser.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      include: {
        organization: true,
        manager: {
          select: {
            id: true,
            organizationId: true,
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  });

  it.each([
    null,
    { organizationId: 'another-tenant', firstName: 'Private manager' },
  ])(
    'does not expose absent or cross-tenant manager data: %j',
    async (manager) => {
      tokens.verify.mockResolvedValue({
        sub: user.id,
        orgId: user.organizationId,
        type: 'tenant-access',
      });
      prisma.tenantUser.findUnique.mockResolvedValue({
        ...user,
        role: TenantRole.EXPENSE_SUBMITTER,
        manager,
      });
      expect(
        (await service.authenticate('valid-token')).user.manager,
      ).toBeNull();
    },
  );

  it('re-reads profile relationships after an account/tenant switch', async () => {
    for (const organizationId of ['tenant-a', 'tenant-b']) {
      tokens.verify.mockResolvedValue({
        sub: 'employee-' + organizationId,
        orgId: organizationId,
        type: 'tenant-access',
      });
      prisma.tenantUser.findUnique.mockResolvedValue({
        ...user,
        id: 'employee-' + organizationId,
        organizationId,
        role: TenantRole.EXPENSE_SUBMITTER,
        organization: { ...user.organization, name: organizationId },
        manager: null,
      });
      expect(
        (await service.authenticate('valid-token')).user.organizationName,
      ).toBe(organizationId);
    }
  });
});
