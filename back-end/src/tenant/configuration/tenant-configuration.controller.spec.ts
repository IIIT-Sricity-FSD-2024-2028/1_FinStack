import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import request from 'supertest';
import { Server } from 'node:http';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthService } from '../auth/tenant-auth.service';
import { TenantConfigurationController } from './tenant-configuration.controller';
import { TenantConfigurationService } from './tenant-configuration.service';
import { TenantHierarchyService } from './tenant-hierarchy.service';

// No DatabaseModule or real auth service: these HTTP tests cannot connect to a DB.
describe('Configuration read authorization', () => {
  let app: INestApplication;
  let server: Server;
  const organizationId = '10000000-0000-4000-8000-000000000001';
  const foreignOrganizationId = '10000000-0000-4000-8000-000000000002';
  interface ReadQuery {
    where: { id?: string; organizationId?: string; status?: string };
    select?: { slug?: boolean };
  }
  const readMock = () => jest.fn<unknown, [ReadQuery]>();
  const prisma = {
    tenantUser: {
      findMany: readMock(),
      groupBy: readMock(),
      count: readMock(),
    },
    organization: { findUnique: readMock() },
    organizationSubscription: { findFirst: readMock() },
  };
  const authenticate = jest.fn((token: string) => {
    const role = token.replace('foreign:', '') as TenantRole;
    if (!Object.values(TenantRole).includes(role)) {
      throw new UnauthorizedException();
    }
    const orgId = token.startsWith('foreign:')
      ? foreignOrganizationId
      : organizationId;
    return {
      organizationId: orgId,
      user: {
        id: '20000000-0000-4000-8000-000000000001',
        organizationId: orgId,
        employeeId: 'CFG-001',
        firstName: 'Config',
        lastName: 'Manager',
        email: 'config@example.test',
        role,
        status: TenantUserStatus.ACTIVE,
      },
    };
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantConfigurationController],
      providers: [
        TenantConfigurationService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantAuthService, useValue: { authenticate } },
        { provide: TenantHierarchyService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1/tenant');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.tenantUser.findMany.mockReturnValue([]);
    prisma.tenantUser.groupBy.mockReturnValue([]);
    prisma.tenantUser.count.mockReturnValue(0);
    prisma.organization.findUnique.mockReturnValue({ id: organizationId });
    prisma.organizationSubscription.findFirst.mockReturnValue(null);
  });

  function expectNoReads() {
    for (const model of Object.values(prisma)) {
      for (const read of Object.values(model))
        expect(read).not.toHaveBeenCalled();
    }
  }

  describe.each(['users', 'roles', 'dashboard'])('GET %s', (route) => {
    const path = `/api/v1/tenant/configuration/${route}`;

    it.each(Object.values(TenantRole))('enforces the %s role', async (role) => {
      const response = await request(server)
        .get(path)
        .set('Authorization', `Bearer ${role}`)
        // Caller-supplied legacy role headers must not override JWT identity.
        .set('role', 'CONFIGURATION_MANAGER');
      expect(response.status).toBe(
        role === TenantRole.CONFIGURATION_MANAGER ? 200 : 403,
      );
      if (role !== TenantRole.CONFIGURATION_MANAGER) expectNoReads();
      else if (route === 'users') expect(response.body).toEqual({ items: [] });
      else if (route === 'roles') {
        const body = response.body as {
          items: { key: string; capabilities: string[]; userCount: number }[];
        };
        expect(body.items).toHaveLength(Object.values(TenantRole).length);
        expect(typeof body.items[0].key).toBe('string');
        expect(Array.isArray(body.items[0].capabilities)).toBe(true);
        expect(body.items[0].userCount).toBe(0);
      } else {
        expect(response.body).toEqual({
          organization: { id: organizationId },
          subscription: null,
          activeUsers: 0,
          totalUsers: 0,
        });
      }
    });

    it('denies missing authentication before reading data', async () => {
      await request(server).get(path).expect(401);
      expect(authenticate).not.toHaveBeenCalled();
      expectNoReads();
    });

    it('denies invalid bearer authentication before reading data', async () => {
      await request(server)
        .get(path)
        .set('Authorization', 'Bearer invalid')
        .expect(401);
      expectNoReads();
    });

    it.each(['', 'foreign:'])(
      'uses only authenticated tenant scope (%s), ignoring tenant overrides',
      async (prefix) => {
        const expectedOrg = prefix ? foreignOrganizationId : organizationId;
        const injectedOrg = prefix ? organizationId : foreignOrganizationId;
        await request(server)
          .get(path)
          .query({ organizationId: injectedOrg, orgId: injectedOrg })
          .set('organizationId', injectedOrg)
          .set('Authorization', `Bearer ${prefix}CONFIGURATION_MANAGER`)
          .expect(200);
        const reads = Object.values(prisma).flatMap((model) =>
          Object.values(model).flatMap((read) => read.mock.calls),
        );
        expect(reads.length).toBeGreaterThan(0);
        for (const [query] of reads) {
          expect(query.where).toEqual(
            expect.objectContaining(
              route === 'dashboard' && query.select?.slug
                ? { id: expectedOrg }
                : { organizationId: expectedOrg },
            ),
          );
        }
      },
    );
  });
});
