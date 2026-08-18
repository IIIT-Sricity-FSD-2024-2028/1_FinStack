import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PlatformHealthModule } from './health/platform-health.module';

@Module({
  imports: [DatabaseModule, PlatformHealthModule],
})
export class PlatformModule {}
