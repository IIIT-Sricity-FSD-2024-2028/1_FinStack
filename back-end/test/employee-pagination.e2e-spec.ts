import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, TenantRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
type Employee = {
  id: string;
  employeeId: string;
  fullName: string;
  status: string;
  role: string;
  department: string;
  manager: { id: string; fullName: string } | null;
};
type Page = {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
(enabled ? describe : describe.skip)('server employee pages', () => {
  let app: INestApplication<App>,
    db: PrismaClient,
    org: string,
    other: string,
    token: string,
    otherToken: string,
    submitter: string,
    managerId: string;
  const prefix = 'PAGE-' + randomUUID().slice(0, 8),
    password = randomUUID() + '!aA1',
    path = '/api/v1/tenant/configuration/employees';
  const queries: string[] = [];
  const api = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: 'Bearer ' + t });
  const data = <T = Page>(r: request.Response) => (r.body as { data: T }).data;
  const employeeId = (n: number) => prefix + '-' + String(n).padStart(4, '0');
  const get = (
    query: Record<string, string | number | undefined> = {},
    t = token,
  ) => api().get(path).set(auth(t)).query(query);
  beforeAll(async () => {
    if (
      !new URL(process.env.DATABASE_URL || '').searchParams
        .get('schema')
        ?.startsWith('finstack_config_verify_')
    )
      throw Error('Disposable schema required');
    process.env.TENANT_JWT_ACCESS_SECRET = randomUUID() + randomUUID();
    const observed = new PrismaClient({
      log: [{ emit: 'event', level: 'query' }],
    });
    observed.$on('query', (event) => queries.push(event.query));
    db = observed;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = module.createNestApplication<INestApplication<App>>();
    configureHttpApplication(app);
    await app.init();
    const hash = await argon2.hash(password);
    for (const second of [false, true]) {
      const o = await db.organization.create({
        data: {
          name: 'Disposable pages',
          slug: 'page-' + randomUUID(),
          primaryEmail: randomUUID() + '@example.test',
        },
      });
      if (second) other = o.id;
      else org = o.id;
      const u = await db.tenantUser.create({
        data: {
          organizationId: o.id,
          employeeId: prefix + (second ? '-other' : '-cfg'),
          email: 'cfg@example.test',
          firstName: 'Zed',
          lastName: 'Config',
          passwordHash: hash,
          role: 'CONFIGURATION_MANAGER',
        },
      });
      const login = data<{ accessToken: string }>(
        await api()
          .post('/api/v1/tenant/auth/login')
          .send({ employeeId: u.employeeId, password })
          .expect(201),
      );
      if (second) otherToken = login.accessToken;
      else token = login.accessToken;
    }
    await db.tenantUser.createMany({
      data: Array.from({ length: 1000 }, (_, i) => ({
        organizationId: org,
        employeeId: employeeId(i),
        email: employeeId(i) + '@example.test',
        firstName: 'Employee ' + String(i).padStart(4, '0'),
        lastName: 'Test',
        passwordHash: hash,
        role: i % 100 === 0 ? TenantRole.MANAGER : TenantRole.EXPENSE_SUBMITTER,
        status: i % 2 === 0 ? ('ACTIVE' as const) : ('INACTIVE' as const),
        department: i % 3 === 0 ? 'Engineering' : 'Operations',
      })),
    });
    managerId = (
      await db.tenantUser.findUniqueOrThrow({
        where: { employeeId: employeeId(900) },
      })
    ).id;
    await db.tenantUser.update({
      where: { employeeId: employeeId(1) },
      data: { managerId },
    });
    // An active non-manager JWT proves role enforcement independently of status.
    submitter = data<{ accessToken: string }>(
      await api()
        .post('/api/v1/tenant/auth/login')
        .send({ employeeId: employeeId(2), password })
        .expect(201),
    ).accessToken;
  });
  afterAll(async () => {
    await app?.close();
    if (db) {
      const ids = [org, other].filter(Boolean);
      await db.tenantUser.deleteMany({
        where: { organizationId: { in: ids } },
      });
      await db.organization.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
  });
  it('requires JWT and Configuration Manager authority', async () => {
    await api().get(path).expect(401);
    await get({}, submitter).expect(403);
  });
  it('retrieves deterministic first/middle/last bounded pages without secrets', async () => {
    const first = data(await get({ page: 1, pageSize: 25 }).expect(200));
    expect(first).toMatchObject({
      page: 1,
      pageSize: 25,
      total: 1001,
      totalPages: 41,
      hasPreviousPage: false,
      hasNextPage: true,
    });
    expect(first.items).toHaveLength(25);
    expect(first.items[0].employeeId).toBe(employeeId(0));
    expect(first.items[0]).not.toHaveProperty('passwordHash');
    expect(first.items[0]).not.toHaveProperty('activationTokenHash');
    expect(first.items[0]).not.toHaveProperty('organizationId');
    const middle = data(await get({ page: 20, pageSize: 25 }).expect(200));
    expect(middle.items[0].employeeId).toBe(employeeId(475));
    const last = data(await get({ page: 41, pageSize: 25 }).expect(200));
    expect(last.items).toHaveLength(1);
    expect(last.hasNextPage).toBe(false);
    expect(
      data(await get({ page: 1, pageSize: 25 }).expect(200)).items,
    ).toEqual(first.items);
  });
  it('returns explicit empty/out-of-range metadata', async () => {
    expect(
      data(await get({ page: 999, pageSize: 25 }).expect(200)),
    ).toMatchObject({
      items: [],
      page: 999,
      total: 1001,
      totalPages: 41,
      hasNextPage: false,
    });
    expect(
      data(await get({ search: 'does-not-exist' }).expect(200)),
    ).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });
  it('searches literal employee IDs, names and email case-insensitively', async () => {
    for (const search of [
      employeeId(7),
      'Employee 0007',
      'EMPLOYEE 0007',
      employeeId(7) + '@example.test',
    ]) {
      const result = data(await get({ search }).expect(200));
      expect(result.total).toBe(1);
      expect(result.items[0].employeeId).toBe(employeeId(7));
    }
    for (const search of ['%', '_', '\\', "' OR 1=1 --"]) {
      expect(data(await get({ search }).expect(200)).total).toBe(0);
    }
  });
  it('combines status, role and department before counting and pagination', async () => {
    const active = data(
      await get({
        status: 'ACTIVE',
        role: 'EXPENSE_SUBMITTER',
        department: 'engineering',
        pageSize: 25,
        page: 2,
      }).expect(200),
    );
    const total = await db.tenantUser.count({
      where: {
        organizationId: org,
        status: 'ACTIVE',
        role: 'EXPENSE_SUBMITTER',
        department: 'Engineering',
      },
    });
    expect(active.total).toBe(total);
    expect(active.page).toBe(2);
    expect(active.items).toHaveLength(25);
    for (const u of active.items)
      expect(u).toMatchObject({
        status: 'ACTIVE',
        role: 'EXPENSE_SUBMITTER',
        department: 'Engineering',
      });
    expect(data(await get({ status: 'INACTIVE' }).expect(200)).total).toBe(500);
  });
  it('scopes page and total to tenant and rejects arbitrary tenant selection', async () => {
    const own = data(await get({}, otherToken).expect(200));
    expect(own.total).toBe(1);
    expect(own.items[0].employeeId).toBe(prefix + '-other');
    expect(
      data(await get({ search: employeeId(7) }, otherToken).expect(200)).items,
    ).toEqual([]);
    await get({ organizationId: other }).expect(400);
  });
  it('validates query bounds, enums, arrays and unknown fields', async () => {
    for (const q of [
      { page: 0 },
      { page: -1 },
      { page: 1.5 },
      { page: 100001 },
      { pageSize: 0 },
      { pageSize: 101 },
      { page: 'nope' },
      { role: 'admin' },
      { status: 'pending' },
      { search: 'x'.repeat(121) },
      { search: 'a b c d e f g h i' },
      { search: 'x\u0000y' },
      { department: 'x'.repeat(121) },
      { sort: 'passwordHash' },
    ])
      await get(q).expect(400);
    await api()
      .get(path + '?search=a&search=b')
      .set(auth())
      .expect(400);
  });
  it('returns an off-page manager and preserves complete legacy contracts', async () => {
    const page = data(await get({ search: employeeId(1) }).expect(200));
    expect(page.items[0].manager?.id).toBe(managerId);
    const managers = data(
      await get({
        role: 'MANAGER',
        status: 'ACTIVE',
        pageSize: 3,
        page: 3,
      }).expect(200),
    );
    expect(managers.total).toBe(10);
    expect(managers.items).toHaveLength(3);
    const legacy = data<{ items: Employee[] }>(
      await api()
        .get('/api/v1/tenant/configuration/users')
        .set(auth())
        .expect(200),
    );
    expect(legacy.items).toHaveLength(1001);
    expect(legacy).not.toHaveProperty('page');
  });
  it('does not expose a foreign manager even if a historical reference is inconsistent', async () => {
    const foreign = await db.tenantUser.findUniqueOrThrow({
      where: { employeeId: prefix + '-other' },
    });
    await db.tenantUser.update({
      where: { employeeId: employeeId(1) },
      data: { managerId: foreign.id },
    });
    expect(
      data(await get({ search: employeeId(1) }).expect(200)).items[0].manager,
    ).toBeNull();
    await db.tenantUser.update({
      where: { employeeId: employeeId(1) },
      data: { managerId },
    });
  });
  it('rejects invalid manual employee fields before writing and protects profile updates', async () => {
    const userPath = '/api/v1/tenant/configuration/users';
    const payload = {
      employeeId: prefix + '-validation',
      firstName: 'Valid',
      lastName: 'Employee',
      email: prefix + '-validation@example.test',
      initialPassword: password,
      role: 'EXPENSE_SUBMITTER',
      department: 'General',
    };
    const before = await db.tenantUser.count({
      where: { organizationId: org },
    });
    for (const [field, value] of [
      ['firstName', '   '],
      ['lastName', 'x'.repeat(101)],
      ['email', 'bad'],
      ['employeeId', 'bad id'],
      ['department', 'a\u0000b'],
      ['role', 'ADMINISTRATOR'],
      ['initialPassword', 'short'],
    ])
      await api()
        .post(userPath)
        .set(auth())
        .send({ ...payload, [field]: value })
        .expect(400);
    await api().post(userPath).set(auth(submitter)).send(payload).expect(403);
    await api().post(userPath).send(payload).expect(401);
    expect(await db.tenantUser.count({ where: { organizationId: org } })).toBe(
      before,
    );
    await api()
      .patch(userPath + '/' + managerId)
      .set(auth())
      .send({ firstName: null })
      .expect(400);
    await api()
      .patch(userPath + '/' + managerId)
      .set(auth(otherToken))
      .send({ firstName: 'Foreign' })
      .expect(404);
  });
  it('measures actual legacy/page payloads, SQL counts and HTTP timings', async () => {
    const measure = async (url: string) => {
      queries.length = 0;
      const start = performance.now();
      const r = await api().get(url).set(auth()).expect(200);
      return {
        bytes: Buffer.byteLength(r.text),
        milliseconds: Math.round((performance.now() - start) * 100) / 100,
        tenantUserSql: queries.filter((q) => q.includes('"TenantUser"')).length,
        sqlStatements: queries.length,
        response: r,
      };
    };
    const before = await measure('/api/v1/tenant/configuration/users');
    const after = await measure(path + '?page=1&pageSize=50');
    expect(data(after.response).items).toHaveLength(50);
    expect(after.bytes).toBeLessThan(before.bytes / 10);
    const a = {
      bytes: before.bytes,
      milliseconds: before.milliseconds,
      tenantUserSql: before.tenantUserSql,
      sqlStatements: before.sqlStatements,
    };
    const b = {
      bytes: after.bytes,
      milliseconds: after.milliseconds,
      tenantUserSql: after.tenantUserSql,
      sqlStatements: after.sqlStatements,
    };
    console.log(
      'EMPLOYEE_PAGE_MEASUREMENT ' +
        JSON.stringify({ dataset: 1001, before: a, after: b }),
    );
  });
});
