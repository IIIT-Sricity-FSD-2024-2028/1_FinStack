import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';
import { TenantAuthenticationGuard } from '../auth/guards/tenant-authentication.guard';
import { TenantRoleGuard } from '../auth/guards/tenant-role.guard';
import { TenantRoles } from '../auth/decorators/tenant-roles.decorator';
import { TenantRequest } from '../auth/tenant-auth.types';
import { ChangeSubscriptionPlanDto } from '../../platform/subscriptions/dto/change-subscription-plan.dto';
import { CancelSubscriptionDto } from '../../platform/subscriptions/dto/cancel-subscription.dto';
import { TenantCommercialService } from './tenant-commercial.service';
import { TenantRazorpayVerifyDto } from './dto/tenant-razorpay-verify.dto';

@ApiTags('Tenant subscription and billing')
@ApiBearerAuth('tenant-access-token')
@Controller()
@UseGuards(TenantAuthenticationGuard, TenantRoleGuard)
@TenantRoles(TenantRole.CONFIGURATION_MANAGER)
export class TenantCommercialController {
  constructor(private readonly commercial: TenantCommercialService) {}
  @Get('subscription') getSubscription(@Req() req: TenantRequest) {
    return this.commercial.getSubscription(req.tenantAuth!.organizationId);
  }
  @Get('subscription/invoices') listInvoices(@Req() req: TenantRequest) {
    return this.commercial.listInvoices(req.tenantAuth!.organizationId);
  }
  @Get('subscription/payments') listPayments(@Req() req: TenantRequest) {
    return this.commercial.listPayments(req.tenantAuth!.organizationId);
  }
  @Post('subscription/plan-changes') changePlan(
    @Req() req: TenantRequest,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    return this.commercial.changePlan(req.tenantAuth!.organizationId, dto);
  }
  @Post('subscription/cancellations') cancel(
    @Req() req: TenantRequest,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.commercial.cancel(req.tenantAuth!.organizationId, dto);
  }
  @Post('billing/invoices/:invoiceId/payment-orders') createPaymentOrder(
    @Req() req: TenantRequest,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.commercial.createPaymentOrder(
      req.tenantAuth!.organizationId,
      invoiceId,
    );
  }
  @Post('billing/razorpay/verify') verifyPayment(
    @Req() req: TenantRequest,
    @Body() dto: TenantRazorpayVerifyDto,
  ) {
    return this.commercial.verifyPayment(req.tenantAuth!.organizationId, dto);
  }
}
