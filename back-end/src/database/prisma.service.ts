import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnApplicationShutdown
{
  // Disconnect after workers and HTTP requests drain, rather than during module teardown.
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
