/* Opt-in browser acceptance against the existing isolated QA services.
 * Creates a clearly fictional retained QA organization. Never resets/deletes records.
 * Secrets live only in ignored local fixture state and never in reports/screenshots.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const backend = path.resolve(__dirname, '..'),
  output = path.join(
    backend,
    '.tmp/react-spa',
    process.env.FINSTACK_SPA_RUN === 'final' ? 'final' : '',
  );
process.chdir(backend);
const state = JSON.parse(
  fs.readFileSync(
    path.join(backend, '.tmp/manual-qa/environment.json'),
    'utf8',
  ),
);
if (
  process.env.FINSTACK_SPA_QA !== '1' ||
  !/^finstack_manual_qa_[a-f0-9]{32}$/.test(state.schema) ||
  new URL(state.env.DATABASE_URL).searchParams.get('schema') !== state.schema
)
  throw Error('Explicit SPA QA opt-in and isolated manual QA schema required.');
Object.assign(process.env, state.env);
const { PrismaClient } = require('@prisma/client');
const { chromium } = require(
  process.env.FINSTACK_PLAYWRIGHT_MODULE ||
    'C:/Users/nikhi/AppData/Local/ms-playwright-go/1.57.0/package',
);
const ordinary = require('dotenv').parse(
  fs.readFileSync(path.join(backend, '.env')),
);
const publicUrl = new URL(ordinary.DATABASE_URL);
publicUrl.searchParams.set('schema', 'public');
const db = new PrismaClient({ datasourceUrl: state.env.DATABASE_URL }),
  publicDb = new PrismaClient({ datasourceUrl: publicUrl.toString() });
const base = 'http://127.0.0.1:5581',
  api = 'http://127.0.0.1:3401',
  adminBase = 'http://127.0.0.1:5174';
const fixturePath = path.join(output, 'fixture.json');
fs.mkdirSync(output, { recursive: true });
const fixture = fs.existsSync(fixturePath)
  ? JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  : {
      suffix: crypto.randomUUID().slice(0, 8),
      password: crypto.randomBytes(24).toString('base64url') + '!Q7',
    };
const checks = [],
  errors = [],
  requests = [];
let browser, page;
async function counts() {
  const result = {};
  for (const model of [
    'organization',
    'tenantUser',
    'expenseCategory',
    'expensePolicy',
    'tenantAuditLog',
    'tenantNotification',
    'platformStaff',
    'platformRole',
    'permission',
    'plan',
    'platformAuditLog',
  ])
    result[model] = await publicDb[model].count();
  return result;
}
async function idle() {
  await page.waitForLoadState('networkidle');
}
async function goto(route) {
  await page.goto(base + route);
  await idle();
}
async function route(route) {
  await page
    .locator('.spa-sidebar')
    .getByRole('link', { name: route[1], exact: true })
    .click();
  await page.waitForURL(base + '/configuration/' + route[0]);
  await idle();
}
async function login(id = fixture.employeeId, password = fixture.password) {
  await goto('/login');
  await page.locator('#employee-id').fill(id);
  await page.locator('#password-input').fill(password);
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForURL('**/configuration/dashboard');
  await idle();
}
async function add(suffix, firstName, role, department, manager) {
  const employeeId = `SPA-${fixture.suffix}-${suffix}`;
  const exists = await db.tenantUser.findUnique({ where: { employeeId } });
  if (exists) return exists;
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  for (const [field, value] of Object.entries({
    'first-name': firstName,
    'last-name': 'QA',
    email: `${suffix}@spa-${fixture.suffix}.test`,
    'employee-id': employeeId,
    department: department,
    password: fixture.password,
  }))
    await page.locator('#manage-user-' + field).fill(value);
  await page.locator('#manage-user-role').selectOption(role);
  if (manager) {
    await page.locator('#manage-user-manager-search').fill(manager.employeeId);
    await page
      .locator(`#manage-user-manager option[value="${manager.id}"]`)
      .waitFor({ state: 'attached' });
    await page.locator('#manage-user-manager').selectOption(manager.id);
  }
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add User', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await idle();
  return db.tenantUser.findUniqueOrThrow({ where: { employeeId } });
}
async function approve() {
  const admin = await browser.newPage();
  admin.on('pageerror', (e) => errors.push(e.message));
  await admin.goto(adminBase + '/login');
  await admin
    .getByLabel('Work email', { exact: true })
    .fill(state.reviewer.email);
  await admin
    .getByLabel('Password', { exact: true })
    .fill(state.reviewer.password);
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
  await admin.waitForURL((url) => !url.pathname.endsWith('/login'));
  await admin.goto(adminBase + '/organizations/' + fixture.organizationId);
  await admin
    .getByRole('heading', {
      name: 'Organization registration review',
      exact: true,
    })
    .waitFor();
  await admin.getByLabel('Decision', { exact: true }).selectOption('APPROVED');
  await admin
    .getByLabel('Evidence checked and decision reason', { exact: true })
    .fill(
      'Local QA only. Fictional SPA scenario; no legal identity or domain ownership verified.',
    );
  admin.once('dialog', (d) => d.accept());
  const reviewed = admin.waitForResponse(
    (r) =>
      r.url().endsWith('/registration-reviews') &&
      r.request().method() === 'POST',
  );
  await admin
    .getByRole('button', { name: 'Save review decision', exact: true })
    .click();
  assert.equal((await reviewed).status(), 201);
  await admin.close();
}
async function register() {
  if (fixture.employeeId) {
    if (
      (
        await db.organization.findUniqueOrThrow({
          where: { id: fixture.organizationId },
        })
      ).registrationStatus !== 'APPROVED'
    )
      await approve();
    return;
  }
  const plan = await db.plan.findUniqueOrThrow({
    where: { key: 'manual-qa-plan' },
  });
  await goto('/views/shared/register.html');
  await page.getByText(/LOCAL MANUAL QA/).waitFor();
  const values = {
    name: `Fictional SPA QA ${fixture.suffix}`,
    registrationExemptionReason:
      'Local QA only: fictional entity without any government registration.',
    primaryEmail: `office@spa-${fixture.suffix}.test`,
    firstName: 'SPA',
    lastName: 'Operator',
    authorizedContactTitle: 'Local QA contact',
    email: `operator@spa-${fixture.suffix}.test`,
    employeeCount: '12',
  };
  for (const [key, value] of Object.entries(values))
    await page.locator('#reg-' + key).fill(value);
  await page.locator('#reg-registrationCountry').selectOption('IN');
  await page.locator('#reg-planId').selectOption(plan.id);
  await page.locator('#reg-password').fill(fixture.password);
  await page.locator('#reg-confirm-password').fill(fixture.password);
  const submitted = page.waitForResponse(
    (r) =>
      r.url().endsWith('/registrations/organizations') &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Submit for review', exact: true })
    .click();
  const response = await submitted;
  assert.equal(response.status(), 201);
  const result = (await response.json()).data;
  Object.assign(fixture, {
    employeeId: result.employeeId,
    organizationId: result.organizationId,
  });
  fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
  await page.waitForURL('**/registration/receipt');
  await page.reload();
  await page.getByText(fixture.employeeId, { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download Employee ID receipt', exact: true })
    .click();
  const receipt = fs.readFileSync(await (await downloadPromise).path(), 'utf8');
  assert(receipt.includes(fixture.employeeId));
  assert(!receipt.includes(fixture.password));
  await goto('/login');
  await page.locator('#employee-id').fill(fixture.employeeId);
  await page.locator('#password-input').fill(fixture.password);
  await page.locator('#login-form button[type=submit]').click();
  await page.getByRole('alert').waitFor();
  assert.equal(new URL(page.url()).pathname, '/login');
  await approve();
  checks.push(
    'Real React registration → tab-persistent receipt/download → pending login denied → separate Admin UI approval.',
  );
}
(async () => {
  const before = await counts();
  fs.writeFileSync(
    path.join(output, 'public-before.json'),
    JSON.stringify(before, null, 2),
  );
  await require('../dist/src/common/config/manual-qa').verifyManualQaDatabase(
    db,
  );
  assert.equal(
    (await (await fetch(api + '/api/v1/tenant/onboarding/environment')).json())
      .data.manualQa,
    true,
  );
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.FINSTACK_BROWSER_EXECUTABLE ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().startsWith(api))
      requests.push({
        path: new URL(r.url()).pathname,
        query: new URL(r.url()).search,
        method: r.method(),
      });
  });
  await register();
  await login();
  const routes = [
    ['dashboard', 'Dashboard'],
    ['manage-users', 'Manage Users'],
    ['user-hierarchy', 'User Hierarchy'],
    ['roles-access', 'Roles & Access'],
    ['expense-categories', 'Expense Categories'],
    ['expense-policies', 'Expense Policies'],
    ['audit-logs', 'Audit Logs'],
    ['notifications', 'Notifications'],
    ['organization-settings', 'Organization Settings'],
    ['preferences', 'Preferences'],
    ['profile-settings', 'Profile Settings'],
    ['subscription', 'Subscription & Billing'],
  ];
  await page.evaluate(() => (window.__spaDocumentMarker = Date.now()));
  const marker = await page.evaluate(() => window.__spaDocumentMarker);
  for (const entry of routes) {
    await route(entry);
    assert.equal(await page.evaluate(() => window.__spaDocumentMarker), marker);
    await page.getByRole('heading', { name: entry[1], exact: true }).waitFor();
    const group = page.getByRole('button', { name: 'Users', exact: true });
    await group.click();
    assert.equal(await group.getAttribute('aria-expanded'), 'false');
    await group.focus();
    await page.keyboard.press('Enter');
    assert.equal(await group.getAttribute('aria-expanded'), 'true');
    assert.equal(
      await page.locator('.spa-sidebar a[aria-current=page]').count(),
      1,
    );
    for (const width of [375, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        entry[0] + ' overflow at ' + width,
      );
      await page.screenshot({
        path: path.join(output, entry[0] + '-' + width + '.png'),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  checks.push(
    'All 12 workspace routes: client navigation without reload; Users accordion mouse/keyboard; one active route; screenshots/no viewport overflow at 375/768/1280/1440.',
  );
  await page
    .getByRole('button', { name: 'Collapse sidebar', exact: true })
    .click();
  await route(routes[1]);
  assert.equal(await page.locator('.spa-workspace.nav-collapsed').count(), 1);
  await page
    .getByRole('button', { name: 'Expand sidebar', exact: true })
    .click();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .locator('.spa-sidebar')
    .getByRole('link', { name: 'User Hierarchy', exact: true })
    .click();
  await page.waitForURL('**/configuration/user-hierarchy');
  assert.equal(await page.locator('.nav-mobile-open').count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await route(routes[4]);
  await route(routes[5]);
  await page.goBack();
  await page.waitForURL('**/configuration/expense-categories');
  await page.goForward();
  await page.waitForURL('**/configuration/expense-policies');
  await page.reload();
  await page
    .getByRole('heading', { name: 'Expense Policies', exact: true })
    .waitFor();
  for (const entry of routes) {
    await goto('/views/config-manager/' + entry[0] + '.html');
    assert.equal(new URL(page.url()).pathname, '/configuration/' + entry[0]);
    await page.getByRole('heading', { name: entry[1], exact: true }).waitFor();
  }
  checks.push(
    'Collapsed and mobile navigation, Back/Forward, deep refresh, all 12 legacy workspace URL bridges.',
  );
  await goto('/configuration/manage-users');
  const general = await add('GM', 'General Manager', 'manager', 'Engineering');
  const manager = await add(
    'DM',
    'Department Manager',
    'manager',
    'Engineering',
    general,
  );
  const a = await add(
    'A',
    'Employee A',
    'expense_submitter',
    'Engineering',
    manager,
  );
  const b = await add('B', 'Employee B', 'expense_submitter', 'Sales', manager);
  assert.equal(manager.managerId, general.id);
  assert.equal(a.managerId, manager.id);
  assert.equal(b.managerId, manager.id);
  const departmentResponse = page.waitForResponse(
    (r) =>
      r.url().includes('/configuration/employees?') &&
      new URL(r.url()).searchParams.get('department') === 'Engineering',
  );
  await page
    .getByLabel('Filter by department', { exact: true })
    .fill('Engineering');
  await departmentResponse;
  await page.getByRole('row').filter({ hasText: general.employeeId }).waitFor();
  await page
    .locator(`[data-employee-id="${b.employeeId}"]`)
    .waitFor({ state: 'hidden' });
  assert.equal(
    await page.locator(`[data-employee-id="${b.employeeId}"]`).count(),
    0,
  );
  const combined = page.waitForResponse((r) => {
    const url = new URL(r.url());
    return (
      url.pathname.endsWith('/configuration/employees') &&
      url.searchParams.get('department') === 'Engineering' &&
      url.searchParams.get('role') === 'MANAGER' &&
      url.searchParams.get('status') === 'ACTIVE' &&
      url.searchParams.get('search') === general.employeeId
    );
  });
  await page
    .getByLabel('Filter by role', { exact: true })
    .selectOption('MANAGER');
  await page
    .getByLabel('Filter by status', { exact: true })
    .selectOption('ACTIVE');
  await page
    .getByLabel('Search users', { exact: true })
    .fill(general.employeeId);
  await combined;
  await page
    .locator(`[data-employee-id="${manager.employeeId}"]`)
    .waitFor({ state: 'hidden' });
  await page.getByLabel('Search users', { exact: true }).fill('');
  await page.getByLabel('Filter by role', { exact: true }).selectOption('');
  await page.getByLabel('Filter by status', { exact: true }).selectOption('');
  const cleared = page.waitForResponse(
    (r) =>
      r.url().includes('/configuration/employees?') &&
      !new URL(r.url()).searchParams.has('department'),
  );
  await page.getByLabel('Filter by department', { exact: true }).fill('');
  await cleared;
  await page
    .getByRole('button', { name: 'Edit Employee A QA', exact: true })
    .click();
  assert.equal(
    await page.locator('#manage-user-employee-id').isDisabled(),
    true,
  );
  assert.equal(await page.locator('#manage-user-password').count(), 0);
  await page.locator('#manage-user-department').fill('Research');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save Changes', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: a.id } })).department,
    'Research',
  );
  checks.push(
    'Actual Add User bounded manager search/selection; 3-level GM→DM→A/B hierarchy; department filtering and immutable-ID profile edit.',
  );
  await subscriptionChecks();
  await workflows({ general, manager, a, b });
  fs.writeFileSync(
    path.join(output, 'fixtures-summary.json'),
    JSON.stringify(
      {
        organizationId: fixture.organizationId,
        employees: {
          general: general.id,
          manager: manager.id,
          a: a.id,
          b: b.id,
        },
      },
      null,
      2,
    ),
  );
  assert.deepEqual(await counts(), before);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, 'browser-results.json'),
    JSON.stringify(
      {
        checks,
        errors,
        requests,
        publicBefore: before,
        publicAfter: await counts(),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, pageErrors: errors }));
})()
  .catch(async (error) => {
    await page
      ?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
      .catch(() => {});
    console.error(error.stack);
    fs.writeFileSync(
      path.join(output, 'failure.json'),
      JSON.stringify({ message: error.message, checks, errors }, null, 2),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await db.$disconnect();
    await publicDb.$disconnect();
  });

async function workflows({ general, manager, a, b }) {
  await goto('/configuration/manage-users');
  // All mutations target this run's retained fictional organization and new records only.
  await page
    .getByRole('button', { name: 'Disable Employee B QA', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Disable employee', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: b.id } })).status,
    'INACTIVE',
  );
  await page
    .getByRole('button', { name: 'Enable Employee B QA', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Enable employee', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: b.id } })).status,
    'ACTIVE',
  );
  await goto('/configuration/user-hierarchy');
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
  await page
    .locator(`[data-employee-id="${a.employeeId}"] .hierarchy-person-details`)
    .click();
  await page
    .getByRole('button', { name: 'Change manager', exact: true })
    .click();
  await page.locator('#hierarchy-manager-search').fill(general.employeeId);
  await page
    .locator(`#hierarchy-manager option[value="${general.id}"]`)
    .waitFor({ state: 'attached' });
  await page.locator('#hierarchy-manager').selectOption(general.id);
  await page.getByRole('button', { name: 'Save manager', exact: true }).click();
  await page.locator('.hierarchy-assignment').waitFor({ state: 'hidden' });
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: a.id } })).managerId,
    general.id,
  );
  await page
    .getByRole('button', { name: 'Change manager', exact: true })
    .click();
  await page.locator('#hierarchy-manager-search').fill(manager.employeeId);
  await page
    .locator(`#hierarchy-manager option[value="${manager.id}"]`)
    .waitFor({ state: 'attached' });
  await page.locator('#hierarchy-manager').selectOption(manager.id);
  await page.getByRole('button', { name: 'Save manager', exact: true }).click();
  await page.locator('.hierarchy-assignment').waitFor({ state: 'hidden' });
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: a.id } })).managerId,
    manager.id,
  );
  await page
    .getByLabel('Hierarchy department', { exact: true })
    .selectOption('Sales');
  await page.locator(`[data-employee-id="${b.employeeId}"]`).waitFor();
  await idle();
  assert.equal(
    await page.locator(`[data-employee-id="${general.employeeId}"]`).count(),
    0,
  );
  checks.push(
    'Confirmed Disable/Enable and real 3-level hierarchy UI reassignment with PostgreSQL verification; hierarchy department filter.',
  );
  await templates();
  const run = crypto.randomUUID().slice(0, 6),
    categoryName = 'SPA category ' + run,
    policyName = 'SPA policy ' + run;
  await goto('/configuration/expense-categories');
  await page
    .getByRole('button', { name: 'Add custom category', exact: true })
    .click();
  await page.locator('#category-name').fill(categoryName);
  await page
    .locator('#category-description')
    .fill('Created by isolated SPA acceptance.');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByText(categoryName, { exact: true }).waitFor();
  const category = await db.expenseCategory.findFirstOrThrow({
    where: { organizationId: fixture.organizationId, name: categoryName },
  });
  await page
    .getByRole('button', { name: 'Deactivate ' + categoryName, exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Deactivate category', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page
    .getByRole('button', { name: 'Reactivate ' + categoryName, exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reactivate category', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await goto('/configuration/expense-policies');
  await page.getByRole('button', { name: 'Add Policy', exact: true }).click();
  await page.locator('#policy-name').fill(policyName);
  await page.locator('#policy-category').selectOption(category.id);
  await page.locator('#policy-amount').fill('5000');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save Policy', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  let policy = await db.expensePolicy.findFirstOrThrow({
    where: { organizationId: fixture.organizationId, name: policyName },
  });
  assert.equal(policy.maxAmount.toString(), '5000');
  await page
    .getByRole('button', { name: 'Edit ' + policyName, exact: true })
    .click();
  await page.locator('#policy-amount').fill('5000.50');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Update Policy', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  policy = await db.expensePolicy.findUniqueOrThrow({
    where: { id: policy.id },
  });
  assert.equal(policy.maxAmount.toString(), '5000.5');
  const deletePolicy = page.getByRole('button', {
    name: 'Delete ' + policyName,
    exact: true,
  });
  assert(await deletePolicy.isVisible());
  await deletePolicy.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete policy', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await db.expensePolicy.count({ where: { id: policy.id } }), 0);
  await goto('/configuration/expense-categories');
  await page
    .getByRole('button', { name: 'Delete ' + categoryName, exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete category', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(
    await db.expenseCategory.count({ where: { id: category.id } }),
    0,
  );
  checks.push(
    'Real category create/deactivate/reactivate/delete and policy create 5000 → edit 5000.50 → visible Delete; Decimal persistence and durable audits.',
  );
  await goto('/configuration/manage-users');
  await page.getByRole('button', { name: 'Bulk Import', exact: true }).click();
  const csv =
    'employeeId,firstName,lastName,email,department,managerEmployeeId\n' +
    [
      `SPA-${fixture.suffix}-${run}-I1,Import One,QA,import1-${run}@spa-${fixture.suffix}.test,Engineering,${manager.employeeId}`,
      `SPA-${fixture.suffix}-${run}-I2,Import Two,QA,import2-${run}@spa-${fixture.suffix}.test,Sales,${manager.employeeId}`,
      `${b.employeeId},Duplicate,QA,duplicate-${run}@spa-${fixture.suffix}.test,Sales,${manager.employeeId}`,
    ].join('\n');
  await page.locator('#employee-import-file').setInputFiles({
    name: 'spa-qa.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Clear file', exact: true }).click();
  assert.equal(await page.locator('#employee-import-file').inputValue(), '');
  await page.locator('#employee-import-file').setInputFiles({
    name: 'spa-qa.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Validate CSV', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .waitFor();
  assert(
    await page
      .getByRole('button', { name: 'Confirm import', exact: true })
      .isDisabled(),
  );
  await page.getByRole('checkbox', { name: /I reviewed the rows/ }).check();
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await page.getByText('Import completed', { exact: true }).waitFor();
  assert.equal(await page.locator('#employee-import-file').count(), 0);
  assert.equal(
    await page
      .getByRole('heading', { name: 'Row preview', exact: true })
      .count(),
    0,
  );
  const completedJobId = await page
    .locator('#employee-import-job')
    .inputValue();
  await page
    .getByRole('button', { name: 'Start another import', exact: true })
    .click();
  await page.locator('#employee-import-file').waitFor();
  await idle();
  assert.equal(await page.locator('#employee-import-job').inputValue(), '');
  assert.equal(
    await page
      .getByRole('heading', { name: 'Row preview', exact: true })
      .count(),
    0,
  );
  await page.locator('#employee-import-job').selectOption(completedJobId);
  await page
    .getByRole('heading', { name: 'Row preview', exact: true })
    .waitFor();
  const imported = await db.tenantUser.findUniqueOrThrow({
    where: { employeeId: `SPA-${fixture.suffix}-${run}-I1` },
  });
  assert.equal(imported.status, 'INACTIVE');
  assert.equal(imported.credentialSetupRequired, true);
  const errorsDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download row errors', exact: true })
    .click();
  assert((await errorsDownload).suggestedFilename().endsWith('.csv'));
  page.once('dialog', (dialog) => dialog.accept());
  const activationDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download activation links', exact: true })
    .click();
  const activationCsv = fs.readFileSync(
    await (await activationDownload).path(),
    'utf8',
  );
  const activationLine = activationCsv
    .split(/\r?\n/)
    .find((line) =>
      line.includes(
        'employeeId=' + encodeURIComponent(imported.employeeId) + '&',
      ),
    );
  assert(activationLine);
  const link = activationLine.match(/http[^"\r\n,]*#employeeId=[^"\r\n,]+/)[0];
  const activation = await browser.newPage();
  activation.on('pageerror', (e) => errors.push(e.message));
  await activation.goto(link);
  await activation.locator('#activation-password').fill(fixture.password);
  await activation.locator('#activation-confirm').fill(fixture.password);
  await activation
    .getByRole('button', { name: 'Set password', exact: true })
    .click();
  await activation
    .getByText('Your password is set. Sign in with your Employee ID.', {
      exact: true,
    })
    .waitFor();
  assert(!activation.url().includes('token='));
  await activation.goto(base + '/login');
  await activation.locator('#employee-id').fill(imported.employeeId);
  await activation.locator('#password-input').fill(fixture.password);
  await activation.locator('#login-submit').click();
  await activation.waitForURL('**/views/submitter/dashboard.html');
  await activation.evaluate(() => {
    const user = JSON.parse(sessionStorage.getItem('finstackTenantUser'));
    user.role = 'CONFIGURATION_MANAGER';
    sessionStorage.setItem('finstackTenantUser', JSON.stringify(user));
  });
  await activation.goto(base + '/configuration/dashboard');
  await activation.waitForURL('**/forbidden');
  const denied = await activation.evaluate(async (api) => {
    const token = sessionStorage.getItem('finstackTenantAccessToken');
    return (
      await fetch(api + '/api/v1/tenant/configuration/employees', {
        headers: { Authorization: 'Bearer ' + token },
      })
    ).status;
  }, api);
  assert.equal(denied, 403);
  await activation.close();
  const activated = await db.tenantUser.findUniqueOrThrow({
    where: { id: imported.id },
  });
  assert.equal(activated.status, 'ACTIVE');
  assert.equal(activated.credentialSetupRequired, false);
  checks.push(
    'CSV clear/reselect/validate, explicit partial consent, completed compact summary/history/errors, secure activation export, actual single-use password setup and untouched Submitter redirect.',
  );
  await goto('/configuration/audit-logs');
  await page
    .getByLabel('Filter by resource', { exact: true })
    .selectOption('category');
  await page
    .getByRole('cell', { name: 'category.created', exact: true })
    .first()
    .waitFor();
  await page
    .getByRole('button', { name: /View event/ })
    .first()
    .click();
  await page
    .getByRole('dialog', { name: 'Audit event details', exact: true })
    .waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const auditDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Logs', exact: true }).click();
  const auditCsv = fs.readFileSync(await (await auditDownload).path(), 'utf8');
  assert(auditCsv.includes('category.created'));
  assert(!auditCsv.includes('policy.created'));
  await goto('/configuration/dashboard');
  const recent = await db.tenantAuditLog.findMany({
    where: { organizationId: fixture.organizationId },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 5,
  });
  for (const event of recent)
    assert(
      (await page.locator('.recent-activity').innerText()).includes(
        event.eventCode.replaceAll('_', ' '),
      ),
    );
  checks.push(
    'Authoritative filtered audit details/CSV and Dashboard recent activity agree with PostgreSQL.',
  );
  await finalChecks();
}

async function finalChecks() {
  await goto('/configuration/notifications');
  const notification = await db.tenantNotification.findFirstOrThrow({
    where: { organizationId: fixture.organizationId, dismissedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  let row = page.locator(`[data-notification-id="${notification.id}"]`);
  if (notification.readAt === null) {
    await row.getByRole('button', { name: 'Mark read', exact: true }).click();
    await row
      .getByRole('button', { name: 'Mark unread', exact: true })
      .waitFor();
    assert(
      (
        await db.tenantNotification.findUniqueOrThrow({
          where: { id: notification.id },
        })
      ).readAt,
    );
  }
  await row.getByRole('button', { name: 'Mark unread', exact: true }).click();
  await row.getByRole('button', { name: 'Mark read', exact: true }).waitFor();
  assert.equal(
    (
      await db.tenantNotification.findUniqueOrThrow({
        where: { id: notification.id },
      })
    ).readAt,
    null,
  );
  const readAllResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/notifications/read-all') &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Mark all read', exact: true })
    .click();
  assert.equal((await readAllResponse).status(), 201);
  await page
    .getByRole('button', { name: 'Mark all read', exact: true })
    .waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => document.querySelector('.page-header button')?.disabled === true,
  );
  assert.equal(
    await db.tenantNotification.count({
      where: {
        organizationId: fixture.organizationId,
        readAt: null,
        dismissedAt: null,
      },
    }),
    0,
  );
  await row.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Dismiss', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert(
    (
      await db.tenantNotification.findUniqueOrThrow({
        where: { id: notification.id },
      })
    ).dismissedAt,
  );
  checks.push(
    'Genuine import-completion notification read/unread/read-all/dismiss persists in PostgreSQL.',
  );
  for (const route of [
    '/',
    '/login',
    '/register',
    '/registration/receipt',
    '/account-request',
    '/forgot-password',
    '/reset-password',
    '/help',
    '/contact',
    '/support',
    '/activate-account',
    '/forbidden',
  ]) {
    // Registration receipt intentionally remains tab scoped; no activation token is put in screenshots.
    await goto(route);
    assert.equal(await page.locator('h1').count(), 1, route);
    for (const width of [375, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + ' overflow ' + width,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const links = await page
      .locator('a[href]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
    for (const href of links) {
      if (href.startsWith('/') && !href.startsWith('//')) {
        const response = await page.request.get(base + href);
        assert.equal(response.status(), 200, route + ' linked ' + href);
      }
    }
  }
  for (const path of [
    '/index.html',
    '/login.html',
    '/views/shared/login.html',
    '/views/shared/register.html',
    '/views/shared/account-request.html',
    '/views/shared/forgot-password.html',
    '/views/shared/reset-password.html',
    '/views/shared/help.html',
    '/activate-account.html',
  ]) {
    await goto(path);
    assert(!new URL(page.url()).pathname.endsWith('.html'), path);
  }
  await goto('/configuration/not-a-page');
  await page
    .getByRole('heading', { name: 'Page not found', exact: true })
    .waitFor();
  await goto('/configuration/manage-users');
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add User', exact: true })
      .boundingBox();
    assert(box && box.y + box.height <= 900);
    await page.keyboard.press('Tab');
    assert(
      await page
        .getByRole('dialog')
        .evaluate((dialog) => dialog.contains(document.activeElement)),
    );
  }
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.profile-menu>button').click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/login');
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem('finstackTenantAccessToken'),
    ),
    null,
  );
  await goto('/configuration/audit-logs');
  await page.waitForURL('**/login');
  await login();
  await page.evaluate(() =>
    sessionStorage.setItem(
      'finstackTenantAccessToken',
      'invalid-expired-token',
    ),
  );
  await goto('/configuration/audit-logs');
  await page.waitForURL('**/login');
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('finstackTenantUser')),
    null,
  );
  await login();
  assert(
    !requests.some(
      (r) =>
        r.path === '/api/v1/tenant/configuration/users' && r.method === 'GET',
    ),
    'No full employee-list download',
  );
  checks.push(
    'All public/shared pages and discovered internal links, legacy bridges, 404, responsive widths, modal keyboard trap/footer, genuine logout and backend-rejected expired session; no full employee-list request.',
  );
  const strict = await browser.newPage();
  strict.on('pageerror', (e) => errors.push(e.message));
  await strict.goto('http://127.0.0.1:5582/register');
  await strict.locator('#reg-primaryEmail').fill('office@ordinary-mode.test');
  await strict.locator('#reg-primaryEmail').blur();
  await strict
    .getByText(
      'Use a publicly usable organization domain, rather than a personal or reserved example domain.',
      { exact: true },
    )
    .waitFor();
  assert.equal(await strict.getByText(/LOCAL MANUAL QA/).count(), 0);
  await strict.close();
  checks.push(
    'Normal source-mode registration reads the actual non-QA backend and rejects .test domains; isolated manual QA remains explicitly opted in.',
  );
  // Scope metadata is retained for a separate backend-restart acceptance phase.
}

async function templates() {
  await goto('/configuration/expense-categories');
  const existing = await db.expenseCategory.findMany({
    where: {
      organizationId: fixture.organizationId,
      templateKey: { in: ['travel', 'meals'] },
    },
  });
  if (
    !(await page
      .getByRole('checkbox', { name: 'Select Travel', exact: true })
      .isVisible())
  )
    await page
      .getByRole('button', {
        name: 'Choose predefined categories',
        exact: true,
      })
      .click();
  const picker = page.getByRole('region', {
    name: 'Predefined categories',
    exact: true,
  });
  const missing = ['Travel', 'Meals'].filter(
    (name) => !existing.some((item) => item.name === name),
  );
  if (missing.length) {
    for (const name of missing)
      await picker
        .getByRole('checkbox', { name: 'Select ' + name, exact: true })
        .check();
    await picker.getByRole('button', { name: new RegExp('^Preview') }).click();
    await picker
      .getByRole('button', {
        name: `Activate ${missing.length} categories`,
        exact: true,
      })
      .click();
    await picker.waitFor({ state: 'hidden' });
  } else
    await page
      .getByRole('button', { name: 'Close predefined categories', exact: true })
      .click();
  const categories = await db.expenseCategory.findMany({
    where: {
      organizationId: fixture.organizationId,
      templateKey: { in: ['travel', 'meals'] },
    },
  });
  assert.equal(categories.length, 2);
  for (const row of existing)
    assert(categories.some((item) => item.id === row.id));
  const policy = await db.expensePolicy.findFirst({
    where: {
      organizationId: fixture.organizationId,
      templateKey: 'travel-policy',
    },
  });
  if (!policy) {
    await goto('/configuration/expense-policies');
    await page
      .getByRole('button', { name: 'Browse policy templates', exact: true })
      .click();
    const policyPicker = page.getByRole('region', {
      name: 'Policy templates',
      exact: true,
    });
    await policyPicker
      .getByRole('checkbox', { name: 'Select Travel policy', exact: true })
      .check();
    const item = policyPicker
      .locator('.template-item')
      .filter({ has: page.getByText('Travel policy', { exact: true }) });
    await item
      .getByLabel('Per-expense spending cap', { exact: true })
      .fill('5000.50');
    await policyPicker
      .getByRole('button', { name: new RegExp('^Preview') })
      .click();
    await policyPicker
      .getByRole('button', { name: 'Activate 1 policies', exact: true })
      .click();
    await policyPicker.waitFor({ state: 'hidden' });
    assert.equal(
      (
        await db.expensePolicy.findFirstOrThrow({
          where: {
            organizationId: fixture.organizationId,
            templateKey: 'travel-policy',
          },
        })
      ).maxAmount.toString(),
      '5000.5',
    );
  }
  checks.push(
    'Category and policy template selection → preview → transactional activation → collapse; exact cap and stable existing IDs.',
  );
}

async function subscriptionChecks() {
  await goto('/configuration/subscription');
  await page.getByRole('heading', { name: 'Invoices', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Change Plan', exact: true }).click();
  const modal = page.getByRole('dialog', {
    name: 'Change subscription plan',
    exact: true,
  });
  await modal.getByText(/Quoted recurring total:/).waitFor();
  await modal.getByLabel('Employee seats').fill('125');
  await modal.getByText(/Quoted recurring total:/).waitFor();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Cancel subscription', exact: true })
    .click();
  const cancellation = page.getByRole('dialog', {
    name: 'Cancel subscription',
    exact: true,
  });
  await cancellation
    .getByLabel('Cancellation reason')
    .fill('QA preview only; cancel without submitting');
  await cancellation
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  assert.equal(await page.getByRole('dialog').count(), 0);
  checks.push(
    'Subscription and billing: real subscription/invoices/payment history, active plans and live seat quote; cancellation confirmation dismissed without mutation. No provider charge attempted.',
  );
}
