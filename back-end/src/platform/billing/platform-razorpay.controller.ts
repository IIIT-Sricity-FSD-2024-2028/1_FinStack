import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPlatformAuth } from '../auth/decorators/current-platform-auth.decorator';
import { PlatformAuthContext } from '../auth/auth.types';
import { Public } from '../auth/decorators/public.decorator';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { VerifyRazorpayPaymentDto } from './dto/razorpay-payment.dto';
import { RazorpayService } from './razorpay.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Platform Razorpay billing')
@ApiBearerAuth('platform-access-token')
@Controller('billing')
export class PlatformRazorpayController {
  constructor(private readonly razorpay: RazorpayService) {}

  @Post('invoices/:invoiceId/payment-orders')
  @Permissions('billing.payment.manage')
  @ApiOperation({ summary: 'Create a Razorpay payment order for an invoice' })
  createPaymentOrder(
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @CurrentPlatformAuth() platformAuth: PlatformAuthContext,
  ) {
    return this.razorpay.createPaymentOrder(invoiceId, platformAuth.staff.id);
  }

  @Post('razorpay-payments/verifications')
  @Permissions('billing.payment.manage')
  @ApiOperation({ summary: 'Verify and finalize a Razorpay checkout payment' })
  verifyPayment(
    @Body() dto: VerifyRazorpayPaymentDto,
    @CurrentPlatformAuth() platformAuth: PlatformAuthContext,
  ) {
    return this.razorpay.verifyCheckoutPayment(dto, platformAuth.staff.id);
  }

  @Post('invoices/:invoiceId/razorpay-payments/verifications')
  @Permissions('billing.payment.manage')
  @ApiOperation({ summary: 'Verify a Razorpay payment for an invoice' })
  verifyInvoicePayment(
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @Body() dto: VerifyRazorpayPaymentDto,
    @CurrentPlatformAuth() platformAuth: PlatformAuthContext,
  ) {
    return this.razorpay.verifyCheckoutPayment(
      { ...dto, invoiceId },
      platformAuth.staff.id,
    );
  }

  @Public()
  @Post('razorpay/webhooks')
  @ApiOperation({ summary: 'Process a signed Razorpay billing webhook' })
  processWebhook(
    @Req() request: RawBodyRequest,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.razorpay.handleWebhook(
      request.rawBody ?? Buffer.alloc(0),
      signature,
      eventId,
    );
  }
}
