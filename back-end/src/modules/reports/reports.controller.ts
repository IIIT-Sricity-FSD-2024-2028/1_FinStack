import { Controller, Get } from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiSecurity('role')
@ApiHeader({ name: 'role', enum: ['superuser', 'admin', 'user'], required: true })
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll() {
    return this.reportsService.findAll();
  }

  @Get('summary')
  summary() {
    return this.reportsService.summary();
  }
}
