/* Recovery browser acceptance. Every mutation uses the disposable finstack_config_verify_* schema. QA/public are read-only. */
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const backend = path.resolve(__dirname, '..');
process.chdir(backend);
if (process.env.FINSTACK_RECOVERY_QA !== '1')
  throw Error('Explicit recovery test opt-in required.');
const env = JSON.parse(
  fs.readFileSync('.tmp/spa-recovery/disposable-env.json', 'utf8'),
);
if (
  !new URL(env.DATABASE_URL).searchParams
    .get('schema')
    ?.startsWith('finstack_config_verify_')
)
  throw Error('Disposable schema required.');
const { PrismaClient } = require('@prisma/client'),
  argon2 = require('argon2');
const { chromium } = require(
  process.env.FINSTACK_PLAYWRIGHT_MODULE ||
    'C:/Users/nikhi/AppData/Local/ms-playwright-go/1.57.0/package',
);
const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const output = path.join(backend, '.tmp/spa-recovery/acceptance');
fs.mkdirSync(output, { recursive: true });
const base = 'http://127.0.0.1:5582',
  api = 'http://127.0.0.1:3402';
const fixtureFile = path.join(output, 'fixture.json');
const fixture = fs.existsSync(fixtureFile)
  ? JSON.parse(fs.readFileSync(fixtureFile, 'utf8'))
  : {
      suffix: crypto.randomUUID().slice(0, 8),
      password: crypto.randomBytes(24).toString('base64url') + '!aA1',
    };
const checks = [],
  errors = [],
  requests = [];
let page, browser;
async function seed() {
  if (
    fixture.organizationId &&
    (await db.organization.count({ where: { id: fixture.organizationId } }))
  )
    return;
  const plan = await db.plan.create({
    data: {
      key: 'recovery-' + fixture.suffix,
      name: 'Fictional recovery ' + fixture.suffix,
      billingInterval: 'MONTHLY',
      basePrice: 0,
      currency: 'INR',
      includedEmployeeCount: 100,
    },
  });
  const org = await db.organization.create({
    data: {
      name: 'Disposable recovery ' + fixture.suffix,
      primaryEmail: 'recovery-' + fixture.suffix + '@workspace.test',
      status: 'ACTIVE',
    },
  });
  const user = await db.tenantUser.create({
    data: {
      organizationId: org.id,
      employeeId: 'CFG-RECOVERY-' + fixture.suffix,
      firstName: 'Recovery',
      lastName: 'Operator',
      email: org.primaryEmail,
      role: 'CONFIGURATION_MANAGER',
      passwordHash: await argon2.hash(fixture.password),
    },
  });
  const subscription = await db.organizationSubscription.create({
    data: {
      organizationId: org.id,
      planId: plan.id,
      status: 'PENDING_PAYMENT',
      billingInterval: 'MONTHLY',
      currency: 'INR',
      priceAtSubscription: 0,
      employeeCount: 100,
    },
  });
  await db.invoice.create({
    data: {
      organizationId: org.id,
      subscriptionId: subscription.id,
      planId: plan.id,
      invoiceNumber: 'RECOVERY-' + fixture.suffix,
      idempotencyKey: 'recovery-' + fixture.suffix,
      billingReason: 'INITIAL',
      subtotal: 0,
      totalAmount: 0,
      currency: 'INR',
      dueDate: new Date(),
    },
  });
  Object.assign(fixture, {
    organizationId: org.id,
    userId: user.id,
    employeeId: user.employeeId,
  });
  fs.writeFileSync(fixtureFile, JSON.stringify(fixture));
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
  await page.waitForURL(url=>url.pathname.startsWith('/configuration/'));
  await idle();
  if(new URL(page.url()).pathname!=='/configuration/dashboard') await goto('/configuration/dashboard');
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

(async () => {
  await seed();
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.FINSTACK_BROWSER_EXECUTABLE ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    requests.push({ path: url.pathname, method: request.method() });
  });
  await login();
  const routes = [
    'dashboard',
    'manage-users',
    'user-hierarchy',
    'roles-access',
    'expense-categories',
    'expense-policies',
    'audit-logs',
    'notifications',
    'organization-settings',
    'preferences',
    'profile-settings',
    'subscription',
    'help',
    'password-assistance',
  ];
  await page.evaluate(() => (window.__recoveryMarker = Date.now()));
  const marker = await page.evaluate(() => window.__recoveryMarker);
  for (const route of routes) {
    const target = page.locator(
      '.spa-sidebar nav a[href="/configuration/' + route + '"]',
    );
    if (await target.count()) await target.click();
    else if (route === 'help') await page.locator('.sidebar-bottom a').click();
    else {
      await page
        .locator('.spa-sidebar nav a[href="/configuration/profile-settings"]')
        .click();
      await page
        .getByRole('link', { name: 'Password assistance', exact: true })
        .click();
    }
    await idle();
    assert.equal(await page.evaluate(() => window.__recoveryMarker), marker);
    assert.equal(await page.locator('.spa-sidebar').count(), 1);
    await page.getByRole('button', { name: 'Users', exact: true }).click();
    await page
      .getByRole('button', { name: 'Users', exact: true })
      .press('Enter');
    for (const width of [375, 768, 1280, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + ' overflow ' + width,
      );
      await page.screenshot({
        path: path.join(output, 'after-' + route + '-' + width + '.png'),
        fullPage: true,
      });
    }
    await page.reload();
    await idle();
    assert(!page.url().endsWith('/login'));
    await page.evaluate((value) => (window.__recoveryMarker = value), marker);
  }
  checks.push(
    '14 protected routes: persistent shell/Users/settings; four widths (375/768/1280/1600), screenshots, no viewport overflow and deep refresh.',
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of ['/help', '/forgot-password', '/contact', '/support']) {
    const token = await page.evaluate(() =>
      sessionStorage.getItem('finstackTenantAccessToken'),
    );
    await goto(route);
    assert.equal(await page.locator('.spa-sidebar').count(), 1);
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem('finstackTenantAccessToken'),
      ),
      token,
    );
    assert.equal(
      (
        await page.request.get(api + '/api/v1/tenant/auth/me', {
          headers: { Authorization: 'Bearer ' + token },
        })
      ).status(),
      200,
    );
    await page.goBack();
    await idle();
    await page.goForward();
    await idle();
  }
  checks.push(
    'Authenticated public help/password/contact aliases retain identical JWT, /me 200 and workspace layout through Back/Forward.',
  );
  await settings();
  await subscriptionChecks();
  await goto('/configuration/manage-users');
  const general = await add('GM', 'General Manager', 'manager', 'Engineering');
  const manager = await add(
    'DM',
    'Department Manager',
    'manager',
    'Engineering',
    general,
  );
  const a = await add('A', 'Employee A', 'expense_submitter', 'Sales', manager);
  const b = await add('B', 'Employee B', 'expense_submitter', 'Sales', manager);
  await workflows({ general, manager, a, b });
  await passwordChange();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, 'browser-results.json'),
    JSON.stringify({ checks, pageErrors: errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, pageErrors: errors }));
})()
  .catch(async (error) => {
    await page
      ?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
      .catch(() => {});
    fs.writeFileSync(
      path.join(output, 'failure.json'),
      JSON.stringify({ message: error.message, checks, errors }, null, 2),
    );
    console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await db.$disconnect();
  });
async function settings() {
  await goto('/configuration/organization-settings');
  await page
    .getByLabel('Company Size', { exact: true })
    .selectOption('11-50 employees');
  await page
    .getByLabel('Fiscal Year Start', { exact: true })
    .selectOption('July');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page
    .getByText('Organization settings saved.', { exact: true })
    .waitFor();
  await page.reload();
  await idle();
  assert.equal(
    await page.getByLabel('Fiscal Year Start', { exact: true }).inputValue(),
    'July',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  assert.equal(
    (await download).suggestedFilename(),
    'organization-configuration.json',
  );
  await goto('/configuration/profile-settings');
  await page.getByLabel('Phone Number', { exact: true }).fill('+91 98765');
  await page.getByLabel('Location', { exact: true }).fill('Hyderabad');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Profile updated.', { exact: true }).waitFor();
  await page.reload();
  await idle();
  assert.equal(
    await page.getByLabel('Phone Number', { exact: true }).inputValue(),
    '+91 98765',
  );
  assert(
    (await page.getByLabel('Employee ID', { exact: true }).isEditable()) ===
      false,
  );
  await page
    .getByRole('link', { name: 'Password assistance', exact: true })
    .click();
  await page.waitForURL(
    '**/configuration/password-assistance?from=profile-settings',
  );
  assert.equal(await page.locator('.spa-sidebar').count(), 1);
  await goto('/configuration/preferences');
  await page.getByRole('switch', { name: 'Compact Mode', exact: true }).click();
  await page
    .getByLabel('Date Format', { exact: true })
    .selectOption('YYYY-MM-DD');
  await page
    .getByRole('button', { name: 'Save Preferences', exact: true })
    .click();
  await page.reload();
  await idle();
  assert.equal(
    await page
      .getByRole('switch', { name: 'Compact Mode', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  assert(await page.locator('#finstack-client-root.compact-workspace').count());
  await page.getByRole('switch', { name: 'Compact Mode', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save Preferences', exact: true })
    .click();
  await goto('/configuration/roles-access');
  await page
    .getByRole('heading', { name: 'Role Members', exact: true })
    .waitFor();
  checks.push(
    'Original settings groups/fields, scoped saves, readonly identity, configuration export, authenticated password link, effective local preferences and role members.',
  );
}
async function passwordChange() {
  await login();
  const previous = await page.evaluate(() =>
    sessionStorage.getItem('finstackTenantAccessToken'),
  );
  await goto('/configuration/profile-settings');
  const next = crypto.randomBytes(24).toString('base64url') + '!aA7';
  await page
    .getByLabel('Current Password', { exact: true })
    .fill(fixture.password);
  await page.getByLabel('New Password', { exact: true }).fill(next);
  await page.getByLabel('Confirm Password', { exact: true }).fill(next);
  await page
    .getByRole('button', { name: 'Update Password', exact: true })
    .click();
  await page.waitForURL('**/login');
  fixture.password = next;
  fs.writeFileSync(fixtureFile, JSON.stringify(fixture));
  assert.equal(
    (
      await page.request.get(api + '/api/v1/tenant/auth/me', {
        headers: { Authorization: 'Bearer ' + previous },
      })
    ).status(),
    401,
  );
  await login();
  checks.push(
    'Actual authenticated password change, revoked old JWT and successful new-password login.',
  );
}
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
