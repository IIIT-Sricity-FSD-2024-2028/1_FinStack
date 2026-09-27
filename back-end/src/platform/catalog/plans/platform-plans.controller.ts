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
import { PlatformAuthContext } from '../../auth/auth.types';
import { CurrentPlatformAuth } from '../../auth/decorators/current-platform-auth.decorator';
import { Permissions } from '../../rbac/decorators/platform-permissions.decorator';
import { AssignPlanFeatureDto } from '../plan-features/dto/assign-plan-feature.dto';
import { UpdatePlanFeatureDto } from '../plan-features/dto/update-plan-feature.dto';
import { PlatformPlanFeaturesService } from '../plan-features/platform-plan-features.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansQueryDto } from './dto/list-plans-query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlatformPlansService } from './platform-plans.service';

@ApiTags('Platform plans')
@ApiBearerAuth('platform-access-token')
@Controller('plans')
export class PlatformPlansController {
  constructor(
    private readonly plans: PlatformPlansService,
    private readonly planFeatures: PlatformPlanFeaturesService,
  ) {}

  @Get()
  @Permissions('subscription.plan.view')
  @ApiOperation({ summary: 'List, search, and filter plans' })
  findAll(@Query() query: ListPlansQueryDto) {
    return this.plans.findAll(query);
  }

  @Post()
  @Permissions('subscription.plan.manage')
  @ApiOperation({ summary: 'Create a new subscription plan' })
  create(
    @Body() dto: CreatePlanDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.plans.create(dto, auth.staff.id);
  }

  @Get(':id')
  @Permissions('subscription.plan.view')
  @ApiOperation({ summary: 'Get plan details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.findOne(id);
  }

  @Patch(':id')
  @Permissions('subscription.plan.manage')
  @ApiOperation({ summary: 'Update plan metadata' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.plans.update(id, dto, auth.staff.id);
  }

  @Post(':id/activations')
  @Permissions('subscription.plan.manage')
  @ApiOperation({ summary: 'Activate a plan' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.plans.activate(id, auth.staff.id);
  }

  @Post(':id/deactivations')
  @Permissions('subscription.plan.manage')
  @ApiOperation({ summary: 'Deactivate a plan' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.plans.deactivate(id, auth.staff.id);
  }

  @Get(':id/features')
  @Permissions('subscription.plan.view')
  @ApiOperation({ summary: 'List features assigned to a plan' })
  findFeatures(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.findFeatures(id);
  }

  @Post(':id/features')
  @Permissions('subscription.plan.manage')
  @ApiOperation({ summary: 'Assign a feature to a plan' })
  assignFeature(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPlanFeatureDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.planFeatures.assign(id, dto, auth.staff.id);
  }

  @Patch(':id/features/:featureId')
  @Permissions('subscription.plan.manage')
  @ApiOperation({ summary: 'Update a plan feature assignment' })
  updateFeature(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('featureId', ParseUUIDPipe) featureId: string,
    @Body() dto: UpdatePlanFeatureDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.planFeatures.update(id, featureId, dto, auth.staff.id);
  }

  @Delete(':id/features/:featureId')
  @Permissions('subscription.plan.manage')
  @ApiOperation({ summary: 'Remove a feature from a plan' })
  removeFeature(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('featureId', ParseUUIDPipe) featureId: string,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.planFeatures.remove(id, featureId, auth.staff.id);
  }
}
