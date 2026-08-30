import { Module } from '@nestjs/common';
import { PlatformFeaturesController } from './features/platform-features.controller';
import { PlatformFeaturesService } from './features/platform-features.service';
import { PlatformPlanFeaturesService } from './plan-features/platform-plan-features.service';
import { PlatformPlansController } from './plans/platform-plans.controller';
import { PlatformPlansService } from './plans/platform-plans.service';

@Module({
  controllers: [PlatformPlansController, PlatformFeaturesController],
  providers: [
    PlatformPlansService,
    PlatformFeaturesService,
    PlatformPlanFeaturesService,
  ],
  exports: [
    PlatformPlansService,
    PlatformFeaturesService,
    PlatformPlanFeaturesService,
  ],
})
export class PlatformCatalogModule {}
