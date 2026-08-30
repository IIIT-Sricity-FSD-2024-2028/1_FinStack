import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { PlatformAuditLogService } from './platform-audit.service';

export class AuditLogListQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  resourceType?: string;
  actorStaffId?: string;
  sortBy?: 'createdAt';
  order?: 'asc' | 'desc';
}

@ApiTags('Platform audit logs')
@ApiBearerAuth('platform-access-token')
@Controller('audit-logs')
export class PlatformAuditController {
  constructor(private readonly auditLogs: PlatformAuditLogService) {}

  @Get()
  @Permissions('platform.audit.view')
  @ApiOperation({
    summary: 'List platform audit logs with safe filters and pagination',
  })
  findAll(@Query() query: AuditLogListQueryDto) {
    return this.auditLogs.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      category: query.category,
      resourceType: query.resourceType,
      actorStaffId: query.actorStaffId,
      sortBy: query.sortBy ?? 'createdAt',
      order: query.order ?? 'desc',
    });
  }

  @Get(':id')
  @Permissions('platform.audit.view')
  @ApiOperation({ summary: 'Get a single platform audit log' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditLogs.findOne(id);
  }
}
