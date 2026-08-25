import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { OrganizationStatus, PlatformStaffStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { createHash, randomUUID } from 'crypto';
import helmet from 'helmet';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DatabaseHealthService } from '../src/database/database-health.service';
import { PrismaService } from '../src/database/prisma.service';
import { seedPlatformAuthRbac } from '../prisma/seed';

describe('FinStack foundation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let staffId: string;
  let roleId: string;
  let bootstrapStaffId: string | undefined;
  const extraRoleIds: string[] = [];
  const extraStaffIds: string[] = [];
  const extraOrganizationIds: string[] = [];
  const email = `auth-e2e-${Date.now()}@example.test`;
  const password = 'Auth-e2e-password-2026!';

  beforeAll(async () => {
    process.env.PLATFORM_JWT_ACCESS_SECRET =
      'e2e-secret-with-more-than-thirty-two-characters';
    process.env.PLATFORM_JWT_ISSUER = 'finstack-e2e';
    process.env.PLATFORM_JWT_AUDIENCE = 'finstack-admin-e2e';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseHealthService)
      .useValue({
        check: jest.fn().mockResolvedValue({
          status: 'available',
          checkedAt: '2026-08-18T00:00:00.000Z',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    const swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('FinStack E2E').build(),
    );
    SwaggerModule.setup('api', app, swaggerDocument);
    await app.init();

    prisma = app.get(PrismaService);
    await seedPlatformAuthRbac(prisma);
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'platform.staff.view' },
    });
    const role = await prisma.platformRole.create({
      data: {
        key: `AUTH_E2E_${Date.now()}`,
        name: `Auth E2E ${Date.now()}`,
        rolePermissions: {
          create: { permissionId: permission.id },
        },
      },
    });
    roleId = role.id;
    const staff = await prisma.platformStaff.create({
      data: {
        firstName: 'Auth',
        lastName: 'Test',
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        roles: { create: { roleId } },
      },
    });
    staffId = staff.id;
  });

  afterAll(async () => {
    if (bootstrapStaffId) {
      await prisma.platformStaff.delete({ where: { id: bootstrapStaffId } });
    }
    if (extraOrganizationIds.length > 0) {
      await prisma.organization.deleteMany({
        where: { id: { in: extraOrganizationIds } },
      });
    }
    if (extraStaffIds.length > 0) {
      await prisma.platformStaff.deleteMany({
        where: { id: { in: extraStaffIds } },
      });
    }
    if (staffId) {
      await prisma.platformStaff.delete({ where: { id: staffId } });
    }
    if (extraRoleIds.length > 0) {
      await prisma.platformRole.deleteMany({
        where: { id: { in: extraRoleIds } },
      });
    }
    if (roleId) {
      await prisma.platformRole.delete({ where: { id: roleId } });
    }
    await app.close();
  });

  async function createPlatformActor(permissionKeys: string[]): Promise<{
    token: string;
    staffId: string;
  }> {
    const suffix = `${Date.now()}-${randomUUID()}`;
    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });
    expect(permissions).toHaveLength(permissionKeys.length);

    const role = await prisma.platformRole.create({
      data: {
        key: `ORG_E2E_${suffix}`.replace(/-/g, '_').slice(0, 100),
        name: `Organization E2E ${suffix}`.slice(0, 150),
        rolePermissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
    });
    extraRoleIds.push(role.id);

    const staff = await prisma.platformStaff.create({
      data: {
        firstName: 'Org',
        lastName: 'E2E',
        email: `org-e2e-${suffix}@example.test`,
        passwordHash: await argon2.hash('Org-e2e-password-2026!'),
        roles: { create: { roleId: role.id } },
      },
    });
    extraStaffIds.push(staff.id);

    const session = await prisma.platformAuthSession.create({
      data: {
        staffId: staff.id,
        refreshTokenHash: createHash('sha256').update(suffix).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const token = new JwtService().sign(
      { sub: staff.id, sid: session.id, type: 'access' },
      {
        algorithm: 'HS256',
        secret: process.env.PLATFORM_JWT_ACCESS_SECRET,
        issuer: process.env.PLATFORM_JWT_ISSUER,
        audience: process.env.PLATFORM_JWT_AUDIENCE,
        expiresIn: '5m',
      },
    );
    return { token, staffId: staff.id };
  }

  async function createAccessToken(permissionKeys: string[]): Promise<string> {
    return (await createPlatformActor(permissionKeys)).token;
  }

  async function createManagedStaff(
    status: PlatformStaffStatus = PlatformStaffStatus.ACTIVE,
    roleId?: string,
  ) {
    const suffix = `${Date.now()}-${randomUUID()}`;
    const staff = await prisma.platformStaff.create({
      data: {
        firstName: 'Managed',
        lastName: 'Staff',
        email: `managed-${suffix}@example.test`,
        passwordHash: await argon2.hash('Managed-password-2026!'),
        status,
        roles: roleId ? { create: { roleId } } : undefined,
      },
    });
    extraStaffIds.push(staff.id);
    return staff;
  }

  async function createManagedRole(
    permissionKeys: string[] = [],
    isActive = true,
  ) {
    const suffix = `${Date.now()}-${randomUUID()}`;
    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });
    expect(permissions).toHaveLength(permissionKeys.length);
    const role = await prisma.platformRole.create({
      data: {
        key: `STAFF_ROLE_E2E_${suffix}`.replace(/-/g, '_').slice(0, 100),
        name: `Staff Role E2E ${suffix}`.slice(0, 150),
        description: 'Role assignment E2E fixture',
        isActive,
        rolePermissions:
          permissions.length > 0
            ? {
                create: permissions.map((permission) => ({
                  permissionId: permission.id,
                })),
              }
            : undefined,
      },
    });
    extraRoleIds.push(role.id);
    return role;
  }

  it('serves platform health without the legacy role header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/health')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'healthy',
        api: { status: 'available' },
        database: { status: 'available' },
      },
    });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves Swagger with Helmet compatibility enabled', async () => {
    const response = await request(app.getHttpServer()).get('/api').expect(200);
    expect(response.text).toContain('Swagger UI');
  });

  it('preserves the legacy role-header guard for Client V1 routes', async () => {
    await request(app.getHttpServer()).get('/users').expect(403);
    await request(app.getHttpServer())
      .get('/users')
      .set('role', 'user')
      .expect(200);
  });

  it('enforces database uniqueness and foreign keys', async () => {
    await expect(
      prisma.platformStaff.create({
        data: {
          firstName: 'Duplicate',
          lastName: 'Email',
          email,
          passwordHash: await argon2.hash('not-used'),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.platformStaffRole.create({
        data: { staffId, roleId: randomUUID() },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects organization creation lifecycle status input', async () => {
    const token = await createAccessToken(['platform.organization.create']);

    await request(app.getHttpServer())
      .post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Forbidden Status LLC',
        primaryEmail: `forbidden-status-${Date.now()}@example.test`,
        status: OrganizationStatus.SUSPENDED,
      })
      .expect(400);
  });

  it('creates organizations in provisioning status', async () => {
    const token = await createAccessToken(['platform.organization.create']);

    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Provisioning Org LLC',
        primaryEmail: `provisioning-org-${Date.now()}@example.test`,
      })
      .expect(201);
    const body = response.body as unknown as {
      data: { id: string; status: OrganizationStatus };
    };
    extraOrganizationIds.push(body.data.id);

    expect(body.data.status).toBe(OrganizationStatus.PROVISIONING);
  });

  it('validates organization route IDs before hitting Prisma', async () => {
    const token = await createAccessToken(['platform.organization.view']);

    await request(app.getHttpServer())
      .get('/api/v1/platform/organizations/hello')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('enforces organization route authentication and permissions', async () => {
    const viewToken = await createAccessToken(['platform.organization.view']);
    const noOrganizationPermissionToken = await createAccessToken([
      'platform.staff.view',
    ]);

    await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${noOrganizationPermissionToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(200);
  });

  it('requires dedicated lifecycle permissions for organization suspension', async () => {
    const createToken = await createAccessToken([
      'platform.organization.create',
    ]);
    const viewToken = await createAccessToken(['platform.organization.view']);
    const suspendToken = await createAccessToken([
      'platform.organization.suspend',
    ]);

    const created = await request(app.getHttpServer())
      .post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${createToken}`)
      .send({
        name: 'Lifecycle Permission LLC',
        primaryEmail: `lifecycle-permission-${Date.now()}@example.test`,
      })
      .expect(201);
    const body = created.body as unknown as { data: { id: string } };
    extraOrganizationIds.push(body.data.id);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/organizations/${body.data.id}/suspensions`)
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/organizations/${body.data.id}/suspensions`)
      .set('Authorization', `Bearer ${suspendToken}`)
      .expect(201);
  });

  it('protects staff list/detail and returns only safe staff fields', async () => {
    const viewToken = await createAccessToken(['platform.staff.view']);
    const withoutPermission = await createAccessToken([
      'platform.organization.view',
    ]);

    await request(app.getHttpServer())
      .get('/api/v1/platform/staff')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/platform/staff')
      .set('Authorization', `Bearer ${withoutPermission}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/api/v1/platform/staff?search=Auth&status=ACTIVE&page=1&limit=10')
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(200);
    const listBody = list.body as unknown as {
      data: { items: Array<Record<string, unknown>> };
    };
    expect(listBody.data.items.length).toBeGreaterThan(0);
    expect(listBody.data.items[0]).not.toHaveProperty('passwordHash');
    expect(listBody.data.items[0]).not.toHaveProperty('authSessions');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/platform/staff/${staffId}`)
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(200);
    const detailBody = detail.body as unknown as {
      data: Record<string, unknown>;
    };
    expect(detailBody.data).toMatchObject({ id: staffId, email });
    expect(detailBody.data).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .get('/api/v1/platform/staff/not-a-uuid')
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/platform/staff/${randomUUID()}`)
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(404);
  });

  it('creates active staff with normalized identity and a hashed password', async () => {
    const createToken = await createAccessToken(['platform.staff.create']);
    const createEmail = `created-${Date.now()}@example.test`;
    const initialPassword = 'Created-password-2026!';
    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/staff')
      .set('Authorization', `Bearer ${createToken}`)
      .send({
        firstName: '  Created ',
        lastName: ' Staff  ',
        email: createEmail.toUpperCase(),
        initialPassword,
      })
      .expect(201);
    const createBody = response.body as unknown as {
      data: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        status: PlatformStaffStatus;
      };
    };
    const created = createBody.data;
    extraStaffIds.push(created.id);
    expect(created).toMatchObject({
      email: createEmail,
      firstName: 'Created',
      lastName: 'Staff',
      status: PlatformStaffStatus.ACTIVE,
    });
    expect(created).not.toHaveProperty('passwordHash');

    const stored = await prisma.platformStaff.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.passwordHash).not.toBe(initialPassword);
    await expect(
      argon2.verify(stored.passwordHash, initialPassword),
    ).resolves.toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/platform/staff')
      .set('Authorization', `Bearer ${createToken}`)
      .send({
        firstName: 'Duplicate',
        lastName: 'Staff',
        email: createEmail.toUpperCase(),
        initialPassword,
      })
      .expect(409);

    for (const forbidden of [
      { status: PlatformStaffStatus.INACTIVE },
      { roles: [roleId] },
      { passwordHash: 'caller-controlled' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/v1/platform/staff')
        .set('Authorization', `Bearer ${createToken}`)
        .send({
          firstName: 'Rejected',
          lastName: 'Staff',
          email: `rejected-${randomUUID()}@example.test`,
          initialPassword,
          ...forbidden,
        })
        .expect(400);
    }
  });

  it('updates only normalized staff profile fields', async () => {
    const updateToken = await createAccessToken(['platform.staff.update']);
    const target = await createManagedStaff();
    const conflict = await createManagedStaff();
    const nextEmail = `updated-${Date.now()}@example.test`;

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/platform/staff/${target.id}`)
      .set('Authorization', `Bearer ${updateToken}`)
      .send({
        firstName: '  Updated ',
        lastName: ' Name ',
        email: nextEmail.toUpperCase(),
      })
      .expect(200);
    const updateBody = response.body as unknown as {
      data: Record<string, unknown>;
    };
    expect(updateBody.data).toMatchObject({
      firstName: 'Updated',
      lastName: 'Name',
      email: nextEmail,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/platform/staff/${target.id}`)
      .set('Authorization', `Bearer ${updateToken}`)
      .send({ email: conflict.email.toUpperCase() })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/platform/staff/${randomUUID()}`)
      .set('Authorization', `Bearer ${updateToken}`)
      .send({ firstName: 'Missing' })
      .expect(404);

    for (const forbidden of [
      { status: PlatformStaffStatus.INACTIVE },
      { passwordHash: 'caller-controlled' },
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/v1/platform/staff/${target.id}`)
        .set('Authorization', `Bearer ${updateToken}`)
        .send(forbidden)
        .expect(400);
    }
  });

  it('deactivates active staff and revokes all target sessions', async () => {
    const disableToken = await createAccessToken(['platform.staff.disable']);
    const target = await createManagedStaff();
    const suspended = await createManagedStaff(PlatformStaffStatus.SUSPENDED);
    await prisma.platformAuthSession.createMany({
      data: [1, 2].map((number) => ({
        staffId: target.id,
        refreshTokenHash: createHash('sha256')
          .update(`${target.id}-${number}`)
          .digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      })),
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${target.id}/deactivations`)
      .set('Authorization', `Bearer ${disableToken}`)
      .expect(201);
    const deactivateBody = response.body as unknown as {
      data: { status: PlatformStaffStatus };
    };
    expect(deactivateBody.data.status).toBe(PlatformStaffStatus.INACTIVE);
    await expect(
      prisma.platformAuthSession.count({
        where: { staffId: target.id, revokedAt: null },
      }),
    ).resolves.toBe(0);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${target.id}/deactivations`)
      .set('Authorization', `Bearer ${disableToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${suspended.id}/deactivations`)
      .set('Authorization', `Bearer ${disableToken}`)
      .expect(400);
  });

  it('rejects self-deactivation', async () => {
    const actor = await createPlatformActor(['platform.staff.disable']);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${actor.staffId}/deactivations`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(409);
  });

  it('allows one Super Admin deactivation while another remains effective', async () => {
    const disableToken = await createAccessToken(['platform.staff.disable']);
    const superAdminRole = await prisma.platformRole.findUniqueOrThrow({
      where: { key: 'PLATFORM_SUPER_ADMIN' },
    });
    const first = await createManagedStaff(
      PlatformStaffStatus.ACTIVE,
      superAdminRole.id,
    );
    await createManagedStaff(PlatformStaffStatus.ACTIVE, superAdminRole.id);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${first.id}/deactivations`)
      .set('Authorization', `Bearer ${disableToken}`)
      .expect(201);
  });

  it('reactivates only inactive staff with the activate permission', async () => {
    const activateToken = await createAccessToken(['platform.staff.activate']);
    const withoutPermission = await createAccessToken(['platform.staff.view']);
    const inactive = await createManagedStaff(PlatformStaffStatus.INACTIVE);
    const suspended = await createManagedStaff(PlatformStaffStatus.SUSPENDED);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${inactive.id}/reactivations`)
      .set('Authorization', `Bearer ${withoutPermission}`)
      .expect(403);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${inactive.id}/reactivations`)
      .set('Authorization', `Bearer ${activateToken}`)
      .expect(201);
    const reactivateBody = response.body as unknown as {
      data: { status: PlatformStaffStatus };
    };
    expect(reactivateBody.data.status).toBe(PlatformStaffStatus.ACTIVE);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${inactive.id}/reactivations`)
      .set('Authorization', `Bearer ${activateToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${suspended.id}/reactivations`)
      .set('Authorization', `Bearer ${activateToken}`)
      .expect(400);
  });

  it('protects staff role listing and returns safe assignments', async () => {
    const role = await createManagedRole();
    const target = await createManagedStaff(
      PlatformStaffStatus.ACTIVE,
      role.id,
    );
    const viewToken = await createAccessToken(['platform.staff.view']);
    const withoutPermission = await createAccessToken([
      'platform.organization.view',
    ]);

    await request(app.getHttpServer())
      .get(`/api/v1/platform/staff/${target.id}/roles`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/platform/staff/${target.id}/roles`)
      .set('Authorization', `Bearer ${withoutPermission}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/platform/staff/not-a-uuid/roles')
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/platform/staff/${randomUUID()}/roles`)
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(404);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/platform/staff/${target.id}/roles`)
      .set('Authorization', `Bearer ${viewToken}`)
      .expect(200);
    const body = response.body as unknown as {
      data: Array<{
        staffId: string;
        role: Record<string, unknown>;
        assignedAt: string;
        assignedByStaffId: string | null;
      }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      staffId: target.id,
      role: {
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystemPreset: role.isSystemPreset,
        isActive: true,
      },
    });
    expect(body.data[0].role).not.toHaveProperty('rolePermissions');
    expect(body.data[0]).not.toHaveProperty('staff');
  });

  it('assigns roles with actor attribution and enforces assignment rules', async () => {
    const actor = await createPlatformActor(['platform.staff.role.assign']);
    const withoutPermission = await createAccessToken(['platform.staff.view']);
    const role = await createManagedRole();
    const inactiveRole = await createManagedRole([], false);
    const activeTarget = await createManagedStaff();
    const inactiveTarget = await createManagedStaff(
      PlatformStaffStatus.INACTIVE,
    );
    const suspendedTarget = await createManagedStaff(
      PlatformStaffStatus.SUSPENDED,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${activeTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${withoutPermission}`)
      .send({ roleId: role.id })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/platform/staff/not-a-uuid/role-assignments')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: role.id })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${activeTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: 'not-a-uuid' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${randomUUID()}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: role.id })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${activeTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: randomUUID() })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${activeTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: inactiveRole.id })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${suspendedTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: role.id })
      .expect(409);

    for (const forbidden of [
      { assignedByStaffId: randomUUID() },
      { permissions: ['platform.organization.view'] },
      { assignedAt: new Date().toISOString() },
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/platform/staff/${activeTarget.id}/role-assignments`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send({ roleId: role.id, ...forbidden })
        .expect(400);
    }

    const assigned = await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${activeTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: role.id })
      .expect(201);
    const assignedBody = assigned.body as unknown as {
      data: {
        staffId: string;
        role: { id: string };
        assignedByStaffId: string;
      };
    };
    expect(assignedBody.data).toMatchObject({
      staffId: activeTarget.id,
      role: { id: role.id },
      assignedByStaffId: actor.staffId,
    });
    const stored = await prisma.platformStaffRole.findUniqueOrThrow({
      where: {
        staffId_roleId: { staffId: activeTarget.id, roleId: role.id },
      },
    });
    expect(stored.assignedByStaffId).toBe(actor.staffId);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${activeTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: role.id })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${inactiveTarget.id}/role-assignments`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roleId: role.id })
      .expect(201);
  });

  it('requires an effective Super Admin actor for Super Admin role changes', async () => {
    const nonSuperAdmin = await createPlatformActor([
      'platform.staff.role.assign',
    ]);
    const effectiveSuperAdmin = await createPlatformActor([
      'platform.staff.role.assign',
    ]);
    const superAdminRole = await prisma.platformRole.findUniqueOrThrow({
      where: { key: 'PLATFORM_SUPER_ADMIN' },
    });
    await prisma.platformStaffRole.create({
      data: {
        staffId: effectiveSuperAdmin.staffId,
        roleId: superAdminRole.id,
      },
    });
    const target = await createManagedStaff();

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${target.id}/role-assignments`)
      .set('Authorization', `Bearer ${nonSuperAdmin.token}`)
      .send({ roleId: superAdminRole.id })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${nonSuperAdmin.staffId}/role-assignments`)
      .set('Authorization', `Bearer ${nonSuperAdmin.token}`)
      .send({ roleId: superAdminRole.id })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${target.id}/role-assignments`)
      .set('Authorization', `Bearer ${effectiveSuperAdmin.token}`)
      .send({ roleId: superAdminRole.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/platform/staff/${target.id}/role-assignments/${superAdminRole.id}`,
      )
      .set('Authorization', `Bearer ${nonSuperAdmin.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(
        `/api/v1/platform/staff/${target.id}/role-assignments/${superAdminRole.id}`,
      )
      .set('Authorization', `Bearer ${effectiveSuperAdmin.token}`)
      .expect(200);
  });

  it('removes exact role assignments across staff lifecycle states', async () => {
    const assignmentToken = await createAccessToken([
      'platform.staff.role.assign',
    ]);
    const withoutPermission = await createAccessToken(['platform.staff.view']);
    const role = await createManagedRole();
    const active = await createManagedStaff(
      PlatformStaffStatus.ACTIVE,
      role.id,
    );
    const inactive = await createManagedStaff(
      PlatformStaffStatus.INACTIVE,
      role.id,
    );
    const suspended = await createManagedStaff(
      PlatformStaffStatus.SUSPENDED,
      role.id,
    );
    const permissionTarget = await createManagedStaff(
      PlatformStaffStatus.ACTIVE,
      role.id,
    );
    const noAssignment = await createManagedStaff();

    await request(app.getHttpServer())
      .delete(
        `/api/v1/platform/staff/${permissionTarget.id}/role-assignments/${role.id}`,
      )
      .set('Authorization', `Bearer ${withoutPermission}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/platform/staff/not-a-uuid/role-assignments/${role.id}`)
      .set('Authorization', `Bearer ${assignmentToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/api/v1/platform/staff/${active.id}/role-assignments/not-a-uuid`)
      .set('Authorization', `Bearer ${assignmentToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .delete(
        `/api/v1/platform/staff/${noAssignment.id}/role-assignments/${role.id}`,
      )
      .set('Authorization', `Bearer ${assignmentToken}`)
      .expect(404);

    for (const target of [active, inactive, suspended]) {
      const response = await request(app.getHttpServer())
        .delete(
          `/api/v1/platform/staff/${target.id}/role-assignments/${role.id}`,
        )
        .set('Authorization', `Bearer ${assignmentToken}`)
        .expect(200);
      const body = response.body as unknown as {
        data: { staffId: string; role: { id: string } };
      };
      expect(body.data).toMatchObject({
        staffId: target.id,
        role: { id: role.id },
      });
    }
    await request(app.getHttpServer())
      .delete(`/api/v1/platform/staff/${active.id}/role-assignments/${role.id}`)
      .set('Authorization', `Bearer ${assignmentToken}`)
      .expect(404);
  });

  it('allows Super Admin removal when another effective Super Admin remains', async () => {
    const actor = await createPlatformActor(['platform.staff.role.assign']);
    const superAdminRole = await prisma.platformRole.findUniqueOrThrow({
      where: { key: 'PLATFORM_SUPER_ADMIN' },
    });
    await prisma.platformStaffRole.create({
      data: { staffId: actor.staffId, roleId: superAdminRole.id },
    });
    const first = await createManagedStaff(
      PlatformStaffStatus.ACTIVE,
      superAdminRole.id,
    );

    await request(app.getHttpServer())
      .delete(
        `/api/v1/platform/staff/${first.id}/role-assignments/${superAdminRole.id}`,
      )
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(200);
  });

  it('refreshes effective permissions after role assignment and removal', async () => {
    const target = await createPlatformActor([
      'platform.staff.view',
      'platform.staff.role.assign',
    ]);
    const organizationRole = await createManagedRole([
      'platform.organization.view',
    ]);

    await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${target.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/staff/${target.staffId}/role-assignments`)
      .set('Authorization', `Bearer ${target.token}`)
      .send({ roleId: organizationRole.id })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${target.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(
        `/api/v1/platform/staff/${target.staffId}/role-assignments/${organizationRole.id}`,
      )
      .set('Authorization', `Bearer ${target.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${target.token}`)
      .expect(403);
  });

  it('keeps the seeded catalog synchronized and never resets a bootstrap password', async () => {
    const permissionKeys = await prisma.permission.findMany({
      select: { key: true },
      orderBy: { key: 'asc' },
    });
    const superAdmin = await prisma.platformRole.findUniqueOrThrow({
      where: { key: 'PLATFORM_SUPER_ADMIN' },
      include: { rolePermissions: { include: { permission: true } } },
    });
    expect(
      superAdmin.rolePermissions.map(({ permission }) => permission.key).sort(),
    ).toEqual(permissionKeys.map(({ key }) => key));

    const bootstrapEmail = `seed-e2e-${Date.now()}@example.test`;
    const environment = {
      PLATFORM_BOOTSTRAP_ADMIN_EMAIL: bootstrapEmail.toUpperCase(),
      PLATFORM_BOOTSTRAP_ADMIN_FIRST_NAME: 'Seed',
      PLATFORM_BOOTSTRAP_ADMIN_LAST_NAME: 'Admin',
      PLATFORM_BOOTSTRAP_ADMIN_PASSWORD: 'initial-bootstrap-password',
    };
    await seedPlatformAuthRbac(prisma, environment);
    const created = await prisma.platformStaff.findUniqueOrThrow({
      where: { email: bootstrapEmail },
    });
    bootstrapStaffId = created.id;

    await seedPlatformAuthRbac(prisma, {
      ...environment,
      PLATFORM_BOOTSTRAP_ADMIN_PASSWORD: 'must-not-replace-password',
    });
    const repeated = await prisma.platformStaff.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(repeated.passwordHash).toBe(created.passwordHash);
    await expect(
      argon2.verify(repeated.passwordHash, 'initial-bootstrap-password'),
    ).resolves.toBe(true);
  });

  it('returns one generic error for unknown accounts and wrong passwords', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: 'unknown@example.test', password: 'wrong' })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email, password: 'wrong' })
      .expect(401);
    const unknownBody = unknown.body as unknown as {
      error: { code: string; message: string };
    };
    const wrongBody = wrong.body as unknown as {
      error: { code: string; message: string };
    };

    expect(unknownBody.error).toEqual(wrongBody.error);
    expect(unknownBody.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks inactive and suspended staff at login', async () => {
    for (const status of [
      PlatformStaffStatus.INACTIVE,
      PlatformStaffStatus.SUSPENDED,
    ]) {
      await prisma.platformStaff.update({
        where: { id: staffId },
        data: { status },
      });
      await request(app.getHttpServer())
        .post('/api/v1/platform/auth/login')
        .send({ email, password })
        .expect(401);
    }
    await prisma.platformStaff.update({
      where: { id: staffId },
      data: { status: PlatformStaffStatus.ACTIVE },
    });
  });

  it('authenticates, rotates refresh tokens, checks current DB state, and logs out', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/auth/me')
      .set('role', 'superuser')
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email, password })
      .expect(200);
    const loginBody = login.body as unknown as {
      data: { accessToken: string; permissions: string[] };
    };
    const accessToken = loginBody.data.accessToken;
    const firstCookie = (login.headers['set-cookie'] as unknown as string[])[0];
    const claims = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(claims).toMatchObject({ sub: staffId, type: 'access' });
    expect(claims).not.toHaveProperty('roles');
    expect(claims).not.toHaveProperty('permissions');
    expect(loginBody.data.permissions).toContain('platform.staff.view');
    const storedStaff = await prisma.platformStaff.findUniqueOrThrow({
      where: { id: staffId },
    });
    const storedSession = await prisma.platformAuthSession.findUniqueOrThrow({
      where: { id: claims.sid as string },
    });
    const rawRefreshToken = firstCookie.split(';')[0].split('=')[1];
    expect(storedStaff.passwordHash).not.toBe(password);
    expect(storedStaff.passwordHash).toContain('$argon2id$');
    expect(storedSession.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedSession.refreshTokenHash).not.toBe(rawRefreshToken);
    expect(storedStaff.lastLoginAt).not.toBeNull();

    const disablePermission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'platform.staff.disable' },
    });
    const manageRolePermission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'platform.role.manage' },
    });
    const activeRole = await prisma.platformRole.create({
      data: {
        key: `AUTH_E2E_ACTIVE_${Date.now()}`,
        name: `Auth E2E Active ${Date.now()}`,
        rolePermissions: { create: { permissionId: disablePermission.id } },
      },
    });
    const inactiveRole = await prisma.platformRole.create({
      data: {
        key: `AUTH_E2E_INACTIVE_${Date.now()}`,
        name: `Auth E2E Inactive ${Date.now()}`,
        isActive: false,
        rolePermissions: {
          create: { permissionId: manageRolePermission.id },
        },
      },
    });
    extraRoleIds.push(activeRole.id, inactiveRole.id);
    await prisma.platformStaffRole.createMany({
      data: [
        { staffId, roleId: activeRole.id },
        { staffId, roleId: inactiveRole.id },
      ],
    });

    const current = await request(app.getHttpServer())
      .get('/api/v1/platform/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const currentBody = current.body as unknown as {
      data: { permissions: string[] };
    };
    expect(currentBody.data.permissions).toEqual(
      expect.arrayContaining(['platform.staff.view', 'platform.staff.disable']),
    );
    expect(currentBody.data.permissions).not.toContain('platform.role.manage');
    await request(app.getHttpServer())
      .get('/api/v1/platform/auth/me')
      .set('Authorization', `Bearer ${accessToken}tampered`)
      .expect(401);
    const expiredToken = new JwtService().sign(
      { sub: staffId, sid: claims.sid, type: 'access' },
      {
        algorithm: 'HS256',
        secret: process.env.PLATFORM_JWT_ACCESS_SECRET,
        issuer: process.env.PLATFORM_JWT_ISSUER,
        audience: process.env.PLATFORM_JWT_AUDIENCE,
        expiresIn: -1,
      },
    );
    await request(app.getHttpServer())
      .get('/api/v1/platform/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    const refreshBody = refresh.body as unknown as {
      data: { accessToken: string };
    };
    const secondCookie = (
      refresh.headers['set-cookie'] as unknown as string[]
    )[0];
    expect(secondCookie).not.toBe(firstCookie);

    expect(firstCookie).toContain('HttpOnly');
    expect(firstCookie).toContain('SameSite=Strict');
    expect(firstCookie).toContain('Path=/api/v1/platform/auth');
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);

    await prisma.platformStaff.update({
      where: { id: staffId },
      data: { status: PlatformStaffStatus.SUSPENDED },
    });
    await request(app.getHttpServer())
      .get('/api/v1/platform/auth/me')
      .set('Authorization', `Bearer ${refreshBody.data.accessToken}`)
      .expect(401);
    const activeSessionsAfterSuspension =
      await prisma.platformAuthSession.count({
        where: { staffId, revokedAt: null },
      });
    expect(activeSessionsAfterSuspension).toBe(0);
    await prisma.platformStaff.update({
      where: { id: staffId },
      data: { status: PlatformStaffStatus.ACTIVE },
    });

    const logoutRefreshToken = 'logout-refresh-token-for-e2e';
    await prisma.platformAuthSession.create({
      data: {
        staffId,
        refreshTokenHash: createHash('sha256')
          .update(logoutRefreshToken)
          .digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const logoutCookie = `finstack_platform_refresh=${logoutRefreshToken}`;
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/logout')
      .set('Cookie', logoutCookie)
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/refresh')
      .set('Cookie', logoutCookie)
      .expect(401);

    const expiredRefreshToken = 'expired-refresh-token-for-e2e';
    await prisma.platformAuthSession.create({
      data: {
        staffId,
        refreshTokenHash: createHash('sha256')
          .update(expiredRefreshToken)
          .digest('hex'),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/refresh')
      .set('Cookie', `finstack_platform_refresh=${expiredRefreshToken}`)
      .expect(401);
  });

  it('rate limits repeated platform login attempts', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email, password })
      .expect(429);
    const body = response.body as unknown as {
      success: boolean;
      error: { message: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.message).toBeTruthy();
  });
});
