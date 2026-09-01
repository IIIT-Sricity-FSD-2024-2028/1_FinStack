import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../platform/auth/decorators/public.decorator';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { QuoteDto } from './dto/quote.dto';
import { TenantOnboardingService } from './tenant-onboarding.service';

@ApiTags('Tenant onboarding')
@Controller('onboarding')
export class TenantOnboardingController {
  constructor(private readonly onboarding: TenantOnboardingService) {}
  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List active plans available for onboarding' })
  listPlans() {
    return this.onboarding.listPlans();
  }

  @Public()
  @Post('quotes')
  quote(@Body() dto: QuoteDto) {
    return this.onboarding.quote(dto);
  }
}

@ApiTags('Tenant registration')
@Controller('registrations')
export class TenantRegistrationController {
  constructor(private readonly onboarding: TenantOnboardingService) {}
  @Public()
  @Post('organizations')
  @ApiOperation({
    summary: 'Register an organization and Configuration Manager',
  })
  register(@Body() dto: RegisterOrganizationDto) {
    return this.onboarding.register(dto);
  }
}
