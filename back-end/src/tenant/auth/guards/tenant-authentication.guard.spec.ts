import { UnauthorizedException } from '@nestjs/common';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import { TenantAuthenticationGuard } from './tenant-authentication.guard';

describe('TenantAuthenticationGuard', () => {
  const tenantAuth = {
    organizationId: 'org-id',
    user: {
      id: 'tenant-user-id',
      organizationId: 'org-id',
      employeeId: 'EMP-1',
      firstName: 'Tenant',
      lastName: 'User',
      email: 'tenant@example.test',
      role: TenantRole.EXPENSE_SUBMITTER,
      status: TenantUserStatus.ACTIVE,
    },
  };

  function contextFor(authorization?: string) {
    const request = {
      header: jest.fn().mockReturnValue(authorization),
    };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      },
    };
  }

  it('attaches an active tenant context for protected endpoints such as auth/me', async () => {
    const auth = { authenticate: jest.fn().mockResolvedValue(tenantAuth) };
    const guard = new TenantAuthenticationGuard(
      auth as unknown as ConstructorParameters<typeof TenantAuthenticationGuard>[0],
    );
    const { context, request } = contextFor('Bearer valid-token');

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(auth.authenticate).toHaveBeenCalledWith('valid-token');
    expect(request).toMatchObject({ tenantAuth });
  });

  it('rejects a request without a bearer token', async () => {
    const auth = { authenticate: jest.fn() };
    const guard = new TenantAuthenticationGuard(
      auth as unknown as ConstructorParameters<typeof TenantAuthenticationGuard>[0],
    );
    const { context } = contextFor();

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
