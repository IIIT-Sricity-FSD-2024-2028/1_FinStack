import { Module } from '@nestjs/common';
import { CoreBillingModule } from '../../core/billing/core-billing.module';
import { PlatformBillingController } from './platform-billing.controller';
import { PlatformBillingWebhookController } from './platform-billing-webhook.controller';

@Module({
  imports: [CoreBillingModule],
  controllers: [PlatformBillingController, PlatformBillingWebhookController],
})
export class PlatformBillingModule {}
