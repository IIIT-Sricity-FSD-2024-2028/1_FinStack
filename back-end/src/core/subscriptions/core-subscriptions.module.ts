import { Module } from '@nestjs/common';
import { CoreSubscriptionsService } from './core-subscriptions.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CoreSubscriptionsService],
  exports: [CoreSubscriptionsService],
})
export class CoreSubscriptionsModule {}
