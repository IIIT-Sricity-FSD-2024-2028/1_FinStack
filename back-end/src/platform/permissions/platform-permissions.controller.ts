import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { ListPlatformPermissionsQueryDto } from './dto/list-platform-permissions-query.dto';
import { PlatformPermissionsService } from './platform-permissions.service';

@ApiTags('Platform permissions')
@ApiBearerAuth('platform-access-token')
@Controller('permissions')
export class PlatformPermissionsController {
  constructor(private readonly permissions: PlatformPermissionsService) {}

  @Get()
  @Permissions('platform.role.view')
  @ApiOperation({ summary: 'List the system-defined permission catalog' })
  findAll(@Query() query: ListPlatformPermissionsQueryDto) {
    return this.permissions.findAll(query);
  }
}
