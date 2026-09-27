import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';
import { TenantAuthenticationGuard } from '../auth/guards/tenant-authentication.guard';
import { TenantRoleGuard } from '../auth/guards/tenant-role.guard';
import { TenantRoles } from '../auth/decorators/tenant-roles.decorator';
import { TenantRequest } from '../auth/tenant-auth.types';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { UpdateTenantUserStatusDto } from './dto/update-tenant-user-status.dto';
import { UpdateTenantUserReportingDto } from './dto/update-tenant-user-reporting.dto';
import { TenantConfigurationService } from './tenant-configuration.service';

@ApiTags('Tenant configuration')
@ApiBearerAuth('tenant-access-token')
@Controller('configuration')
@UseGuards(TenantAuthenticationGuard)
export class TenantConfigurationController {
  constructor(private readonly configuration: TenantConfigurationService) {}

  @Get('dashboard') dashboard(@Req() request: TenantRequest) { return this.configuration.dashboard(request.tenantAuth!.organizationId); }
  @Get('users') users(@Req() request: TenantRequest) { return this.configuration.listUsers(request.tenantAuth!.organizationId); }
  @Get('roles') roles(@Req() request: TenantRequest) { return this.configuration.listRoles(request.tenantAuth!.organizationId); }

  @Post('users')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  create(@Req() request: TenantRequest, @Body() dto: CreateTenantUserDto) { return this.configuration.createUser(request.tenantAuth!.organizationId, dto); }

  @Patch('users/:id')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  update(@Req() request: TenantRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantUserDto) { return this.configuration.updateUser(request.tenantAuth!.organizationId, id, dto); }

  @Patch('users/:id/status')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  status(@Req() request: TenantRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantUserStatusDto) { return this.configuration.updateStatus(request.tenantAuth!.organizationId, request.tenantAuth!.user.id, id, dto); }

  @Patch('users/:id/reporting')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  reporting(@Req() request: TenantRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantUserReportingDto) { return this.configuration.updateReporting(request.tenantAuth!.organizationId, id, dto); }
}
