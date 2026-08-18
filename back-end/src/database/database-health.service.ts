import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export type DatabaseAvailability = 'available' | 'unavailable';

export interface DatabaseHealth {
  status: DatabaseAvailability;
  checkedAt: string;
}

@Injectable()
export class DatabaseHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<DatabaseHealth> {
    const checkedAt = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'available', checkedAt };
    } catch {
      return { status: 'unavailable', checkedAt };
    }
  }
}
