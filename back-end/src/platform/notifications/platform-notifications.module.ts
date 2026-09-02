import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformNotificationsController } from './platform-notifications.controller';
import { PlatformNotificationsService } from './platform-notifications.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformNotificationsController],
  providers: [PlatformNotificationsService],
  exports: [PlatformNotificationsService],
})
export class PlatformNotificationsModule {}
