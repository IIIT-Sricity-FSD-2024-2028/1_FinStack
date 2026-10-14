import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRole } from '@prisma/client';
import { TenantRoleGuard } from '../auth/guards/tenant-role.guard';
import { TenantSelfSettingsController } from './tenant-self-settings.controller';
import { TenantSettingsController } from './tenant-settings.controller';

function context(
  controller: { prototype: object },
  handlerName: string,
  role: TenantRole,
): ExecutionContext {
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    handlerName,
  )?.value as () => void;
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ tenantAuth: { user: { role } } }),
    }),
  } as unknown as ExecutionContext;
}

describe('tenant settings role boundaries', () => {
  const guard = new TenantRoleGuard(new Reflector());

  it('allows a Manager to access only authenticated-user settings routes', () => {
    expect(
      guard.canActivate(
        context(
          TenantSelfSettingsController,
          'updatePreferences',
          TenantRole.MANAGER,
        ),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context(
          TenantSettingsController,
          'updatePreferences',
          TenantRole.MANAGER,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('keeps Configuration Manager settings on the Configuration Manager role', () => {
    expect(
      guard.canActivate(
        context(
          TenantSettingsController,
          'updatePreferences',
          TenantRole.CONFIGURATION_MANAGER,
        ),
      ),
    ).toBe(true);
  });
});
