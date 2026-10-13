import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
import { TenantAuthResponse } from '../src/tenant/auth/tenant-auth.types';
import { TENANT_WORKSPACES } from '../src/tenant/auth/tenant-workspace';

const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)(
  'Employee-ID-only login (PostgreSQL)',
  () => {
    let app: INestApplication<App>;
    const prisma = new PrismaService();
    const ids: string[] = [];
    const users = new Map<
      TenantRole,
      { id: string; employeeId: string; organizationId: string }
    >();
    const password = 'Old!7'; // Imported existing credentials must not be locked out by creation rules.
    const inactiveEmployeeId = `INACTIVE-${randomUUID()}`;
    const loginPath = '/api/v1/tenant/auth/login';

    beforeAll(async () => {
      const schema = new URL(process.env.DATABASE_URL || '').searchParams.get(
        'schema',
      );
      if (!schema?.startsWith('finstack_config_verify_'))
        throw new Error('Use a disposable verification schema.');
      process.env.TENANT_JWT_ACCESS_SECRET = randomUUID() + randomUUID();
      const passwordHash = await argon2.hash(password);
      for (let index = 0; index < 2; index++) {
        const org = await prisma.organization.create({
          data: {
            name: 'Disposable employee-login test',
            slug: `employee-test-${randomUUID()}`,
            primaryEmail: `${randomUUID()}@example.test`,
          },
        });
        ids.push(org.id);
      }
      for (const [index, role] of Object.values(TenantRole).entries()) {
        const user = await prisma.tenantUser.create({
          data: {
            organizationId: ids[index % 2],
            employeeId: `${role.slice(0, 3)}-${randomUUID()}`,
            firstName: 'Test',
            lastName: 'Employee',
            email: `${randomUUID()}@example.test`,
            passwordHash,
            role,
          },
        });
        users.set(role, user);
      }
      await prisma.tenantUser.create({
        data: {
          organizationId: ids[0],
          employeeId: inactiveEmployeeId,
          firstName: 'Inactive',
          lastName: 'Employee',
          email: `${randomUUID()}@example.test`,
          passwordHash,
          status: 'INACTIVE',
        },
      });
    });
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication<INestApplication<App>>();
      configureHttpApplication(app);
      await app.init();
    });
    afterEach(async () => {
      await app?.close();
    });
    afterAll(async () => {
      await prisma.tenantUser.deleteMany({
        where: { organizationId: { in: ids } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    });

    it('logs in every role without a tenant or selected role and resolves authoritative /me', async () => {
      for (const [role, user] of users) {
        const response = await request(app.getHttpServer())
          .post(loginPath)
          .send({ employeeId: user.employeeId, password })
          .expect(201);
        const auth = (response.body as { data: TenantAuthResponse }).data;
        expect(auth.organizationId).toBe(user.organizationId);
        expect(auth.effectiveRoles).toEqual([role]);
        expect(auth.workspace).toEqual(TENANT_WORKSPACES[role]);
        expect(auth.user).not.toHaveProperty('passwordHash');
        const me = await request(app.getHttpServer())
          .get('/api/v1/tenant/auth/me')
          .set('Authorization', `Bearer ${auth.accessToken}`)
          .expect(200);
        expect((me.body as { data: unknown }).data).toMatchObject({
          organizationId: user.organizationId,
          user: { id: user.id },
          effectiveRoles: [role],
          workspace: auth.workspace,
        });
      }
    });

    it('returns identical credential errors for incorrect, missing and inactive accounts', async () => {
      const known = users.get(TenantRole.CONFIGURATION_MANAGER)!;
      const errors: unknown[] = [];
      for (const payload of [
        { employeeId: known.employeeId, password: 'incorrect' },
        { employeeId: `UNKNOWN-${randomUUID()}`, password },
        { employeeId: inactiveEmployeeId, password },
      ]) {
        const response = await request(app.getHttpServer())
          .post(loginPath)
          .send(payload)
          .expect(401);
        errors.push((response.body as { error: unknown }).error);
        expect(response.body as unknown).not.toHaveProperty('accessToken');
      }
      expect(errors).toEqual(
        Array(3).fill({
          code: 'INVALID_TENANT_CREDENTIALS',
          message: 'Employee ID or password is incorrect.',
        }),
      );
    });

    it('rejects invalid identifiers, missing passwords and client-selected tenant/role bodies', async () => {
      const known = users.get(TenantRole.CONFIGURATION_MANAGER)!;
      for (const payload of [
        { employeeId: '', password },
        { employeeId: 'EMP@123', password },
        { employeeId: '-EMP-123', password },
        { employeeId: known.employeeId, password: '' },
        { employeeId: known.employeeId, password, organizationId: ids[1] },
        {
          employeeId: known.employeeId,
          password,
          role: 'CONFIGURATION_MANAGER',
        },
      ]) {
        await request(app.getHttpServer())
          .post(loginPath)
          .send(payload)
          .expect(400);
      }
    });

    it('enforces global employee-ID uniqueness across organizations in PostgreSQL', async () => {
      const known = users.get(TenantRole.CONFIGURATION_MANAGER)!;
      await expect(
        prisma.tenantUser.create({
          data: {
            organizationId: ids.find((id) => id !== known.organizationId)!,
            employeeId: known.employeeId,
            firstName: 'Duplicate',
            lastName: 'Employee',
            email: `${randomUUID()}@example.test`,
            passwordHash: await argon2.hash(password),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('re-reads authoritative role/status and rejects expired or forged JWTs', async () => {
      const known = users.get(TenantRole.CONFIGURATION_MANAGER)!;
      const response = await request(app.getHttpServer())
        .post(loginPath)
        .send({ employeeId: known.employeeId, password })
        .expect(201);
      const auth = (response.body as { data: TenantAuthResponse }).data;
      await prisma.tenantUser.update({
        where: { id: known.id },
        data: { role: TenantRole.MANAGER },
      });
      const me = await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .expect(200);
      expect((me.body as { data: unknown }).data).toMatchObject({
        effectiveRoles: [TenantRole.MANAGER],
        workspace: TENANT_WORKSPACES.MANAGER,
      });
      await prisma.tenantUser.update({
        where: { id: known.id },
        data: { role: TenantRole.CONFIGURATION_MANAGER, status: 'INACTIVE' },
      });
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .expect(401);
      await prisma.tenantUser.update({
        where: { id: known.id },
        data: { status: 'ACTIVE' },
      });
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .set('Authorization', 'Bearer forged.token.value')
        .expect(401);
    });

    it('rate limits repeated tenant credential attempts', async () => {
      for (let index = 0; index < 10; index++)
        await request(app.getHttpServer())
          .post(loginPath)
          .send({ employeeId: 'UNKNOWN-TEST', password })
          .expect(401);
      await request(app.getHttpServer())
        .post(loginPath)
        .send({ employeeId: 'UNKNOWN-TEST', password })
        .expect(429);
    });
  },
);
