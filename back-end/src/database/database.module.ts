import { Global, Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, DatabaseHealthService],
  exports: [PrismaService, DatabaseHealthService],
})
export class DatabaseModule {}
