import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { PlatformBillingController } from './platform-billing.controller';
import { PlatformRazorpayController } from './platform-razorpay.controller';
import { PlatformBillingService } from './platform-billing.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [PlatformBillingController, PlatformRazorpayController],
  providers: [PlatformBillingService, RazorpayService],
  exports: [PlatformBillingService, RazorpayService],
})
export class PlatformBillingModule {}
