import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PlatformHealth,
  PlatformHealthService,
} from './platform-health.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Platform health')
@Public()
@Controller('health')
export class PlatformHealthController {
  constructor(private readonly healthService: PlatformHealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check platform API and database availability' })
  getHealth(): Promise<PlatformHealth> {
    return this.healthService.check();
  }
}
