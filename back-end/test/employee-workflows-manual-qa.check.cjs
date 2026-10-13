const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fork } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const state = JSON.parse(
  fs.readFileSync(
    path.join(backend, '.tmp/manual-qa/environment.json'),
    'utf8',
  ),
);
if (
  process.env.FINSTACK_EMPLOYEE_MANUAL_QA !== '1' ||
  !/^finstack_manual_qa_[a-f0-9]{32}$/.test(state.schema) ||
  new URL(state.env.DATABASE_URL).searchParams.get('schema') !== state.schema
)
  throw Error('Explicit opt-in and verified manual-QA schema required.');
Object.assign(process.env, state.env);
const { PrismaClient } = require('@prisma/client');
const {
  verifyManualQaDatabase,
} = require('../dist/src/common/config/manual-qa');
const { chromium } = require(
  process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright',
);
const db = new PrismaClient({ datasourceUrl: state.env.DATABASE_URL });
const orgId = randomUUID(),
  prefix = 'TASK3-' + randomUUID().slice(0, 8),
  password = randomUUID() + '!Qa1';
const base = 'http://127.0.0.1:5581';
let api, browser;
const events = [],
  failures = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function start() {
  api = fork(path.join(backend, 'scripts/manual-qa.cjs'), ['backend'], {
    cwd: backend,
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (api.exitCode !== null) throw Error('QA backend exited');
    try {
      const r = await fetch(
        'http://127.0.0.1:3401/api/v1/tenant/onboarding/environment',
      );
      if (r.ok) return;
    } catch {}
    await delay(250);
  }
  throw Error('QA backend startup timeout');
}
async function stop() {
  if (api && api.exitCode === null) {
    const exited = new Promise((resolve) => api.once('exit', resolve));
    api.kill();
    await exited;
  }
}
async function login(page) {
  await page.goto(base + '/login.html');
  await page.locator('#employee-id').fill(prefix + '-CFG');
  await page.locator('#password-input').fill(password);
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForURL('**/views/config-manager/dashboard.html');
}
async function add(page, suffix, firstName, role, manager) {
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  for (const [field, value] of Object.entries({
    'first-name': firstName,
    'last-name': 'QA',
    email: prefix + '-' + suffix + '@task3.test',
    'employee-id': prefix + '-' + suffix,
    department: 'QA Engineering',
    password: password,
  }))
    await page.locator('#manage-user-' + field).fill(value);
  await page.locator('#manage-user-role').selectOption(role);
  if (manager) {
    await page
      .locator('#manage-user-manager option[value="' + manager.id + '"]')
      .waitFor({ state: 'attached' });
    await page.locator('#manage-user-manager').selectOption(manager.id);
  }
  await page
    .getByRole('dialog', { name: 'Add New User', exact: true })
    .getByRole('button', { name: 'Add User', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Add New User', exact: true })
    .waitFor({ state: 'hidden' });
  return db.tenantUser.findUniqueOrThrow({
    where: { employeeId: prefix + '-' + suffix },
  });
}
(async () => {
  await verifyManualQaDatabase(db);
  try {
    await fetch('http://127.0.0.1:3401/api/v1/tenant/onboarding/environment');
    throw Error(
      'Stop the existing QA backend before this restart-verification harness.',
    );
  } catch (error) {
    if (!error.message.includes('fetch failed')) throw error;
  }
  await db.organization.create({
    data: {
      id: orgId,
      name: 'Disposable Task 3 manual QA',
      slug: 'task3-' + orgId,
      primaryEmail: prefix + '@task3.test',
    },
  });
  await db.tenantUser.create({
    data: {
      organizationId: orgId,
      employeeId: prefix + '-CFG',
      firstName: 'Task3',
      lastName: 'Operator',
      email: prefix + '-cfg@task3.test',
      passwordHash: await require('argon2').hash(password),
      role: 'CONFIGURATION_MANAGER',
    },
  });
  await start();
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.FINSTACK_BROWSER_EXECUTABLE ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on('pageerror', (e) => failures.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') failures.push(m.text());
  });
  await login(page);
  await page.goto(base + '/views/config-manager/manage-users.html');
  const general = await add(page, 'GM', 'General Manager', 'manager');
  const manager = await add(
    page,
    'DM',
    'Department Manager',
    'manager',
    general,
  );
  const a = await add(page, 'A', 'Employee A', 'expense_submitter', manager);
  const b = await add(page, 'B', 'Employee B', 'expense_submitter', manager);
  assert.equal(manager.managerId, general.id);
  assert.equal(a.managerId, manager.id);
  assert.equal(b.managerId, manager.id);
  await page.goto(base + '/views/config-manager/user-hierarchy.html');
  await page
    .getByRole('button', {
      name: 'Expand reports of General Manager QA',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Expand reports of Department Manager QA',
      exact: true,
    })
    .click();
  await page.locator('[data-employee-id="' + a.employeeId + '"]').waitFor();
  await page.locator('[data-employee-id="' + b.employeeId + '"]').waitFor();
  await page
    .locator(
      '[data-employee-id="' + a.employeeId + '"] .hierarchy-person-details',
    )
    .click();
  await page
    .getByRole('button', { name: 'Change manager', exact: true })
    .click();
  await page
    .locator('#hierarchy-manager option[value="' + general.id + '"]')
    .waitFor({ state: 'attached' });
  await page.locator('#hierarchy-manager').selectOption(general.id);
  await page.getByRole('button', { name: 'Save manager', exact: true }).click();
  await page.getByText('Reporting manager saved.', { exact: true }).waitFor();
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: a.id } })).managerId,
    general.id,
  );
  events.push(
    'Real form created two Managers and two Submitters; expanded three-level tree; reassigned Employee A through hierarchy UI.',
  );
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByRole('button', { name: 'Bulk Import', exact: true }).click();
  const csv =
    'employeeId,firstName,lastName,email,department,role,managerEmployeeId\n' +
    [1, 2]
      .map(
        (n) =>
          `${prefix}-CSV${n},Imported${n},QA,${prefix}-csv${n}@task3.test,QA Engineering,EXPENSE_SUBMITTER,${manager.employeeId}`,
      )
      .join('\n') +
    '\n';
  await page
    .locator('#employee-import-file')
    .setInputFiles({
      name: 'task3-qa.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
  await page.getByRole('button', { name: 'Validate CSV', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Import READY', exact: true })
    .waitFor();
  await page.getByRole('checkbox', { name: /I reviewed the rows/ }).check();
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Import COMPLETED', exact: true })
    .waitFor();
  const job = await db.employeeImportJob.findFirstOrThrow({
    where: { organizationId: orgId },
  });
  assert.equal(job.successfulCount, 2);
  assert.equal(job.failedCount, 0);
  const imported = await db.tenantUser.findMany({
    where: { organizationId: orgId, credentialSetupRequired: true },
  });
  assert.equal(imported.length, 2);
  assert.ok(
    imported.every(
      (u) => u.managerId === manager.id && u.status === 'INACTIVE',
    ),
  );
  await page.locator('#sidebar-logout').click();
  await login(page);
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByText('Showing 1-7 of 7 users', { exact: true }).waitFor();
  await stop();
  await start();
  await page.reload();
  await page.getByText('Showing 1-7 of 7 users', { exact: true }).waitFor();
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: a.id } })).managerId,
    general.id,
  );
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: b.id } })).managerId,
    manager.id,
  );
  assert.equal(
    (await db.employeeImportJob.findUniqueOrThrow({ where: { id: job.id } }))
      .successfulCount,
    2,
  );
  const codes = (
    await db.tenantAuditLog.findMany({
      where: { organizationId: orgId },
      select: { eventCode: true },
    })
  ).map((e) => e.eventCode);
  for (const code of [
    'employee.created',
    'employee.reporting_changed',
    'import.created',
    'import.confirmed',
    'import.completed',
  ])
    assert.ok(codes.includes(code));
  assert.deepEqual(failures, []);
  events.push(
    'Two-row real CSV preview/confirmation completed; imported accounts require activation; logout/login and full QA backend restart preserve seven accounts, hierarchy, job results and genuine audit events.',
  );
  fs.writeFileSync(
    path.join(backend, '.tmp/employee-workflows-manual-qa-results.json'),
    JSON.stringify(
      {
        schema: state.schema,
        events,
        employees: 7,
        imported: 2,
        auditEvents: codes.length,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { events, employees: 7, imported: 2, auditEvents: codes.length },
      null,
      2,
    ),
  );
})()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await stop();
    // Only this positively identified fixture organization and its dependent rows.
    const fixture = await db.organization.findUnique({ where: { id: orgId } });
    if (fixture && fixture.slug === 'task3-' + orgId) {
      await db.employeeImportJob.deleteMany({
        where: { organizationId: orgId },
      });
      await db.tenantUser.deleteMany({ where: { organizationId: orgId } });
      await db.organization.delete({ where: { id: orgId } });
    }
    await db.$disconnect();
  });
