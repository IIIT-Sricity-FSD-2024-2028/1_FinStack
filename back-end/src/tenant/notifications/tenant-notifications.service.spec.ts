import { NotFoundException } from '@nestjs/common';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthContext } from '../auth/tenant-auth.types';
import {
  NotificationQuery,
  TenantNotificationsService,
} from './tenant-notifications.service';

const actor: TenantAuthContext = {
  organizationId: 'org-a',
  effectiveRoles: [TenantRole.EXPENSE_SUBMITTER],
  user: {
    id: 'immutable-user-a',
    organizationId: 'org-a',
    employeeId: 'LEGACY-A',
    firstName: 'Alex',
    lastName: 'Tester',
    email: 'a@example.test',
    role: TenantRole.EXPENSE_SUBMITTER,
    status: TenantUserStatus.ACTIVE,
  },
};
function setup() {
  const prisma = {
    tenantNotification: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn(),
    },
    tenantUser: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (
      work: Promise<unknown>[] | ((client: typeof prisma) => Promise<unknown>),
    ) => (Array.isArray(work) ? Promise.all(work) : work(prisma)),
  );
  return {
    prisma,
    service: new TenantNotificationsService(prisma as unknown as PrismaService),
  };
}
describe('tenant notification recipient isolation', () => {
  it('scopes page, total and unread count by tenant and immutable user UUID', async () => {
    const { service, prisma } = setup();
    await service.page(actor, new NotificationQuery());
    const scope = {
      organizationId: actor.organizationId,
      recipientUserId: actor.user.id,
      dismissedAt: null,
    };
    expect(prisma.tenantNotification.count).toHaveBeenNthCalledWith(1, {
      where: scope,
    });
    expect(prisma.tenantNotification.count).toHaveBeenNthCalledWith(2, {
      where: { ...scope, readAt: null },
    });
    expect(prisma.tenantNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: scope }),
    );
    await service.unread(actor);
    await service.readAll(actor);
    expect(prisma.tenantNotification.updateMany).toHaveBeenCalledWith({
      where: { ...scope, readAt: null },
      data: { readAt: expect.any(Date) as unknown },
    });
  });
  it('cannot mark a foreign tenant or foreign recipient notification as read', async () => {
    const { service, prisma } = setup();
    await expect(
      service.read(actor, 'foreign-notification'),
    ).rejects.toBeInstanceOf(NotFoundException);
    const [sql, ...values] = prisma.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...string[],
    ];
    expect(sql.join('?')).toContain(
      '"organizationId"=?::uuid AND "recipientUserId"=?::uuid',
    );
    expect(values).toEqual([
      'foreign-notification',
      actor.organizationId,
      actor.user.id,
    ]);
    expect(prisma.tenantNotification.update).not.toHaveBeenCalled();
  });
  it('cannot dismiss another recipient notification', async () => {
    const { service, prisma } = setup();
    await expect(
      service.dismiss(actor, 'foreign-notification'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tenantNotification.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: actor.organizationId,
        recipientUserId: actor.user.id,
        id: 'foreign-notification',
      },
      data: { dismissedAt: expect.any(Date) as unknown },
    });
  });
  it('resolves employee IDs only in the authenticated organization before enqueueing', async () => {
    const { service, prisma } = setup();
    await expect(
      service.notifyEmployee(
        actor.organizationId,
        'FOREIGN-EMPLOYEE',
        'Title',
        'Message',
        'info',
        'expense',
        'event',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tenantUser.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: actor.organizationId,
        employeeId: 'FOREIGN-EMPLOYEE',
      },
      select: { id: true },
    });
    expect(prisma.tenantNotification.createMany).not.toHaveBeenCalled();
  });
});
