import { Injectable } from '@nestjs/common';
import {
  DatabaseHealth,
  DatabaseHealthService,
} from '../../database/database-health.service';

export interface PlatformHealth {
  status: 'healthy' | 'degraded';
  api: {
    status: 'available';
  };
  database: DatabaseHealth;
  checkedAt: string;
}

@Injectable()
export class PlatformHealthService {
  constructor(private readonly databaseHealth: DatabaseHealthService) {}

  async check(): Promise<PlatformHealth> {
    const database = await this.databaseHealth.check();

    return {
      status: database.status === 'available' ? 'healthy' : 'degraded',
      api: { status: 'available' },
      database,
      checkedAt: new Date().toISOString(),
    };
  }
}
