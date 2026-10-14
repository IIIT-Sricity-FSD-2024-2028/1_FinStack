import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ChildProcess, fork } from 'node:child_process';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { PrismaService } from '../src/database/prisma.service';
import { EmployeeImportService } from '../src/tenant/configuration/employee-import.service';
import * as notifications from '../src/tenant/notifications/tenant-notifications.service';

interface ExpenseDto {
  id: string;
  workflowStatus: string;
  amount: number;
  managerEmployeeId: string;
  assignedFinanceOfficerId: string | null;
  history: Array<{ code: string; note: string }>;
}
interface ReleaseDto {
  batchId: string;
  transactions: Array<{ id: string; status: string }>;
  expenses: ExpenseDto[];
}
const enabled = process.env.FINSTACK_EXPENSE_E2E === '1';
(enabled ? describe : describe.skip)(
  'shared PostgreSQL expense workflow',
  () => {
    let app: INestApplication<App>, db: PrismaService;
    const prefix = randomUUID(),
      password = randomUUID() + '!Aa1';
    const users: string[] = [],
      tokens: string[] = [],
      orgs: string[] = [];
    const base = '/api/v1/tenant/expenses';
    const pdf = Buffer.from('%PDF-1.4\nExpense persistence verification');
    let categoryId: string, main: string, payment: string;
    const api = () => request(app.getHttpServer());
    const auth = (index: number) => ({
      Authorization: 'Bearer ' + tokens[index],
    });
    const data = <T>(response: request.Response): T =>
      (response.body as { data: T }).data;
    const payload = () => ({
      amount: '123.45',
      categoryId,
      merchant: 'Railway',
      date: '2026-10-14',
      currency: 'INR',
      notes: 'Client visit',
    });
    const roles: TenantRole[] = [
      'EXPENSE_SUBMITTER',
      'MANAGER',
      'FINANCE_OFFICER',
      'COMPLIANCE_OFFICER',
      'EXPENSE_SUBMITTER',
      'MANAGER',
      'FINANCE_OFFICER',
      'CONFIGURATION_MANAGER',
      'MANAGER',
      'EXPENSE_SUBMITTER',
    ];
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
    async function submit(
      key = randomUUID(),
      overrides: Record<string, string> = {},
    ) {
      return api()
        .post(base)
        .set(auth(0))
        .set('idempotency-key', key)
        .field({ ...payload(), ...overrides })
        .attach('receipt', pdf, 'receipt.pdf');
    }
    async function action(
      id: string,
      path: string,
      actor: number,
      body: object = {},
    ) {
      return api().post(`${base}/${id}/${path}`).set(auth(actor)).send(body);
    }
    beforeAll(async () => {
      const schema = new URL(process.env.DATABASE_URL!).searchParams.get(
        'schema',
      );
      if (!schema?.startsWith('finstack_config_verify_expense_'))
        throw Error('Fresh isolated expense verification schema required.');
      process.env.TENANT_JWT_ACCESS_SECRET = randomUUID() + randomUUID();
      process.env.UPLOAD_DIRECTORY = join(
        __dirname,
        '../.tmp/expense-verification',
        schema,
      );
      await start();
      const passwordHash = await argon2.hash(password);
      for (let i = 0; i < 2; i++)
        orgs.push(
          (
            await db.organization.create({
              data: {
                name: 'Expense verification ' + i,
                primaryEmail: randomUUID() + '@example.test',
                status: 'ACTIVE',
              },
            })
          ).id,
        );
      for (let i = 0; i < roles.length; i++)
        users.push(
          (
            await db.tenantUser.create({
              data: {
                organizationId: orgs[i >= 8 ? 1 : 0],
                employeeId: prefix + '-' + i,
                firstName: 'Actor',
                lastName: String(i),
                email: `${i}@example.test`,
                passwordHash,
                role: roles[i],
              },
            })
          ).id,
        );
      for (const i of [0, 4, 9])
        await db.tenantUser.update({
          where: { id: users[i] },
          data: { managerId: users[i === 9 ? 8 : 1] },
        });
      categoryId = (
        await db.expenseCategory.create({
          data: { organizationId: orgs[0], name: 'Travel' },
        })
      ).id;
      for (let i = 0; i < roles.length; i++)
        tokens[i] = data<{ accessToken: string }>(
          await api()
            .post('/api/v1/tenant/auth/login')
            .send({ employeeId: prefix + '-' + i, password })
            .expect(201),
        ).accessToken;
    });
    afterAll(async () => {
      await app?.close();
    });

    async function startProcess(): Promise<{
      child: ChildProcess;
      origin: string;
    }> {
      const child = fork(join(__dirname, 'expense-process-harness.cjs'), [], {
        env: { ...process.env },
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      const port = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill();
          reject(Error('Backend child startup timed out'));
        }, 20000);
        child.once('message', (message: { port: number }) => {
          clearTimeout(timeout);
          resolve(message.port);
        });
        child.once('exit', () => {
          clearTimeout(timeout);
          reject(Error('Backend child exited during startup'));
        });
      });
      return { child, origin: `http://127.0.0.1:${port}` };
    }
    async function stopProcess(child: ChildProcess) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill();
          reject(Error('Backend child shutdown timed out'));
        }, 10000);
        child.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
        child.send('stop');
      });
    }

    it('submits with JWT ownership, Decimal money, receipt, durable history and notifications; supports safe request replay', async () => {
      await api()
        .get(base + '/mine')
        .set('role', 'superuser')
        .expect(401);
      const key = randomUUID();
      const first = await submit(key);
      expect(first.status).toBe(201);
      const expense = data<ExpenseDto>(first);
      main = expense.id;
      expect(expense.workflowStatus).toBe('manager_review');
      expect(expense.managerEmployeeId).toBe(prefix + '-1');
      expect(
        (
          await db.expense.findUniqueOrThrow({ where: { id: main } })
        ).amount.toFixed(2),
      ).toBe('123.45');
      expect(await db.receipt.count({ where: { expenseId: main } })).toBe(1);
      expect(
        await db.expenseStatusHistory.count({ where: { expenseId: main } }),
      ).toBe(1);
      expect(
        await db.tenantAuditLog.count({
          where: { targetId: main, eventCode: 'expense.submitted' },
        }),
      ).toBe(1);
      expect(
        await db.tenantNotification.count({ where: { sourceId: main } }),
      ).toBe(2);
      const replay = await submit(key);
      expect(replay.status).toBe(201);
      expect(data<ExpenseDto>(replay).id).toBe(main);
      expect((await submit(key, { amount: '124.45' })).status).toBe(409);
      expect(
        await db.expense.count({ where: { organizationId: orgs[0] } }),
      ).toBe(1);
      const queue = data<ExpenseDto[]>(
        await api()
          .get(base + '/manager/queue')
          .set(auth(1))
          .expect(200),
      );
      expect(queue.map((e) => e.id)).toContain(main);
      expect(
        data<ExpenseDto[]>(
          await api()
            .get(base + '/manager/queue')
            .set(auth(5))
            .expect(200),
        ),
      ).toEqual([]);
    });

    it('rejects role, other-employee, unassigned manager/finance and cross-tenant receipt/action access', async () => {
      await action(main, 'manager/approve', 0, {
        financeOfficerId: users[2],
      }).then((r) => expect(r.status).toBe(403));
      await action(main, 'manager/reject', 5).then((r) =>
        expect(r.status).toBe(403),
      );
      await action(main, 'manager/reject', 8).then((r) =>
        expect(r.status).toBe(404),
      );
      await api()
        .patch(`${base}/${main}`)
        .set(auth(4))
        .send({ amount: 10 })
        .expect(403);
      for (const [actor, status] of [
        [4, 403],
        [5, 403],
        [6, 403],
        [9, 404],
      ])
        await api()
          .get(`${base}/${main}/receipt`)
          .set(auth(actor))
          .expect(status);
      await api()
        .get(`${base}/${main}/receipt`)
        .set(auth(0))
        .expect(200)
        .expect('Content-Type', /application\/pdf/);
      await api().get(`${base}/${main}/receipt`).set(auth(1)).expect(200);
      const foreignFinance = users[8];
      expect(
        (
          await action(main, 'manager/approve', 1, {
            financeOfficerId: foreignFinance,
          })
        ).status,
      ).toBe(400);
    });

    it('serializes concurrent manager decisions; only assigned finance can review; follows finance-flag compliance route', async () => {
      const results = await Promise.all([
        action(main, 'manager/approve', 1, {
          financeOfficerId: users[2],
          note: 'Approved',
        }),
        action(main, 'manager/approve', 1, {
          financeOfficerId: users[2],
          note: 'Approved',
        }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      expect(
        await db.expenseStatusHistory.count({
          where: { expenseId: main, code: 'manager_approved' },
        }),
      ).toBe(1);
      expect((await action(main, 'finance/approve', 6)).status).toBe(403);
      expect(
        data<ExpenseDto[]>(
          await api()
            .get(base + '/finance/queue')
            .set(auth(2))
            .expect(200),
        ).map((e) => e.id),
      ).toContain(main);
      expect(
        (await action(main, 'finance/flag', 2, { note: 'Check receipt' }))
          .status,
      ).toBe(201);
      expect(
        data<ExpenseDto[]>(
          await api()
            .get(base + '/compliance/queue')
            .set(auth(3))
            .expect(200),
        ).map((e) => e.id),
      ).toContain(main);
      expect(
        (
          await action(main, 'compliance/corrective-action', 3, {
            note: 'Reviewed documentation',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await action(main, 'compliance/corrective-action', 3, {
            note: 'Reviewed documentation',
          })
        ).status,
      ).toBe(201);
      expect(
        await db.expenseStatusHistory.count({
          where: { expenseId: main, code: 'compliance_corrective_action' },
        }),
      ).toBe(1);
      const compliance = await action(main, 'compliance/approve', 3);
      expect(compliance.status).toBe(201);
      expect(data<ExpenseDto>(compliance).assignedFinanceOfficerId).toBe(
        users[2],
      );
      expect((await action(main, 'finance/approve', 2)).status).toBe(201);
      expect((await action(main, 'finance/approve', 2)).status).toBe(400);
    });

    it('records authorized processing once, protects atomic batches, refuses fabricated settlement, and exposes actual outcome to employee', async () => {
      const unreleasable = data<ExpenseDto>(await submit());
      await api()
        .post(base + '/finance/payment-releases')
        .set(auth(2))
        .send({ expenseIds: [main, unreleasable.id] })
        .expect(403);
      expect(
        await db.expensePayment.count({ where: { expenseId: main } }),
      ).toBe(0);
      expect(
        (await db.expense.findUniqueOrThrow({ where: { id: main } }))
          .workflowStatus,
      ).toBe('approved_for_payment');
      const release = data<ReleaseDto>(
        await api()
          .post(base + '/finance/payment-releases')
          .set(auth(2))
          .send({ expenseIds: [main, main] })
          .expect(201),
      );
      payment = release.transactions[0].id;
      expect(release.transactions[0].status).toBe('pending');
      const replay = data<ReleaseDto>(
        await api()
          .post(base + '/finance/payment-releases')
          .set(auth(2))
          .send({ expenseIds: [main] })
          .expect(201),
      );
      expect(replay.transactions[0].id).toBe(payment);
      expect(
        await db.expensePayment.count({ where: { expenseId: main } }),
      ).toBe(1);
      await api()
        .post(`${base}/finance/transactions/${payment}/process`)
        .set(auth(2))
        .send({})
        .expect(409);
      await api()
        .post(`${base}/finance/transactions/${payment}/reconcile`)
        .set(auth(2))
        .send({})
        .expect(409);
      await api()
        .post(`${base}/finance/transactions/${payment}/process`)
        .set(auth(6))
        .send({})
        .expect(403);
      const mine = data<ExpenseDto[]>(
        await api()
          .get(base + '/mine')
          .set(auth(0))
          .expect(200),
      );
      expect(mine.find((e) => e.id === main)?.workflowStatus).toBe(
        'payment_processing',
      );
      expect(
        mine
          .find((e) => e.id === main)
          ?.history.some((h) => h.code === 'payment_released'),
      ).toBe(true);
      expect(
        (await db.expensePayment.findUniqueOrThrow({ where: { id: payment } }))
          .bankReference,
      ).toBeNull();
    });

    it('retains receipt, decisions, processing requests, notifications and audit after backend reconstruction', async () => {
      const historyCount = await db.expenseStatusHistory.count({
        where: { expenseId: main },
      });
      const auditCount = await db.tenantAuditLog.count({
        where: { targetId: main },
      });
      const notificationCount = await db.tenantNotification.count({
        where: { sourceId: main },
      });
      await app.close();
      await start();
      expect(
        data<ExpenseDto[]>(
          await api()
            .get(base + '/mine')
            .set(auth(0))
            .expect(200),
        ).find((e) => e.id === main)?.workflowStatus,
      ).toBe('payment_processing');
      await api().get(`${base}/${main}/receipt`).set(auth(0)).expect(200);
      expect(
        await db.expenseStatusHistory.count({ where: { expenseId: main } }),
      ).toBe(historyCount);
      expect(await db.tenantAuditLog.count({ where: { targetId: main } })).toBe(
        auditCount,
      );
      expect(
        await db.tenantNotification.count({ where: { sourceId: main } }),
      ).toBe(notificationCount);
      await api()
        .post(`${base}/finance/transactions/${payment}/fail`)
        .set(auth(2))
        .send({})
        .expect(201);
      await api()
        .post(`${base}/finance/transactions/${payment}/fail`)
        .set(auth(2))
        .send({})
        .expect(201);
      expect(
        await db.tenantAuditLog.count({
          where: { targetId: payment, eventCode: 'expense.payment_failed' },
        }),
      ).toBe(1);
    });

    it('saves and edits drafts, submits with the current reporting manager, returns/resubmits and supports manager escalation plus terminal rejection', async () => {
      const draft = data<ExpenseDto>(
        await api()
          .post(base + '/drafts')
          .set(auth(0))
          .send({ ...payload(), amount: 10 })
          .expect(201),
      );
      expect(draft.workflowStatus).toBe('draft');
      await api()
        .patch(`${base}/${draft.id}`)
        .set(auth(0))
        .send({ amount: 20 })
        .expect(200);
      const submitted = data<ExpenseDto>(
        await api()
          .post(`${base}/${draft.id}/submit`)
          .set(auth(0))
          .attach('receipt', pdf, 'receipt.pdf')
          .expect(201),
      );
      expect(submitted.workflowStatus).toBe('manager_review');
      await api()
        .post(`${base}/${draft.id}/submit`)
        .set(auth(0))
        .attach('receipt', pdf, 'receipt.pdf')
        .expect(400);
      expect(
        (await action(draft.id, 'manager/return', 1, { note: 'Clarify' }))
          .status,
      ).toBe(201);
      expect(
        data<ExpenseDto>(
          await api()
            .patch(`${base}/${draft.id}`)
            .set(auth(0))
            .send({ notes: 'Clarified' })
            .expect(200),
        ).workflowStatus,
      ).toBe('manager_review');
      expect((await action(draft.id, 'manager/escalate', 1)).status).toBe(201);
      expect((await action(draft.id, 'compliance/approve', 3)).status).toBe(
        201,
      );
      expect((await action(draft.id, 'finance/request-info', 2)).status).toBe(
        201,
      );
      await api()
        .patch(`${base}/${draft.id}`)
        .set(auth(0))
        .send({ notes: 'More clarification' })
        .expect(200);
      expect(
        (
          await action(draft.id, 'manager/reject', 1, {
            note: 'Not reimbursable',
          })
        ).status,
      ).toBe(201);
      expect(
        data<ExpenseDto[]>(
          await api()
            .get(base + '/mine')
            .set(auth(0))
            .expect(200),
        ).find((e) => e.id === draft.id)?.workflowStatus,
      ).toBe('rejected');
      await api()
        .patch(`${base}/${draft.id}`)
        .set(auth(0))
        .send({ amount: 30 })
        .expect(400);
    });

    it('reads the same records and receipt bytes from two separately started backend OS processes', async () => {
      for (let restart = 0; restart < 2; restart++) {
        const { child, origin } = await startProcess();
        try {
          const mine = data<ExpenseDto[]>(
            await request(origin)
              .get(base + '/mine')
              .set(auth(0))
              .expect(200),
          );
          expect(mine.find((e) => e.id === main)?.workflowStatus).toBe(
            'payment_processing',
          );
          expect(
            mine
              .find((e) => e.id === main)
              ?.history.some((h) => h.code === 'manager_approved'),
          ).toBe(true);
          await request(origin)
            .get(`${base}/${main}/receipt`)
            .set(auth(0))
            .expect(200)
            .expect('Content-Type', /application\/pdf/);
          await request(origin)
            .get(`${base}/${main}/receipt`)
            .set(auth(9))
            .expect(404);
          const workspace = data<{
            transactions: Array<{ id: string; status: string }>;
          }>(
            await request(origin)
              .get(base + '/finance/workspace')
              .set(auth(2))
              .expect(200),
          );
          expect(
            workspace.transactions.find((t) => t.id === payment)?.status,
          ).toBe('failed');
        } finally {
          await stopProcess(child);
        }
      }
    });

    it('rolls back expense, history, audit and receipt metadata if a notification write fails', async () => {
      const before = await db.expense.count({
        where: { organizationId: orgs[0] },
      });
      const spy = jest
        .spyOn(notifications, 'enqueueNotification')
        .mockRejectedValueOnce(Error('Injected notification failure'));
      try {
        expect((await submit()).status).toBe(500);
      } finally {
        spy.mockRestore();
      }
      expect(
        await db.expense.count({ where: { organizationId: orgs[0] } }),
      ).toBe(before);
      expect(
        await db.receipt.count({ where: { organizationId: orgs[0] } }),
      ).toBe(
        await db.expense.count({
          where: { organizationId: orgs[0], workflowStatus: { not: 'draft' } },
        }),
      );
    });

    it('validates money and tenant category, persists soft deletion, rejects inactive actors', async () => {
      expect((await submit(randomUUID(), { amount: '1.001' })).status).toBe(
        400,
      );
      expect(
        (await submit(randomUUID(), { currency: 'not-a-currency' })).status,
      ).toBe(400);
      expect(
        (await submit(randomUUID(), { categoryId: randomUUID() })).status,
      ).toBe(400);
      const draft = data<ExpenseDto>(
        await api()
          .post(base + '/drafts')
          .set(auth(0))
          .send({ ...payload(), amount: 1 })
          .expect(201),
      );
      await api().delete(`${base}/${draft.id}`).set(auth(0)).expect(200);
      expect(
        (await db.expense.findUniqueOrThrow({ where: { id: draft.id } }))
          .deletedAt,
      ).not.toBeNull();
      expect(
        await db.tenantAuditLog.count({
          where: { targetId: draft.id, eventCode: 'expense.deleted' },
        }),
      ).toBe(1);
      await db.tenantUser.update({
        where: { id: users[0] },
        data: { status: 'INACTIVE' },
      });
      await api()
        .get(base + '/mine')
        .set(auth(0))
        .expect(401);
    });
  },
);
