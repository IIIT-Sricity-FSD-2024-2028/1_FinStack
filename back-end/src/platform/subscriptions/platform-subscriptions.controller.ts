import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAuthContext } from '../auth/auth.types';
import { CurrentPlatformAuth } from '../auth/decorators/current-platform-auth.decorator';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import {
  ListSubscriptionHistoryQueryDto,
  ListSubscriptionsQueryDto,
} from './dto/list-subscriptions-query.dto';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

@ApiTags('Platform subscriptions')
@ApiBearerAuth('platform-access-token')
@Controller('subscriptions')
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: PlatformSubscriptionsService) {}

  @Get()
  @Permissions('subscription.subscription.view')
  @ApiOperation({ summary: 'List subscriptions' })
  findAll(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptions.findAll(query);
  }

  @Post()
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Assign a plan and start a subscription' })
  assign(
    @Body() dto: AssignSubscriptionDto,
    @CurrentPlatformAuth() platformAuth: PlatformAuthContext,
  ) {
    return this.subscriptions.assign(dto, platformAuth.staff.id);
  }

  @Get(':id')
  @Permissions('subscription.subscription.view')
  @ApiOperation({ summary: 'Get subscription detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.findOne(id);
  }

  @Get(':id/history')
  @Permissions('subscription.subscription.view')
  @ApiOperation({ summary: 'Get subscription history' })
  findHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSubscriptionHistoryQueryDto,
  ) {
    return this.subscriptions.findHistory(id, query);
  }

  @Post(':id/plan-changes')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Request a payment-gated plan change' })
  changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionPlanDto,
    @CurrentPlatformAuth() platformAuth: PlatformAuthContext,
  ) {
    return this.subscriptions.requestPlanChange(id, dto, platformAuth.staff.id);
  }

  @Post(':id/cancellations')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Cancel a subscription' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
    @CurrentPlatformAuth() platformAuth: PlatformAuthContext,
  ) {
    return this.subscriptions.cancel(id, dto, platformAuth.staff.id);
  }

  @Post(':id/reactivations')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Reactivate an eligible paid subscription' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformAuth() platformAuth: PlatformAuthContext,
  ) {
    return this.subscriptions.reactivate(id, platformAuth.staff.id);
  }
}
