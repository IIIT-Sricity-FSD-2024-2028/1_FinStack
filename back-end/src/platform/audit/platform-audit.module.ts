import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformAuditLogService } from './platform-audit.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformAuditController],
  providers: [PlatformAuditLogService],
  exports: [PlatformAuditLogService],
})
export class PlatformAuditModule {}
