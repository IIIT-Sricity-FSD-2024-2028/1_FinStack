import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantRegisterOrganizationDto } from './dto/tenant-register-organization.dto';
import { TenantRegistrationService } from './tenant-registration.service';

@ApiTags('tenant-registration')
@Controller('api/v1/tenant/registrations')
export class TenantRegistrationController {
  constructor(private readonly registration: TenantRegistrationService) {}

  @Post('organizations')
  @ApiOperation({
    summary: 'Register a tenant organization and start its selected plan trial',
  })
  registerOrganization(@Body() dto: TenantRegisterOrganizationDto) {
    return this.registration.registerOrganization(dto);
  }
}
