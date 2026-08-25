import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PlatformOrganizationsService } from './platform-organizations.service';

@ApiTags('Platform organizations')
@ApiBearerAuth('platform-access-token')
@Controller('organizations')
export class PlatformOrganizationsController {
  constructor(private readonly organizations: PlatformOrganizationsService) {}

  @Get()
  @Permissions('platform.organization.view')
  @ApiOperation({ summary: 'List, search, and filter organizations' })
  findAll(@Query() query: ListOrganizationsQueryDto) {
    return this.organizations.findAll(query);
  }

  @Post()
  @Permissions('platform.organization.create')
  @ApiOperation({ summary: 'Create or provision an organization' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizations.create(dto);
  }

  @Get(':id')
  @Permissions('platform.organization.view')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.findOne(id);
  }

  @Patch(':id')
  @Permissions('platform.organization.update')
  @ApiOperation({ summary: 'Update organization metadata' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(id, dto);
  }

  @Post(':id/suspensions')
  @Permissions('platform.organization.suspend')
  @ApiOperation({ summary: 'Suspend an organization' })
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.suspend(id);
  }

  @Post(':id/reactivations')
  @Permissions('platform.organization.reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended organization' })
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.reactivate(id);
  }

  @Post(':id/cancellations')
  @Permissions('platform.organization.cancel')
  @ApiOperation({ summary: 'Cancel an organization' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.cancel(id);
  }

  @Post(':id/archivals')
  @Permissions('platform.organization.archive')
  @ApiOperation({ summary: 'Archive a cancelled organization' })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.archive(id);
  }
}
