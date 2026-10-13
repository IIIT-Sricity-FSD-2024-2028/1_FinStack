import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)(
  'Tenant authenticated settings security and persistence',
  () => {
    let app: INestApplication<App>;
    let db: PrismaService;
    let token: string;
    let otherToken: string;
    let submitterToken: string;
    const orgs: string[] = [];
    const users: string[] = [];
    const password = randomUUID() + '!Aa1';
    const root = '/api/v1/tenant/configuration/settings';
    const data = (response: request.Response) =>
      (response.body as { data: Record<string, unknown> }).data;
    async function login(employeeId: string, pw = password) {
      return data(
        await request(app.getHttpServer())
          .post('/api/v1/tenant/auth/login')
          .send({ employeeId, password: pw })
          .expect(201),
      ).accessToken as string;
    }
    beforeAll(async () => {
      if (
        !new URL(process.env.DATABASE_URL || '').searchParams
          .get('schema')
          ?.startsWith('finstack_config_verify_')
      )
        throw Error('Disposable schema required.');
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication<INestApplication<App>>();
      configureHttpApplication(app);
      await app.init();
      db = app.get(PrismaService);
      for (let i = 0; i < 2; i++) {
        const org = await db.organization.create({
          data: {
            name: 'Disposable settings ' + randomUUID(),
            primaryEmail: randomUUID() + '@settings.test',
            metadata: { retained: 'unchanged' },
          },
        });
        orgs.push(org.id);
        const user = await db.tenantUser.create({
          data: {
            organizationId: org.id,
            employeeId: 'CFG-' + randomUUID(),
            email: 'owner@settings.test',
            firstName: 'Owner',
            lastName: 'QA',
            role: 'CONFIGURATION_MANAGER',
            passwordHash: await argon2.hash(password),
          },
        });
        users.push(user.id);
        const signed = await login(user.employeeId);
        if (i === 0) token = signed;
        else otherToken = signed;
      }
      const user = await db.tenantUser.create({
        data: {
          organizationId: orgs[0],
          employeeId: 'EMP-' + randomUUID(),
          email: 'submitter@settings.test',
          firstName: 'Employee',
          lastName: 'QA',
          passwordHash: await argon2.hash(password),
        },
      });
      submitterToken = await login(user.employeeId);
    });
    afterAll(async () => {
      if (db) await db.organization.deleteMany({ where: { id: { in: orgs } } });
      await app?.close();
    });
    it('denies anonymous and other-role access', async () => {
      await request(app.getHttpServer())
        .get(root + '/profile')
        .expect(401);
      await request(app.getHttpServer())
        .get(root + '/organization')
        .auth(submitterToken, { type: 'bearer' })
        .expect(403);
    });
    it('scopes settings to authenticated organization and rejects mass assignment', async () => {
      const first = data(
        await request(app.getHttpServer())
          .get(root + '/organization')
          .auth(token, { type: 'bearer' })
          .expect(200),
      );
      const other = data(
        await request(app.getHttpServer())
          .get(root + '/organization')
          .auth(otherToken, { type: 'bearer' })
          .expect(200),
      );
      expect(first.id).toBe(orgs[0]);
      expect(other.id).toBe(orgs[1]);
      for (const body of [
        { name: 'Changed legal name' },
        { organizationId: orgs[1] },
        { defaultCurrency: 'USD' },
        { role: 'CONFIGURATION_MANAGER' },
      ])
        await request(app.getHttpServer())
          .patch(root + '/organization')
          .auth(token, { type: 'bearer' })
          .send(body)
          .expect(400);
    });
    it('persists operational settings, preserves metadata and creates safe audit', async () => {
      const body = {
        companySize: '11-50 employees',
        fiscalYearStart: 'July',
        defaultPaymentMethod: 'Corporate Card',
      };
      await request(app.getHttpServer())
        .patch(root + '/organization')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(200);
      expect(
        data(
          await request(app.getHttpServer())
            .get(root + '/organization')
            .auth(token, { type: 'bearer' }),
        ),
      ).toMatchObject(body);
      const org = await db.organization.findUniqueOrThrow({
        where: { id: orgs[0] },
      });
      const auditResponse = await request(app.getHttpServer())
        .get('/api/v1/tenant/configuration/audit-logs?targetType=organization')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(data(auditResponse).total).toBeGreaterThanOrEqual(1);
      expect(org.metadata).toMatchObject({
        retained: 'unchanged',
        tenantSettings: body,
      });
      expect(
        await db.tenantAuditLog.count({
          where: {
            organizationId: orgs[0],
            eventCode: 'organization.settings_updated',
          },
        }),
      ).toBe(1);
      await request(app.getHttpServer())
        .patch(root + '/organization')
        .auth(token, { type: 'bearer' })
        .send({ ...body, companySize: 'unbounded' })
        .expect(400);
    });
    it('edits own profile without changing identity/role or another tenant', async () => {
      const body = {
        fullName: 'Updated Owner',
        phone: '+91 12345',
        location: 'Hyderabad',
        avatarColor: '#22D3EE',
      };
      await request(app.getHttpServer())
        .patch(root + '/profile')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(200);
      expect(
        data(
          await request(app.getHttpServer())
            .get(root + '/profile')
            .auth(token, { type: 'bearer' }),
        ),
      ).toMatchObject({
        firstName: 'Updated',
        lastName: 'Owner',
        phone: body.phone,
      });
      await request(app.getHttpServer())
        .patch(root + '/profile')
        .auth(token, { type: 'bearer' })
        .send({ ...body, employeeId: 'HACK', role: 'MANAGER' })
        .expect(400);
      await request(app.getHttpServer())
        .patch(root + '/profile')
        .auth(token, { type: 'bearer' })
        .send({
          fullName: 'Updated Owner',
          department: 'Privileged Department',
        })
        .expect(400);
      expect(
        (await db.tenantUser.findUniqueOrThrow({ where: { id: users[1] } }))
          .firstName,
      ).toBe('Owner');
      expect(
        await db.tenantAuditLog.count({
          where: { organizationId: orgs[0], eventCode: 'profile.updated' },
        }),
      ).toBe(1);
    });
    it('persists validated preferences only for the authenticated tenant user and audits the change', async () => {
      const preferences = {
        theme: 'system',
        compactMode: true,
        animations: false,
        language: 'en-GB',
        dateFormat: 'YYYY-MM-DD',
        timezone: 'UTC',
        numberLocale: 'de-DE',
        desktopNotifications: false,
        defaultView: 'notifications',
        pageSize: 50,
        autoRefresh: true,
      };
      await request(app.getHttpServer())
        .patch(root + '/preferences')
        .auth(token, { type: 'bearer' })
        .send(preferences)
        .expect(200);
      expect(
        data(
          await request(app.getHttpServer())
            .get(root + '/preferences')
            .auth(token, { type: 'bearer' }),
        ),
      ).toMatchObject(preferences);
      expect(
        data(
          await request(app.getHttpServer())
            .get(root + '/preferences')
            .auth(otherToken, { type: 'bearer' }),
        ),
      ).toMatchObject({ theme: 'dark', pageSize: 25 });
      const [stored] = await db.$queryRaw<
        { preferences: unknown }[]
      >`SELECT preferences FROM "TenantUser" WHERE id = ${users[0]}::uuid`;
      expect(stored.preferences).toEqual(preferences);
      await request(app.getHttpServer())
        .patch(root + '/preferences')
        .auth(token, { type: 'bearer' })
        .send({ ...preferences, pageSize: 500 })
        .expect(400);
      expect(
        await db.tenantAuditLog.count({
          where: {
            organizationId: orgs[0],
            eventCode: 'profile.preferences_updated',
          },
        }),
      ).toBe(1);
    });
    it('exports only authorized configuration and protects the last active manager', async () => {
      const exported = data(
        await request(app.getHttpServer())
          .get(root + '/organization-export')
          .auth(token, { type: 'bearer' })
          .expect(200),
      );
      expect(JSON.stringify(exported)).not.toContain('passwordHash');
      expect(JSON.stringify(exported)).not.toContain('activationTokenHash');
      expect(JSON.stringify(exported)).not.toContain(orgs[1]);
      await request(app.getHttpServer())
        .patch('/api/v1/tenant/configuration/users/' + users[0])
        .auth(token, { type: 'bearer' })
        .send({ role: 'MANAGER' })
        .expect(409);
      expect(
        (await db.tenantUser.findUniqueOrThrow({ where: { id: users[0] } }))
          .role,
      ).toBe('CONFIGURATION_MANAGER');
    });
    it('rejects wrong current password and weak/mismatched new passwords without losing session', async () => {
      for (const body of [
        {
          currentPassword: 'incorrect',
          newPassword: 'Secure-Password-984!aA',
          confirmPassword: 'Secure-Password-984!aA',
        },
        {
          currentPassword: password,
          newPassword: 'short',
          confirmPassword: 'short',
        },
        {
          currentPassword: password,
          newPassword: 'Secure-Password-984!aA',
          confirmPassword: 'different-password-34!aA',
        },
      ])
        await request(app.getHttpServer())
          .post(root + '/password-changes')
          .auth(token, { type: 'bearer' })
          .send(body)
          .expect(400);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(200);
    });
    it('hashes password and invalidates all old tokens atomically with audit', async () => {
      const user = await db.tenantUser.findUniqueOrThrow({
        where: { id: users[0] },
      });
      const newPassword = 'Changed-Secure-Password-928!aA';
      await request(app.getHttpServer())
        .post(root + '/password-changes')
        .auth(token, { type: 'bearer' })
        .send({
          currentPassword: password,
          newPassword,
          confirmPassword: newPassword,
        })
        .expect(201);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
      const saved = await db.tenantUser.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(saved.passwordHash).not.toBe(newPassword);
      expect(await argon2.verify(saved.passwordHash, newPassword)).toBe(true);
      expect(saved.credentialVersion).toBe(1);
      token = await login(user.employeeId, newPassword);
      const audit = await db.tenantAuditLog.findFirstOrThrow({
        where: {
          organizationId: orgs[0],
          eventCode: 'profile.password_changed',
        },
      });
      expect(JSON.stringify(audit.changes)).not.toContain('password');
      expect(audit.changes).toEqual({ sessionsRevoked: true });
    });
    it('rate limits password changes without invalidating another valid session', async () => {
      const body = {
        currentPassword: 'incorrect',
        newPassword: 'Rate-Limit-Safe-928!aA',
        confirmPassword: 'Rate-Limit-Safe-928!aA',
      };
      await request(app.getHttpServer())
        .post(root + '/password-changes')
        .auth(otherToken, { type: 'bearer' })
        .send(body)
        .expect(400);
      await request(app.getHttpServer())
        .post(root + '/password-changes')
        .auth(otherToken, { type: 'bearer' })
        .send(body)
        .expect(429);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(otherToken, { type: 'bearer' })
        .expect(200);
    });
    it('revokes all sessions without touching other tenants', async () => {
      await request(app.getHttpServer())
        .post(root + '/session-revocations')
        .auth(token, { type: 'bearer' })
        .expect(201);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(otherToken, { type: 'bearer' })
        .expect(200);
    });
  },
);
