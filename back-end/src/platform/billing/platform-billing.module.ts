import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformBillingController } from './platform-billing.controller';
import { PlatformBillingService } from './platform-billing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformBillingController],
  providers: [PlatformBillingService],
  exports: [PlatformBillingService],
})
export class PlatformBillingModule {}
