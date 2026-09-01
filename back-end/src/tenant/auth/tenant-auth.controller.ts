import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../platform/auth/decorators/public.decorator';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { TenantAuthenticationGuard } from './guards/tenant-authentication.guard';
import { TenantRequest } from './tenant-auth.types';
import { Req } from '@nestjs/common';
import { TenantAuthService } from './tenant-auth.service';

@ApiTags('Tenant authentication')
@Controller('auth')
export class TenantAuthController {
  constructor(private readonly auth: TenantAuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: TenantLoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth('tenant-access-token')
  @UseGuards(TenantAuthenticationGuard)
  @Get('me')
  me(@Req() request: TenantRequest) {
    return request.tenantAuth;
  }
}
