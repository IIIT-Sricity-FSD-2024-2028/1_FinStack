import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CoreBillingService } from '../../core/billing/core-billing.service';
import { TenantAuthenticationGuard } from '../tenant-auth/guards/tenant-authentication.guard';
import {
  RecordRazorpayFailureDto,
  VerifyRazorpayPaymentDto,
} from './dto/tenant-billing.dto';

interface RequestWithTenantUser {
  user?: {
    organizationId?: string;
  };
}

@ApiTags('tenant-billing')
@ApiSecurity('role')
@ApiBearerAuth()
@UseGuards(TenantAuthenticationGuard)
@Controller('api/v1/tenant/billing')
export class TenantBillingController {
  constructor(private readonly billing: CoreBillingService) {}

  private getOrgId(req: RequestWithTenantUser) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new UnauthorizedException('Organization context missing');
    return orgId;
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current organization billing state' })
  getCurrentBilling(@Req() req: RequestWithTenantUser) {
    return this.billing.getCustomerBilling(this.getOrgId(req));
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List current organization invoices' })
  listInvoices(@Req() req: RequestWithTenantUser) {
    return this.billing.listInvoices({
      organizationId: this.getOrgId(req),
      limit: 20,
    });
  }

  @Get('payments')
  @ApiOperation({ summary: 'List current organization subscription payments' })
  listPayments(@Req() req: RequestWithTenantUser) {
    return this.billing.listPayments({
      organizationId: this.getOrgId(req),
      limit: 20,
    });
  }

  @Post('invoices/current')
  @ApiOperation({ summary: 'Create or return current subscription invoice' })
  ensureCurrentInvoice(@Req() req: RequestWithTenantUser) {
    return this.billing.ensureCurrentInvoiceForOrganization(this.getOrgId(req));
  }

  @Post('invoices/:invoiceId/razorpay-orders')
  @ApiOperation({ summary: 'Create Razorpay test order for an invoice' })
  createOrder(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() req: RequestWithTenantUser,
  ) {
    return this.billing.createRazorpayOrderForInvoice(
      this.getOrgId(req),
      invoiceId,
    );
  }

  @Post('razorpay-orders/current')
  @ApiOperation({ summary: 'Create Razorpay test order for current invoice' })
  createCurrentOrder(@Req() req: RequestWithTenantUser) {
    return this.billing.createRazorpayOrderForCurrentInvoice(
      this.getOrgId(req),
    );
  }

  @Post('razorpay-payments/verifications')
  @ApiOperation({ summary: 'Verify Razorpay checkout payment signature' })
  verifyPayment(
    @Body() dto: VerifyRazorpayPaymentDto,
    @Req() req: RequestWithTenantUser,
  ) {
    return this.billing.verifyRazorpayPayment(this.getOrgId(req), dto);
  }

  @Post('razorpay-payments/failures')
  @ApiOperation({ summary: 'Persist safe Razorpay checkout failure state' })
  recordFailure(
    @Body() dto: RecordRazorpayFailureDto,
    @Req() req: RequestWithTenantUser,
  ) {
    return this.billing.recordCheckoutFailure(this.getOrgId(req), dto);
  }
}
