import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantAuthService } from './tenant-auth.service';
import { TenantLoginDto } from './dto/tenant-login.dto';

@ApiTags('tenant-auth')
@Controller('api/v1/tenant/auth')
export class TenantAuthController {
  constructor(private readonly tenantAuthService: TenantAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login for tenant users' })
  login(@Body() dto: TenantLoginDto) {
    return this.tenantAuthService.login(dto);
  }
}
