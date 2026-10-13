import { Prisma, TenantRole, TenantUserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantConfigurationService } from './tenant-configuration.service';

describe('TenantConfigurationService', () => {
  const organizationId = '10000000-0000-4000-8000-000000000001';
  const userId = '20000000-0000-4000-8000-000000000001';
  const actorId = '30000000-0000-4000-8000-000000000001';
  const user = {
    id: userId,
    organizationId,
    employeeId: 'CFG-001',
    firstName: 'Config',
    lastName: 'Manager',
    email: 'config@example.test',
    passwordHash: 'hash',
    role: TenantRole.CONFIGURATION_MANAGER,
    status: TenantUserStatus.ACTIVE,
    department: 'Operations',
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function setup() {
    const update = jest.fn();
    const prisma = {
      tenantUser: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update,
      },
    } as unknown as PrismaService;
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    prisma.$transaction = jest.fn(
      async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(prisma),
    ) as unknown as PrismaService['$transaction'];
    return { prisma, update, service: new TenantConfigurationService(prisma) };
  }

  it('does not deactivate the final active Configuration Manager', async () => {
    const { prisma, update, service } = setup();
    prisma.tenantUser.findFirst = jest.fn().mockResolvedValue(user);
    prisma.tenantUser.count = jest.fn().mockResolvedValue(1);

    await expect(
      service.updateStatus(organizationId, actorId, userId, {
        status: TenantUserStatus.INACTIVE,
      }),
    ).rejects.toThrow('last active Configuration Manager');
    expect(update).not.toHaveBeenCalled();
  });

  it('does not allow a reporting manager from another organization', async () => {
    const { prisma, update, service } = setup();
    prisma.tenantUser.findFirst = jest
      .fn()
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);

    await expect(
      service.updateReporting(organizationId, userId, {
        managerId: '40000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toThrow('Manager must belong to this organization.');
    expect(update).not.toHaveBeenCalled();
  });
});
