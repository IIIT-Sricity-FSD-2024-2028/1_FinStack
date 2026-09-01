import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { CoreBillingService } from './core-billing.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [CoreBillingService, RazorpayService],
  exports: [CoreBillingService, RazorpayService],
})
export class CoreBillingModule {}
