import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthService } from '../auth/tenant-auth.service';
import { TenantTokenService } from '../auth/tenant-token.service';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSelfSettingsController } from './tenant-self-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';

// Real Argon2 work can exceed Jest's 5s default while build/lint run concurrently.
jest.setTimeout(15000);

// Only in-memory database providers. Real auth, JWT, argon2, settings service,
// validation, audit writer and throttler exercise the production boundaries.
describe('Manager self-settings HTTP contracts', () => {
  let app: INestApplication;
  let server: Server;
  let tokens: TenantTokenService;
  let originalHash: string;
  const currentPassword = 'Current-Password123!';
  const newPassword = 'Changed-Password456!';
  const org = '10000000-0000-4000-8000-000000000001';
  const foreignOrg = '10000000-0000-4000-8000-000000000002';
  const userId = '20000000-0000-4000-8000-000000000001';
  const otherId = '20000000-0000-4000-8000-000000000002';
  interface Row {
    id: string;
    organizationId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: TenantRole;
    status: TenantUserStatus;
    credentialSetupRequired: boolean;
    credentialVersion: number;
    passwordHash: string;
    department: string;
    phone: string;
    location: string;
    avatarColor: string;
  }
  interface Query {
    where: Partial<Row>;
    select?: Partial<Record<keyof Row, boolean>>;
  }
  interface Write extends Query {
    data: Partial<Omit<Row, 'credentialVersion'>> & {
      credentialVersion?: { increment: number };
    };
  }
  interface Audit {
    organizationId: string;
    actorUserId: string;
    targetId: string;
    eventCode: string;
    changes: unknown;
  }
  let rows: Row[];
  let audit: Audit[];
  const lookup = (where: Partial<Row>) =>
    rows.find((row) =>
      Object.entries(where).every(
        ([key, value]) => row[key as keyof Row] === value,
      ),
    );
  const readProfile = jest.fn(({ where, select }: Query) => {
    const row = lookup(where);
    if (!row) throw new Error('Profile not found');
    return select
      ? Object.fromEntries(
          Object.keys(select).map((key) => [key, row[key as keyof Row]]),
        )
      : { ...row };
  });
  const models = {
    tenantUser: {
      findUnique: jest.fn(({ where }: Query) => {
        const row = lookup(where);
        return row
          ? {
              ...row,
              organization: {
                registrationStatus: 'APPROVED',
                status: 'ACTIVE',
              },
            }
          : null;
      }),
      findFirstOrThrow: readProfile,
      update: jest.fn(({ where, data, select }: Write) => {
        const row = lookup(where);
        if (!row) throw new Error('Profile not found');
        Object.assign(row, data);
        return readProfile({ where, select });
      }),
      updateMany: jest.fn(({ where, data }: Write) => {
        const row = lookup(where);
        if (!row) return { count: 0 };
        const { credentialVersion, ...fields } = data;
        Object.assign(row, fields);
        row.credentialVersion += credentialVersion?.increment ?? 0;
        return { count: 1 };
      }),
    },
    tenantAuditLog: {
      create: jest.fn(({ data }: { data: Audit }) => {
        audit.push(data);
        return data;
      }),
    },
  };

  beforeAll(async () => {
    originalHash = await argon2.hash(currentPassword);
  });

  beforeEach(async () => {
    audit = [];
    rows = [
      {
        id: userId,
        organizationId: org,
        employeeId: 'MAN-1',
        firstName: 'Test',
        lastName: 'Manager',
        email: 'manager@example.test',
        role: TenantRole.MANAGER,
        status: TenantUserStatus.ACTIVE,
        credentialSetupRequired: false,
        credentialVersion: 3,
        passwordHash: originalHash,
        department: 'Operations',
        phone: '',
        location: '',
        avatarColor: '#7C3AED',
      },
    ];
    rows.push({
      ...rows[0],
      id: otherId,
      organizationId: foreignOrg,
      employeeId: 'OTHER-1',
    });
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
      controllers: [TenantSelfSettingsController, TenantSettingsController],
      providers: [
        TenantSettingsService,
        TenantAuthService,
        TenantTokenService,
        JwtService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            TENANT_JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
          }),
        },
        {
          provide: PrismaService,
          useValue: {
            ...models,
            $transaction: (work: (tx: typeof models) => Promise<unknown>) =>
              work(models),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1/tenant');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    tokens = module.get(TenantTokenService);
  });

  afterEach(async () => {
    await app?.close();
  });

  const base = '/api/v1/tenant/me/settings';
  const profile = {
    fullName: 'Updated Manager',
    phone: '+91 123456',
    location: 'Hyderabad',
    avatarColor: '#22D3EE',
  };
  const password = {
    currentPassword,
    newPassword,
    confirmPassword: newPassword,
  };
  const endpoints = [
    { method: 'get' as const, path: '/profile', body: {} },
    { method: 'patch' as const, path: '/profile', body: profile },
    { method: 'post' as const, path: '/password-changes', body: password },
    { method: 'post' as const, path: '/session-revocations', body: {} },
  ];
  const token = (row = rows[0]) => tokens.sign(row);

  function expectAudit(eventCode: string) {
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      organizationId: org,
      actorUserId: userId,
      targetId: userId,
      eventCode,
    });
    expect(JSON.stringify(audit)).not.toContain(currentPassword);
    expect(JSON.stringify(audit)).not.toContain(newPassword);
    expect(JSON.stringify(audit)).not.toContain(originalHash);
  }

  it('returns the Manager profile without credentials', async () => {
    const response = await request(server)
      .get(base + '/profile')
      .auth(await token(), { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      id: userId,
      organizationId: org,
      firstName: 'Test',
      role: 'MANAGER',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('credentialVersion');
  });

  it('persists permitted fields through the existing service and audits only that user', async () => {
    await request(server)
      .patch(base + '/profile')
      .auth(await token(), { type: 'bearer' })
      .send(profile)
      .expect(200);
    expect(rows[0]).toMatchObject({
      firstName: 'Updated',
      lastName: 'Manager',
      phone: profile.phone,
      location: profile.location,
    });
    expect(rows[1].firstName).toBe('Test');
    const response = await request(server)
      .get(base + '/profile')
      .auth(await token(), { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      firstName: 'Updated',
      avatarColor: profile.avatarColor,
    });
    expectAudit('profile.updated');
  });

  it.each([
    'userId',
    'organizationId',
    'id',
    'role',
    'email',
    'passwordHash',
    'credentialVersion',
    'unexpected',
  ])('rejects profile mass assignment: %s', async (field) => {
    await request(server)
      .patch(base + '/profile')
      .auth(await token(), { type: 'bearer' })
      .send({ ...profile, [field]: otherId })
      .expect(400);
    expect(models.tenantUser.update).not.toHaveBeenCalled();
    expect(audit).toHaveLength(0);
  });

  it.each([
    { fullName: '' },
    { phone: 'invalid' },
    { avatarColor: 'red' },
    { location: 'x'.repeat(181) },
  ])('rejects invalid profile values %j', async (invalid) => {
    await request(server)
      .patch(base + '/profile')
      .auth(await token(), { type: 'bearer' })
      .send({ ...profile, ...invalid })
      .expect(400);
    expect(audit).toHaveLength(0);
  });

  it('ignores forged query/header identities and retains same-user, same-tenant scope', async () => {
    await request(server)
      .patch(base + '/profile')
      .query({ userId: otherId, organizationId: foreignOrg })
      .set('organizationId', foreignOrg)
      .auth(await token(), { type: 'bearer' })
      .send(profile)
      .expect(200);
    expect(rows[1].firstName).toBe('Test');
    expect(models.tenantUser.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: userId, organizationId: org } }),
    );
    expectAudit('profile.updated');
  });

  it('rejects a signed token with a foreign tenant claim', async () => {
    const forged = await tokens.sign({
      ...rows[0],
      organizationId: foreignOrg,
    });
    await request(server)
      .get(base + '/profile')
      .auth(forged, { type: 'bearer' })
      .expect(401);
    expect(models.tenantUser.findFirstOrThrow).not.toHaveBeenCalled();
  });

  describe.each(endpoints)(
    '$method $path boundaries',
    ({ method, path, body }) => {
      it('rejects unauthenticated access', async () => {
        await request(server)
          [method](base + path)
          .send(body)
          .expect(401);
        expect(audit).toHaveLength(0);
      });
      it.each(
        Object.values(TenantRole).filter((role) => role !== TenantRole.MANAGER),
      )('denies %s', async (role) => {
        rows[0].role = role;
        await request(server)
          [method](base + path)
          .auth(await token(), { type: 'bearer' })
          .send(body)
          .expect(403);
        expect(audit).toHaveLength(0);
      });
      it('denies inactive Managers', async () => {
        rows[0].status = TenantUserStatus.INACTIVE;
        await request(server)
          [method](base + path)
          .auth(await token(), { type: 'bearer' })
          .send(body)
          .expect(401);
      });
    },
  );

  it('checks the current password, hashes the new password and invalidates old tokens', async () => {
    const oldToken = await token();
    await request(server)
      .post(base + '/password-changes')
      .auth(oldToken, { type: 'bearer' })
      .send(password)
      .expect(201, { signInRequired: true });
    expect(rows[0].credentialVersion).toBe(4);
    expect(rows[1].credentialVersion).toBe(3);
    expect(rows[0].passwordHash).not.toBe(newPassword);
    expect(await argon2.verify(rows[0].passwordHash, newPassword)).toBe(true);
    expectAudit('profile.password_changed');
    await request(server)
      .get(base + '/profile')
      .auth(oldToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .get(base + '/profile')
      .auth(await token(), { type: 'bearer' })
      .expect(200);
  });

  it('rejects a wrong current password without changing credentials', async () => {
    await request(server)
      .post(base + '/password-changes')
      .auth(await token(), { type: 'bearer' })
      .send({ ...password, currentPassword: 'Wrong-current-password1!' })
      .expect(400);
    expect(rows[0].credentialVersion).toBe(3);
    expect(rows[0].passwordHash).toBe(originalHash);
    expect(audit).toHaveLength(0);
  });

  it.each([
    'short',
    'alllowercase123!',
    'ALLUPPERCASE123!',
    'NoSpecialCharacter123',
    'NoDigitsPassword!',
    'x'.repeat(129),
  ])('enforces password complexity/length: %s', async (value) => {
    await request(server)
      .post(base + '/password-changes')
      .auth(await token(), { type: 'bearer' })
      .send({ ...password, newPassword: value, confirmPassword: value })
      .expect(400);
    expect(models.tenantUser.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { confirmPassword: 'Different-Password123!' },
    { newPassword: currentPassword, confirmPassword: currentPassword },
  ])('rejects mismatched or reused passwords %j', async (invalid) => {
    await request(server)
      .post(base + '/password-changes')
      .auth(await token(), { type: 'bearer' })
      .send({ ...password, ...invalid })
      .expect(400);
    expect(audit).toHaveLength(0);
  });

  it('throttles the sixth password request in a minute', async () => {
    const bearer = await token();
    for (let i = 0; i < 5; i++)
      await request(server)
        .post(base + '/password-changes')
        .auth(bearer, { type: 'bearer' })
        .send({ ...password, currentPassword: 'wrong' })
        .expect(400);
    await request(server)
      .post(base + '/password-changes')
      .auth(bearer, { type: 'bearer' })
      .send(password)
      .expect(429);
    expect(rows[0].credentialVersion).toBe(3);
  });

  it('revokes only own sessions through credentialVersion and creates a safe audit entry', async () => {
    const oldToken = await token();
    const foreignToken = await token(rows[1]);
    await request(server)
      .post(base + '/session-revocations')
      .auth(oldToken, { type: 'bearer' })
      .send({})
      .expect(201, { signInRequired: true });
    expect(rows[0].credentialVersion).toBe(4);
    expect(rows[1].credentialVersion).toBe(3);
    expectAudit('profile.sessions_revoked');
    await request(server)
      .get(base + '/profile')
      .auth(oldToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .get(base + '/profile')
      .auth(foreignToken, { type: 'bearer' })
      .expect(200);
  });

  it.each(['/password-changes', '/session-revocations'])(
    'rejects target identities in %s',
    async (path) => {
      await request(server)
        .post(base + path)
        .auth(await token(), { type: 'bearer' })
        .send({
          ...(path === '/password-changes' ? password : {}),
          userId: otherId,
          organizationId: foreignOrg,
        })
        .expect(400);
      expect(models.tenantUser.updateMany).not.toHaveBeenCalled();
    },
  );

  describe.each(endpoints)(
    'existing CM $method $path',
    ({ method, path, body }) => {
      it('keeps Configuration Manager authorized on its original route', async () => {
        rows[0].role = TenantRole.CONFIGURATION_MANAGER;
        await request(server)
          [method]('/api/v1/tenant/configuration/settings' + path)
          .auth(await token(), { type: 'bearer' })
          .send(body)
          .expect(method === 'post' ? 201 : 200);
      });
      it('does not grant Manager access to Configuration Manager settings', async () => {
        await request(server)
          [method]('/api/v1/tenant/configuration/settings' + path)
          .auth(await token(), { type: 'bearer' })
          .send(body)
          .expect(403);
      });
    },
  );

  it.each(['get', 'patch'] as const)(
    'does not add %s preferences routes',
    async (method) => {
      await request(server)
        [method](base + '/preferences')
        .auth(await token(), { type: 'bearer' })
        .send({})
        .expect(404);
    },
  );
});
