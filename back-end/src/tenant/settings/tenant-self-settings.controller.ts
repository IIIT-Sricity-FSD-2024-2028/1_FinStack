import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TenantRole } from '@prisma/client';
import { TenantAuthenticationGuard } from '../auth/guards/tenant-authentication.guard';
import { TenantRoleGuard } from '../auth/guards/tenant-role.guard';
import { TenantRoles } from '../auth/decorators/tenant-roles.decorator';
import { TenantRequest } from '../auth/tenant-auth.types';
import {
  ChangeOwnPasswordDto,
  ProfileSettingsDto,
} from './tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';

// Revocation accepts no target identity or other caller-controlled fields.
export class RevokeOwnSessionsDto {}

@Controller('me/settings')
@UseGuards(TenantAuthenticationGuard, TenantRoleGuard)
@TenantRoles(TenantRole.MANAGER)
export class TenantSelfSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}

  @Get('profile')
  profile(@Req() req: TenantRequest) {
    return this.settings.profile(req.tenantAuth!);
  }

  @Patch('profile')
  updateProfile(@Req() req: TenantRequest, @Body() dto: ProfileSettingsDto) {
    return this.settings.updateProfile(req.tenantAuth!, dto);
  }

  @Post('password-changes')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  changePassword(@Req() req: TenantRequest, @Body() dto: ChangeOwnPasswordDto) {
    return this.settings.changePassword(req.tenantAuth!, dto);
  }

  @Post('session-revocations')
  revokeSessions(@Req() req: TenantRequest, @Body() dto: RevokeOwnSessionsDto) {
    void dto;
    return this.settings.revokeSessions(req.tenantAuth!);
  }
}
