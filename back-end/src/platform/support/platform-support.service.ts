import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketMessageAuthorType, TicketStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuthContext } from '../auth/auth.types';
import { CreateTicketInternalNoteDto } from './dto/create-ticket-internal-note.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import { TransitionTicketStatusDto } from './dto/transition-ticket-status.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';

const ticketListInclude = {
  organization: {
    select: { id: true, name: true, status: true },
  },
} satisfies Prisma.SupportTicketInclude;

const ticketDetailInclude = {
  organization: {
    select: { id: true, name: true, status: true },
  },
  messages: {
    orderBy: { createdAt: 'asc' },
    include: {
      authorStaff: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  internalNotes: {
    orderBy: { createdAt: 'asc' },
    include: {
      staff: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    include: {
      changedByStaff: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.SupportTicketInclude;

type SupportTicketListItem = Prisma.SupportTicketGetPayload<{
  include: typeof ticketListInclude;
}>;

type SupportTicketDetail = Prisma.SupportTicketGetPayload<{
  include: typeof ticketDetailInclude;
}>;

export interface PaginatedSupportTickets {
  items: SupportTicketListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
  ],
  [TicketStatus.ASSIGNED]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
  ],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.WAITING_FOR_CUSTOMER,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
  ],
  [TicketStatus.WAITING_FOR_CUSTOMER]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
  ],
  [TicketStatus.ESCALATED]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [],
};

@Injectable()
export class PlatformSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListSupportTicketsQueryDto,
  ): Promise<PaginatedSupportTickets> {
    if (query.organizationId) {
      await this.ensureOrganizationExists(query.organizationId);
    }

    const page = query.page;
    const limit = query.limit;
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: ticketListInclude,
        orderBy: { [query.sortBy]: query.order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async create(
    dto: CreateSupportTicketDto,
    auth: PlatformAuthContext,
  ): Promise<SupportTicketDetail> {
    await this.ensureOrganizationExists(dto.organizationId);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const ticket = await tx.supportTicket.create({
            data: {
              ticketNumber: this.generateTicketNumber(),
              organizationId: dto.organizationId,
              requesterUserId: dto.requesterUserId,
              requesterName: this.optionalTrim(dto.requesterName),
              requesterEmail: this.optionalLower(dto.requesterEmail),
              category: dto.category,
              priority: dto.priority,
              subject: dto.subject.trim(),
              description: dto.description.trim(),
              status: TicketStatus.OPEN,
            },
          });

          await tx.ticketStatusHistory.create({
            data: {
              ticketId: ticket.id,
              previousStatus: null,
              newStatus: TicketStatus.OPEN,
              changedByStaffId: auth.staff.id,
              note: 'Ticket created.',
            },
          });

          return tx.supportTicket.findUniqueOrThrow({
            where: { id: ticket.id },
            include: ticketDetailInclude,
          });
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error) && attempt < 2) {
          continue;
        }
        this.handlePrismaError(error);
      }
    }

    throw new ConflictException({
      code: 'SUPPORT_TICKET_NUMBER_CONFLICT',
      message: 'A unique ticket number could not be generated.',
    });
  }

  async findOne(id: string): Promise<SupportTicketDetail> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: ticketDetailInclude,
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found.',
      });
    }
    return ticket;
  }

  async update(
    id: string,
    dto: UpdateSupportTicketDto,
  ): Promise<SupportTicketDetail> {
    await this.ensureTicketExists(id);
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        requesterName: this.optionalTrim(dto.requesterName),
        requesterEmail: this.optionalLower(dto.requesterEmail),
        category: dto.category,
        priority: dto.priority,
        subject: dto.subject?.trim(),
        description: dto.description?.trim(),
      },
    });
    return this.findOne(id);
  }

  async reply(
    id: string,
    dto: CreateTicketMessageDto,
    auth: PlatformAuthContext,
  ): Promise<SupportTicketDetail> {
    const ticket = await this.ensureTicketExists(id);
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException({
        code: 'SUPPORT_TICKET_CLOSED',
        message: 'Closed support tickets cannot receive replies.',
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          authorType: TicketMessageAuthorType.PLATFORM_STAFF,
          authorStaffId: auth.staff.id,
          message: dto.message.trim(),
        },
      }),
      this.prisma.supportTicket.update({
        where: { id },
        data: ticket.firstResponseAt ? {} : { firstResponseAt: now },
      }),
    ]);

    return this.findOne(id);
  }

  async addInternalNote(
    id: string,
    dto: CreateTicketInternalNoteDto,
    auth: PlatformAuthContext,
  ): Promise<SupportTicketDetail> {
    await this.ensureTicketExists(id);
    await this.prisma.ticketInternalNote.create({
      data: {
        ticketId: id,
        staffId: auth.staff.id,
        note: dto.note.trim(),
      },
    });
    return this.findOne(id);
  }

  async transitionStatus(
    id: string,
    dto: TransitionTicketStatusDto,
    auth: PlatformAuthContext,
  ): Promise<SupportTicketDetail> {
    this.ensureTransitionPermission(dto.status, auth);
    const ticket = await this.ensureTicketExists(id);
    this.ensureValidTransition(ticket.status, dto.status);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportTicket.update({
        where: { id },
        data: this.buildLifecycleUpdate(ticket.status, dto.status, now),
      }),
      this.prisma.ticketStatusHistory.create({
        data: {
          ticketId: id,
          previousStatus: ticket.status,
          newStatus: dto.status,
          changedByStaffId: auth.staff.id,
          note: this.optionalTrim(dto.note),
        },
      }),
    ]);

    return this.findOne(id);
  }

  private buildWhere(
    query: ListSupportTicketsQueryDto,
  ): Prisma.SupportTicketWhereInput {
    const where: Prisma.SupportTicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = query.category;
    if (query.organizationId) where.organizationId = query.organizationId;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { requesterName: { contains: search, mode: 'insensitive' } },
        { requesterEmail: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  private async ensureOrganizationExists(id: string): Promise<void> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found.',
      });
    }
  }

  private async ensureTicketExists(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true, firstResponseAt: true },
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found.',
      });
    }
    return ticket;
  }

  private ensureValidTransition(
    currentStatus: TicketStatus,
    nextStatus: TicketStatus,
  ): void {
    if (currentStatus === nextStatus) {
      throw new BadRequestException({
        code: 'INVALID_TICKET_STATUS_TRANSITION',
        message: `Cannot transition ticket from ${currentStatus} to ${nextStatus}.`,
      });
    }

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException({
        code: 'INVALID_TICKET_STATUS_TRANSITION',
        message: `Cannot transition ticket from ${currentStatus} to ${nextStatus}.`,
      });
    }
  }

  private ensureTransitionPermission(
    nextStatus: TicketStatus,
    auth: PlatformAuthContext,
  ): void {
    const requiredPermission =
      nextStatus === TicketStatus.RESOLVED || nextStatus === TicketStatus.CLOSED
        ? 'support.ticket.resolve'
        : nextStatus === TicketStatus.ESCALATED
          ? 'support.ticket.escalate'
          : 'support.ticket.update';

    if (!auth.permissions.includes(requiredPermission)) {
      throw new ForbiddenException({
        code: 'PLATFORM_PERMISSION_DENIED',
        message: 'You do not have permission to perform this action.',
      });
    }
  }

  private buildLifecycleUpdate(
    currentStatus: TicketStatus,
    nextStatus: TicketStatus,
    now: Date,
  ): Prisma.SupportTicketUpdateInput {
    const data: Prisma.SupportTicketUpdateInput = { status: nextStatus };
    if (nextStatus === TicketStatus.RESOLVED) {
      data.resolvedAt = now;
      data.closedAt = null;
    }
    if (nextStatus === TicketStatus.CLOSED) {
      data.closedAt = now;
      if (currentStatus !== TicketStatus.RESOLVED) {
        data.resolvedAt = now;
      }
    }
    if (
      currentStatus === TicketStatus.RESOLVED &&
      nextStatus === TicketStatus.IN_PROGRESS
    ) {
      data.resolvedAt = null;
      data.closedAt = null;
    }
    return data;
  }

  private generateTicketNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `TCK-${date}-${suffix}`;
  }

  private optionalTrim(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private optionalLower(value: string | undefined): string | undefined {
    return this.optionalTrim(value)?.toLowerCase();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private handlePrismaError(error: unknown): never {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException({
        code: 'SUPPORT_TICKET_UNIQUE_CONSTRAINT',
        message: 'A support ticket with the same unique field already exists.',
      });
    }
    throw error;
  }
}
