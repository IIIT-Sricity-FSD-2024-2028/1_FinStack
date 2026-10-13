import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EmployeeImportJob,
  EmployeeImportRow,
  TenantRole,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
import { EmployeeImportService } from '../src/tenant/configuration/employee-import.service';

const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)('durable employee provisioning', () => {
  let app: INestApplication<App>,
    db: PrismaService,
    worker: EmployeeImportService;
  let org: string,
    other: string,
    token: string,
    otherToken: string,
    submitter: string;
  const prefix = 'IMP-' + randomUUID().slice(0, 8),
    password = randomUUID() + '!A1';
  const path = '/api/v1/tenant/configuration/employee-imports';
  const header =
    'employeeId,firstName,lastName,email,department,role,managerEmployeeId\n';
  const api = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: 'Bearer ' + t });
  const row = (
    id: string,
    role = '',
    email = id + '@example.test',
    manager = '',
  ) => `${id},Anita,Sharma,${email},Engineering,${role},${manager}\n`;
  const upload = (csv: string, key = randomUUID(), t = token) =>
    api()
      .post(path)
      .set(auth(t))
      .set('idempotency-key', key)
      .attach('file', Buffer.from(csv), 'employees.csv');
  const data = <T = EmployeeImportJob>(r: request.Response): T =>
    (r.body as { data: T }).data;
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
  async function complete(id: string) {
    await api()
      .post(path + '/' + id + '/confirm')
      .set(auth())
      .expect(201);
    for (let i = 0; i < 15; i++) {
      await worker.tick();
      const j = await db.employeeImportJob.findUniqueOrThrow({ where: { id } });
      if (j.status === 'COMPLETED') return j;
    }
    throw Error('Job failed to complete');
  }
  beforeAll(async () => {
    if (
      !new URL(process.env.DATABASE_URL || '').searchParams
        .get('schema')
        ?.startsWith('finstack_config_verify_')
    )
      throw Error('Disposable schema required');
    process.env.TENANT_JWT_ACCESS_SECRET = randomUUID() + randomUUID();
    await start();
    const passwordHash = await argon2.hash(password);
    for (const second of [false, true]) {
      const o = await db.organization.create({
        data: {
          name: 'Disposable import test',
          slug: 'import-' + randomUUID(),
          primaryEmail: randomUUID() + '@example.test',
        },
      });
      if (second) other = o.id;
      else org = o.id;
      const u = await db.tenantUser.create({
        data: {
          organizationId: o.id,
          employeeId: prefix + (second ? '-other' : '-cfg'),
          firstName: 'Test',
          lastName: 'Config',
          email: 'cfg@example.test',
          passwordHash,
          role: TenantRole.CONFIGURATION_MANAGER,
        },
      });
      const r = await api()
        .post('/api/v1/tenant/auth/login')
        .send({ employeeId: u.employeeId, password })
        .expect(201);
      if (second) otherToken = data<{ accessToken: string }>(r).accessToken;
      else token = data<{ accessToken: string }>(r).accessToken;
    }
    await db.tenantUser.create({
      data: {
        organizationId: org,
        employeeId: prefix + '-sub',
        firstName: 'Test',
        lastName: 'Employee',
        email: 'sub@example.test',
        passwordHash,
        role: TenantRole.EXPENSE_SUBMITTER,
      },
    });
    submitter = data<{ accessToken: string }>(
      await api()
        .post('/api/v1/tenant/auth/login')
        .send({ employeeId: prefix + '-sub', password })
        .expect(201),
    ).accessToken;
  });
  afterAll(async () => {
    if (db) {
      const ids = [org, other].filter(Boolean);
      await db.employeeImportJob.deleteMany({
        where: { organizationId: { in: ids } },
      });
      await db.tenantUser.deleteMany({
        where: { organizationId: { in: ids } },
      });
      await db.organization.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });
  it('requires JWT and configuration manager authority', async () => {
    await api().get(path).expect(401);
    await api().get(path).set(auth(submitter)).expect(403);
    await upload(
      header + row(prefix + '-denied'),
      randomUUID(),
      submitter,
    ).expect(403);
  });
  it('downloads an empty password-free template', async () => {
    const r = await api()
      .get(path + '/template')
      .set(auth())
      .expect(200);
    expect(r.text.trim()).toBe(header.trim());
  });
  it('rejects empty, malformed, forbidden-column and missing-header files', async () => {
    for (const csv of [
      '',
      header,
      'employeeId,password\na,secret\n',
      header + '"unterminated',
      header + 'one,two\n',
    ])
      await upload(csv).expect(400);
  });
  it('rejects missing upload keys and oversized files', async () => {
    await api()
      .post(path)
      .set(auth())
      .attach('file', Buffer.from(header), 'a.csv')
      .expect(400);
    await upload('x'.repeat(10 * 1024 * 1024 + 1)).expect(413);
  });
  it('enforces the 10000-row limit before any account provisioning', async () => {
    const before = await db.tenantUser.count({
      where: { organizationId: org },
    });
    const csv =
      header +
      Array.from({ length: 10001 }, (_, i) => row(prefix + '-limit-' + i)).join(
        '',
      );
    await upload(csv).expect(400);
    expect(await db.tenantUser.count({ where: { organizationId: org } })).toBe(
      before,
    );
  }, 30000);
  it('previews mixed errors without accounts and imports only valid submitters', async () => {
    const good = prefix + '-good',
      dup = prefix + '-dup';
    const csv =
      header +
      row(good) +
      row(dup) +
      row(dup) +
      row(prefix + '-admin', 'CONFIGURATION_MANAGER') +
      row(prefix + '-sub') +
      row(prefix + '-mail', '', 'CFG@example.test') +
      row(prefix + '-mgr', '', 'mgr@example.test', prefix + '-cfg') +
      row(prefix + '-bad', '', 'not-email').replace('Anita', 'An\u0000ita') +
      row(prefix + '-dup-mail1', '', 'shared@example.test') +
      row(prefix + '-dup-mail2', '', 'SHARED@example.test');
    const j = data(await upload(csv).expect(201));
    expect(j).toMatchObject({
      status: 'READY',
      totalCount: 10,
      validCount: 1,
      invalidCount: 9,
    });
    expect(await db.tenantUser.count({ where: { employeeId: good } })).toBe(0);
    const rows = data<EmployeeImportRow[]>(
      await api()
        .get(path + '/' + j.id + '/rows')
        .set(auth())
        .expect(200),
    );
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].errors.join()).toContain('Duplicate');
    const done = await complete(j.id);
    expect(done).toMatchObject({
      successfulCount: 1,
      failedCount: 9,
      processedCount: 10,
    });
    const user = await db.tenantUser.findUniqueOrThrow({
      where: { employeeId: good },
    });
    expect(user).toMatchObject({
      status: 'INACTIVE',
      credentialSetupRequired: true,
      role: 'EXPENSE_SUBMITTER',
    });
    expect(user.passwordHash.startsWith('!credential-setup-required:')).toBe(
      true,
    );
    await api()
      .post('/api/v1/tenant/auth/login')
      .send({ employeeId: good, password })
      .expect(401);
    await api()
      .patch('/api/v1/tenant/configuration/users/' + user.id + '/status')
      .set(auth())
      .send({ status: 'ACTIVE' })
      .expect(409);
    const errors = await api()
      .get(path + '/' + j.id + '/errors')
      .set(auth())
      .expect(200);
    expect(errors.text).toContain('Duplicate employeeId');
    expect(errors.text).toContain('Duplicate email');
  });
  it('isolates every job resource, confirmation and activation export', async () => {
    const j = data(
      await upload(header + row(prefix + '-isolated')).expect(201),
    );
    for (const suffix of ['', '/rows', '/errors'])
      await api()
        .get(path + '/' + j.id + suffix)
        .set(auth(otherToken))
        .expect(404);
    for (const suffix of ['/confirm', '/activation-links'])
      await api()
        .post(path + '/' + j.id + suffix)
        .set(auth(otherToken))
        .expect(404);
    expect(
      data(await api().get(path).set(auth(otherToken)).expect(200)),
    ).toEqual([]);
    await complete(j.id);
  });
  it('makes concurrent upload and confirm retries idempotent', async () => {
    const csv = header + row(prefix + '-idem'),
      key = randomUUID();
    const results = await Promise.all([upload(csv, key), upload(csv, key)]);
    expect(results.map((x) => x.status)).toEqual([201, 201]);
    expect(data(results[0]).id).toBe(data(results[1]).id);
    await upload(header + row(prefix + '-changed'), key).expect(409);
    const id = data(results[0]).id;
    await Promise.all([
      api()
        .post(path + '/' + id + '/confirm')
        .set(auth())
        .expect(201),
      api()
        .post(path + '/' + id + '/confirm')
        .set(auth())
        .expect(201),
    ]);
    await Promise.all([worker.tick(), worker.tick()]);
    await complete(id);
    await complete(id);
    expect(
      await db.tenantUser.count({ where: { employeeId: prefix + '-idem' } }),
    ).toBe(1);
  });
  it('resolves concurrent distinct jobs racing on global IDs and normalized emails', async () => {
    const csv = header + row(prefix + '-race');
    const a = data(await upload(csv).expect(201)),
      b = data(await upload(csv).expect(201));
    await complete(a.id);
    const done = await complete(b.id);
    expect(done.successfulCount).toBe(0);
    expect(done.failedCount).toBe(1);
    const email = 'race-' + prefix + '@example.test';
    const c = data(
        await upload(header + row(prefix + '-ci1', '', email)).expect(201),
      ),
      d = data(
        await upload(
          header + row(prefix + '-ci2', '', email.toUpperCase()),
        ).expect(201),
      );
    await complete(c.id);
    expect((await complete(d.id)).failedCount).toBe(1);
  });
  it('rotates, expires and consumes activation links once through normal auth', async () => {
    const id = prefix + '-activate',
      j = data(await upload(header + row(id)).expect(201));
    await complete(j.id);
    const first = data<{ items: { token: string }[] }>(
      await api()
        .post(path + '/' + j.id + '/activation-links')
        .set(auth())
        .expect(201),
    ).items[0];
    const second = data<{ items: { token: string }[] }>(
      await api()
        .post(path + '/' + j.id + '/activation-links')
        .set(auth())
        .expect(201),
    ).items[0];
    const activate = (token: string) =>
      api()
        .post('/api/v1/tenant/employee-activation')
        .send({ employeeId: id, token, password });
    await activate(first.token).expect(400);
    await db.tenantUser.update({
      where: { employeeId: id },
      data: { activationExpiresAt: new Date(0) },
    });
    await activate(second.token).expect(400);
    const third = data<{ items: { token: string }[] }>(
      await api()
        .post(path + '/' + j.id + '/activation-links')
        .set(auth())
        .expect(201),
    ).items[0];
    const r = await activate(third.token).expect(201);
    expect(data<{ accessToken: string }>(r).accessToken).toBeUndefined();
    await activate(third.token).expect(400);
    await api()
      .post('/api/v1/tenant/auth/login')
      .send({ employeeId: id, password })
      .expect(201);
    const u = await db.tenantUser.findUniqueOrThrow({
      where: { employeeId: id },
    });
    expect(u.activationTokenHash).toBeNull();
    expect(await argon2.verify(u.passwordHash, password)).toBe(true);
  });
  it('recovers an expired lease after backend recreation and preserves completed batches', async () => {
    const csv =
      header +
      Array.from({ length: 450 }, (_, i) => row(prefix + '-recover-' + i)).join(
        '',
      );
    const j = data(await upload(csv).expect(201));
    await api()
      .post(path + '/' + j.id + '/confirm')
      .set(auth())
      .expect(201);
    await worker.tick();
    expect(
      (await db.employeeImportJob.findUniqueOrThrow({ where: { id: j.id } }))
        .successfulCount,
    ).toBe(200);
    // Revocation between batches must preserve the committed 200 accounts and
    // stop new accounts. A subsequent authorized confirmation safely retries.
    await db.tenantUser.update({
      where: { employeeId: prefix + '-cfg' },
      data: { status: 'INACTIVE' },
    });
    for (let attempt = 0; attempt < 5; attempt++) await worker.tick();
    expect(
      await db.employeeImportJob.findUniqueOrThrow({ where: { id: j.id } }),
    ).toMatchObject({ status: 'FAILED', successfulCount: 200 });
    expect(
      await db.tenantUser.count({
        where: { employeeId: { startsWith: prefix + '-recover-' } },
      }),
    ).toBe(200);
    await db.tenantUser.update({
      where: { employeeId: prefix + '-cfg' },
      data: { status: 'ACTIVE' },
    });
    await api()
      .post(path + '/' + j.id + '/confirm')
      .set(auth())
      .expect(201);
    await db.employeeImportJob.update({
      where: { id: j.id },
      data: {
        status: 'RUNNING',
        leaseToken: randomUUID(),
        leaseExpiresAt: new Date(0),
      },
    });
    await app.close();
    await start();
    const done = await complete(j.id);
    expect(done).toMatchObject({ successfulCount: 450, processedCount: 450 });
    expect(
      await db.tenantUser.count({
        where: { employeeId: { startsWith: prefix + '-recover-' } },
      }),
    ).toBe(450);
  });
  it('fails interrupted validation safely without creating accounts', async () => {
    const job = await db.employeeImportJob.create({
      data: {
        organizationId: org,
        createdById: (
          await db.tenantUser.findUniqueOrThrow({
            where: { employeeId: prefix + '-cfg' },
          })
        ).id,
        idempotencyKey: randomUUID(),
        fileHash: '0'.repeat(64),
        updatedAt: new Date(0),
      },
    });
    await worker.tick();
    expect(
      (await db.employeeImportJob.findUniqueOrThrow({ where: { id: job.id } }))
        .status,
    ).toBe('FAILED');
  });
  it('processes a measured 1,000-row sample in bounded database batches', async () => {
    const csv =
      header +
      Array.from({ length: 1000 }, (_, i) => row(prefix + '-load-' + i)).join(
        '',
      );
    const begin = Date.now();
    const j = data(await upload(csv).expect(201));
    const validated = Date.now();
    const done = await complete(j.id);
    expect(done.successfulCount).toBe(1000);
    const audit = await db.tenantAuditLog.findMany({
      where: { organizationId: org, targetId: j.id },
    });
    const batches = audit.filter((event) =>
      ['import.batch_processed', 'import.completed'].includes(event.eventCode),
    );
    const createdIds = batches.flatMap(
      (event) => (event.changes as { createdUserIds: string[] }).createdUserIds,
    );
    expect(batches).toHaveLength(5);
    expect(new Set(createdIds).size).toBe(1000);
    const auditMeasurement = {
      events: audit.length,
      batchEvents: batches.length,
      createdUserIds: createdIds.length,
      maximumChangesBytes: Math.max(
        ...audit.map((event) =>
          Buffer.byteLength(JSON.stringify(event.changes)),
        ),
      ),
    };

    console.log(
      'IMPORT_MEASUREMENT ' +
        JSON.stringify({
          rows: 1000,
          bytes: Buffer.byteLength(csv),
          validationMs: validated - begin,
          processingMs: Date.now() - validated,
          batchSize: 200,
          audit: auditMeasurement,
        }),
    );
  });
});
