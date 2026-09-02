import { NotFoundException } from '@nestjs/common';
import { PlatformNotificationsService } from './platform-notifications.service';

describe('PlatformNotificationsService', () => {
  it('scopes notification queries to the authenticated staff member', async () => {
    const findMany = jest.fn<
      Promise<Array<{ id: string; recipientStaffId: string }>>,
      [unknown]
    >();
    findMany.mockResolvedValue([{ id: 'n1', recipientStaffId: 'staff-1' }]);

    const count = jest.fn<Promise<number>, [unknown]>();
    count.mockResolvedValue(1);

    const prisma: {
      $transaction: jest.Mock;
      platformNotification: {
        findMany: typeof findMany;
        count: typeof count;
      };
    } = {
      $transaction: jest
        .fn()
        .mockImplementation(() => [
          [{ id: 'n1', recipientStaffId: 'staff-1' }],
          1,
        ]),
      platformNotification: {
        findMany,
        count,
      },
    };

    const service = new PlatformNotificationsService(prisma as never);
    await service.findAllForStaff('staff-1', {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      order: 'desc',
    });

    const mockFindMany = prisma.platformNotification.findMany as {
      mock: {
        calls: Array<[unknown]>;
      };
    };
    const findManyArgs = mockFindMany.mock.calls[0]?.[0] as {
      where: { recipientStaffId: string };
      skip: number;
      take: number;
    };
    expect(findManyArgs.where).toMatchObject({ recipientStaffId: 'staff-1' });
    expect(findManyArgs.skip).toBe(0);
    expect(findManyArgs.take).toBe(20);
  });

  it('marks a notification read only for the owning staff member', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'n1',
      recipientStaffId: 'staff-1',
      isRead: true,
    });
    const findUnique = jest.fn().mockResolvedValue({
      id: 'n1',
      recipientStaffId: 'staff-1',
      isRead: false,
    });
    const prisma = {
      platformNotification: {
        findUnique,
        update,
      },
    };

    const service = new PlatformNotificationsService(prisma as never);
    await expect(service.markAsRead('staff-1', 'n1')).resolves.toMatchObject({
      id: 'n1',
      isRead: true,
    });
  });

  it('throws a not-found exception for another staff member notification', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'n1',
      recipientStaffId: 'staff-2',
      isRead: false,
    });
    const prisma = {
      platformNotification: {
        findUnique,
      },
    };

    const service = new PlatformNotificationsService(prisma as never);
    await expect(service.markAsRead('staff-1', 'n1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects external notification links', async () => {
    const service = new PlatformNotificationsService({} as never);
    await expect(
      service.createForStaff({
        recipientStaffId: 'staff-1',
        type: 'INFO',
        title: 'External link',
        body: 'bad',
        link: 'https://evil.example.com',
      }),
    ).rejects.toThrow('internal Admin route');
  });
});
