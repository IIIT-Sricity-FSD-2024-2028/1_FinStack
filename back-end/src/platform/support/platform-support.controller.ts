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
import { CurrentPlatformAuth } from '../auth/decorators/current-platform-auth.decorator';
import { PlatformAuthContext } from '../auth/auth.types';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import { CreateTicketInternalNoteDto } from './dto/create-ticket-internal-note.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import { TransitionTicketStatusDto } from './dto/transition-ticket-status.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { PlatformSupportService } from './platform-support.service';

@ApiTags('Platform support')
@ApiBearerAuth('platform-access-token')
@Controller('support/tickets')
export class PlatformSupportController {
  constructor(private readonly support: PlatformSupportService) {}

  @Get()
  @Permissions('support.ticket.view')
  @ApiOperation({ summary: 'List, search, and filter support tickets' })
  findAll(@Query() query: ListSupportTicketsQueryDto) {
    return this.support.findAll(query);
  }

  @Post()
  @Permissions('support.ticket.create')
  @ApiOperation({ summary: 'Create a support ticket' })
  create(
    @Body() dto: CreateSupportTicketDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.support.create(dto, auth);
  }

  @Get(':id')
  @Permissions('support.ticket.view')
  @ApiOperation({ summary: 'Get support ticket details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.findOne(id);
  }

  @Patch(':id')
  @Permissions('support.ticket.update')
  @ApiOperation({ summary: 'Update support ticket metadata' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.support.update(id, dto);
  }

  @Post(':id/messages')
  @Permissions('support.ticket.reply')
  @ApiOperation({ summary: 'Reply to a support ticket as platform staff' })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.support.reply(id, dto, auth);
  }

  @Post(':id/internal-notes')
  @Permissions('support.ticket.note')
  @ApiOperation({ summary: 'Add an internal support note' })
  addInternalNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketInternalNoteDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.support.addInternalNote(id, dto, auth);
  }

  @Post(':id/status-transitions')
  @Permissions('support.ticket.view')
  @ApiOperation({ summary: 'Transition support ticket status' })
  transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionTicketStatusDto,
    @CurrentPlatformAuth() auth: PlatformAuthContext,
  ) {
    return this.support.transitionStatus(id, dto, auth);
  }
}
