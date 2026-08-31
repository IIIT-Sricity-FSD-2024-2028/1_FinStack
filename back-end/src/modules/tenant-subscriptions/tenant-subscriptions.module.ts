import { Module } from '@nestjs/common';
import { CoreSubscriptionsModule } from '../../core/subscriptions/core-subscriptions.module';
import { PlatformCatalogModule } from '../../platform/catalog/platform-catalog.module';
import { TenantAuthModule } from '../tenant-auth/tenant-auth.module';
import { TenantSubscriptionsController } from './tenant-subscriptions.controller';
import { TenantPlansController } from './tenant-plans.controller';

@Module({
  imports: [CoreSubscriptionsModule, PlatformCatalogModule, TenantAuthModule],
  controllers: [TenantSubscriptionsController, TenantPlansController],
})
export class TenantSubscriptionsModule {}
