import { UnauthorizedException } from '@nestjs/common';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { TenantAuthService } from './tenant-auth.service';

jest.mock('argon2', () => ({ verify: jest.fn(), hash: jest.fn() }));

describe('TenantAuthService', () => {
  const user = {
    id: 'user-1',
    organizationId: 'org-1',
    employeeId: 'CFG-1234',
    firstName: 'Config',
    lastName: 'Manager',
    email: 'config@example.test',
    passwordHash: 'hash',
    role: TenantRole.CONFIGURATION_MANAGER,
    status: TenantUserStatus.ACTIVE,
  };
  const prisma = {
    tenantUser: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-1' }) },
  } as unknown as ConstructorParameters<typeof TenantAuthService>[0];
  const tokens = {
    sign: jest.fn().mockResolvedValue('token'),
    verify: jest.fn(),
    accessTokenTtlSeconds: 28800,
  } as unknown as ConstructorParameters<typeof TenantAuthService>[1];
  let service: TenantAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantAuthService(prisma, tokens);
  });

  it('authenticates every active tenant role by email or generated employee id', async () => {
    prisma.tenantUser.findUnique = jest.fn().mockResolvedValue(user);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    const byEmail = await service.login({
      organizationId: 'org-1',
      email: user.email,
      password: 'Password1!',
    });
    const byEmployee = await service.login({
      organizationId: 'org-1',
      employeeId: user.employeeId,
      password: 'Password1!',
    });
    expect(byEmail.accessToken).toBe('token');
    expect(byEmail.expiresIn).toBe(28800);
    expect(
      Object.prototype.hasOwnProperty.call(byEmployee.user, 'passwordHash'),
    ).toBe(false);

    for (const role of [
      TenantRole.CONFIGURATION_MANAGER,
      TenantRole.EXPENSE_SUBMITTER,
      TenantRole.MANAGER,
      TenantRole.FINANCE_OFFICER,
      TenantRole.COMPLIANCE_OFFICER,
    ]) {
      prisma.tenantUser.findUnique = jest
        .fn()
        .mockResolvedValue({ ...user, role });
      const result = await service.login({
        organizationId: 'org-1',
        employeeId: user.employeeId,
        password: 'Password1!',
      });
      expect(result.user.role).toBe(role);
    }
  });

  it('rejects an unknown organization slug', async () => {
    prisma.organization.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      service.login({
        organizationId: 'missing-org',
        employeeId: user.employeeId,
        password: 'Password1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects wrong passwords and inactive tenant users', async () => {
    prisma.tenantUser.findUnique = jest.fn().mockResolvedValue(user);
    (argon2.verify as jest.Mock).mockResolvedValue(false);
    await expect(
      service.login({
        organizationId: 'org-1',
        email: user.email,
        password: 'wrongpass',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.tenantUser.findUnique = jest
      .fn()
      .mockResolvedValue({ ...user, status: TenantUserStatus.INACTIVE });
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    await expect(
      service.login({
        organizationId: 'org-1',
        email: user.email,
        password: 'Password1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authenticates an active token identity and rejects invalid tokens', async () => {
    prisma.tenantUser.findUnique = jest.fn().mockResolvedValue(user);
    tokens.verify = jest.fn().mockResolvedValue({
      sub: user.id,
      orgId: user.organizationId,
      type: 'tenant-access',
    });

    await expect(service.authenticate('valid-token')).resolves.toMatchObject({
      organizationId: user.organizationId,
      user: { id: user.id, status: TenantUserStatus.ACTIVE },
    });

    prisma.tenantUser.findUnique = jest
      .fn()
      .mockResolvedValue({ ...user, status: TenantUserStatus.INACTIVE });
    await expect(service.authenticate('inactive-user-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    tokens.verify = jest.fn().mockRejectedValue(new Error('expired'));
    await expect(service.authenticate('expired-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
