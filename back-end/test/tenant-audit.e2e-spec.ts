import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
import { EmployeeImportService } from '../src/tenant/configuration/employee-import.service';
import { TenantAuditLog } from '@prisma/client';
const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)('Durable tenant audit', () => {
  let app: INestApplication<App>,
    db: PrismaService,
    token: string,
    otherToken: string,
    submitterToken: string;
  let org: string,
    otherOrg: string,
    actorId: string,
    employee: string,
    manager: string,
    category: string,
    policy: string;
  const password = randomUUID() + '!Aa1',
    prefix = randomUUID();
  const audit = '/api/v1/tenant/configuration/audit-logs',
    users = '/api/v1/tenant/configuration/users',
    cats = '/api/v1/tenant/expenses/configuration/categories',
    pols = '/api/v1/tenant/expenses/configuration/policies';
  const api = () => request(app.getHttpServer());
  const auth = (value = token) => ({ Authorization: 'Bearer ' + value });
  type Reply = {
    id: string;
    accessToken: string;
    total: number;
    createdCount: number;
    items: Array<TenantAuditLog & { token: string }>;
    version: string;
    categories: Array<{ key: string }>;
    policies: Array<{ key: string; categoryKey: string }>;
  };
  const data = (r: request.Response): Reply => (r.body as { data: Reply }).data;
  async function start() {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
    configureHttpApplication(app);
    await app.init();
    db = app.get(PrismaService);
    await app.get(EmployeeImportService).onModuleDestroy();
  }
  async function login(employeeId: string) {
    return data(
      await api()
        .post('/api/v1/tenant/auth/login')
        .send({ employeeId, password })
        .expect(201),
    ).accessToken;
  }
  async function events() {
    return db.tenantAuditLog.findMany({
      where: { organizationId: org },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
  }
  beforeAll(async () => {
    if (
      !new URL(process.env.DATABASE_URL!).searchParams
        .get('schema')
        ?.startsWith('finstack_config_verify_')
    )
      throw new Error('Disposable schema required');
    process.env.TENANT_JWT_ACCESS_SECRET = randomUUID() + randomUUID();
    await start();
    const passwordHash = await argon2.hash(password);
    for (const suffix of ['a', 'b']) {
      const organization = await db.organization.create({
        data: {
          name: 'Disposable tenant audit ' + suffix,
          primaryEmail: randomUUID() + '@example.test',
        },
      });
      const actor = await db.tenantUser.create({
        data: {
          organizationId: organization.id,
          employeeId: prefix + suffix,
          firstName: 'Original',
          lastName: 'Auditor',
          email: 'cfg@example.test',
          passwordHash,
          role: 'CONFIGURATION_MANAGER',
        },
      });
      if (suffix === 'a') {
        org = organization.id;
        actorId = actor.id;
        token = await login(actor.employeeId);
      } else {
        otherOrg = organization.id;
        otherToken = await login(actor.employeeId);
      }
    }
    const mgr = await db.tenantUser.create({
      data: {
        organizationId: org,
        employeeId: prefix + 'm',
        firstName: 'Existing',
        lastName: 'Manager',
        email: 'mgr@example.test',
        passwordHash,
        role: 'MANAGER',
      },
    });
    manager = mgr.id;
    const sub = await db.tenantUser.create({
      data: {
        organizationId: org,
        employeeId: prefix + 's',
        firstName: 'Existing',
        lastName: 'Submitter',
        email: 'sub@example.test',
        passwordHash,
        role: 'EXPENSE_SUBMITTER',
      },
    });
    submitterToken = await login(sub.employeeId);
  });
  afterAll(async () => {
    if (db) {
      const ids = [org, otherOrg].filter(Boolean);
      await db.expensePolicy.deleteMany({
        where: { organizationId: { in: ids } },
      });
      await db.expenseCategory.deleteMany({
        where: { organizationId: { in: ids } },
      });
      await db.employeeImportRow.deleteMany({
        where: { job: { organizationId: { in: ids } } },
      });
      await db.employeeImportJob.deleteMany({
        where: { organizationId: { in: ids } },
      });
      await db.organization.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });
  it('requires JWT, Configuration Manager role and tenant-scoped detail/export', async () => {
    await api().get(audit).expect(401);
    await api().get(audit).set(auth(submitterToken)).expect(403);
    await api()
      .get(audit + '/export')
      .set(auth(submitterToken))
      .expect(403);
    expect(await events()).toHaveLength(0); // No fabricated fixture history.
    category = data(
      await api()
        .post(cats)
        .set(auth())
        .send({ name: 'Audit Travel' })
        .expect(201),
    ).id;
    const event = (await events())[0];
    expect(event).toMatchObject({
      actorUserId: actorId,
      actorName: 'Original Auditor',
      actorRole: 'CONFIGURATION_MANAGER',
      organizationId: org,
      eventCode: 'category.created',
      targetId: category,
      outcome: 'SUCCESS',
    });
    await api()
      .get(audit + '/' + event.id)
      .set(auth(otherToken))
      .expect(404);
    expect(
      data(await api().get(audit).set(auth(otherToken)).expect(200)).total,
    ).toBe(0);
    expect(
      (
        await api()
          .get(audit + '/export')
          .set(auth(otherToken))
          .expect(200)
      ).text,
    ).not.toContain(event.id);
  });
  it('audits employee creation, role/access, reporting and status changes without credentials or email content', async () => {
    employee = data(
      await api()
        .post(users)
        .set(auth())
        .send({
          employeeId: prefix + 'new',
          firstName: 'Private',
          lastName: 'Employee',
          email: 'private@example.test',
          initialPassword: password,
          role: 'EXPENSE_SUBMITTER',
          department: 'Operations',
        })
        .expect(201),
    ).id;
    await api()
      .patch(users + '/' + employee)
      .set(auth())
      .send({ role: 'MANAGER', firstName: 'Changed' })
      .expect(200);
    await api()
      .patch(users + '/' + employee + '/reporting')
      .set(auth())
      .send({ managerId: manager, expectedManagerId: null })
      .expect(200);
    await api()
      .patch(users + '/' + employee + '/reporting')
      .set(auth())
      .send({ managerId: null, expectedManagerId: manager })
      .expect(200);
    await api()
      .patch(users + '/' + employee + '/status')
      .set(auth())
      .send({ status: 'INACTIVE' })
      .expect(200);
    const history = (await events()).filter((e) => e.targetId === employee);
    expect(history.map((e) => e.eventCode)).toEqual([
      'employee.created',
      'employee.updated',
      'employee.reporting_changed',
      'employee.reporting_changed',
      'employee.status_changed',
    ]);
    expect(JSON.stringify(history)).not.toMatch(
      /private@example|passwordHash|initialPassword|activationToken|Private|Changed/,
    );
    expect(history[1].changes).toMatchObject({
      before: { role: 'EXPENSE_SUBMITTER' },
      after: { role: 'MANAGER' },
    });
    expect(
      (history[1].changes as { changedFields: string[] }).changedFields,
    ).toEqual(expect.arrayContaining(['role', 'firstName']));
    const before = (await events()).length;
    await api()
      .patch(users + '/' + employee + '/reporting')
      .set(auth())
      .send({ managerId: employee })
      .expect(409);
    await api()
      .patch(users + '/' + employee + '/reporting')
      .set(auth(otherToken))
      .send({ managerId: null })
      .expect(404);
    expect(await events()).toHaveLength(before);
  });
  it('audits category/policy CRUD, preserves historical actor snapshots, and omits rolled-back duplicate successes', async () => {
    policy = data(
      await api()
        .post(pols)
        .set(auth())
        .send({ name: 'Audit Cap', categoryId: category, maxAmount: 100 })
        .expect(201),
    ).id;
    await api()
      .patch(pols + '/' + policy)
      .set(auth())
      .send({ maxAmount: 120 })
      .expect(200);
    await api()
      .patch(cats + '/' + category)
      .set(auth())
      .send({ description: 'Secret-free metadata edit' })
      .expect(200);
    const old = (await events())[0];
    await api()
      .patch(users + '/' + actorId)
      .set(auth())
      .send({ firstName: 'Renamed' })
      .expect(200);
    const persisted = await db.tenantAuditLog.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(persisted.actorName).toBe('Original Auditor');
    const before = (await events()).length;
    await api()
      .post(cats)
      .set(auth())
      .send({ name: 'Audit Travel' })
      .expect(409);
    await api()
      .delete(cats + '/' + category)
      .set(auth())
      .expect(400);
    expect(await events()).toHaveLength(before);
  });
  it('fails the business update when its audit insert fails and prohibits direct ledger edits/deletes', async () => {
    const before = (await events()).length;
    const current = await db.expensePolicy.findUniqueOrThrow({
      where: { id: policy },
    });
    // Fault injection is scoped to this disposable schema and this policy UUID.
    await db.$executeRawUnsafe(
      `CREATE FUNCTION audit_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."targetId"='${policy}' THEN RAISE EXCEPTION 'injected audit write failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER audit_test_failure BEFORE INSERT ON "TenantAuditLog" FOR EACH ROW EXECUTE FUNCTION audit_test_failure()',
    );
    try {
      await api()
        .patch(pols + '/' + policy)
        .set(auth())
        .send({ maxAmount: 999 })
        .expect(500);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER audit_test_failure ON "TenantAuditLog"',
      );
      await db.$executeRawUnsafe('DROP FUNCTION audit_test_failure()');
    }
    expect(
      (
        await db.expensePolicy.findUniqueOrThrow({ where: { id: policy } })
      ).maxAmount.toString(),
    ).toBe(current.maxAmount.toString());
    expect(await events()).toHaveLength(before);
    const id = (await events())[0].id;
    await expect(
      db.tenantAuditLog.update({
        where: { id },
        data: { actorName: 'Forged' },
      }),
    ).rejects.toThrow();
    await expect(db.tenantAuditLog.delete({ where: { id } })).rejects.toThrow();
  });
  it('serializes concurrent changes with truthful before/after values', async () => {
    const baseline = (await events()).length;
    await Promise.all(
      [130, 140].map((maxAmount) =>
        api()
          .patch(pols + '/' + policy)
          .set(auth())
          .send({ maxAmount })
          .expect(200),
      ),
    );
    const added = (await events())
      .slice(baseline)
      .filter((e) => e.targetId === policy);
    expect(added).toHaveLength(2);
    const pairs = added.map(
      (e) =>
        e.changes as {
          before: { maxAmount: string };
          after: { maxAmount: string };
        },
    );
    expect(pairs[0].before.maxAmount).toBe('120');
    expect(pairs[1].before.maxAmount).toBe(pairs[0].after.maxAmount);
  });
  it('audits batch activation once per batch with accurate created/skipped counts', async () => {
    const path = cats + '/activate-templates';
    const catalog = data(
      await api()
        .get('/api/v1/tenant/expenses/configuration/templates')
        .set(auth())
        .expect(200),
    );
    const key = catalog.categories[0].key;
    const baseline = (await events()).length;
    const replies = await Promise.all(
      [1, 2].map(() =>
        api()
          .post(path)
          .set(auth())
          .send({ version: catalog.version, templateKeys: [key] })
          .expect(201),
      ),
    );
    expect(replies.reduce((sum, r) => sum + data(r).createdCount, 0)).toBe(1);
    const batch = (await events()).slice(baseline);
    expect(batch).toHaveLength(2);
    expect(
      batch.every((e) => e.eventCode === 'category.templates_activated'),
    ).toBe(true);
    const selected = await db.expenseCategory.findFirstOrThrow({
      where: { organizationId: org, templateKey: key },
    });
    const template = catalog.policies.find(
      (p: { categoryKey: string }) => p.categoryKey === key,
    );
    if (template) {
      await api()
        .post(pols + '/activate-templates')
        .set(auth())
        .send({
          version: catalog.version,
          policies: [
            {
              templateKey: template.key,
              categoryId: selected.id,
              maxAmount: 200,
              currency: 'INR',
              receiptRequired: true,
              approvalLevels: 1,
            },
          ],
        })
        .expect(201);
      expect((await events()).at(-1)?.eventCode).toBe(
        'policy.templates_activated',
      );
    }
  });
  it('audits provisioning lifecycle, actual created UUIDs and activation without secret material', async () => {
    const path = '/api/v1/tenant/configuration/employee-imports',
      id = prefix + 'import';
    const csv =
      'employeeId,firstName,lastName,email,department,role,managerEmployeeId\n' +
      id +
      ',Import,Person,import@example.test,Operations,EXPENSE_SUBMITTER,\n';
    const job = data(
      await api()
        .post(path)
        .set(auth())
        .set('idempotency-key', randomUUID())
        .attach('file', Buffer.from(csv), 'employees.csv')
        .expect(201),
    );
    await api()
      .post(path + '/' + job.id + '/confirm')
      .set(auth())
      .expect(201);
    await app.get(EmployeeImportService).tick();
    expect(
      (await db.employeeImportJob.findUniqueOrThrow({ where: { id: job.id } }))
        .status,
    ).toBe('COMPLETED');
    const imported = await db.tenantUser.findUniqueOrThrow({
      where: { employeeId: id },
    });
    const history = (await events()).filter((e) => e.targetId === job.id);
    expect(history.map((e) => e.eventCode)).toEqual(
      expect.arrayContaining([
        'import.created',
        'import.validation_changed',
        'import.confirmed',
        'import.processing_started',
        'import.completed',
      ]),
    );
    expect(
      history.find((e) => e.eventCode === 'import.completed'),
    ).toMatchObject({
      actorKind: 'SYSTEM',
      actorUserId: null,
      initiatedByUserId: actorId,
      changes: { createdUserIds: [imported.id] },
    });
    const links = data(
      await api()
        .post(path + '/' + job.id + '/activation-links')
        .set(auth())
        .expect(201),
    );
    expect(links.items).toHaveLength(1);
    await api()
      .post('/api/v1/tenant/employee-activation')
      .send({ employeeId: id, token: links.items[0].token, password })
      .expect(201);
    const serialized = JSON.stringify(await events());
    expect(serialized).not.toContain(links.items[0].token);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toMatch(
      /activationTokenHash|leaseToken|fileHash|passwordHash|import@example/,
    );
    expect((await events()).at(-1)).toMatchObject({
      eventCode: 'credential.activated',
      actorUserId: imported.id,
      actorRole: 'EXPENSE_SUBMITTER',
    });
  });
  async function withAuditFailure(
    eventCode: string,
    work: () => Promise<void>,
  ) {
    await db.$executeRawUnsafe(
      `CREATE FUNCTION audit_batch_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId"='${org}'::uuid AND NEW."eventCode"='${eventCode}' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER audit_batch_failure BEFORE INSERT ON "TenantAuditLog" FOR EACH ROW EXECUTE FUNCTION audit_batch_failure()',
    );
    try {
      await work();
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER audit_batch_failure ON "TenantAuditLog"',
      );
      await db.$executeRawUnsafe('DROP FUNCTION audit_batch_failure()');
    }
  }
  it('rolls back an entire template batch if its audit insert fails', async () => {
    const catalog = data(
      await api()
        .get('/api/v1/tenant/expenses/configuration/templates')
        .set(auth())
        .expect(200),
    );
    const key = catalog.categories[1].key,
      before = (await events()).length;
    await withAuditFailure('category.templates_activated', async () => {
      await api()
        .post(cats + '/activate-templates')
        .set(auth())
        .send({ version: catalog.version, templateKeys: [key] })
        .expect(500);
    });
    expect(
      await db.expenseCategory.count({
        where: { organizationId: org, templateKey: key },
      }),
    ).toBe(0);
    expect(await events()).toHaveLength(before);
  });
  it('rolls back provisioned users on audit failure and truthfully records the retry state', async () => {
    const path = '/api/v1/tenant/configuration/employee-imports',
      employeeId = prefix + 'rollback';
    const csv =
      'employeeId,firstName,lastName,email\n' +
      employeeId +
      ',Rollback,Person,rollback@example.test\n';
    const job = data(
      await api()
        .post(path)
        .set(auth())
        .set('idempotency-key', randomUUID())
        .attach('file', Buffer.from(csv), 'rollback.csv')
        .expect(201),
    );
    await api()
      .post(path + '/' + job.id + '/confirm')
      .set(auth())
      .expect(201);
    await withAuditFailure('import.completed', async () => {
      await app.get(EmployeeImportService).tick();
    });
    expect(await db.tenantUser.count({ where: { employeeId } })).toBe(0);
    expect(
      await db.employeeImportJob.findUniqueOrThrow({ where: { id: job.id } }),
    ).toMatchObject({ status: 'QUEUED', successfulCount: 0, retries: 1 });
    const history = (await events()).filter((e) => e.targetId === job.id);
    expect(history.some((e) => e.eventCode === 'import.completed')).toBe(false);
    expect(history.at(-1)).toMatchObject({
      eventCode: 'import.processing_interrupted',
      outcome: 'FAILED',
      actorKind: 'SYSTEM',
    });
    await app.get(EmployeeImportService).tick();
    expect(await db.tenantUser.count({ where: { employeeId } })).toBe(1);
  });
  it('supports bounded pages, literal search, filters, date validation and genuine filtered CSV', async () => {
    const first = data(
      await api()
        .get(audit + '?pageSize=2')
        .set(auth())
        .expect(200),
    );
    const next = data(
      await api()
        .get(audit + '?pageSize=2&page=2')
        .set(auth())
        .expect(200),
    );
    expect(first.items).toHaveLength(2);
    expect(next.items).toHaveLength(2);
    expect(first.items[0].id).not.toBe(next.items[0].id);
    const filtered = data(
      await api()
        .get(audit + '?eventCode=category.created&targetType=category')
        .set(auth())
        .expect(200),
    );
    expect(
      filtered.items.every(
        (e: TenantAuditLog) => e.eventCode === 'category.created',
      ),
    ).toBe(true);
    expect(
      data(
        await api()
          .get(audit + '?search=%25')
          .set(auth())
          .expect(200),
      ).total,
    ).toBe(0);
    await api()
      .get(audit + '?pageSize=101')
      .set(auth())
      .expect(400);
    await api()
      .get(audit + '?from=2026-12-01&to=2026-01-01')
      .set(auth())
      .expect(400);
    const csv = await api()
      .get(audit + '/export?eventCode=category.created')
      .set(auth())
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('\r\n');
    expect(csv.text).toContain(category);
    expect(csv.text).not.toContain('policy.updated');
  });
  it('survives application restart and records deletes while retaining actor role after later changes', async () => {
    await api()
      .delete(pols + '/' + policy)
      .set(auth())
      .expect(200);
    const second = data(
      await api()
        .post(cats)
        .set(auth())
        .send({ name: 'Disposable audit delete' })
        .expect(201),
    );
    await api()
      .delete(cats + '/' + second.id)
      .set(auth())
      .expect(200);
    const before = await events();
    await app.close();
    await start();
    token = await login(prefix + 'a');
    expect(await events()).toEqual(before);
    expect(data(await api().get(audit).set(auth()).expect(200)).total).toBe(
      before.length,
    );
    // An actor's subsequent role change cannot rewrite prior attribution.
    await db.tenantUser.update({
      where: { id: actorId },
      data: { role: 'MANAGER' },
    });
    expect(
      (
        await db.tenantAuditLog.findMany({
          where: { organizationId: org, actorUserId: actorId },
        })
      ).every((e) => e.actorRole === 'CONFIGURATION_MANAGER'),
    ).toBe(true);
    await api().get(audit).set(auth()).expect(403);
  });
});
