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
  } as unknown as ConstructorParameters<typeof TenantAuthService>[0];
  const tokens = {
    sign: jest.fn().mockResolvedValue('token'),
    accessTokenTtlSeconds: 900,
  } as unknown as ConstructorParameters<typeof TenantAuthService>[1];
  let service: TenantAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantAuthService(prisma, tokens);
  });

  it('authenticates an active Configuration Manager by email or generated employee id', async () => {
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
    expect(
      Object.prototype.hasOwnProperty.call(byEmployee.user, 'passwordHash'),
    ).toBe(false);
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
});
