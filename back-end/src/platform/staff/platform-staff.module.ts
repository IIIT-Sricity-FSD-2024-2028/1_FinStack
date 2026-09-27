import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformStaffController } from './platform-staff.controller';
import { PlatformStaffService } from './platform-staff.service';

@Module({
  imports: [DatabaseModule, PlatformAuthModule],
  controllers: [PlatformStaffController],
  providers: [PlatformStaffService],
})
export class PlatformStaffModule {}
