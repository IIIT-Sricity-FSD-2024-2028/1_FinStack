import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformOrganizationsController } from './platform-organizations.controller';
import { PlatformOrganizationsService } from './platform-organizations.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformOrganizationsController],
  providers: [PlatformOrganizationsService],
})
export class PlatformOrganizationsModule {}
