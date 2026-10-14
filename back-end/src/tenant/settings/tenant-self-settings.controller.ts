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
  TenantPreferencesDto,
} from './tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';

// These routes only operate on the authenticated user's own profile. Keep
// organization/configuration routes protected by the Configuration Manager role.
@Controller('me/settings')
@UseGuards(TenantAuthenticationGuard, TenantRoleGuard)
@TenantRoles(...Object.values(TenantRole))
export class TenantSelfSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}

  @Get('profile')
  profile(@Req() req: TenantRequest) {
    return this.settings.profile(req.tenantAuth!);
  }

  @Get('preferences')
  preferences(@Req() req: TenantRequest) {
    return this.settings.preferences(req.tenantAuth!);
  }

  @Patch('preferences')
  updatePreferences(
    @Req() req: TenantRequest,
    @Body() dto: TenantPreferencesDto,
  ) {
    return this.settings.updatePreferences(req.tenantAuth!, dto);
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
  revokeSessions(@Req() req: TenantRequest) {
    return this.settings.revokeSessions(req.tenantAuth!);
  }
}
