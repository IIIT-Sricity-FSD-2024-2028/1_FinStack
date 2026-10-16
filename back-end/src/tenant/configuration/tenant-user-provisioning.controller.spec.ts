import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantRole } from '@prisma/client';
import { Server } from 'node:http';
import request from 'supertest';
import { TenantAuthService } from '../auth/tenant-auth.service';
import { TenantConfigurationController } from './tenant-configuration.controller';
import { TenantConfigurationService } from './tenant-configuration.service';
import { TenantHierarchyService } from './tenant-hierarchy.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';

// Real guards, DTO validation and controller; no DatabaseModule, DB access or writes.
describe('employee provisioning HTTP boundary', () => {
  let app: INestApplication;
  let server: Server;
  const organizationId = '10000000-0000-4000-8000-000000000001';
  const createUser = jest.fn((tenant: string, dto: CreateTenantUserDto) =>
    Promise.resolve({
      id: 'immutable-user-uuid',
      employeeId:
        dto.employeeId ||
        'ACM-10000000000040008000000000000001-0123456789ABCDEF0123',
      organizationId: tenant,
    }),
  );
  const authenticate = jest.fn((role: string) => {
    if (!Object.values(TenantRole).includes(role as TenantRole))
      throw new UnauthorizedException();
    return Promise.resolve({
      organizationId,
      user: {
        id: 'cm-user',
        organizationId,
        role,
        firstName: 'Config',
        lastName: 'Manager',
      },
    });
  });
  const payload = {
    firstName: 'Alex',
    lastName: 'Tester',
    email: 'alex@example.test',
    initialPassword: 'fixture-password-only',
    role: TenantRole.EXPENSE_SUBMITTER,
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantConfigurationController],
      providers: [
        { provide: TenantConfigurationService, useValue: { createUser } },
        { provide: TenantHierarchyService, useValue: {} },
        { provide: TenantAuthService, useValue: { authenticate } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it.each(Object.values(TenantRole))(
    'enforces provisioning permission for %s without trusting a role header',
    async (role) => {
      const result = await request(server)
        .post('/configuration/users')
        .set('Authorization', `Bearer ${role}`)
        .set('role', 'CONFIGURATION_MANAGER')
        .send(payload);
      expect(result.status).toBe(
        role === TenantRole.CONFIGURATION_MANAGER ? 201 : 403,
      );
      if (role === TenantRole.CONFIGURATION_MANAGER) {
        expect(createUser).toHaveBeenCalledWith(
          organizationId,
          expect.objectContaining(payload),
        );
        const body = result.body as { employeeId: string };
        expect(body.employeeId).toMatch(/^ACM-/);
      } else expect(createUser).not.toHaveBeenCalled();
    },
  );
  it('denies unauthenticated provisioning before reaching the service', async () => {
    expect(
      (await request(server).post('/configuration/users').send(payload)).status,
    ).toBe(401);
    expect(createUser).not.toHaveBeenCalled();
  });
  it.each([
    { organizationId: 'another-tenant' },
    { employeeId: null },
    { employeeId: '' },
  ])(
    'rejects tenant overrides and invalid explicit legacy IDs: %j',
    async (extra) => {
      expect(
        (
          await request(server)
            .post('/configuration/users')
            .set('Authorization', 'Bearer CONFIGURATION_MANAGER')
            .send({ ...payload, ...extra })
        ).status,
      ).toBe(400);
      expect(createUser).not.toHaveBeenCalled();
    },
  );
  it('continues accepting a valid legacy employeeId for published callers', async () => {
    const response = await request(server)
      .post('/configuration/users')
      .set('Authorization', 'Bearer CONFIGURATION_MANAGER')
      .send({ ...payload, employeeId: 'LEGACY-1' });
    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ employeeId: 'LEGACY-1' }),
    );
  });
});
