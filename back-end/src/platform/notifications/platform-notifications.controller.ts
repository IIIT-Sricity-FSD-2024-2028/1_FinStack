import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRequest } from '../auth/auth.types';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { PlatformNotificationsService } from './platform-notifications.service';

export class NotificationListQueryDto {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  sortBy?: 'createdAt';
  order?: 'asc' | 'desc';
}

@ApiTags('Platform notifications')
@ApiBearerAuth('platform-access-token')
@Controller('notifications')
export class PlatformNotificationsController {
  constructor(private readonly notifications: PlatformNotificationsService) {}

  @Get()
  @Permissions('platform.notification.view')
  @ApiOperation({ summary: 'List the current staff member notifications' })
  findAll(
    @Request() req: PlatformRequest,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notifications.findAllForStaff(req.platformAuth!.staff.id, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      unreadOnly: query.unreadOnly ?? false,
      sortBy: query.sortBy ?? 'createdAt',
      order: query.order ?? 'desc',
    });
  }

  @Get('unread-count')
  @Permissions('platform.notification.view')
  @ApiOperation({
    summary: 'Get the current staff member notification unread count',
  })
  unreadCount(@Request() req: PlatformRequest) {
    return this.notifications.getUnreadCount(req.platformAuth!.staff.id);
  }

  @Patch(':id/read')
  @Permissions('platform.notification.manage')
  @ApiOperation({ summary: 'Mark a current staff member notification as read' })
  markAsRead(
    @Request() req: PlatformRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markAsRead(req.platformAuth!.staff.id, id);
  }

  @Patch('read-all')
  @Permissions('platform.notification.manage')
  @ApiOperation({
    summary: 'Mark all current staff member notifications as read',
  })
  markAllRead(@Request() req: PlatformRequest) {
    return this.notifications.markAllRead(req.platformAuth!.staff.id);
  }
}
