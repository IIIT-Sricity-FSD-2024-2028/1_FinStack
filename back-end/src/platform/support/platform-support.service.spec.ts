/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationStatus,
  PlatformStaffStatus,
  Prisma,
  TicketCategory,
  TicketMessageAuthorType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { PlatformAuthContext } from '../auth/auth.types';
import { PlatformSupportService } from './platform-support.service';

const auth: PlatformAuthContext = {
  sessionId: 'session-id',
  staff: {
    id: '2db6c808-a9b9-4c1d-827c-81d935873a9b',
    firstName: 'Support',
    lastName: 'Agent',
    email: 'support@example.test',
    status: PlatformStaffStatus.ACTIVE,
  },
  roles: [],
  permissions: [
    'support.ticket.view',
    'support.ticket.create',
    'support.ticket.update',
    'support.ticket.reply',
    'support.ticket.note',
    'support.ticket.resolve',
    'support.ticket.escalate',
  ],
};

const organization = {
  id: '325e66a2-d98d-428f-bf75-0639de98dd09',
  name: 'Acme Finance',
  status: OrganizationStatus.ACTIVE,
};

const ticket = {
  id: '7a0519c6-4570-4431-af1c-c41479d1992d',
  ticketNumber: 'TCK-20260829-ABC12345',
  organizationId: organization.id,
  requesterUserId: null,
  requesterName: 'Riya Requester',
  requesterEmail: 'riya@example.test',
  category: TicketCategory.TECHNICAL,
  priority: TicketPriority.HIGH,
  subject: 'Receipt upload fails',
  description: 'Receipt upload fails on PNG files.',
  status: TicketStatus.OPEN,
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date('2026-08-29T00:00:00.000Z'),
  updatedAt: new Date('2026-08-29T00:00:00.000Z'),
  organization,
};

function serviceWithPrisma(prisma: Record<string, unknown>) {
  return new PlatformSupportService(prisma as never);
}

describe('PlatformSupportService', () => {
  it('lists tickets with search, filters, sorting, and pagination metadata', async () => {
    const findMany = jest.fn().mockResolvedValue([ticket]);
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue(organization) },
      supportTicket: {
        findMany,
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
    };
    const service = serviceWithPrisma(prisma);

    await expect(
      service.findAll({
        page: 2,
        limit: 10,
        search: 'receipt',
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
        category: TicketCategory.TECHNICAL,
        organizationId: organization.id,
        sortBy: 'createdAt',
        order: 'desc',
      }),
    ).resolves.toMatchObject({
      items: [ticket],
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    const findManyArg = findMany.mock.calls[0]?.[0] as {
      skip: number;
      take: number;
      where: {
        status?: TicketStatus;
        priority?: TicketPriority;
        category?: TicketCategory;
        organizationId?: string;
        OR?: unknown[];
      };
    };
    expect(findManyArg.skip).toBe(10);
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where.status).toBe(TicketStatus.OPEN);
    expect(findManyArg.where.priority).toBe(TicketPriority.HIGH);
    expect(findManyArg.where.category).toBe(TicketCategory.TECHNICAL);
    expect(findManyArg.where.organizationId).toBe(organization.id);
    expect(Array.isArray(findManyArg.where.OR)).toBe(true);
  });

  it('rejects list filtering for an unknown organization', async () => {
    const service = serviceWithPrisma({
      organization: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.findAll({
        page: 1,
        limit: 20,
        organizationId: organization.id,
        sortBy: 'createdAt',
        order: 'desc',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects ticket creation for an unknown organization', async () => {
    const service = serviceWithPrisma({
      organization: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create(
        {
          organizationId: organization.id,
          category: TicketCategory.ACCOUNT,
          priority: TicketPriority.MEDIUM,
          subject: 'Login issue',
          description: 'Customer cannot log in.',
        },
        auth,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates tickets in OPEN status and records initial status history', async () => {
    const create = jest.fn().mockResolvedValue(ticket);
    const createHistory = jest.fn().mockResolvedValue({});
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      ...ticket,
      messages: [],
      internalNotes: [],
      statusHistory: [],
    });
    const transactionClient = {
      supportTicket: { create, findUniqueOrThrow },
      ticketStatusHistory: { create: createHistory },
    };
    const service = serviceWithPrisma({
      organization: { findUnique: jest.fn().mockResolvedValue(organization) },
      $transaction: jest
        .fn()
        .mockImplementation(
          (callback: (tx: typeof transactionClient) => unknown) =>
            callback(transactionClient),
        ),
    });

    await service.create(
      {
        organizationId: organization.id,
        requesterName: ' Riya Requester ',
        requesterEmail: 'RIYA@EXAMPLE.TEST',
        category: TicketCategory.TECHNICAL,
        priority: TicketPriority.HIGH,
        subject: ' Receipt upload fails ',
        description: ' PNG upload fails. ',
      },
      auth,
    );

    const createArg = create.mock.calls[0]?.[0] as {
      data: {
        status: TicketStatus;
        requesterName?: string;
        requesterEmail?: string;
        subject: string;
        description: string;
      };
    };
    expect(createArg.data.status).toBe(TicketStatus.OPEN);
    expect(createArg.data.requesterName).toBe('Riya Requester');
    expect(createArg.data.requesterEmail).toBe('riya@example.test');
    expect(createArg.data.subject).toBe('Receipt upload fails');
    expect(createArg.data.description).toBe('PNG upload fails.');

    const historyArg = createHistory.mock.calls[0]?.[0] as {
      data: {
        previousStatus: TicketStatus | null;
        newStatus: TicketStatus;
        changedByStaffId: string;
      };
    };
    expect(historyArg.data.previousStatus).toBeNull();
    expect(historyArg.data.newStatus).toBe(TicketStatus.OPEN);
    expect(historyArg.data.changedByStaffId).toBe(auth.staff.id);
  });

  it('retries ticket creation when a generated ticket number collides', async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on ticketNumber',
      { code: 'P2002', clientVersion: 'test' },
    );
    const create = jest.fn().mockResolvedValue(ticket);
    const createHistory = jest.fn().mockResolvedValue({});
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      ...ticket,
      messages: [],
      internalNotes: [],
      statusHistory: [],
    });
    const transactionClient = {
      supportTicket: { create, findUniqueOrThrow },
      ticketStatusHistory: { create: createHistory },
    };
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(uniqueError)
      .mockImplementation(
        (callback: (tx: typeof transactionClient) => unknown) =>
          callback(transactionClient),
      );
    const service = serviceWithPrisma({
      organization: { findUnique: jest.fn().mockResolvedValue(organization) },
      $transaction: transaction,
    });

    await expect(
      service.create(
        {
          organizationId: organization.id,
          category: TicketCategory.TECHNICAL,
          priority: TicketPriority.HIGH,
          subject: 'Receipt upload fails',
          description: 'PNG upload fails.',
        },
        auth,
      ),
    ).resolves.toMatchObject({ id: ticket.id });

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('uses authenticated platform staff context for replies', async () => {
    const createMessage = jest.fn().mockResolvedValue({});
    const updateTicket = jest.fn().mockResolvedValue({});
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: ticket.id,
        status: TicketStatus.OPEN,
        firstResponseAt: null,
      })
      .mockResolvedValueOnce({ ...ticket, messages: [], internalNotes: [] });
    const service = serviceWithPrisma({
      supportTicket: {
        findUnique,
        update: updateTicket,
      },
      ticketMessage: { create: createMessage },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
    });

    await service.reply(
      ticket.id,
      { message: ' We are checking this. ' },
      auth,
    );

    const messageArg = createMessage.mock.calls[0]?.[0] as {
      data: {
        authorType: TicketMessageAuthorType;
        authorStaffId?: string;
        authorUserId?: string;
        message: string;
      };
    };
    expect(messageArg.data.authorType).toBe(
      TicketMessageAuthorType.PLATFORM_STAFF,
    );
    expect(messageArg.data.authorStaffId).toBe(auth.staff.id);
    expect(messageArg.data).not.toHaveProperty('authorUserId');
    expect(messageArg.data.message).toBe('We are checking this.');
    expect(updateTicket.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ticket.id },
      data: { firstResponseAt: expect.any(Date) },
    });
  });

  it('uses authenticated platform staff context for internal notes', async () => {
    const createNote = jest.fn().mockResolvedValue({});
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: ticket.id,
        status: TicketStatus.OPEN,
        firstResponseAt: null,
      })
      .mockResolvedValueOnce({ ...ticket, messages: [], internalNotes: [] });
    const service = serviceWithPrisma({
      supportTicket: { findUnique },
      ticketInternalNote: { create: createNote },
    });

    await service.addInternalNote(
      ticket.id,
      { note: ' Customer is blocked. ' },
      auth,
    );

    expect(createNote.mock.calls[0]?.[0]).toMatchObject({
      data: {
        ticketId: ticket.id,
        staffId: auth.staff.id,
        note: 'Customer is blocked.',
      },
    });
  });

  it('rejects invalid lifecycle transitions', async () => {
    const service = serviceWithPrisma({
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: ticket.id,
          status: TicketStatus.OPEN,
          firstResponseAt: null,
        }),
      },
    });

    await expect(
      service.transitionStatus(
        ticket.id,
        { status: TicketStatus.CLOSED },
        auth,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the target-specific permission for transitions', async () => {
    const service = serviceWithPrisma({});

    await expect(
      service.transitionStatus(
        ticket.id,
        { status: TicketStatus.RESOLVED },
        {
          ...auth,
          permissions: ['support.ticket.view', 'support.ticket.reply'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires ticket update permission for ordinary status transitions', async () => {
    const service = serviceWithPrisma({});

    await expect(
      service.transitionStatus(
        ticket.id,
        { status: TicketStatus.IN_PROGRESS },
        {
          ...auth,
          permissions: ['support.ticket.view', 'support.ticket.reply'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records valid status transitions and lifecycle timestamps atomically', async () => {
    const updateTicket = jest.fn().mockResolvedValue({});
    const createHistory = jest.fn().mockResolvedValue({});
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: ticket.id,
        status: TicketStatus.IN_PROGRESS,
        firstResponseAt: null,
      })
      .mockResolvedValueOnce({
        ...ticket,
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date('2026-08-29T00:10:00.000Z'),
        messages: [],
        internalNotes: [],
        statusHistory: [],
      });
    const service = serviceWithPrisma({
      supportTicket: { findUnique, update: updateTicket },
      ticketStatusHistory: { create: createHistory },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
    });

    await service.transitionStatus(
      ticket.id,
      { status: TicketStatus.RESOLVED, note: ' Issue fixed. ' },
      auth,
    );

    expect(updateTicket.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: expect.any(Date),
        closedAt: null,
      },
    });
    expect(createHistory.mock.calls[0]?.[0]).toMatchObject({
      data: {
        ticketId: ticket.id,
        previousStatus: TicketStatus.IN_PROGRESS,
        newStatus: TicketStatus.RESOLVED,
        changedByStaffId: auth.staff.id,
        note: 'Issue fixed.',
      },
    });
  });
});
