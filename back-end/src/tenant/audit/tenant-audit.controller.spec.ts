import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import { Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthService } from '../auth/tenant-auth.service';
import { TenantAuditController } from './tenant-audit.controller';

// No DatabaseModule: real HTTP controller, guards, validation and CSV behavior,
// with a generic in-memory query evaluator instead of a database connection.
describe('Scoped Compliance audit access', () => {
  let app: INestApplication;
  let server: Server;
  const org = '10000000-0000-4000-8000-000000000001';
  const foreignOrg = '10000000-0000-4000-8000-000000000002';
  const actorId = '20000000-0000-4000-8000-000000000001';
  const base = '/api/v1/tenant/configuration/audit-logs';
  // Independent expected inventory, traced to persistent history/transition calls.
  const expenseCodes = [
    'submitted',
    'resubmitted',
    'updated',
    'deleted',
    'manager_approved',
    'manager_returned',
    'manager_rejected',
    'manager_escalated',
    'finance_approved',
    'finance_rejected',
    'finance_requested_info',
    'finance_flagged',
    'compliance_approved',
    'compliance_rejected',
    'compliance_corrective_action',
    'payment_released',
  ];
  interface Row {
    id: string;
    organizationId: string;
    actorUserId: string;
    initiatedByUserId: string;
    actorKind: string;
    actorName: string;
    actorRole: string;
    eventCode: string;
    targetType: string;
    targetId: string;
    outcome: string;
    occurredAt: Date;
    changes: { secret: string };
  }
  interface Where {
    AND?: Where[];
    OR?: Where[];
    [key: string]: unknown;
  }
  interface Query {
    where: Where;
    select?: Partial<Record<keyof Row, boolean>>;
    skip?: number;
    take?: number;
    cursor?: { id: string };
  }
  let rows: Row[];
  const matches = (row: Row, where: Where): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'AND')
        return (value as Where[]).every((child) => matches(row, child));
      if (key === 'OR')
        return (value as Where[]).some((child) => matches(row, child));
      const actual = row[key as keyof Row];
      if (typeof value !== 'object' || value === null) return actual === value;
      const filter = value as {
        in?: string[];
        contains?: string;
        gte?: Date;
        lte?: Date;
      };
      if (filter.in)
        return typeof actual === 'string' && filter.in.includes(actual);
      if (filter.contains !== undefined)
        return (
          typeof actual === 'string' &&
          actual
            .toLowerCase()
            .includes(
              filter.contains.replace(/\\([\\%_])/g, '$1').toLowerCase(),
            )
        );
      return (
        actual instanceof Date &&
        (!filter.gte || actual >= filter.gte) &&
        (!filter.lte || actual <= filter.lte)
      );
    });
  const filtered = (where: Where) =>
    rows
      .filter((row) => matches(row, where))
      .sort((a, b) => b.id.localeCompare(a.id));
  const models = {
    tenantAuditLog: {
      count: jest.fn(({ where }: Query) =>
        Promise.resolve(filtered(where).length),
      ),
      findMany: jest.fn(({ where, select, take, skip = 0, cursor }: Query) => {
        const all = filtered(where);
        const start =
          (cursor ? all.findIndex((row) => row.id === cursor.id) : 0) + skip;
        return Promise.resolve(
          all
            .slice(start, take === undefined ? undefined : start + take)
            .map((row) =>
              select
                ? Object.fromEntries(
                    Object.keys(select).map((key) => [
                      key,
                      row[key as keyof Row],
                    ]),
                  )
                : { ...row },
            ),
        );
      }),
      findFirst: jest.fn(({ where }: Query) =>
        Promise.resolve(filtered(where)[0] ?? null),
      ),
    },
  };
  const authenticate = jest.fn((token: string) => {
    const role = token.replace('foreign:', '') as TenantRole;
    if (!Object.values(TenantRole).includes(role))
      throw new UnauthorizedException();
    const organizationId = token.startsWith('foreign:') ? foreignOrg : org;
    return {
      organizationId,
      user: {
        id: actorId,
        organizationId,
        employeeId: 'AUD-1',
        firstName: 'Audit',
        lastName: 'User',
        email: 'audit@example.test',
        role,
        status: TenantUserStatus.ACTIVE,
      },
    };
  });
  function add(
    eventCode: string,
    targetType = 'expense',
    organizationId = org,
  ) {
    const row: Row = {
      id: `30000000-0000-4000-8000-${String(rows.length + 1).padStart(12, '0')}`,
      organizationId,
      actorUserId: actorId,
      initiatedByUserId: actorId,
      actorKind: 'USER',
      actorName: 'Historical Actor',
      actorRole: 'MANAGER',
      eventCode,
      targetType,
      targetId: 'claim-1',
      outcome: 'SUCCESS',
      occurredAt: new Date('2026-10-15T12:00:00Z'),
      changes: { secret: 'SENSITIVE-CHANGE-CANARY' },
    };
    rows.push(row);
    return row;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantAuditController],
      providers: [
        { provide: TenantAuthService, useValue: { authenticate } },
        {
          provide: PrismaService,
          useValue: {
            ...models,
            $transaction: (
              work:
                Promise<unknown>[] | ((tx: typeof models) => Promise<unknown>),
            ) => (Array.isArray(work) ? Promise.all(work) : work(models)),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1/tenant');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [];
    for (const code of expenseCodes) add(`expense.${code}`);
    add('expense.payment_failed', 'expense_payment');
    for (const [event, target] of [
      ['employee.updated', 'employee'],
      ['credential.activated', 'credential'],
      ['organization.settings_updated', 'organization'],
      ['import.completed', 'import'],
      ['subscription.changed', 'subscription'],
      ['billing.paid', 'billing'],
      ['policy.updated', 'policy'],
      ['category.created', 'category'],
      ['expense.future_sensitive_event', 'expense'],
      ['expense.draft_created', 'expense'],
      ['expense.manager_approved', 'employee'],
      ['expense.payment_failed', 'expense'],
      ['expense.payment_released', 'expense_payment'],
    ])
      add(event, target);
    add('expense.submitted', 'expense', foreignOrg);
  });
  function get(path = '', role = 'COMPLIANCE_OFFICER') {
    return request(server)
      .get(base + path)
      .auth(role, { type: 'bearer' });
  }
  function body(response: request.Response) {
    return response.body as {
      items: Record<string, unknown>[];
      total: number;
      totalPages: number;
      page: number;
      pageSize: number;
    };
  }

  describe.each(['', '/export', '/30000000-0000-4000-8000-000000000001'])(
    'endpoint %s',
    (path) => {
      it('denies missing authentication', async () => {
        await request(server)
          .get(base + path)
          .expect(401);
        expect(models.tenantAuditLog.findMany).not.toHaveBeenCalled();
      });
      it('denies invalid authentication', async () => {
        await get(path, 'invalid').expect(401);
      });
      it.each(['EXPENSE_SUBMITTER', 'MANAGER', 'FINANCE_OFFICER'])(
        'denies %s',
        async (role) => {
          await get(path, role).expect(403);
          expect(models.tenantAuditLog.count).not.toHaveBeenCalled();
          expect(models.tenantAuditLog.findMany).not.toHaveBeenCalled();
          expect(models.tenantAuditLog.findFirst).not.toHaveBeenCalled();
        },
      );
      it('preserves Configuration Manager access', async () => {
        await get(path, 'CONFIGURATION_MANAGER').expect(200);
      });
    },
  );

  it('returns every approved event and excludes foreign/unrelated/incorrect target-action pairs', async () => {
    const result = body(await get().query({ pageSize: 100 }).expect(200));
    expect(result.total).toBe(17);
    expect(result.items.map((row) => row.eventCode).sort()).toEqual(
      [
        ...expenseCodes.map((code) => `expense.${code}`),
        'expense.payment_failed',
      ].sort(),
    );
    for (const row of result.items)
      expect(Object.keys(row).sort()).toEqual(
        [
          'id',
          'occurredAt',
          'actorKind',
          'actorName',
          'actorRole',
          'eventCode',
          'targetType',
          'targetId',
          'outcome',
        ].sort(),
      );
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-CHANGE-CANARY');
    expect(JSON.stringify(result)).not.toContain(foreignOrg);
  });
  it('uses the authenticated tenant for a second Compliance account', async () => {
    const result = body(
      await get('', 'foreign:COMPLIANCE_OFFICER').expect(200),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(rows[rows.length - 1].id);
  });
  it('denies Compliance full detail, including authorized expense IDs', async () => {
    await get('/' + rows[0].id).expect(403);
    expect(models.tenantAuditLog.findFirst).not.toHaveBeenCalled();
  });
  it.each(['', '/export'])(
    'rejects arbitrary query scope injection on %s',
    async (path) => {
      await get(path)
        .query({ organizationId: foreignOrg, OR: '{}', scope: 'all' })
        .expect(400);
      expect(models.tenantAuditLog.findMany).not.toHaveBeenCalled();
    },
  );
  it.each([
    { eventCode: 'employee.updated' },
    { targetType: 'employee' },
    { eventCode: 'expense.future_sensitive_event' },
    { eventCode: 'expense.payment_failed', targetType: 'expense' },
    { search: 'employee' },
    { actorUserId: '20000000-0000-4000-8000-000000000002' },
  ])('filters cannot widen list or export scope: %j', async (query) => {
    expect(body(await get().query(query).expect(200)).total).toBe(0);
    const csv = await get('/export').query(query).expect(200);
    expect(csv.text.trim().split('\r\n')).toHaveLength(1);
  });
  it('applies scoped pagination totals and leaves no cross-page leaks', async () => {
    const first = body(
      await get().query({ page: 1, pageSize: 10 }).expect(200),
    );
    const second = body(
      await get().query({ page: 2, pageSize: 10 }).expect(200),
    );
    expect(first.total).toBe(17);
    expect(second.total).toBe(17);
    expect(first.totalPages).toBe(2);
    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(7);
    expect(
      new Set([...first.items, ...second.items].map((row) => row.id)).size,
    ).toBe(17);
  });
  it.each([{ pageSize: 101 }, { page: 0 }, { page: 100000, pageSize: 100 }])(
    'preserves pagination bounds %j',
    async (query) => {
      await get().query(query).expect(400);
    },
  );
  it('exports only the minimized approved projection with safe headers', async () => {
    const response = await get('/export').expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="finstack-audit-logs.csv"',
    );
    expect(response.text.trim().split('\r\n')).toHaveLength(18);
    expect(response.text).not.toMatch(
      /SENSITIVE-CHANGE-CANARY|changes|actorUserId|initiatedByUserId|organizationId|employee.updated|future_sensitive_event/,
    );
    for (const query of models.tenantAuditLog.findMany.mock.calls.map(
      ([query]) => query,
    ))
      expect(query.select).toBeDefined();
  });
  it.each(['=SUM(1,2)', '+cmd', '-cmd', '@SUM(1)', ' \t=2+2'])(
    'neutralizes Compliance CSV formulas: %s',
    async (formula) => {
      rows[0].actorName = formula;
      const response = await get('/export')
        .query({ eventCode: 'expense.submitted' })
        .expect(200);
      expect(response.text).toContain('"\'' + formula + '"');
    },
  );
  it('keeps Configuration Manager all-event list and its existing fields', async () => {
    const response = body(
      await get('', 'CONFIGURATION_MANAGER')
        .query({ pageSize: 100 })
        .expect(200),
    );
    expect(response.total).toBe(rows.length - 1);
    expect(
      response.items.some((row) => row.eventCode === 'employee.updated'),
    ).toBe(true);
    expect(response.items[0]).toHaveProperty('organizationId', org);
    expect(response.items[0]).toHaveProperty('actorUserId', actorId);
    expect(response.items[0]).toHaveProperty('initiatedByUserId', actorId);
    expect(response.items[0]).not.toHaveProperty('changes');
  });
  it('preserves CM detail payload and cross-tenant 404', async () => {
    const own = await get('/' + rows[0].id, 'CONFIGURATION_MANAGER').expect(
      200,
    );
    expect(own.body).toMatchObject({
      changes: { secret: 'SENSITIVE-CHANGE-CANARY' },
    });
    await get('/' + rows[rows.length - 1].id, 'CONFIGURATION_MANAGER').expect(
      404,
    );
  });
  it('preserves CM export columns/change payload and excludes foreign records', async () => {
    const response = await get('/export', 'CONFIGURATION_MANAGER')
      .query({ targetType: 'employee', eventCode: 'employee.updated' })
      .expect(200);
    expect(response.text.split('\r\n')[0]).toBe(
      'id,occurredAt,actorKind,actorUserId,actorName,actorRole,initiatedByUserId,eventCode,targetType,targetId,outcome,changes',
    );
    expect(response.text).toContain('SENSITIVE-CHANGE-CANARY');
    expect(response.text.trim().split('\r\n')).toHaveLength(2);
  });
  it('keeps CM combined search/action/target/actor/outcome/date filters', async () => {
    const result = body(
      await get('', 'CONFIGURATION_MANAGER')
        .query({
          search: 'Historical',
          eventCode: 'employee.updated',
          targetType: 'employee',
          actorUserId: actorId,
          outcome: 'SUCCESS',
          from: '2026-10-15T00:00:00Z',
          to: '2026-10-16T00:00:00Z',
        })
        .expect(200),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].eventCode).toBe('employee.updated');
  });
  it('supports permitted expense/payment filters without broadening CM permissions', async () => {
    const query = {
      targetType: 'expense_payment',
      eventCode: 'expense.payment_failed',
    };
    expect(body(await get().query(query).expect(200)).total).toBe(1);
    expect(
      body(await get('', 'CONFIGURATION_MANAGER').query(query).expect(200))
        .total,
    ).toBe(1);
  });
  it('enforces the same scope across multiple CSV cursor batches', async () => {
    for (let i = 0; i < 275; i++) {
      add('expense.submitted');
      add('employee.updated', 'employee');
      add('expense.submitted', 'expense', foreignOrg);
    }
    const response = await get('/export').expect(200);
    expect(response.text.trim().split('\r\n')).toHaveLength(293);
    expect(response.text).not.toContain('employee.updated');
    const foreignIds = rows
      .filter((row) => row.organizationId === foreignOrg)
      .map((row) => row.id);
    for (const id of foreignIds) expect(response.text).not.toContain(id);
  });

  it('preserves the CSV 10,000-row limit', async () => {
    for (let i = 0; i < 10000; i++) add('expense.submitted');
    await get('/export').expect(400);
  });
});
