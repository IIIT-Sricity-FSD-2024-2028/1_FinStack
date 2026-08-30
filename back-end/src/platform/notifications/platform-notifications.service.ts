import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const SAFE_INTERNAL_ROUTE_PREFIXES = [
  '/health',
  '/auth',
  '/staff',
  '/teams',
  '/roles',
  '/audit-logs',
  '/notifications',
];

export interface CreateNotificationForStaffInput {
  recipientStaffId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationListQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
  sortBy?: 'createdAt';
  order?: 'asc' | 'desc';
}

@Injectable()
export class PlatformNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForStaff(
    staffId: string,
    query: NotificationListQuery,
  ): Promise<{
    items: unknown[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const order = query.order ?? 'desc';
    const sortBy = query.sortBy ?? 'createdAt';
    const where: Prisma.PlatformNotificationWhereInput = {
      recipientStaffId: staffId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.platformNotification.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.platformNotification.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getUnreadCount(staffId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.platformNotification.count({
      where: { recipientStaffId: staffId, isRead: false },
    });
    return { unreadCount };
  }

  async findOneForStaff(staffId: string, id: string): Promise<unknown> {
    const notification = await this.prisma.platformNotification.findUnique({
      where: { id },
    });

    if (!notification || notification.recipientStaffId !== staffId) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found.',
      });
    }

    return notification;
  }

  async markAsRead(staffId: string, id: string): Promise<unknown> {
    const current = await this.findOneForStaff(staffId, id);
    if (current && (current as { isRead: boolean }).isRead) {
      return current;
    }

    return this.prisma.platformNotification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllRead(staffId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.platformNotification.updateMany({
      where: { recipientStaffId: staffId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  async createForStaff(
    input: CreateNotificationForStaffInput,
  ): Promise<unknown> {
    const safeLink = this.validateLink(input.link);
    const metadata = input.metadata ?? null;

    return this.prisma.platformNotification.create({
      data: {
        recipientStaffId: input.recipientStaffId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: safeLink,
        metadata:
          metadata === null
            ? Prisma.JsonNull
            : (metadata as Prisma.InputJsonValue),
      },
    });
  }

  private validateLink(link?: string | null): string | null {
    if (!link) {
      return null;
    }

    if (!/^\//.test(link)) {
      throw new BadRequestException({
        code: 'INVALID_NOTIFICATION_LINK',
        message: 'Notification link must be an internal Admin route.',
      });
    }

    const normalized = link.trim();
    const isSafe = SAFE_INTERNAL_ROUTE_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    );

    if (!isSafe) {
      throw new BadRequestException({
        code: 'INVALID_NOTIFICATION_LINK',
        message: 'Notification link must be an internal Admin route.',
      });
    }

    return normalized;
  }
}
