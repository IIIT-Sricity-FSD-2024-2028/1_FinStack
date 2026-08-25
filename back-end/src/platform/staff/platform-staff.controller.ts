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
import { AssignPlatformStaffRoleDto } from './dto/assign-platform-staff-role.dto';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { ListPlatformStaffQueryDto } from './dto/list-platform-staff-query.dto';
import { UpdatePlatformStaffDto } from './dto/update-platform-staff.dto';
import { PlatformStaffService } from './platform-staff.service';

@ApiTags('Platform staff')
@ApiBearerAuth('platform-access-token')
@Controller('staff')
export class PlatformStaffController {
  constructor(private readonly staff: PlatformStaffService) {}

  @Get()
  @Permissions('platform.staff.view')
  @ApiOperation({ summary: 'List, search, and filter platform staff' })
  findAll(@Query() query: ListPlatformStaffQueryDto) {
    return this.staff.findAll(query);
  }

  @Post()
  @Permissions('platform.staff.create')
  @ApiOperation({ summary: 'Create an active platform staff member' })
  create(@Body() dto: CreatePlatformStaffDto) {
    return this.staff.create(dto);
  }

  @Get(':id')
  @Permissions('platform.staff.view')
  @ApiOperation({ summary: 'Get platform staff details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.staff.findOne(id);
  }

  @Patch(':id')
  @Permissions('platform.staff.update')
  @ApiOperation({ summary: 'Update platform staff profile fields' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformStaffDto,
  ) {
    return this.staff.update(id, dto);
  }

  @Post(':id/deactivations')
  @Permissions('platform.staff.disable')
  @ApiOperation({ summary: 'Deactivate active platform staff' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformStaff() authenticatedStaff: PlatformStaffIdentity,
  ) {
    return this.staff.deactivate(id, authenticatedStaff.id);
  }

  @Post(':id/reactivations')
  @Permissions('platform.staff.activate')
  @ApiOperation({ summary: 'Reactivate inactive platform staff' })
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.staff.reactivate(id);
  }

  @Get(':staffId/roles')
  @Permissions('platform.staff.view')
  @ApiOperation({ summary: 'List roles assigned to platform staff' })
  findAssignedRoles(@Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.staff.findAssignedRoles(staffId);
  }

  @Post(':staffId/role-assignments')
  @Permissions('platform.staff.role.assign')
  @ApiOperation({ summary: 'Assign an active role to platform staff' })
  assignRole(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: AssignPlatformStaffRoleDto,
    @CurrentPlatformStaff() authenticatedStaff: PlatformStaffIdentity,
  ) {
    return this.staff.assignRole(staffId, dto, authenticatedStaff.id);
  }

  @Delete(':staffId/role-assignments/:roleId')
  @Permissions('platform.staff.role.assign')
  @ApiOperation({ summary: 'Remove a role assignment from platform staff' })
  removeRole(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentPlatformStaff() authenticatedStaff: PlatformStaffIdentity,
  ) {
    return this.staff.removeRole(staffId, roleId, authenticatedStaff.id);
  }
}
