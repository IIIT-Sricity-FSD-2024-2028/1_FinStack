import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformSupportController } from './platform-support.controller';
import { PlatformSupportService } from './platform-support.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformSupportController],
  providers: [PlatformSupportService],
})
export class PlatformSupportModule {}
