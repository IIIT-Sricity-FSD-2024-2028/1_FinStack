import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { Response } from 'supertest';
import type { Organization } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { TenantTokenService } from '../src/tenant/auth/tenant-token.service';

interface RegistrationResult {
  organizationId: string;
  employeeId: string;
  registrationStatus: string;
  domainVerified: boolean;
}
function responseData<T>(response: Response): T {
  return (response.body as { data: T }).data;
}

const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)(
  'Organization registration and authorized review (PostgreSQL)',
  () => {
    const prisma = new PrismaService();
    const suffix = randomUUID().replaceAll('-', '');
    const password = 'Review-test-password!7';
    const registration = '/api/v1/tenant/registrations/organizations';
    const login = '/api/v1/tenant/auth/login';
    let app: INestApplication<App>,
      planId: string,
      staffId: string,
      roleId: string,
      unprivilegedId: string;
    const orgIds: string[] = [],
      permissionIds: string[] = [];
    function payload(extra: Record<string, unknown> = {}) {
      const id = randomUUID();
      const domain = `org-${id.slice(0, 8)}-${suffix}.org`;
      return {
        name: 'Société Example 株式会社',
        registrationCountry: 'IN',
        registrationIdentifier: 'REG-' + id,
        primaryEmail: 'office@' + domain,
        email: 'contact@' + domain,
        authorizedContactTitle: 'Director',
        firstName: 'Alex',
        lastName: 'Reviewer',
        password,
        employeeCount: 3,
        planId,
        ...extra,
      };
    }
    async function register(data = payload()) {
      const response = await request(app.getHttpServer())
        .post(registration)
        .send(data);
      if (response.status === 201)
        orgIds.push(responseData<RegistrationResult>(response).organizationId);
      return response;
    }
    async function adminToken(privileged = true): Promise<string> {
      const staff = await prisma.platformStaff.findUniqueOrThrow({
        where: { id: privileged ? staffId : unprivilegedId },
      });
      const response = await request(app.getHttpServer())
        .post('/api/v1/platform/auth/login')
        .send({ email: staff.email, password })
        .expect(200);
      return responseData<{ accessToken: string }>(response).accessToken;
    }
    const reviewPath = (id: string) =>
      `/api/v1/platform/organizations/${id}/registration-reviews`;
    const note =
      'Reviewed supplied identity and independent evidence; domain control remains unverified.';
    beforeAll(async () => {
      if (
        !new URL(process.env.DATABASE_URL || '').searchParams
          .get('schema')
          ?.startsWith('finstack_config_verify_')
      )
        throw Error('Use a disposable verification schema.');
      const hash = await argon2.hash(password);
      const plan = await prisma.plan.create({
        data: {
          key: 'review-' + suffix,
          name: 'Disposable review plan ' + suffix,
          billingInterval: 'MONTHLY',
          basePrice: 10,
          currency: 'INR',
        },
      });
      planId = plan.id;
      const role = await prisma.platformRole.create({
        data: {
          key: 'review-' + suffix,
          name: 'Disposable reviewer ' + suffix,
        },
      });
      roleId = role.id;
      for (const key of [
        'platform.organization.create',
        'platform.organization.view',
        'platform.organization.update',
        'platform.organization.reactivate',
        'platform.organization.suspend',
      ]) {
        const permission = await prisma.permission.upsert({
          where: { key },
          create: { key, description: key },
          update: {},
        });
        permissionIds.push(permission.id);
        await prisma.platformRolePermission.create({
          data: { roleId, permissionId: permission.id },
        });
      }
      const staff = await prisma.platformStaff.create({
        data: {
          firstName: 'Test',
          lastName: 'Reviewer',
          email: suffix + '@review.org',
          passwordHash: hash,
          roles: { create: { roleId } },
        },
      });
      staffId = staff.id;
      const other = await prisma.platformStaff.create({
        data: {
          firstName: 'Test',
          lastName: 'Viewer',
          email: suffix + '@viewer.org',
          passwordHash: hash,
        },
      });
      unprivilegedId = other.id;
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
      const subscriptions = await prisma.organizationSubscription.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true },
      });
      const invoices = await prisma.invoice.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true },
      });
      await prisma.platformAuditLog.deleteMany({
        where: {
          resourceId: {
            in: [
              ...orgIds,
              ...subscriptions.map((item) => item.id),
              ...invoices.map((item) => item.id),
            ],
          },
        },
      });
      await prisma.subscriptionPayment.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.invoice.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organizationSubscription.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      await prisma.platformAuditLog.deleteMany({
        where: {
          OR: [
            { resourceId: { in: orgIds } },
            { actorStaffId: staffId },
            { newValue: { path: ['organizationId'], string_contains: suffix } },
          ],
        },
      });
      await prisma.platformStaff.deleteMany({
        where: { id: { in: [staffId, unprivilegedId] } },
      });
      await prisma.platformRole.delete({ where: { id: roleId } });
      await prisma.permission.deleteMany({
        where: { id: { in: permissionIds }, roleAssignments: { none: {} } },
      });
      await prisma.plan.delete({ where: { id: planId } });
      await prisma.$disconnect();
    });

    it('persists a public submission without a JWT and prevents access until an auditable authorized approval', async () => {
      const response = await register();
      expect(response.status).toBe(201);
      const result = responseData<RegistrationResult>(response);
      expect(result).not.toHaveProperty('accessToken');
      expect(result.domainVerified).toBe(false);
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: result.organizationId },
      });
      expect(org).toMatchObject({
        registrationStatus: 'PENDING_ORGANIZATION_REVIEW',
        status: 'PROVISIONING',
        domainVerifiedAt: null,
        registrationCountry: 'IN',
      });
      const user = await prisma.tenantUser.findUniqueOrThrow({
        where: { employeeId: result.employeeId },
      });
      expect(await argon2.verify(user.passwordHash, password)).toBe(true);
      await request(app.getHttpServer())
        .post(login)
        .send({ employeeId: user.employeeId, password })
        .expect(401);
      const oldToken = await app.get(TenantTokenService).sign(user);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(oldToken, { type: 'bearer' })
        .expect(401);
      const token = await adminToken();
      await request(app.getHttpServer())
        .post(reviewPath(org.id))
        .auth(token, { type: 'bearer' })
        .send({ decision: 'APPROVED', note })
        .expect(201);
      const approved = await prisma.organization.findUniqueOrThrow({
        where: { id: org.id },
      });
      expect(approved).toMatchObject({
        status: 'ACTIVE',
        registrationStatus: 'APPROVED',
        reviewedByStaffId: staffId,
        reviewNote: note,
        domainVerifiedAt: null,
      });
      const auth = await request(app.getHttpServer())
        .post(login)
        .send({ employeeId: user.employeeId, password })
        .expect(201);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(responseData<{ accessToken: string }>(auth).accessToken, {
          type: 'bearer',
        })
        .expect(200);
      expect(
        await prisma.platformAuditLog.count({
          where: {
            resourceId: org.id,
            action: 'organization.registration.approved',
            actorStaffId: staffId,
          },
        }),
      ).toBe(1);
      await request(app.getHttpServer())
        .post(`/api/v1/platform/organizations/${org.id}/suspensions`)
        .auth(token, { type: 'bearer' })
        .expect(201);
      await request(app.getHttpServer())
        .get('/api/v1/tenant/auth/me')
        .auth(responseData<{ accessToken: string }>(auth).accessToken, {
          type: 'bearer',
        })
        .expect(401);
    });
    it('validates and audits trusted Admin provisioning without a second review or tenant lockout', async () => {
      const token = await adminToken();
      const domain = `admin-${randomUUID()}.org`;
      const created = await request(app.getHttpServer())
        .post('/api/v1/platform/organizations')
        .auth(token, { type: 'bearer' })
        .send({
          name: 'Trusted Admin organization',
          primaryEmail: 'OFFICE@' + domain.toUpperCase(),
        })
        .expect(201);
      const org = responseData<Organization>(created);
      orgIds.push(org.id);
      expect(org).toMatchObject({
        registrationStatus: 'LEGACY_APPROVED',
        registrationSubmittedAt: null,
        status: 'PROVISIONING',
        domainVerifiedAt: null,
        normalizedDomain: domain,
      });
      expect(
        await prisma.platformAuditLog.count({
          where: {
            resourceId: org.id,
            action: 'organization.provisioned',
            actorStaffId: staffId,
          },
        }),
      ).toBe(1);
      const user = await prisma.tenantUser.create({
        data: {
          organizationId: org.id,
          employeeId: 'ADM-' + randomUUID(),
          firstName: 'Trusted',
          lastName: 'User',
          email: 'trusted@' + domain,
          passwordHash: await argon2.hash(password),
        },
      });
      await request(app.getHttpServer())
        .post(login)
        .send({ employeeId: user.employeeId, password })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/platform/organizations')
        .auth(token, { type: 'bearer' })
        .send({ name: 'Different legal name', primaryEmail: 'other@' + domain })
        .expect(409);
      expect(
        (
          await register(
            payload({
              primaryEmail: 'third@' + domain,
              email: 'alex@' + domain,
            }),
          )
        ).status,
      ).toBe(409);
      await request(app.getHttpServer())
        .post('/api/v1/platform/organizations')
        .auth(token, { type: 'bearer' })
        .send({ name: '  ', primaryEmail: 'office@another.org' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/platform/organizations')
        .send({ name: 'Denied', primaryEmail: 'office@denied.org' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/platform/organizations')
        .auth(await adminToken(false), { type: 'bearer' })
        .send({ name: 'Denied', primaryEmail: 'office@denied.org' })
        .expect(403);
    });

    it('serializes competing public and Admin domain claims and records Admin metadata changes', async () => {
      const token = await adminToken(),
        domain = `race-${randomUUID()}.org`;
      const adminAttempt = request(app.getHttpServer())
        .post('/api/v1/platform/organizations')
        .auth(token, { type: 'bearer' })
        .send({ name: 'Shared name', primaryEmail: 'admin@' + domain });
      const [admin, client] = await Promise.all([
        adminAttempt,
        register(
          payload({
            name: 'Shared name',
            primaryEmail: 'public@' + domain,
            email: 'contact@' + domain,
          }),
        ),
      ]);
      if (admin.status === 201)
        orgIds.push(responseData<Organization>(admin).id);
      expect([admin.status, client.status].sort()).toEqual([201, 409]);
      const created = await request(app.getHttpServer())
        .post('/api/v1/platform/organizations')
        .auth(token, { type: 'bearer' })
        .send({
          name: 'Shared name',
          primaryEmail: `office@edit-${randomUUID()}.org`,
        })
        .expect(201);
      const id = responseData<Organization>(created).id;
      orgIds.push(id);
      await request(app.getHttpServer())
        .patch(`/api/v1/platform/organizations/${id}`)
        .auth(token, { type: 'bearer' })
        .send({ primaryEmail: 'different@' + domain })
        .expect(409);
      const nextDomain = `updated-${randomUUID()}.org`;
      await request(app.getHttpServer())
        .patch(`/api/v1/platform/organizations/${id}`)
        .auth(token, { type: 'bearer' })
        .send({ primaryEmail: 'office@' + nextDomain })
        .expect(200);
      expect(
        (await prisma.organization.findUniqueOrThrow({ where: { id } }))
          .normalizedDomain,
      ).toBe(nextDomain);
      expect(
        await prisma.platformAuditLog.count({
          where: {
            resourceId: id,
            actorStaffId: staffId,
            action: 'organization.updated',
          },
        }),
      ).toBe(1);
    });

    it('rejects missing, invalid country, reserved domains and malformed identifiers without provisioning', async () => {
      for (const data of [
        payload({ registrationCountry: '' }),
        payload({ registrationCountry: 'ZZ' }),
        payload({
          primaryEmail: 'fake@example.test',
          email: 'fake@example.test',
        }),
        payload({ registrationIdentifier: '<script>fake</script>' }),
      ]) {
        const response = await register(data);
        expect(response.status).toBe(400);
      }
    });
    it('prevents concurrent duplicates of a country/normalized identifier, even on different domains', async () => {
      const identifier = 'REG-' + randomUUID();
      const results = await Promise.all([
        register(payload({ registrationIdentifier: identifier })),
        register(
          payload({
            registrationIdentifier: identifier
              .toLowerCase()
              .replaceAll('-', ' '),
          }),
        ),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });
    it('prevents domain duplicates and recognizes existing historical emails case insensitively', async () => {
      const domain = 'domain-' + suffix + '.org';
      const results = await Promise.all([
        register(
          payload({
            primaryEmail: 'office@' + domain,
            email: 'alex@' + domain,
          }),
        ),
        register(
          payload({
            primaryEmail: 'other@' + domain.toUpperCase(),
            email: 'contact@' + domain,
          }),
        ),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const historical = await prisma.organization.create({
        data: {
          name: 'Historical',
          primaryEmail: 'OFFICE@HISTORIC-' + suffix + '.ORG',
        },
      });
      orgIds.push(historical.id);
      expect(
        (
          await register(
            payload({
              primaryEmail: 'new@historic-' + suffix + '.org',
              email: 'alex@historic-' + suffix + '.org',
            }),
          )
        ).status,
      ).toBe(409);
    });
    it('recognizes a historical internationalized email domain through its ASCII IDNA spelling', async () => {
      const unicodeDomain = `münchen-${randomUUID()}.org`;
      const historical = await prisma.organization.create({
        data: {
          name: 'International historical organization',
          primaryEmail: 'office@' + unicodeDomain,
        },
      });
      orgIds.push(historical.id);
      const asciiDomain = new URL('https://' + unicodeDomain).hostname;
      expect(
        (
          await register(
            payload({
              primaryEmail: 'office@' + asciiDomain,
              email: 'contact@' + asciiDomain,
            }),
          )
        ).status,
      ).toBe(409);
    });

    it('permits country-scoped IDs and an honest not-applicable explanation without claiming genuineness', async () => {
      const identifier = 'REG-' + randomUUID();
      expect(
        (
          await register(
            payload({
              registrationIdentifier: identifier,
              registrationCountry: 'IN',
            }),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await register(
            payload({
              registrationIdentifier: identifier,
              registrationCountry: 'GB',
            }),
          )
        ).status,
      ).toBe(201);
      const exempt = await register(
        payload({
          registrationIdentifier: '',
          registrationExemptionReason:
            'Unincorporated association without an issued company number.',
        }),
      );
      expect(exempt.status).toBe(201);
      expect(responseData<RegistrationResult>(exempt).registrationStatus).toBe(
        'PENDING_ORGANIZATION_REVIEW',
      );
    });
    it('rejects unauthenticated and unprivileged review attempts; rejection prevents subsequent access or reactivation bypass', async () => {
      const result = responseData<RegistrationResult>(await register());
      const path = reviewPath(result.organizationId);
      const body = {
        decision: 'REJECTED',
        note: 'Insufficient independent evidence of registration and authorized representation.',
      };
      await request(app.getHttpServer()).post(path).send(body).expect(401);
      await request(app.getHttpServer())
        .post(path)
        .auth(await adminToken(false), { type: 'bearer' })
        .send(body)
        .expect(403);
      const token = await adminToken();
      await request(app.getHttpServer())
        .post(path)
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(201);
      await request(app.getHttpServer())
        .post(login)
        .send({ employeeId: result.employeeId, password })
        .expect(401);
      await request(app.getHttpServer())
        .post(
          `/api/v1/platform/organizations/${result.organizationId}/reactivations`,
        )
        .auth(token, { type: 'bearer' })
        .expect(409);
      expect(
        await prisma.platformAuditLog.count({
          where: {
            resourceId: result.organizationId,
            action: 'organization.registration.rejected',
          },
        }),
      ).toBe(1);
    });
    it('makes competing review decisions race safe and locks submitted identity metadata', async () => {
      const result = responseData<RegistrationResult>(await register()),
        token = await adminToken();
      const responses = await Promise.all(
        ['APPROVED', 'REJECTED'].map((decision) =>
          request(app.getHttpServer())
            .post(reviewPath(result.organizationId))
            .auth(token, { type: 'bearer' })
            .send({ decision, note }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        await prisma.platformAuditLog.count({
          where: {
            resourceId: result.organizationId,
            action: {
              in: [
                'organization.registration.approved',
                'organization.registration.rejected',
              ],
            },
          },
        }),
      ).toBe(1);
      await request(app.getHttpServer())
        .patch(`/api/v1/platform/organizations/${result.organizationId}`)
        .auth(token, { type: 'bearer' })
        .send({ primaryEmail: 'changed@different.org' })
        .expect(409);
    });
    it('retains existing historical organization access and persists approval across application restart', async () => {
      const historic = await prisma.organization.create({
        data: {
          name: 'Historical approved organization',
          primaryEmail: 'legacy-' + suffix + '@preserved.org',
          status: 'ACTIVE',
        },
      });
      orgIds.push(historic.id);
      const user = await prisma.tenantUser.create({
        data: {
          organizationId: historic.id,
          employeeId: 'LEGACY-' + suffix,
          firstName: 'Old',
          lastName: 'User',
          email: 'old@preserved.org',
          passwordHash: await argon2.hash(password),
        },
      });
      await request(app.getHttpServer())
        .post(login)
        .send({ employeeId: user.employeeId, password })
        .expect(201);
      const result = responseData<RegistrationResult>(await register()),
        token = await adminToken();
      await request(app.getHttpServer())
        .post(reviewPath(result.organizationId))
        .auth(token, { type: 'bearer' })
        .send({ decision: 'APPROVED', note })
        .expect(201);
      await app.close();
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication<INestApplication<App>>();
      configureHttpApplication(app);
      await app.init();
      await request(app.getHttpServer())
        .post(login)
        .send({ employeeId: result.employeeId, password })
        .expect(201);
      await request(app.getHttpServer())
        .post(login)
        .send({ employeeId: user.employeeId, password })
        .expect(201);
    });
  },
);
