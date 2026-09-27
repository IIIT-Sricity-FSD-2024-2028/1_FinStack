import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformRolesController } from './platform-roles.controller';
import { PlatformRolesService } from './platform-roles.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformRolesController],
  providers: [PlatformRolesService],
})
export class PlatformRolesModule {}
