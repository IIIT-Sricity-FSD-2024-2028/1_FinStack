import { Module } from '@nestjs/common';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { CoreSubscriptionsModule } from '../../core/subscriptions/core-subscriptions.module';

@Module({
  imports: [CoreSubscriptionsModule],
  controllers: [PlatformSubscriptionsController],
})
export class PlatformSubscriptionsModule {}
