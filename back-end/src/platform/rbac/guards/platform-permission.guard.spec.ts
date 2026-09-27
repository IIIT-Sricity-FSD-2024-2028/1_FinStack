import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRequest } from '../../auth/auth.types';
import { PlatformPermissionGuard } from './platform-permission.guard';

describe('PlatformPermissionGuard', () => {
  const request = {
    path: '/api/v1/platform/test',
    platformAuth: {
      sessionId: 'session-id',
      staff: {
        id: 'staff-id',
        firstName: 'Test',
        lastName: 'Staff',
        email: 'staff@example.test',
        status: 'ACTIVE',
      },
      roles: [],
      permissions: ['platform.staff.view'],
    },
  } as unknown as PlatformRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;

  it('allows an authenticated route with no permission metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    expect(new PlatformPermissionGuard(reflector).canActivate(context)).toBe(
      true,
    );
  });

  it('requires every declared permission without role-name bypasses', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(['platform.staff.view', 'platform.staff.disable']),
    } as unknown as Reflector;

    expect(() =>
      new PlatformPermissionGuard(reflector).canActivate(context),
    ).toThrow(ForbiddenException);
  });
});
