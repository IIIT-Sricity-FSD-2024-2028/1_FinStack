import { EmployeeImportService } from '../src/tenant/configuration/employee-import.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
const enabled = process.env.FINSTACK_CONFIGURATION_E2E === '1';
type Person = {
  id: string;
  employeeId: string;
  fullName: string;
  managerId: string | null;
  directReportCount: number;
  department: string;
};
type Page = {
  items: Person[];
  total: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
};
(enabled ? describe : describe.skip)('persisted reporting hierarchy', () => {
  let app: INestApplication<App>,
    db: PrismaClient,
    org: string,
    other: string,
    token: string,
    otherToken: string,
    submitterToken: string;
  let a: string, b: string, child: string, inactive: string, foreign: string;
  const password = randomUUID() + '!A1',
    prefix = 'TREE-' + randomUUID().slice(0, 8),
    queries: string[] = [];
  const api = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: 'Bearer ' + t });
  const data = <T = Page>(r: request.Response) => (r.body as { data: T }).data;
  const root = '/api/v1/tenant/configuration';
  const branch = (q: Record<string, string | number> = {}, t = token) =>
    api()
      .get(root + '/hierarchy/branches')
      .set(auth(t))
      .query(q);
  const move = (
    id: string,
    managerId: string | null,
    expected?: string | null,
  ) =>
    api()
      .patch(root + '/users/' + id + '/reporting')
      .set(auth())
      .send({
        managerId,
        ...(expected !== undefined ? { expectedManagerId: expected } : {}),
      });
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
          name: 'Disposable hierarchy',
          slug: 'tree-' + randomUUID(),
          primaryEmail: randomUUID() + '@example.test',
        },
      });
      if (second) other = o.id;
      else org = o.id;
      const u = await db.tenantUser.create({
        data: {
          organizationId: o.id,
          employeeId: prefix + (second ? '-other' : '-cfg'),
          firstName: 'Config',
          lastName: 'Test',
          email: 'cfg@example.test',
          passwordHash: hash,
          role: 'CONFIGURATION_MANAGER',
          department: 'Administration',
        },
      });
      const login = data<{ accessToken: string }>(
        await api()
          .post('/api/v1/tenant/auth/login')
          .send({ employeeId: u.employeeId, password })
          .expect(201),
      );
      if (second) {
        otherToken = login.accessToken;
        foreign = u.id;
      } else {
        token = login.accessToken;
      }
    }
    const create = async (
      n: string,
      role:
        | 'MANAGER'
        | 'FINANCE_OFFICER'
        | 'EXPENSE_SUBMITTER' = 'EXPENSE_SUBMITTER',
      status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
    ) =>
      (
        await db.tenantUser.create({
          data: {
            organizationId: org,
            employeeId: prefix + '-' + n,
            firstName: n,
            lastName: 'Test',
            email: n + '@example.test',
            passwordHash: hash,
            role,
            status,
            department: 'Engineering',
          },
        })
      ).id;
    a = await create('Alpha', 'FINANCE_OFFICER');
    b = await create('Bravo', 'MANAGER');
    child = await create('Child');
    inactive = await create('Inactive', 'MANAGER', 'INACTIVE');
    submitterToken = data<{ accessToken: string }>(
      await api()
        .post('/api/v1/tenant/auth/login')
        .send({ employeeId: prefix + '-Child', password })
        .expect(201),
    ).accessToken;
    await db.tenantUser.createMany({
      data: Array.from({ length: 1000 }, (_, i) => ({
        organizationId: org,
        employeeId: prefix + '-' + i,
        firstName: 'Report ' + String(i).padStart(4, '0'),
        lastName: 'Test',
        email: i + '@example.test',
        passwordHash: hash,
        managerId: b,
        department: i % 2 ? 'Engineering' : 'Operations',
      })),
    });
  });
  afterAll(async () => {
    await app?.close();
    if (db) {
      await db.employeeImportJob.deleteMany({
        where: { organizationId: { in: [org, other].filter(Boolean) } },
      });
      await db.tenantUser.deleteMany({
        where: { organizationId: { in: [org, other].filter(Boolean) } },
      });
      await db.organization.deleteMany({
        where: { id: { in: [org, other].filter(Boolean) } },
      });
      await db.$disconnect();
    }
  });

  it('requires JWT and configuration-manager role for every read and write', async () => {
    for (const url of [
      '/hierarchy',
      '/hierarchy/branches',
      '/hierarchy/employees/' + a,
    ]) {
      await api()
        .get(root + url)
        .expect(401);
      await api()
        .get(root + url)
        .set(auth(submitterToken))
        .expect(403);
    }
    await api()
      .patch(root + '/users/' + child + '/reporting')
      .set(auth(submitterToken))
      .send({ managerId: a })
      .expect(403);
  });
  it('returns genuine overview and bounded department grouping', async () => {
    const summary = data<{
      total: number;
      unassigned: number;
      departments: { name: string; total: number }[];
      departmentTotalPages: number;
    }>(
      await api()
        .get(root + '/hierarchy')
        .set(auth())
        .query({ pageSize: 1 })
        .expect(200),
    );
    expect(summary.total).toBe(1005);
    expect(summary.unassigned).toBe(5);
    expect(summary.departments).toHaveLength(1);
    expect(summary.departmentTotalPages).toBe(3);
    const roots = data(await branch().expect(200));
    expect(roots.total).toBe(5);
    expect(roots.items.find((u) => u.id === b)?.directReportCount).toBe(1000);
    const dept = data(
      await branch({
        view: 'DEPARTMENT',
        department: 'Operations',
        pageSize: 20,
      }).expect(200),
    );
    expect(dept.total).toBe(500);
    expect(dept.items).toHaveLength(20);
  });
  it('assigns, reassigns, removes and persists links including managers of other roles', async () => {
    await move(child, a, null).expect(200);
    expect(
      (await db.tenantUser.findUniqueOrThrow({ where: { id: child } }))
        .managerId,
    ).toBe(a);
    await move(child, b, a).expect(200);
    await move(child, null, b).expect(200);
    expect(
      (await db.tenantUser.findUniqueOrThrow({ where: { id: child } }))
        .managerId,
    ).toBeNull();
  });
  it('rejects self, cyclic, inactive and foreign managers without changing valid links', async () => {
    await move(child, child).expect(409);
    await move(child, inactive).expect(409);
    await move(child, foreign).expect(404);
    await move(child, a).expect(200);
    await move(a, child).expect(409);
    await move(child, null).expect(200);
    expect(
      (await db.tenantUser.findUniqueOrThrow({ where: { id: a } })).managerId,
    ).toBeNull();
  });
  it('serializes simultaneous opposite assignments so a cycle cannot commit', async () => {
    const results = await Promise.all([move(a, b), move(b, a)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const rows = await db.tenantUser.findMany({
      where: { id: { in: [a, b] } },
      select: { id: true, managerId: true },
    });
    expect(rows.every((u) => u.managerId !== null)).toBe(false);
    await move(a, null).expect(200);
    await move(b, null).expect(200);
  });
  it('rejects stale optimistic updates and serializes manager deactivation against assignment', async () => {
    await move(child, a, null).expect(200);
    await move(child, b, null).expect(409);
    const results = await Promise.all([
      move(child, b, a),
      api()
        .patch(root + '/users/' + b + '/status')
        .set(auth())
        .send({ status: 'INACTIVE' }),
    ]);
    expect(results[1].status).toBe(200);
    expect([200, 409]).toContain(results[0].status);
    const before = (
      await db.tenantUser.findUniqueOrThrow({ where: { id: child } })
    ).managerId;
    // Existing links survive deactivation; none is silently rewritten.
    expect([a, b]).toContain(before);
    await move(child, null).expect(200);
    await move(child, b).expect(409);
    expect(
      await db.tenantUser.count({ where: { managerId: b } }),
    ).toBeGreaterThanOrEqual(1000);
    await api()
      .patch(root + '/users/' + b + '/status')
      .set(auth())
      .send({ status: 'ACTIVE' })
      .expect(200);
    await move(child, null).expect(200);
  });
  it('paginates each branch deterministically and returns empty/out-of-range pages', async () => {
    const first = data(
      await branch({ view: 'REPORTS', managerId: b, pageSize: 20 }).expect(200),
    );
    const second = data(
      await branch({
        view: 'REPORTS',
        managerId: b,
        pageSize: 20,
        page: 2,
      }).expect(200),
    );
    const last = data(
      await branch({
        view: 'REPORTS',
        managerId: b,
        pageSize: 20,
        page: 50,
      }).expect(200),
    );
    expect(first.total).toBe(1000);
    expect(first.items).toHaveLength(20);
    expect(last.hasNextPage).toBe(false);
    expect(
      new Set([...first.items, ...second.items].map((u) => u.id)).size,
    ).toBe(40);
    expect(
      data(
        await branch({ view: 'REPORTS', managerId: b, page: 999 }).expect(200),
      ).items,
    ).toEqual([]);
    expect(
      data(await branch({ view: 'REPORTS', managerId: a }).expect(200)).total,
    ).toBe(0);
  });
  it('searches literally and exposes tenant-safe ancestor navigation', async () => {
    await move(child, a).expect(200);
    await move(a, b).expect(200);
    const details = data<
      Person & { ancestors: Person[]; pathTruncated: boolean }
    >(
      await api()
        .get(root + '/hierarchy/employees/' + child)
        .set(auth())
        .expect(200),
    );
    expect(details.ancestors.map((u) => u.id)).toEqual([b, a]);
    expect(details.pathTruncated).toBe(false);
    expect(
      data(await branch({ view: 'SEARCH', search: 'rEpOrT 0042' }).expect(200))
        .total,
    ).toBe(1);
    expect(
      data(await branch({ view: 'SEARCH', search: '%' }).expect(200)).total,
    ).toBe(0);
    const candidates = data(
      await branch({ view: 'CANDIDATES', search: 'Alpha' }).expect(200),
    );
    expect(candidates.items[0].id).toBe(a);
    await move(child, null).expect(200);
    await move(a, null).expect(200);
  });
  it('isolates another tenant and rejects unknown/invalid query parameters', async () => {
    await branch({ view: 'REPORTS', managerId: b }, otherToken).expect(404);
    await api()
      .get(root + '/hierarchy/employees/' + b)
      .set(auth(otherToken))
      .expect(404);
    expect(
      data(
        await branch(
          { view: 'SEARCH', search: prefix + '-Alpha' },
          otherToken,
        ).expect(200),
      ).total,
    ).toBe(0);
    for (const query of [
      { organizationId: other },
      { pageSize: 101 },
      { page: 0 },
      { view: 'UNKNOWN' },
      { view: 'REPORTS' },
      { view: 'DEPARTMENT' },
      { managerId: 'bad' },
      { page: [1, 2] },
    ])
      await api()
        .get(root + '/hierarchy/branches')
        .set(auth())
        .query(query)
        .expect(400);
  });
  it('shows a provisioned employee under the existing persisted manager without rewriting reporting links', async () => {
    const employeeId = prefix + '-imported';
    const csv =
      'employeeId,firstName,lastName,email,department,role,managerEmployeeId\n' +
      `${employeeId},Imported,Person,${employeeId}@example.test,Engineering,EXPENSE_SUBMITTER,${prefix}-Bravo\n`;
    const job = data<{ id: string }>(
      await api()
        .post(root + '/employee-imports')
        .set(auth())
        .set('idempotency-key', randomUUID())
        .attach('file', Buffer.from(csv), 'hierarchy.csv')
        .expect(201),
    );
    await api()
      .post(root + '/employee-imports/' + job.id + '/confirm')
      .set(auth())
      .expect(201);
    const worker = app.get(EmployeeImportService);
    for (let i = 0; i < 40; i++) {
      await worker.tick();
      if (
        (
          await db.employeeImportJob.findUniqueOrThrow({
            where: { id: job.id },
          })
        ).status === 'COMPLETED'
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(
      (await db.employeeImportJob.findUniqueOrThrow({ where: { id: job.id } }))
        .successfulCount,
    ).toBe(1);
    const employee = await db.tenantUser.findUniqueOrThrow({
      where: { employeeId },
    });
    expect(employee.managerId).toBe(b);
    expect(employee.credentialSetupRequired).toBe(true);
    const page = data(
      await branch({
        view: 'REPORTS',
        managerId: b,
        search: employeeId,
      }).expect(200),
    );
    expect(page.items.map((user) => user.id)).toEqual([employee.id]);
    expect(
      data<Person>(
        await api()
          .get(root + '/hierarchy/employees/' + employee.id)
          .set(auth())
          .expect(200),
      ).managerId,
    ).toBe(b);
  });
  it('retains legacy complete employees and records actual response/query measurements', async () => {
    // Drain this app's polling worker so SQL counts represent only each HTTP request.
    await app.get(EmployeeImportService).onModuleDestroy();
    queries.length = 0;
    const start = performance.now();
    const full = await api()
      .get(root + '/users')
      .set(auth())
      .expect(200);
    const fullMs = performance.now() - start;
    const fullQueries = queries.length;
    queries.length = 0;
    const next = performance.now();
    const bounded = await branch({
      view: 'REPORTS',
      managerId: b,
      pageSize: 20,
    }).expect(200);
    const branchMs = performance.now() - next;
    const branchQueries = queries.length;
    expect(data(full).items).toHaveLength(1006);
    expect(data(bounded).items).toHaveLength(20);
    expect(branchQueries).toBeLessThan(15);
    console.info(
      'HIERARCHY_MEASUREMENTS',
      JSON.stringify({
        employees: 1006,
        fullBytes: Buffer.byteLength(full.text),
        branchBytes: Buffer.byteLength(bounded.text),
        fullMs,
        branchMs,
        fullQueries,
        branchQueries,
      }),
    );
  });
});
