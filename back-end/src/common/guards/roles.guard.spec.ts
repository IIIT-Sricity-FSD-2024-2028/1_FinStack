import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function requestContext(
  path: string,
  method = 'GET',
  role?: string,
): ExecutionContext {
  const request = {
    path,
    method,
    header: (name: string) =>
      name.toLowerCase() === 'role' ? role : undefined,
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard legacy route containment', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(undefined),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    '/users',
    '/users/123',
    '/expenses',
    '/expenses/123/receipt',
    '/notifications',
    '/categories',
    '/policies',
    '/transactions',
    '/reports',
    '/dashboard',
    '/audit',
  ])(
    'denies unauthenticated legacy route %s before its handler runs',
    (path) => {
      const sensitiveHandler = jest.fn();

      expect(() => {
        guard.canActivate(requestContext(path));
        sensitiveHandler();
      }).toThrow(NotFoundException);
      expect(sensitiveHandler).not.toHaveBeenCalled();
    },
  );

  it.each(['admin', 'superuser', 'user'])(
    'does not let a spoofed %s role header access legacy routes',
    (role) => {
      expect(() =>
        guard.canActivate(requestContext('/users', 'GET', role)),
      ).toThrow(NotFoundException);
    },
  );

  it.each([
    '/api/v1/tenant/auth/login',
    '/api/v1/tenant/expenses/finance/queue',
    '/api/v1/platform/auth/login',
    '/api/v1/platform/organizations',
  ])(
    'delegates versioned API authorization for %s to its own guards',
    (path) => {
      expect(guard.canActivate(requestContext(path))).toBe(true);
    },
  );
});
