import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { CoreSubscriptionsService } from '../../core/subscriptions/core-subscriptions.service';
import {
  AssignSubscriptionDto,
  CancelSubscriptionDto,
  ListSubscriptionsDto,
  UpdateSubscriptionPlanDto,
} from './dto/platform-subscription.dto';

interface RequestWithUser {
  user?: {
    id: string;
  };
}

@ApiTags('Platform subscriptions')
@ApiBearerAuth('platform-access-token')
@Controller('subscriptions')
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: CoreSubscriptionsService) {}

  @Get()
  @Permissions('subscription.subscription.view')
  @ApiOperation({ summary: 'List platform subscriptions' })
  findAll(@Query() query: ListSubscriptionsDto) {
    return this.subscriptions.findAll(query);
  }

  @Post()
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Create a new subscription (assign)' })
  create(@Body() dto: AssignSubscriptionDto, @Req() req: RequestWithUser) {
    const actorStaffId = req.user?.id;
    return this.subscriptions.startTrial(
      dto.organizationId,
      dto.planId,
      dto.trialDays || 14,
      actorStaffId,
    );
  }

  @Get(':id')
  @Permissions('subscription.subscription.view')
  @ApiOperation({ summary: 'Get subscription details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.findOne(id);
  }

  @Post(':id/activations')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Activate a subscription' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.subscriptions.activate(id, req.user?.id);
  }

  @Post(':id/upgrades')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Upgrade a subscription' })
  upgrade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
    @Req() req: RequestWithUser,
  ) {
    return this.subscriptions.upgrade(id, dto.planId, req.user?.id);
  }

  @Post(':id/downgrades')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Downgrade a subscription' })
  downgrade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
    @Req() req: RequestWithUser,
  ) {
    return this.subscriptions.downgrade(id, dto.planId, req.user?.id);
  }

  @Post(':id/suspensions')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Suspend a subscription' })
  suspend(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.subscriptions.suspend(id, 'Suspended by admin', req.user?.id);
  }

  @Post(':id/reactivations')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Reactivate a suspended subscription' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.subscriptions.reactivate(id, req.user?.id);
  }

  @Post(':id/cancellations')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Cancel a subscription' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.subscriptions.cancel(id, !!dto.immediate, req.user?.id);
  }

  @Post(':id/renewals')
  @Permissions('subscription.subscription.manage')
  @ApiOperation({ summary: 'Renew a subscription' })
  renew(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.subscriptions.renew(id, req.user?.id);
  }

  @Get(':id/history')
  @Permissions('subscription.subscription.view')
  @ApiOperation({ summary: 'Get subscription history' })
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.getHistory(id);
  }
}
