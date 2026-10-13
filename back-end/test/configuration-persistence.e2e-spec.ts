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

// Explicit opt-in: this suite must never run against an operational database.
const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)(
  'PostgreSQL tenant configuration persistence',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let token: string;
    let otherToken: string;
    let submitterToken: string;
    let organizationId: string;
    let otherOrganizationId: string;
    let categoryId: string;
    let policyId: string;
    let slug: string;
    const password = randomUUID() + '!aA1';
    const categories = '/api/v1/tenant/expenses/configuration/categories';
    const policies = '/api/v1/tenant/expenses/configuration/policies';

    async function start() {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication<INestApplication<App>>();
      configureHttpApplication(app);
      await app.init();
      prisma = app.get(PrismaService);
    }

    async function login(organizationSlug: string, employeeId = 'CFG-TEST') {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenant/auth/login')
        .send({ employeeId: `${employeeId}-${organizationSlug}`, password })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL || '');
      if (
        !url.pathname.startsWith('/finstack_config_verify_') &&
        !url.searchParams.get('schema')?.startsWith('finstack_config_verify_')
      )
        throw new Error(
          'Use a disposable finstack_config_verify_* database or schema.',
        );
      process.env.TENANT_JWT_ACCESS_SECRET = randomUUID() + randomUUID();
      await start();
      const passwordHash = await argon2.hash(password);
      const first = await prisma.organization.create({
        data: {
          name: 'Disposable configuration test',
          slug: `config-test-${randomUUID()}`,
          primaryEmail: `${randomUUID()}@example.test`,
        },
      });
      const other = await prisma.organization.create({
        data: {
          name: 'Disposable isolation test',
          slug: `config-test-${randomUUID()}`,
          primaryEmail: `${randomUUID()}@example.test`,
        },
      });
      organizationId = first.id;
      otherOrganizationId = other.id;
      slug = first.slug!;
      for (const organization of [first, other]) {
        await prisma.tenantUser.create({
          data: {
            organizationId: organization.id,
            employeeId: `CFG-TEST-${organization.slug}`,
            firstName: 'Test',
            lastName: 'Config',
            email: 'config@example.test',
            passwordHash,
            role: TenantRole.CONFIGURATION_MANAGER,
          },
        });
      }
      await prisma.tenantUser.create({
        data: {
          organizationId,
          employeeId: `SUB-TEST-${slug}`,
          firstName: 'Test',
          lastName: 'Submitter',
          email: 'submitter@example.test',
          passwordHash,
          role: TenantRole.EXPENSE_SUBMITTER,
        },
      });
      token = await login(slug);
      otherToken = await login(other.slug!);
      submitterToken = await login(slug, 'SUB-TEST');
    });

    afterAll(async () => {
      if (prisma) {
        const ids = [organizationId, otherOrganizationId].filter(Boolean);
        await prisma.expensePolicy.deleteMany({
          where: { organizationId: { in: ids } },
        });
        await prisma.expenseCategory.deleteMany({
          where: { organizationId: { in: ids } },
        });
        await prisma.tenantUser.deleteMany({
          where: { organizationId: { in: ids } },
        });
        await prisma.organization.deleteMany({ where: { id: { in: ids } } });
      }
      await app?.close();
    });

    it('requires a tenant JWT and Configuration Manager authority', async () => {
      await request(app.getHttpServer())
        .post(categories)
        .send({ name: 'Denied' })
        .expect(401);
      await request(app.getHttpServer())
        .post(categories)
        .set('Authorization', `Bearer ${submitterToken}`)
        .set('role', 'superuser')
        .send({ name: 'Denied' })
        .expect(403);
    });

    it('creates categories and policies in PostgreSQL and reads them back', async () => {
      const category = await request(app.getHttpServer())
        .post(categories)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: ' Travel ', limit: 123.45 })
        .expect(201);
      categoryId = (category.body as { data: { id: string } }).data.id;
      const policy = await request(app.getHttpServer())
        .post(policies)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Travel cap',
          categoryId,
          maxAmount: 999.99,
          receiptRequired: false,
        })
        .expect(201);
      policyId = (policy.body as { data: { id: string } }).data.id;
      expect(
        (
          await prisma.expenseCategory.findUniqueOrThrow({
            where: { id: categoryId },
          })
        ).limit.toString(),
      ).toBe('123.45');
      expect(
        (
          await prisma.expensePolicy.findUniqueOrThrow({
            where: { id: policyId },
          })
        ).maxAmount.toString(),
      ).toBe('999.99');
      const response = await request(app.getHttpServer())
        .get(policies)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((response.body as { data: unknown }).data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: policyId, receiptRequired: false }),
        ]),
      );
    });

    it('rejects duplicates, including simultaneous case variants, per tenant', async () => {
      await request(app.getHttpServer())
        .post(categories)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'travel' })
        .expect(409);
      await request(app.getHttpServer())
        .post(policies)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: ' TRAVEL CAP ', categoryId, maxAmount: 1 })
        .expect(409);
      const concurrent = await Promise.all(
        ['Meals', 'MEALS'].map((name) =>
          request(app.getHttpServer())
            .post(categories)
            .set('Authorization', `Bearer ${token}`)
            .send({ name }),
        ),
      );
      expect(concurrent.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      await request(app.getHttpServer())
        .post(categories)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Travel' })
        .expect(201);
    });

    it('rejects invalid input and explicit null without changing records', async () => {
      for (const data of [
        { name: '   ' },
        { name: 'x', currency: 'RUPEES' },
        { name: 'x', limit: -1 },
        { name: 'x', limit: 0.001 },
        { name: 'x', color: 'url(x)' },
        { name: 'x', organizationId: otherOrganizationId },
      ]) {
        await request(app.getHttpServer())
          .post(categories)
          .set('Authorization', `Bearer ${token}`)
          .send(data)
          .expect(400);
      }
      await request(app.getHttpServer())
        .patch(`${categories}/${categoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: null })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`${categories}/not-a-uuid`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x' })
        .expect(400);
      await request(app.getHttpServer())
        .post(policies)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x', categoryId: 'all_categories', maxAmount: 1 })
        .expect(400);
    });

    it('isolates reads, writes, deletion and category associations across tenants', async () => {
      const list = await request(app.getHttpServer())
        .get(policies)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect((list.body as { data: unknown }).data).toEqual([]);
      for (const path of [
        `${categories}/${categoryId}`,
        `${policies}/${policyId}`,
      ]) {
        await request(app.getHttpServer())
          .patch(path)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ name: 'stolen' })
          .expect(404);
        await request(app.getHttpServer())
          .delete(path)
          .set('Authorization', `Bearer ${otherToken}`)
          .expect(404);
      }
      await request(app.getHttpServer())
        .post(policies)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'stolen', categoryId, maxAmount: 1 })
        .expect(404);
      await expect(
        prisma.expensePolicy.create({
          data: {
            organizationId: otherOrganizationId,
            categoryId,
            name: 'invalid direct association',
            maxAmount: 1,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('updates fields, preserves omitted flags and protects referenced categories', async () => {
      await request(app.getHttpServer())
        .patch(`${categories}/${categoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Travel updated' })
        .expect(200);
      const response = await request(app.getHttpServer())
        .patch(`${policies}/${policyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ maxAmount: 1000.01 })
        .expect(200);
      expect(
        (response.body as { data: { receiptRequired: boolean } }).data
          .receiptRequired,
      ).toBe(false);
      await request(app.getHttpServer())
        .delete(`${categories}/${categoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('survives application shutdown, a fresh Prisma client and new login', async () => {
      await app.close();
      await start();
      token = await login(slug);
      const response = await request(app.getHttpServer())
        .get(policies)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((response.body as { data: unknown }).data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: policyId, maxAmount: 1000.01 }),
        ]),
      );
      expect(
        (
          await prisma.expenseCategory.findUniqueOrThrow({
            where: { id: categoryId },
          })
        ).name,
      ).toBe('Travel updated');
    });

    it('deletes unreferenced configuration records persistently', async () => {
      await request(app.getHttpServer())
        .delete(`${policies}/${policyId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .delete(`${categories}/${categoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        await prisma.expensePolicy.findUnique({ where: { id: policyId } }),
      ).toBeNull();
      expect(
        await prisma.expenseCategory.findUnique({ where: { id: categoryId } }),
      ).toBeNull();
    });
  },
);
