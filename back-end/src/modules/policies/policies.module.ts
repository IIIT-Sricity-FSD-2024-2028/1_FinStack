import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CategoriesModule } from '../categories/categories.module';
import { PoliciesController } from './policies.controller';
import { PoliciesRepository } from './policies.repository';
import { PoliciesService } from './policies.service';

@Module({
  imports: [AuditModule, CategoriesModule],
  controllers: [PoliciesController],
  providers: [PoliciesService, PoliciesRepository],
  exports: [PoliciesService, PoliciesRepository],
})
export class PoliciesModule {}
