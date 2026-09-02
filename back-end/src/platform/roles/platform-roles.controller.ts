import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformStaffIdentity } from '../auth/auth.types';
import { CurrentPlatformStaff } from '../auth/decorators/current-platform-auth.decorator';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { AssignPlatformRolePermissionDto } from './dto/assign-platform-role-permission.dto';
import { CreatePlatformRoleDto } from './dto/create-platform-role.dto';
import { ListPlatformRolesQueryDto } from './dto/list-platform-roles-query.dto';
import { UpdatePlatformRoleDto } from './dto/update-platform-role.dto';
import { PlatformRolesService } from './platform-roles.service';

@ApiTags('Platform roles')
@ApiBearerAuth('platform-access-token')
@Controller('roles')
export class PlatformRolesController {
  constructor(private readonly roles: PlatformRolesService) {}

  @Get()
  @Permissions('platform.role.view')
  @ApiOperation({ summary: 'List, search, and filter platform roles' })
  findAll(@Query() query: ListPlatformRolesQueryDto) {
    return this.roles.findAll(query);
  }

  @Post()
  @Permissions('platform.role.manage')
  @ApiOperation({ summary: 'Create an active custom platform role' })
  create(@Body() dto: CreatePlatformRoleDto) {
    return this.roles.create(dto);
  }

  @Get(':id')
  @Permissions('platform.role.view')
  @ApiOperation({ summary: 'Get platform role details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.findOne(id);
  }

  @Patch(':id')
  @Permissions('platform.role.manage')
  @ApiOperation({ summary: 'Update custom platform role details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformRoleDto,
  ) {
    return this.roles.update(id, dto);
  }

  @Post(':id/deactivations')
  @Permissions('platform.role.manage')
  @ApiOperation({ summary: 'Deactivate an active custom platform role' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.deactivate(id);
  }

  @Post(':id/reactivations')
  @Permissions('platform.role.manage')
  @ApiOperation({ summary: 'Reactivate an inactive custom platform role' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformStaff() authenticatedStaff: PlatformStaffIdentity,
  ) {
    return this.roles.reactivate(id, authenticatedStaff.id);
  }

  @Get(':roleId/permissions')
  @Permissions('platform.role.view')
  @ApiOperation({ summary: 'List permissions assigned to a platform role' })
  findPermissions(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.roles.findPermissions(roleId);
  }

  @Post(':roleId/permission-assignments')
  @Permissions('platform.role.manage')
  @ApiOperation({ summary: 'Assign an effective permission to a custom role' })
  assignPermission(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignPlatformRolePermissionDto,
    @CurrentPlatformStaff() authenticatedStaff: PlatformStaffIdentity,
  ) {
    return this.roles.assignPermission(roleId, dto, authenticatedStaff.id);
  }

  @Delete(':roleId/permission-assignments/:permissionId')
  @Permissions('platform.role.manage')
  @ApiOperation({ summary: 'Remove a permission from a custom role' })
  removePermission(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.roles.removePermission(roleId, permissionId);
  }
}
