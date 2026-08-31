import { Controller, Get } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PlatformPlansService } from '../../platform/catalog/plans/platform-plans.service';

@ApiTags('tenant-plans')
@ApiSecurity('role')
@ApiHeader({ name: 'role', enum: ['superuser', 'admin', 'user'], required: true })
@Controller('api/v1/tenant/plans')
export class TenantPlansController {
  constructor(private readonly plans: PlatformPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List active plans' })
  async findAll() {
    return this.plans.findAll({
      status: 'ACTIVE',
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      order: 'desc',
    } as any);
  }
}
