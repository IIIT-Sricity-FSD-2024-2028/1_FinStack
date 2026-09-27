import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformHealthController } from './platform-health.controller';
import { PlatformHealthService } from './platform-health.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformHealthController],
  providers: [PlatformHealthService],
})
export class PlatformHealthModule {}
