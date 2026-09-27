import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformPermissionsController } from './platform-permissions.controller';
import { PlatformPermissionsService } from './platform-permissions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformPermissionsController],
  providers: [PlatformPermissionsService],
})
export class PlatformPermissionsModule {}
