import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CoreBillingService } from '../../core/billing/core-billing.service';
import { Public } from '../auth/decorators/public.decorator';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Platform billing webhooks')
@Controller('billing/razorpay/webhooks')
export class PlatformBillingWebhookController {
  constructor(private readonly billing: CoreBillingService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Process Razorpay billing webhook' })
  processWebhook(
    @Req() req: RawBodyRequest,
    @Body() payload: Record<string, unknown>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.billing.handleRazorpayWebhook({
      rawBody: req.rawBody || Buffer.from(JSON.stringify(payload)),
      signature,
      eventId,
      payload,
    });
  }
}
