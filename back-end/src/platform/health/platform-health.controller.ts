import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PlatformHealth,
  PlatformHealthService,
} from './platform-health.service';

@ApiTags('Platform health')
@Controller('health')
export class PlatformHealthController {
  constructor(private readonly healthService: PlatformHealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check platform API and database availability' })
  getHealth(): Promise<PlatformHealth> {
    return this.healthService.check();
  }
}
