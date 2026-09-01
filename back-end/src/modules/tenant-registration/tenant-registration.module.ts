import { Module } from '@nestjs/common';
import { CoreSubscriptionsModule } from '../../core/subscriptions/core-subscriptions.module';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../users/users.module';
import { TenantRegistrationController } from './tenant-registration.controller';
import { TenantRegistrationService } from './tenant-registration.service';

@Module({
  imports: [DatabaseModule, CoreSubscriptionsModule, UsersModule],
  controllers: [TenantRegistrationController],
  providers: [TenantRegistrationService],
})
export class TenantRegistrationModule {}
