import { Module } from '@nestjs/common';
import { CoreBillingModule } from '../../core/billing/core-billing.module';
import { TenantAuthModule } from '../tenant-auth/tenant-auth.module';
import { TenantBillingController } from './tenant-billing.controller';

@Module({
  imports: [CoreBillingModule, TenantAuthModule],
  controllers: [TenantBillingController],
})
export class TenantBillingModule {}
