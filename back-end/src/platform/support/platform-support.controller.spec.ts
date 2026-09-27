/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PlatformStaffStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PlatformAuthContext } from '../auth/auth.types';
import { PlatformAuthenticationGuard } from '../auth/guards/platform-authentication.guard';
import { PlatformAuthService } from '../auth/platform-auth.service';
import { PlatformPermissionGuard } from '../rbac/guards/platform-permission.guard';
import { PlatformSupportController } from './platform-support.controller';
import { PlatformSupportService } from './platform-support.service';

const ticketId = '7a0519c6-4570-4431-af1c-c41479d1992d';
const organizationId = '325e66a2-d98d-428f-bf75-0639de98dd09';

function authContext(permissions: string[]): PlatformAuthContext {
  return {
    sessionId: 'support-controller-session',
    staff: {
      id: '2db6c808-a9b9-4c1d-827c-81d935873a9b',
      firstName: 'Support',
      lastName: 'Agent',
      email: 'support@example.test',
      status: PlatformStaffStatus.ACTIVE,
    },
    roles: [],
    permissions,
  };
}

describe('PlatformSupportController', () => {
  let app: INestApplication<App>;
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    reply: jest.fn(),
    addInternalNote: jest.fn(),
    transitionStatus: jest.fn(),
  };

  beforeAll(async () => {
    const contexts = new Map<string, PlatformAuthContext>([
      ['view-token', authContext(['support.ticket.view'])],
      ['create-token', authContext(['support.ticket.create'])],
      ['update-token', authContext(['support.ticket.update'])],
      ['reply-token', authContext(['support.ticket.reply'])],
      ['note-token', authContext(['support.ticket.note'])],
      ['staff-token', authContext(['platform.staff.view'])],
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlatformSupportController],
      providers: [
        { provide: PlatformSupportService, useValue: service },
        {
          provide: PlatformAuthService,
          useValue: {
            authenticateAccessToken: jest.fn((token: string) => {
              const context = contexts.get(token);
              if (!context) {
                throw new UnauthorizedException({
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Platform authentication is required.',
                });
              }
              return context;
            }),
          },
        },
        { provide: APP_GUARD, useClass: PlatformAuthenticationGuard },
        { provide: APP_GUARD, useClass: PlatformPermissionGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1/platform');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service.findAll.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    service.create.mockResolvedValue({ id: ticketId });
    service.findOne.mockResolvedValue({ id: ticketId });
    service.update.mockResolvedValue({ id: ticketId });
    service.reply.mockResolvedValue({ id: ticketId });
    service.addInternalNote.mockResolvedValue({ id: ticketId });
    service.transitionStatus.mockResolvedValue({ id: ticketId });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for Support ticket routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/support/tickets')
      .expect(401);
  });

  it('rejects platform staff without the required Support permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/support/tickets')
      .set('Authorization', 'Bearer staff-token')
      .expect(403);
  });

  it('allows authorized staff to list Support tickets', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/support/tickets')
      .set('Authorization', 'Bearer view-token')
      .expect(200);

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('requires the dedicated ticket creation permission', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/support/tickets')
      .set('Authorization', 'Bearer view-token')
      .send({
        organizationId,
        category: TicketCategory.TECHNICAL,
        priority: TicketPriority.MEDIUM,
        subject: 'Receipt upload fails',
        description: 'Customer cannot upload receipts.',
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/platform/support/tickets')
      .set('Authorization', 'Bearer create-token')
      .send({
        organizationId,
        category: TicketCategory.TECHNICAL,
        priority: TicketPriority.MEDIUM,
        subject: 'Receipt upload fails',
        description: 'Customer cannot upload receipts.',
      })
      .expect(201);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId }),
      expect.objectContaining({
        staff: expect.objectContaining({ id: expect.any(String) }),
      }),
    );
    const [dto] = service.create.mock.calls[0] as [Record<string, unknown>];
    expect(dto).not.toHaveProperty('status');
  });

  it('validates route UUIDs before calling the Support service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/support/tickets/not-a-uuid')
      .set('Authorization', 'Bearer view-token')
      .expect(400);

    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('does not allow generic PATCH to modify lifecycle status', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/platform/support/tickets/${ticketId}`)
      .set('Authorization', 'Bearer update-token')
      .send({ status: TicketStatus.CLOSED })
      .expect(400);

    expect(service.update).not.toHaveBeenCalled();
  });

  it('rejects client-supplied staff identity on replies', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/platform/support/tickets/${ticketId}/messages`)
      .set('Authorization', 'Bearer reply-token')
      .send({ message: 'Checking this now.', authorStaffId: organizationId })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/support/tickets/${ticketId}/messages`)
      .set('Authorization', 'Bearer reply-token')
      .send({ message: 'Checking this now.' })
      .expect(201);

    expect(service.reply).toHaveBeenCalledWith(
      ticketId,
      { message: 'Checking this now.' },
      expect.objectContaining({
        staff: expect.objectContaining({ id: expect.any(String) }),
      }),
    );
  });

  it('protects internal notes with a dedicated permission and trusted staff context', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/platform/support/tickets/${ticketId}/internal-notes`)
      .set('Authorization', 'Bearer reply-token')
      .send({ note: 'Private note.' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/support/tickets/${ticketId}/internal-notes`)
      .set('Authorization', 'Bearer note-token')
      .send({ note: 'Private note.' })
      .expect(201);

    expect(service.addInternalNote).toHaveBeenCalledWith(
      ticketId,
      { note: 'Private note.' },
      expect.objectContaining({
        staff: expect.objectContaining({ id: expect.any(String) }),
      }),
    );
  });

  it('validates status transition DTOs and passes authenticated context to the service', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/platform/support/tickets/${ticketId}/status-transitions`)
      .set('Authorization', 'Bearer staff-token')
      .send({ status: TicketStatus.RESOLVED })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/support/tickets/${ticketId}/status-transitions`)
      .set('Authorization', 'Bearer view-token')
      .send({ status: 'DONE' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/support/tickets/${ticketId}/status-transitions`)
      .set('Authorization', 'Bearer view-token')
      .send({ status: TicketStatus.RESOLVED, note: 'Fixed.' })
      .expect(201);

    expect(service.transitionStatus).toHaveBeenCalledWith(
      ticketId,
      { status: TicketStatus.RESOLVED, note: 'Fixed.' },
      expect.objectContaining({
        staff: expect.objectContaining({ id: expect.any(String) }),
      }),
    );
  });
});
