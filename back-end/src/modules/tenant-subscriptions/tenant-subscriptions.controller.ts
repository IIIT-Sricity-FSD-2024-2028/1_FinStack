import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CoreSubscriptionsService } from '../../core/subscriptions/core-subscriptions.service';
import { TenantAuthenticationGuard } from '../tenant-auth/guards/tenant-authentication.guard';
import { TenantCreateSubscriptionDto, TenantUpdateSubscriptionDto } from './dto/tenant-subscription.dto';

interface RequestWithTenantUser {
  user?: {
    organizationId?: string;
  };
}

@ApiTags('tenant-subscriptions')
@ApiSecurity('role')
@ApiHeader({ name: 'role', enum: ['superuser', 'admin', 'user'], required: true })
@ApiBearerAuth()
@UseGuards(TenantAuthenticationGuard)
@Controller('api/v1/tenant/subscriptions')
export class TenantSubscriptionsController {
  constructor(private readonly subscriptions: CoreSubscriptionsService) {}

  private getOrgId(req: RequestWithTenantUser) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new UnauthorizedException('Organization context missing');
    return orgId;
  }

  @Get()
  @ApiOperation({ summary: 'List subscriptions for current organization' })
  async findAll(@Req() req: RequestWithTenantUser) {
    const sub = await this.subscriptions.findByOrganizationId(this.getOrgId(req));
    return sub ? [sub] : [];
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current organization subscription' })
  findCurrent(@Req() req: RequestWithTenantUser) {
    return this.subscriptions.findByOrganizationId(this.getOrgId(req));
  }

  @Post()
  @ApiOperation({ summary: 'Start a trial or subscribe to a plan' })
  create(@Body() dto: TenantCreateSubscriptionDto, @Req() req: RequestWithTenantUser) {
    return this.subscriptions.startTrial(this.getOrgId(req), dto.planId, 14);
  }

  @Post('current/upgrades')
  @ApiOperation({ summary: 'Upgrade current subscription plan' })
  async upgradeCurrent(@Body() dto: TenantUpdateSubscriptionDto, @Req() req: RequestWithTenantUser) {
    const sub = await this.subscriptions.findByOrganizationId(this.getOrgId(req));
    if (!sub) throw new UnauthorizedException('No active subscription found');
    return this.subscriptions.upgrade(sub.id, dto.planId);
  }

  @Post('current/downgrades')
  @ApiOperation({ summary: 'Downgrade current subscription plan' })
  async downgradeCurrent(@Body() dto: TenantUpdateSubscriptionDto, @Req() req: RequestWithTenantUser) {
    const sub = await this.subscriptions.findByOrganizationId(this.getOrgId(req));
    if (!sub) throw new UnauthorizedException('No active subscription found');
    return this.subscriptions.downgrade(sub.id, dto.planId);
  }

  @Post('current/cancellations')
  @ApiOperation({ summary: 'Cancel current subscription at period end' })
  async cancelCurrent(@Req() req: RequestWithTenantUser) {
    const sub = await this.subscriptions.findByOrganizationId(this.getOrgId(req));
    if (!sub) throw new UnauthorizedException('No active subscription found');
    return this.subscriptions.cancel(sub.id, false);
  }
}
