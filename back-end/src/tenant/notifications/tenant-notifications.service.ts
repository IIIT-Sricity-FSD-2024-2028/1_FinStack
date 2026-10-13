import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantNotification } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthContext } from '../auth/tenant-auth.types';
export class NotificationQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
  @IsOptional() @IsIn(['all', 'read', 'unread']) state?: string;
  @IsOptional() @IsIn(['info', 'success', 'warning', 'danger']) type?: string;
}
export interface NotificationEvent {
  organizationId: string;
  recipientUserId: string;
  eventCode: string;
  eventKey: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  sourceType?: string;
  sourceId?: string;
}
// Call only with authoritative backend events. Composite FK enforces tenant-recipient membership.
export async function enqueueNotification(
  tx: Prisma.TransactionClient,
  event: NotificationEvent,
) {
  return tx.tenantNotification.createMany({
    data: [event],
    skipDuplicates: true,
  });
}
@Injectable()
export class TenantNotificationsService {
  constructor(private readonly prisma: PrismaService) {}
  private scope(actor: TenantAuthContext) {
    return {
      organizationId: actor.organizationId,
      recipientUserId: actor.user.id,
      dismissedAt: null,
    };
  }
  private dto(row: TenantNotification, actor: TenantAuthContext) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      recipientUserId: row.recipientUserId,
      recipientEmployeeId: actor.user.employeeId,
      recipientRole: actor.user.role.toLowerCase(),
      title: row.title,
      message: row.message,
      type: row.type,
      actionType: row.eventCode,
      relatedExpenseId: row.sourceType === 'expense' ? row.sourceId || '' : '',
      relatedEntityId: row.sourceId || '',
      sourceType: row.sourceType,
      unread: row.readAt === null,
      readAt: row.readAt,
      createdAt: row.createdAt.toISOString(),
    };
  }
  async page(actor: TenantAuthContext, query: NotificationQuery) {
    const scope = this.scope(actor),
      where = {
        ...scope,
        ...(query.state === 'read'
          ? { readAt: { not: null } }
          : query.state === 'unread'
            ? { readAt: null }
            : {}),
        ...(query.type ? { type: query.type } : {}),
      };
    const [total, unreadCount, rows] = await this.prisma.$transaction(
      [
        this.prisma.tenantNotification.count({ where }),
        this.prisma.tenantNotification.count({
          where: { ...scope, readAt: null },
        }),
        this.prisma.tenantNotification.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: rows.map((row) => this.dto(row, actor)),
      total,
      unreadCount,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
  async legacy(actor: TenantAuthContext) {
    return (await this.page(actor, new NotificationQuery())).items;
  }
  async unread(actor: TenantAuthContext) {
    return {
      unreadCount: await this.prisma.tenantNotification.count({
        where: { ...this.scope(actor), readAt: null },
      }),
    };
  }
  async read(actor: TenantAuthContext, id: string, unread = false) {
    return this.prisma.$transaction(async (tx) => {
      // Row lock keeps simultaneous read/unread/dismiss operations consistent; never resurrect a dismissed row.
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "TenantNotification" WHERE id=${id}::uuid AND "organizationId"=${actor.organizationId}::uuid AND "recipientUserId"=${actor.user.id}::uuid AND "dismissedAt" IS NULL FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Notification not found.');
      const row = await tx.tenantNotification.update({
        where: { id },
        data: { readAt: unread ? null : new Date() },
      });
      return this.dto(row, actor);
    });
  }
  async readAll(actor: TenantAuthContext) {
    const result = await this.prisma.tenantNotification.updateMany({
      where: { ...this.scope(actor), readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
  async dismiss(actor: TenantAuthContext, id: string) {
    const result = await this.prisma.tenantNotification.updateMany({
      where: {
        organizationId: actor.organizationId,
        recipientUserId: actor.user.id,
        id,
      },
      data: { dismissedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Notification not found.');
    return { id, deleted: true };
  }
  async notifyRecipients(
    ids: string[],
    event: Omit<NotificationEvent, 'recipientUserId'>,
  ) {
    return this.prisma.tenantNotification.createMany({
      data: ids.map((recipientUserId) => ({ ...event, recipientUserId })),
      skipDuplicates: true,
    });
  }
  async notifyEmployee(
    organizationId: string,
    employeeId: string,
    title: string,
    message: string,
    type: NotificationEvent['type'],
    sourceId: string,
    eventCode: string,
    eventKey?: string,
  ) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { organizationId, employeeId },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException(
        'Notification recipient not found in this organization.',
      );
    return enqueueNotification(this.prisma, {
      organizationId,
      recipientUserId: user.id,
      eventCode,
      eventKey: eventKey || `${eventCode}:${sourceId}`,
      title: title.slice(0, 200),
      message: message.length > 2000 ? message.slice(0, 1999) + '�' : message,
      type,
      sourceType: 'expense',
      sourceId,
    });
  }
}
