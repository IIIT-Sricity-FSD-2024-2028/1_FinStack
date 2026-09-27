import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformSubscriptionsController],
  providers: [PlatformSubscriptionsService],
  exports: [PlatformSubscriptionsService],
})
export class PlatformSubscriptionsModule {}
