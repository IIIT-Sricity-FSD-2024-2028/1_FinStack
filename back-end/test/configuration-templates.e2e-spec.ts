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
  'PostgreSQL configuration template activation',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let token: string;
    let otherToken: string;
    let submitterToken: string;
    let organizationId: string;
    let otherOrganizationId: string;
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

    const catalogPath = '/api/v1/tenant/expenses/configuration/templates';
    const categoryBatch = categories + '/activate-templates';
    const policyBatch = policies + '/activate-templates';
    const version = '2026-10-10.v1';
    function data<T>(response: request.Response): T {
      return (response.body as { data: T }).data;
    }
    const api = () => request(app.getHttpServer());
    const auth = () => ({ Authorization: `Bearer ${token}` });
    const categorySelection = (templateKeys: string[]) => ({
      version,
      templateKeys,
    });
    function policySelection(
      templateKey: string,
      id: string,
      maxAmount = 125.75,
    ) {
      return {
        templateKey,
        categoryId: id,
        maxAmount,
        currency: 'USD',
        receiptRequired: false,
        approvalLevels: 1,
      };
    }

    it('requires JWT and Configuration Manager authority for catalog and both batches', async () => {
      await api().get(catalogPath).expect(401);
      await api()
        .get(catalogPath)
        .set('Authorization', `Bearer ${submitterToken}`)
        .expect(403);
      for (const path of [categoryBatch, policyBatch]) {
        await api().post(path).send({}).expect(401);
        await api()
          .post(path)
          .set('Authorization', `Bearer ${submitterToken}`)
          .send({})
          .expect(403);
      }
    });

    it('serves stable templates with blank monetary limits without activating records', async () => {
      const response = await api().get(catalogPath).set(auth()).expect(200);
      const catalog = data<{
        version: string;
        categories: unknown[];
        policies: { maxAmount: null }[];
      }>(response);
      expect(catalog.version).toBe(version);
      expect(catalog.categories).toHaveLength(8);
      expect(catalog.policies).toHaveLength(8);
      expect(catalog.policies.every((p) => p.maxAmount === null)).toBe(true);
      expect(
        await prisma.expenseCategory.count({ where: { organizationId } }),
      ).toBe(0);
    });

    it('preserves matching custom IDs, settings and inactive state during activation', async () => {
      const custom = data<{ id: string }>(
        await api()
          .post(categories)
          .set(auth())
          .send({
            name: ' Travel ',
            description: 'Existing custom category',
            limit: 12.34,
            status: 'Inactive',
          })
          .expect(201),
      );
      const before = await prisma.expenseCategory.findUniqueOrThrow({
        where: { id: custom.id },
      });
      const response = await api()
        .post(categoryBatch)
        .set(auth())
        .send(categorySelection(['travel', 'meals']))
        .expect(201);
      expect(data(response)).toEqual({
        createdCount: 1,
        existingCount: 1,
        createdTemplates: [{ key: 'meals', name: 'Meals' }],
        skippedTemplates: [
          { key: 'travel', name: 'Travel', status: 'Inactive' },
        ],
      });
      expect(
        await prisma.expenseCategory.findUniqueOrThrow({
          where: { id: custom.id },
        }),
      ).toEqual(before);
    });

    it('audits category create, deactivation, reactivation and allowed deletion while protecting references', async () => {
      const created = data<{ id: string; name: string }>(
        await api()
          .post(categories)
          .set(auth())
          .send({
            name: '  Lifecycle category  ',
            description: 'Keeps history safe.',
          })
          .expect(201),
      );
      expect(created.name).toBe('Lifecycle category');
      await api()
        .post(categories)
        .set(auth())
        .send({ name: 'LIFECYCLE CATEGORY' })
        .expect(409);
      await api()
        .post(categories)
        .set(auth())
        .send({ name: 'Invalid description', description: 'x'.repeat(1001) })
        .expect(400);
      await api()
        .patch(categories + '/' + created.id)
        .set('Authorization', `Bearer ${submitterToken}`)
        .send({ status: 'Inactive' })
        .expect(403);
      await api()
        .patch(categories + '/' + created.id)
        .set({ Authorization: `Bearer ${otherToken}` })
        .send({ status: 'Inactive' })
        .expect(404);
      const policy = data<{ id: string }>(
        await api()
          .post(policies)
          .set(auth())
          .send({
            name: 'Lifecycle policy',
            categoryId: created.id,
            maxAmount: 25,
          })
          .expect(201),
      );
      const policyBefore = await prisma.expensePolicy.findUniqueOrThrow({
        where: { id: policy.id },
      });

      await api()
        .patch(categories + '/' + created.id)
        .set(auth())
        .send({ status: 'Inactive' })
        .expect(200);
      expect(
        (
          await prisma.expenseCategory.findUniqueOrThrow({
            where: { id: created.id },
          })
        ).status,
      ).toBe('Inactive');
      expect(
        data<{ id: string }[]>(
          await api()
            .get('/api/v1/tenant/expenses/categories')
            .set(auth())
            .expect(200),
        ).some((item) => item.id === created.id),
      ).toBe(false);
      expect(
        await prisma.expensePolicy.findUniqueOrThrow({
          where: { id: policy.id },
        }),
      ).toEqual(policyBefore);
      await api()
        .patch(categories + '/' + created.id)
        .set(auth())
        .send({ status: 'Active' })
        .expect(200);
      expect(
        data<{ id: string }[]>(
          await api()
            .get('/api/v1/tenant/expenses/categories')
            .set(auth())
            .expect(200),
        ).some((item) => item.id === created.id),
      ).toBe(true);
      expect(
        await prisma.expensePolicy.findUniqueOrThrow({
          where: { id: policy.id },
        }),
      ).toEqual(
        expect.objectContaining({ status: 'Active', name: 'Lifecycle policy' }),
      );
      const blockedDelete = await api()
        .delete(categories + '/' + created.id)
        .set(auth())
        .expect(400);
      expect(JSON.stringify(blockedDelete.body)).toContain(
        'Deactivate it instead',
      );
      expect(
        await prisma.expenseCategory.findUnique({ where: { id: created.id } }),
      ).not.toBeNull();
      expect(
        await prisma.tenantAuditLog.count({
          where: {
            organizationId,
            eventCode: 'category.deleted',
            targetId: created.id,
          },
        }),
      ).toBe(0);

      await api()
        .delete(policies + '/' + policy.id)
        .set(auth())
        .expect(200);
      await api()
        .delete(categories + '/' + created.id)
        .set(auth())
        .expect(200);
      const events = await prisma.tenantAuditLog.findMany({
        where: { organizationId, targetId: created.id },
        orderBy: { occurredAt: 'asc' },
        select: { eventCode: true, outcome: true },
      });
      expect(events.map((event) => event.eventCode)).toEqual([
        'category.created',
        'category.deactivated',
        'category.reactivated',
        'category.deleted',
      ]);
      expect(events.every((event) => event.outcome === 'SUCCESS')).toBe(true);
    });

    it('serializes concurrent category batches with database uniqueness', async () => {
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          api()
            .post(categoryBatch)
            .set(auth())
            .send(categorySelection(['equipment', 'fuel-mileage'])),
        ),
      );
      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(
        responses.reduce(
          (sum, r) => sum + data<{ createdCount: number }>(r).createdCount,
          0,
        ),
      ).toBe(2);
      expect(
        await prisma.expenseCategory.count({
          where: {
            organizationId,
            templateKey: { in: ['equipment', 'fuel-mileage'] },
          },
        }),
      ).toBe(2);
    });

    it('keeps renamed activated category identity and rejects client provenance changes', async () => {
      const meals = await prisma.expenseCategory.findFirstOrThrow({
        where: { organizationId, templateKey: 'meals' },
      });
      await api()
        .patch(categories + '/' + meals.id)
        .set(auth())
        .send({ name: 'Company Food' })
        .expect(200);
      await api()
        .patch(categories + '/' + meals.id)
        .set(auth())
        .send({ templateKey: 'equipment' })
        .expect(400);
      const response = await api()
        .post(categoryBatch)
        .set(auth())
        .send(categorySelection(['meals']))
        .expect(201);
      expect(data(response)).toEqual(
        expect.objectContaining({ createdCount: 0, existingCount: 1 }),
      );
      expect(
        (
          await prisma.expenseCategory.findUniqueOrThrow({
            where: { id: meals.id },
          })
        ).name,
      ).toBe('Company Food');
      expect(
        await prisma.expenseCategory.count({
          where: { organizationId, templateKey: 'meals' },
        }),
      ).toBe(1);
    });

    it('validates complete batches, unknown/duplicate keys and catalog versions', async () => {
      const before = await prisma.expenseCategory.count({
        where: { organizationId },
      });
      for (const payload of [
        categorySelection([]),
        categorySelection(['training', 'unknown']),
        categorySelection(['meals', 'meals']),
        { version: 'old', templateKeys: ['training'] },
        {
          ...categorySelection(['training']),
          organizationId: otherOrganizationId,
        },
      ])
        await api().post(categoryBatch).set(auth()).send(payload).expect(400);
      expect(
        await prisma.expenseCategory.count({ where: { organizationId } }),
      ).toBe(before);
    });

    it('activates concurrent policy batches, preserving reviewed caps and renamed policy edits', async () => {
      const equipment = await prisma.expenseCategory.findFirstOrThrow({
        where: { organizationId, templateKey: 'equipment' },
      });
      const fuel = await prisma.expenseCategory.findFirstOrThrow({
        where: { organizationId, templateKey: 'fuel-mileage' },
      });
      const payload = {
        version,
        policies: [
          policySelection('equipment-policy', equipment.id),
          {
            ...policySelection('fuel-mileage-policy', fuel.id, 450.25),
            receiptRequired: true,
            approvalLevels: 2,
          },
        ],
      };
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          api().post(policyBatch).set(auth()).send(payload),
        ),
      );
      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(
        responses.reduce(
          (sum, r) => sum + data<{ createdCount: number }>(r).createdCount,
          0,
        ),
      ).toBe(2);
      const policy = await prisma.expensePolicy.findFirstOrThrow({
        where: { organizationId, templateKey: 'equipment-policy' },
      });
      policyId = policy.id;
      expect(policy.maxAmount.toString()).toBe('125.75');
      expect(policy.currency).toBe('USD');
      expect(policy.receiptRequired).toBe(false);
      expect(policy.approval).toBe('Manager Approval');
      await api()
        .patch(policies + '/' + policy.id)
        .set(auth())
        .send({
          name: 'Company Hardware',
          maxAmount: 900.55,
          currency: 'EUR',
          receiptRequired: true,
          approval: 'Manager + Finance',
          requiresApproval: true,
        })
        .expect(200);
      const edited = await prisma.expensePolicy.findUniqueOrThrow({
        where: { id: policy.id },
      });
      await api().post(policyBatch).set(auth()).send(payload).expect(201);
      expect(
        await prisma.expensePolicy.findUniqueOrThrow({
          where: { id: policy.id },
        }),
      ).toEqual(edited);
      expect(
        await prisma.expensePolicy.count({
          where: { organizationId, templateKey: 'equipment-policy' },
        }),
      ).toBe(1);
    });

    it('rejects invalid, mismatched, inactive and foreign categories atomically', async () => {
      await api()
        .post(categoryBatch)
        .set(auth())
        .send(categorySelection(['training', 'accommodation']))
        .expect(201);
      const training = await prisma.expenseCategory.findFirstOrThrow({
        where: { organizationId, templateKey: 'training' },
      });
      const travel = await prisma.expenseCategory.findFirstOrThrow({
        where: { organizationId, name: 'Travel' },
      });
      const accommodation = await prisma.expenseCategory.findFirstOrThrow({
        where: { organizationId, templateKey: 'accommodation' },
      });
      const foreign = await prisma.expenseCategory.create({
        data: { organizationId: otherOrganizationId, name: 'Training' },
      });
      const valid = policySelection('training-policy', training.id);
      for (const malformed of [[null], [42], [], null]) {
        await api()
          .post(policyBatch)
          .set(auth())
          .send({ version, policies: malformed })
          .expect(400);
      }

      const before = await prisma.expensePolicy.count({
        where: { organizationId },
      });
      for (const invalid of [
        { ...valid, maxAmount: null },
        { ...valid, maxAmount: -1 },
        { ...valid, maxAmount: 0.001 },
        { ...valid, currency: 'rupees' },
        { ...valid, receiptRequired: null },
        { ...valid, approvalLevels: 3 },
        { ...valid, categoryId: foreign.id },
        { ...valid, categoryId: travel.id },
        { ...valid, templateKey: 'unknown' },
      ])
        await api()
          .post(policyBatch)
          .set(auth())
          .send({
            version,
            policies: [
              policySelection('accommodation-policy', accommodation.id),
              invalid,
            ],
          })
          .expect(400);
      expect(
        await prisma.expensePolicy.count({ where: { organizationId } }),
      ).toBe(before);
      await api()
        .patch(categories + '/' + training.id)
        .set(auth())
        .send({ status: 'Inactive' })
        .expect(200);
      await api()
        .post(policyBatch)
        .set(auth())
        .send({ version, policies: [valid] })
        .expect(400);
      await api()
        .patch(categories + '/' + training.id)
        .set(auth())
        .send({ status: 'Active' })
        .expect(200);
      await api()
        .post(policyBatch)
        .set(auth())
        .send({ version, policies: [valid, valid] })
        .expect(400);
      await api()
        .post(policyBatch)
        .set(auth())
        .send({
          version,
          policies: [{ ...valid, maxAmount: '0.01', approvalLevels: 0 }],
        })
        .expect(201);
      const noApproval = await prisma.expensePolicy.findFirstOrThrow({
        where: { organizationId, templateKey: 'training-policy' },
      });
      expect(noApproval.maxAmount.toString()).toBe('0.01');
      expect(noApproval.requiresApproval).toBe(false);
      expect(noApproval.approval).toBe('Auto Approved');
    });

    it('isolates records and allows the same template independently in another tenant', async () => {
      const otherAuth = { Authorization: `Bearer ${otherToken}` };
      expect(
        data(await api().get(policies).set(otherAuth).expect(200)),
      ).toEqual([]);
      await api()
        .patch(policies + '/' + policyId)
        .set(otherAuth)
        .send({ maxAmount: 1 })
        .expect(404);
      const response = await api()
        .post(categoryBatch)
        .set(otherAuth)
        .send(categorySelection(['equipment']))
        .expect(201);
      expect(data(response)).toEqual(
        expect.objectContaining({ createdCount: 1, existingCount: 0 }),
      );
      const equipment = await prisma.expenseCategory.findFirstOrThrow({
        where: {
          organizationId: otherOrganizationId,
          templateKey: 'equipment',
        },
      });
      await api()
        .post(policyBatch)
        .set(otherAuth)
        .send({
          version,
          policies: [policySelection('equipment-policy', equipment.id)],
        })
        .expect(201);
      expect(
        await prisma.expensePolicy.count({
          where: { organizationId: otherOrganizationId },
        }),
      ).toBe(1);
    });

    it('preserves ordinary custom category and policy CRUD', async () => {
      const category = data<{ id: string }>(
        await api()
          .post(categories)
          .set(auth())
          .send({ name: 'Custom conference' })
          .expect(201),
      );
      const policy = data<{ id: string }>(
        await api()
          .post(policies)
          .set(auth())
          .send({ name: 'Custom cap', categoryId: category.id, maxAmount: 25 })
          .expect(201),
      );
      await api()
        .patch(categories + '/' + category.id)
        .set(auth())
        .send({ description: 'Edited custom' })
        .expect(200);
      await api()
        .patch(policies + '/' + policy.id)
        .set(auth())
        .send({ maxAmount: 33.25, currency: 'GBP' })
        .expect(200);
      await api()
        .delete(policies + '/' + policy.id)
        .set(auth())
        .expect(200);
      await api()
        .delete(categories + '/' + category.id)
        .set(auth())
        .expect(200);
      expect(
        await prisma.expensePolicy.findUnique({ where: { id: policyId } }),
      ).not.toBeNull();
    });

    it('persists exact policy caps, defaults currency, audits lifecycle and guards inactive categories', async () => {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { defaultCurrency: 'EUR' },
      });
      const category = data<{ id: string }>(
        await api()
          .post(categories)
          .set(auth())
          .send({ name: 'Policy lifecycle category' })
          .expect(201),
      );
      const catalog = data<{ defaultCurrency: string }>(
        await api().get(catalogPath).set(auth()).expect(200),
      );
      expect(catalog.defaultCurrency).toBe('EUR');
      for (const amount of ['5000', '5000.50', '7500.75', '0.01']) {
        const response = data<{ id: string; maxAmountExact: string }>(
          await api()
            .post(policies)
            .set(auth())
            .send({
              name: 'POL-01 ' + amount,
              categoryId: category.id,
              maxAmount: amount,
            })
            .expect(201),
        );
        const expected = amount.includes('.') ? amount : amount + '.00';
        expect(response.maxAmountExact).toBe(expected);
        expect(
          (
            await prisma.expensePolicy.findUniqueOrThrow({
              where: { id: response.id },
            })
          ).maxAmount.toFixed(2),
        ).toBe(expected);
        await api()
          .delete(policies + '/' + response.id)
          .set(auth())
          .expect(200);
      }
      for (const amount of [
        '',
        'abc',
        '0',
        '-1',
        '1.005',
        '10000000000',
        '1e3',
      ])
        await api()
          .post(policies)
          .set(auth())
          .send({
            name: 'Invalid cap',
            categoryId: category.id,
            maxAmount: amount,
          })
          .expect(400);
      const created = data<{
        id: string;
        maxAmountExact: string;
        currency: string;
      }>(
        await api()
          .post(policies)
          .set(auth())
          .send({
            name: ' Exact decimal policy ',
            categoryId: category.id,
            maxAmount: '9999999999.99',
            description: 'Preserve description',
            receiptRequired: false,
            approval: 'Auto Approved',
            requiresApproval: false,
          })
          .expect(201),
      );
      expect(created.maxAmountExact).toBe('9999999999.99');
      expect(created.currency).toBe('EUR');
      await api()
        .post(policies)
        .set(auth())
        .send({
          name: 'exact decimal policy',
          categoryId: category.id,
          maxAmount: '500',
        })
        .expect(409);
      await api()
        .patch(policies + '/' + created.id)
        .set(auth())
        .send({ status: 'Inactive' })
        .expect(200);
      await api()
        .patch(categories + '/' + category.id)
        .set(auth())
        .send({ status: 'Inactive' })
        .expect(200);
      await api()
        .patch(policies + '/' + created.id)
        .set(auth())
        .send({ status: 'Active' })
        .expect(400);
      await api()
        .post(policies)
        .set(auth())
        .send({
          name: 'Inactive dependency',
          categoryId: category.id,
          maxAmount: '500',
        })
        .expect(400);
      await api()
        .patch(categories + '/' + category.id)
        .set(auth())
        .send({ status: 'Active' })
        .expect(200);
      await api()
        .patch(policies + '/' + created.id)
        .set(auth())
        .send({ status: 'Active' })
        .expect(200);
      for (const [approval, requiresApproval] of [
        ['Manager Approval', true],
        ['Manager + Finance', true],
        ['Auto Approved', false],
      ] as const) {
        await api()
          .patch(policies + '/' + created.id)
          .set(auth())
          .send({ approval, requiresApproval })
          .expect(200);
        const row = await prisma.expensePolicy.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(row.approval).toBe(approval);
        expect(row.requiresApproval).toBe(requiresApproval);
        expect(row.maxAmount.toFixed(2)).toBe('9999999999.99');
        expect(row.description).toBe('Preserve description');
        expect(row.receiptRequired).toBe(false);
      }
      await api()
        .patch(policies + '/' + created.id)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ status: 'Inactive' })
        .expect(404);
      await api()
        .patch(policies + '/' + created.id)
        .set('Authorization', `Bearer ${submitterToken}`)
        .send({ status: 'Inactive' })
        .expect(403);
      await api()
        .delete(policies + '/' + created.id)
        .set(auth())
        .expect(200);
      const codes = (
        await prisma.tenantAuditLog.findMany({
          where: { organizationId, targetId: created.id },
          orderBy: { occurredAt: 'asc' },
        })
      ).map((row) => row.eventCode);
      expect(codes).toEqual([
        'policy.created',
        'policy.deactivated',
        'policy.reactivated',
        'policy.updated',
        'policy.updated',
        'policy.updated',
        'policy.deleted',
      ]);
      await prisma.organization.update({
        where: { id: organizationId },
        data: { defaultCurrency: 'INR' },
      });
    });

    it('retains activated configuration across application restart and credential login', async () => {
      await app.close();
      await start();
      token = await login(slug);
      const rows = data<{ id: string; maxAmount: number; currency: string }[]>(
        await api().get(policies).set(auth()).expect(200),
      );
      expect(rows.find((row) => row.id === policyId)).toEqual(
        expect.objectContaining({ maxAmount: 900.55, currency: 'EUR' }),
      );
      const response = await api()
        .post(categoryBatch)
        .set(auth())
        .send(categorySelection(['meals']))
        .expect(201);
      expect(data(response)).toEqual(
        expect.objectContaining({ createdCount: 0, existingCount: 1 }),
      );
    });
  },
);
