import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAuthContext } from '../../auth/auth.types';
import { CurrentPlatformAuth } from '../../auth/decorators/current-platform-auth.decorator';
import { Permissions } from '../../rbac/decorators/platform-permissions.decorator';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { ListFeaturesQueryDto } from './dto/list-features-query.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { PlatformFeaturesService } from './platform-features.service';

@ApiTags('Platform features')
@ApiBearerAuth('platform-access-token')
@Controller('features')
export class PlatformFeaturesController {
  constructor(private readonly features: PlatformFeaturesService) {}

  @Get()
  @Permissions('subscription.feature.view')
  @ApiOperation({ summary: 'List, search, and filter features' })
  findAll(@Query() query: ListFeaturesQueryDto) {
    return this.features.findAll(query);
  }

  @Post()
  @Permissions('subscription.feature.manage')
  @ApiOperation({ summary: 'Create a new feature definition' })
  create(
    @Body() dto: CreateFeatureDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.features.create(dto, auth.staff.id);
  }

  @Get(':id')
  @Permissions('subscription.feature.view')
  @ApiOperation({ summary: 'Get feature details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.features.findOne(id);
  }

  @Patch(':id')
  @Permissions('subscription.feature.manage')
  @ApiOperation({ summary: 'Update feature metadata' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.features.update(id, dto, auth.staff.id);
  }

  @Post(':id/activations')
  @Permissions('subscription.feature.manage')
  @ApiOperation({ summary: 'Activate a feature' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.features.activate(id, auth.staff.id);
  }

  @Post(':id/deactivations')
  @Permissions('subscription.feature.manage')
  @ApiOperation({ summary: 'Deactivate a feature' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.features.deactivate(id, auth.staff.id);
  }
}
