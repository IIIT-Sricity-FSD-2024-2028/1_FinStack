import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { join } from 'path';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
import { EmployeeImportService } from '../src/tenant/configuration/employee-import.service';
import * as notificationWriter from '../src/tenant/notifications/tenant-notifications.service';
import { enqueueNotification } from '../src/tenant/notifications/tenant-notifications.service';
const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)('durable tenant notifications', () => {
  let app: INestApplication<App>,
    db: PrismaService,
    worker: EmployeeImportService;
  const prefix = randomUUID(),
    password = randomUUID() + '!Aa1',
    orgs: string[] = [],
    tokens: string[] = [],
    users: string[] = [];
  const path = '/api/v1/tenant/expenses/notifications',
    imports = '/api/v1/tenant/configuration/employee-imports';
  const api = () => request(app.getHttpServer());
  const auth = (n = 0) => ({ Authorization: 'Bearer ' + tokens[n] });
  type Page = {
    items: Array<{ id: string; unread: boolean }>;
    total: number;
    unreadCount: number;
  };
  const data = <T>(r: request.Response): T => (r.body as { data: T }).data;
  let eventId: string;
  const inserts: Array<{ count: number; ms: number }> = [];
  const originalEnqueue = notificationWriter.enqueueNotification;
  let enqueueSpy: jest.SpyInstance;
  async function start() {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication<INestApplication<App>>();
    configureHttpApplication(app);
    await app.init();
    db = app.get(PrismaService);
    worker = app.get(EmployeeImportService);
    await worker.onModuleDestroy();
  }
  async function login(n: number) {
    tokens[n] = data<{ accessToken: string }>(
      await api()
        .post('/api/v1/tenant/auth/login')
        .send({ employeeId: prefix + n, password })
        .expect(201),
    ).accessToken;
  }
  async function upload(suffix: string) {
    return data<{ id: string }>(
      await api()
        .post(imports)
        .set(auth())
        .set('idempotency-key', randomUUID())
        .attach(
          'file',
          Buffer.from(
            'employeeId,firstName,lastName,email,department,role,managerEmployeeId\n' +
              `${prefix + suffix},Test,Import,${suffix}@example.test,Engineering,,\n`,
          ),
          'employees.csv',
        )
        .expect(201),
    );
  }
  async function complete(id: string) {
    await api()
      .post(imports + '/' + id + '/confirm')
      .set(auth())
      .expect(201);
    for (let i = 0; i < 10; i++) {
      await worker.tick();
      if (
        (await db.employeeImportJob.findUniqueOrThrow({ where: { id } }))
          .status === 'COMPLETED'
      )
        return;
    }
    throw Error('Job not completed');
  }
  beforeAll(async () => {
    if (
      !new URL(process.env.DATABASE_URL!).searchParams
        .get('schema')
        ?.startsWith('finstack_config_verify_')
    )
      throw Error('Disposable schema required');
    process.env.TENANT_JWT_ACCESS_SECRET = randomUUID() + randomUUID();
    process.env.UPLOAD_DIRECTORY = join(
      __dirname,
      '../.tmp/tenant-notification-verification/receipts-' + prefix,
    );
    await start();
    enqueueSpy = jest
      .spyOn(notificationWriter, 'enqueueNotification')
      .mockImplementation(async (tx, event) => {
        const start = performance.now();
        const result = await originalEnqueue(tx, event);
        inserts.push({ count: result.count, ms: performance.now() - start });
        return result;
      });
    const hash = await argon2.hash(password);
    for (let i = 0; i < 3; i++) {
      if (i < 2)
        orgs.push(
          (
            await db.organization.create({
              data: {
                name: 'Disposable notification verification',
                primaryEmail: randomUUID() + '@example.test',
              },
            })
          ).id,
        );
      const u = await db.tenantUser.create({
        data: {
          organizationId: orgs[i === 1 ? 1 : 0],
          employeeId: prefix + i,
          email: i + '@example.test',
          firstName: 'Notification',
          lastName: 'Tester',
          passwordHash: hash,
          role: i === 2 ? 'EXPENSE_SUBMITTER' : 'CONFIGURATION_MANAGER',
        },
      });
      users.push(u.id);
      await login(i);
    }
  });
  afterAll(async () => {
    enqueueSpy?.mockRestore();
    if (db) {
      // Disposable test fixtures now have durable expense dependencies.
      const where = { organizationId: { in: orgs } };
      await db.expensePayment.deleteMany({ where });
      await db.receipt.deleteMany({ where });
      await db.expenseStatusHistory.deleteMany({ where });
      await db.expense.deleteMany({ where });
      await db.expenseCategory.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await db.employeeImportJob.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await db.tenantUser.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
    }
    await app?.close();
  });
  it('requires JWT, rejects client-selected identity and validates bounds; empty state is genuine', async () => {
    await api().get(path).expect(401);
    for (const q of [
      'pageSize=101',
      'page=0',
      'state=fictional',
      'recipientUserId=' + randomUUID(),
    ])
      await api()
        .get(path + '/page?' + q)
        .set(auth())
        .expect(400);
    expect(
      data<Page>(
        await api()
          .get(path + '/page')
          .set(auth())
          .expect(200),
      ).items,
    ).toEqual([]);
    await api().post(path).set(auth()).send({ title: 'Fake' }).expect(404);
  });
  it('a real import completion notifies only its authoritative confirming employee', async () => {
    const j = await upload('-first');
    await complete(j.id);
    const e = await db.tenantNotification.findMany({
      where: { organizationId: orgs[0] },
    });
    expect(e).toHaveLength(1);
    eventId = e[0].id;
    expect(e[0].recipientUserId).toBe(users[0]);
    expect(e[0].sourceId).toBe(j.id);
    expect(e[0].eventCode).toBe('import.completed');
    expect(e[0].readAt).toBeNull();
    for (const n of [1, 2]) {
      expect(
        data<Page>(
          await api()
            .get(path + '/page')
            .set(auth(n))
            .expect(200),
        ).items,
      ).toEqual([]);
      for (const action of ['read', 'unread'])
        await api()
          .patch(path + '/' + eventId + '/' + action)
          .set(auth(n))
          .expect(404);
      await api()
        .delete(path + '/' + eventId)
        .set(auth(n))
        .expect(404);
    }
  });
  it('concurrent producer retries deduplicate, and composite FK rejects cross-tenant recipients', async () => {
    const e = await db.tenantNotification.findUniqueOrThrow({
      where: { id: eventId },
    });
    const event = {
      organizationId: orgs[0],
      recipientUserId: users[0],
      eventCode: e.eventCode,
      eventKey: e.eventKey,
      type: 'success' as const,
      title: e.title,
      message: e.message,
      sourceType: 'import',
      sourceId: e.sourceId!,
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => enqueueNotification(db, event)),
    );
    expect(results.reduce((n, r) => n + r.count, 0)).toBe(0);
    await expect(
      enqueueNotification(db, { ...event, recipientUserId: users[1] }),
    ).rejects.toThrow();
  });
  it('read/unread, all-read, filtering and pagination use genuine import events', async () => {
    await api()
      .patch(path + '/' + eventId + '/read')
      .set(auth())
      .expect(200);
    expect(
      data<{ unreadCount: number }>(
        await api()
          .get(path + '/unread-count')
          .set(auth()),
      ).unreadCount,
    ).toBe(0);
    await api()
      .patch(path + '/' + eventId + '/unread')
      .set(auth())
      .expect(200);
    for (let i = 0; i < 3; i++) {
      const j = await upload('-page' + i);
      await complete(j.id);
    }
    const a = data<Page>(
        await api()
          .get(path + '/page?pageSize=2')
          .set(auth())
          .expect(200),
      ),
      b = data<Page>(
        await api()
          .get(path + '/page?pageSize=2&page=2')
          .set(auth())
          .expect(200),
      );
    expect(a.total).toBe(4);
    expect(a.items).toHaveLength(2);
    expect(b.items).toHaveLength(2);
    expect(new Set([...a.items, ...b.items].map((e) => e.id)).size).toBe(4);
    expect(
      data<Page>(
        await api()
          .get(path + '/page?state=unread&type=success')
          .set(auth()),
      ).total,
    ).toBe(4);
    await api()
      .post(path + '/read-all')
      .set(auth())
      .expect(201);
    expect(
      data<Page>(
        await api()
          .get(path + '/page?state=read')
          .set(auth()),
      ).total,
    ).toBe(4);
  }, 120000);
  it('notification write failure rolls back users, completion and success audit, then retry delivers', async () => {
    const j = await upload('-rollback');
    await api()
      .post(imports + '/' + j.id + '/confirm')
      .set(auth())
      .expect(201);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION fail_notification_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected notification failure'; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER fail_notification_test BEFORE INSERT ON "TenantNotification" FOR EACH ROW EXECUTE FUNCTION fail_notification_test()`,
    );
    try {
      await worker.tick();
      expect(
        await db.tenantUser.count({
          where: { employeeId: prefix + '-rollback' },
        }),
      ).toBe(0);
      expect(
        await db.tenantNotification.count({ where: { sourceId: j.id } }),
      ).toBe(0);
      expect(
        await db.tenantAuditLog.count({
          where: {
            organizationId: orgs[0],
            targetId: j.id,
            eventCode: 'import.completed',
          },
        }),
      ).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER fail_notification_test ON "TenantNotification"',
      );
      await db.$executeRawUnsafe('DROP FUNCTION fail_notification_test()');
    }
    for (let i = 0; i < 5; i++) await worker.tick();
    expect(
      await db.tenantUser.count({
        where: { employeeId: prefix + '-rollback' },
      }),
    ).toBe(1);
    expect(
      await db.tenantNotification.count({ where: { sourceId: j.id } }),
    ).toBe(1);
  });
  it('concurrent read/unread/dismiss cannot resurrect dismissed records; dismiss retries succeed', async () => {
    const rs = await Promise.all([
      api()
        .patch(path + '/' + eventId + '/read')
        .set(auth()),
      api()
        .patch(path + '/' + eventId + '/unread')
        .set(auth()),
      api()
        .delete(path + '/' + eventId)
        .set(auth()),
    ]);
    expect(rs.every((r) => [200, 404].includes(r.status))).toBe(true);
    await api()
      .delete(path + '/' + eventId)
      .set(auth())
      .expect(200);
    await api()
      .patch(path + '/' + eventId + '/read')
      .set(auth())
      .expect(404);
    expect(
      (
        await db.tenantNotification.findUniqueOrThrow({
          where: { id: eventId },
        })
      ).dismissedAt,
    ).not.toBeNull();
    const dismissed = await db.tenantNotification.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(
      (
        await enqueueNotification(db, {
          organizationId: dismissed.organizationId,
          recipientUserId: dismissed.recipientUserId,
          eventCode: dismissed.eventCode,
          eventKey: dismissed.eventKey,
          type: 'success',
          title: dismissed.title,
          message: dismissed.message,
          sourceType: 'import',
          sourceId: dismissed.sourceId!,
        })
      ).count,
    ).toBe(0);
    expect(
      (
        await db.tenantNotification.findUniqueOrThrow({
          where: { id: eventId },
        })
      ).dismissedAt,
    ).toEqual(dismissed.dismissedAt);
  });
  it('completion belongs to the confirming Configuration Manager when another manager uploaded the file', async () => {
    const confirmer = await db.tenantUser.create({
      data: {
        organizationId: orgs[0],
        employeeId: prefix + 4,
        email: 'confirmer@example.test',
        firstName: 'Confirming',
        lastName: 'Manager',
        passwordHash: await argon2.hash(password),
        role: 'CONFIGURATION_MANAGER',
      },
    });
    users[4] = confirmer.id;
    await login(4);
    const job = await upload('-different-confirmer');
    await api()
      .post(imports + '/' + job.id + '/confirm')
      .set(auth(4))
      .expect(201);
    await worker.tick();
    const notification = await db.tenantNotification.findFirstOrThrow({
      where: { sourceId: job.id },
    });
    expect(notification.recipientUserId).toBe(confirmer.id);
    expect(
      data<Page>(
        await api()
          .get(path + '/page')
          .set(auth(4)),
      ).total,
    ).toBe(1);
    await api()
      .patch(path + '/' + notification.id + '/read')
      .set(auth())
      .expect(404);
  });
  it('existing real expense submission/return/resubmission producers retain per-user routing and later returns are distinct events', async () => {
    const manager = await db.tenantUser.create({
      data: {
        organizationId: orgs[0],
        employeeId: prefix + 3,
        email: 'manager@example.test',
        firstName: 'Existing',
        lastName: 'Manager',
        passwordHash: await argon2.hash(password),
        role: 'MANAGER',
      },
    });
    users[3] = manager.id;
    await login(3);
    await db.tenantUser.update({
      where: { id: users[2] },
      data: { managerId: manager.id },
    });
    const category = data<{ id: string }>(
      await api()
        .post('/api/v1/tenant/expenses/configuration/categories')
        .set(auth())
        .send({ name: 'Notification routing verification', status: 'Active' })
        .expect(201),
    );
    const expense = data<{ id: string }>(
      await api()
        .post('/api/v1/tenant/expenses')
        .set(auth(2))
        .field('amount', '10')
        .field('categoryId', category.id)
        .field('merchant', 'Disposable routing test')
        .field('date', '2026-10-12')
        .attach(
          'receipt',
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
            'base64',
          ),
          { filename: 'verification.png', contentType: 'image/png' },
        )
        .expect(201),
    );
    expect(
      data<Page>(
        await api()
          .get(path + '/page')
          .set(auth(3)),
      ).items,
    ).toHaveLength(1);
    expect(
      data<Page>(
        await api()
          .get(path + '/page')
          .set(auth(2)),
      ).items,
    ).toHaveLength(1);
    await api()
      .post('/api/v1/tenant/expenses/' + expense.id + '/manager/return')
      .set(auth(3))
      .send({ note: 'Please clarify this test receipt.' })
      .expect(201);
    await api()
      .patch('/api/v1/tenant/expenses/' + expense.id)
      .set(auth(2))
      .send({ notes: 'Receipt clarified for verification.' })
      .expect(200);
    await api()
      .post('/api/v1/tenant/expenses/' + expense.id + '/manager/return')
      .set(auth(3))
      .send({ note: 'Please clarify the remaining field.' })
      .expect(201);
    const returned = await db.tenantNotification.findMany({
      where: {
        organizationId: orgs[0],
        recipientUserId: users[2],
        eventCode: 'manager_returned_submitter',
      },
    });
    expect(returned).toHaveLength(2);
    expect(new Set(returned.map((r) => r.eventKey)).size).toBe(2);
    await api()
      .patch(path + '/' + returned[0].id + '/read')
      .set(auth())
      .expect(404);
    await api()
      .post('/api/v1/tenant/expenses/configuration/categories')
      .set(auth(2))
      .send({ name: 'Wrong role' })
      .expect(403);
  });
  it('notification UUIDs and all states persist across application restart and fresh login', async () => {
    const before = await db.tenantNotification.findMany({
      where: { organizationId: orgs[0] },
      orderBy: { id: 'asc' },
    });
    await app.close();
    await start();
    await login(0);
    expect(
      await db.tenantNotification.findMany({
        where: { organizationId: orgs[0] },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
    expect(
      data<Page>(
        await api()
          .get(path + '/page')
          .set(auth())
          .expect(200),
      ).total,
    ).toBe(4);
    const begin = performance.now(),
      result = await api()
        .get(path + '/page?pageSize=2')
        .set(auth())
        .expect(200);
    console.log(
      'NOTIFICATION_MEASUREMENTS',
      JSON.stringify({
        events: before.length,
        pageBytes: Buffer.byteLength(JSON.stringify(result.body)),
        requestMs: performance.now() - begin,
        deduplicatedRetries: 8,
        insertSamples: inserts.filter((i) => i.count === 1),
        queryPlan:
          await db.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM "TenantNotification" WHERE "organizationId"=${orgs[0]}::uuid AND "recipientUserId"=${users[0]}::uuid AND "dismissedAt" IS NULL ORDER BY "createdAt" DESC,id DESC LIMIT 2`,
      }),
    );
  });
});
