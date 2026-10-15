import { UseInterceptors } from '@nestjs/common';
import { TenantAuditContextInterceptor } from '../audit/tenant-audit-context';
import { ListHierarchyDto } from './dto/list-hierarchy.dto';
import { TenantHierarchyService } from './tenant-hierarchy.service';
import { ListEmployeesDto } from './dto/list-employees.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
@UseInterceptors(TenantAuditContextInterceptor)
@Controller('configuration')
@UseGuards(TenantAuthenticationGuard)
export class TenantConfigurationController {
  constructor(
    private readonly configuration: TenantConfigurationService,
    private readonly hierarchy: TenantHierarchyService,
  ) {}

  @Get('dashboard')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  dashboard(@Req() request: TenantRequest) {
    return this.configuration.dashboard(request.tenantAuth!.organizationId);
  }
  @Get('users')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  users(@Req() request: TenantRequest) {
    return this.configuration.listUsers(request.tenantAuth!.organizationId);
  }
  @Get('employees')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  employees(@Req() request: TenantRequest, @Query() query: ListEmployeesDto) {
    return this.configuration.listEmployees(
      request.tenantAuth!.organizationId,
      query,
    );
  }
  @Get('hierarchy')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  summary(@Req() request: TenantRequest, @Query() query: ListHierarchyDto) {
    return this.hierarchy.summary(request.tenantAuth!.organizationId, query);
  }
  @Get('hierarchy/branches')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  branch(@Req() request: TenantRequest, @Query() query: ListHierarchyDto) {
    return this.hierarchy.branch(request.tenantAuth!.organizationId, query);
  }
  @Get('hierarchy/employees/:id')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  detail(
    @Req() request: TenantRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hierarchy.employee(request.tenantAuth!.organizationId, id);
  }

  @Get('roles')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  roles(@Req() request: TenantRequest) {
    return this.configuration.listRoles(request.tenantAuth!.organizationId);
  }

  @Post('users')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  create(@Req() request: TenantRequest, @Body() dto: CreateTenantUserDto) {
    return this.configuration.createUser(
      request.tenantAuth!.organizationId,
      dto,
    );
  }

  @Patch('users/:id')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  update(
    @Req() request: TenantRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantUserDto,
  ) {
    return this.configuration.updateUser(
      request.tenantAuth!.organizationId,
      id,
      dto,
    );
  }

  @Patch('users/:id/status')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  status(
    @Req() request: TenantRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantUserStatusDto,
  ) {
    return this.configuration.updateStatus(
      request.tenantAuth!.organizationId,
      request.tenantAuth!.user.id,
      id,
      dto,
    );
  }

  @Patch('users/:id/reporting')
  @UseGuards(TenantRoleGuard)
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  reporting(
    @Req() request: TenantRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantUserReportingDto,
  ) {
    return this.configuration.updateReporting(
      request.tenantAuth!.organizationId,
      id,
      dto,
    );
  }
}
