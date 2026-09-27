import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { PlatformBillingModule } from '../platform/billing/platform-billing.module';
import { PlatformSubscriptionsModule } from '../platform/subscriptions/platform-subscriptions.module';
import { TenantAuthModule } from './auth/tenant-auth.module';
import { TenantAuthController } from './auth/tenant-auth.controller';
import { TenantCommercialController } from './commercial/tenant-commercial.controller';
import { TenantCommercialService } from './commercial/tenant-commercial.service';
import { TenantConfigurationController } from './configuration/tenant-configuration.controller';
import { TenantConfigurationService } from './configuration/tenant-configuration.service';
import { TenantExpensesModule } from './expenses/tenant-expenses.module';
import {
  TenantOnboardingController,
  TenantRegistrationController,
} from './onboarding/tenant-onboarding.controller';
import { TenantOnboardingService } from './onboarding/tenant-onboarding.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    TenantAuthModule,
    TenantExpensesModule,
    PlatformSubscriptionsModule,
    PlatformBillingModule,
  ],
  controllers: [
    TenantAuthController,
    TenantOnboardingController,
    TenantRegistrationController,
    TenantCommercialController,
    TenantConfigurationController,
  ],
  providers: [
    TenantOnboardingService,
    TenantCommercialService,
    TenantConfigurationService,
  ],
})
export class TenantModule {}
