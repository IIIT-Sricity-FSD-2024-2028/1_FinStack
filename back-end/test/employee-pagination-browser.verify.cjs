const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { fork, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { chromium } = require(
  process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright',
);
const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'back-end');
const frontend = path.join(root, 'front-end');
require(path.join(backend, 'node_modules/dotenv')).config({
  path: path.join(backend, '.env'),
  quiet: true,
});
const { PrismaClient } = require(
  path.join(backend, 'node_modules/@prisma/client'),
);
const argon2 = require(path.join(backend, 'node_modules/argon2'));
const testUrl = new URL(process.env.DATABASE_URL || '');
if (
  process.env.FINSTACK_CONFIGURATION_E2E !== '1' ||
  !testUrl.searchParams.get('schema')?.startsWith('finstack_config_verify_')
)
  throw new Error(
    'Explicit opt-in and a disposable finstack_config_verify_* schema are required.',
  );
const state = {
  DATABASE_URL: testUrl.toString(),
  schema: testUrl.searchParams.get('schema'),
};
const env = {
  ...process.env,
  DATABASE_URL: state.DATABASE_URL,
  CORS_ORIGINS: 'http://127.0.0.1:5580',
  TENANT_JWT_ACCESS_SECRET: randomUUID() + randomUUID(),
  LOG_DIRECTORY: path.join(backend, '.tmp', 'configuration-browser-logs'),
  NODE_ENV: 'test',
};
const prisma = new PrismaClient({ datasourceUrl: state.DATABASE_URL });
let api, browser, staticServer, debugPage;
const fixtureIds = [];
const subscriptionPlanId = randomUUID();
const employeeIdsBySlug = new Map();
const events = [];
const password = randomUUID() + '!A1';
const base = 'http://127.0.0.1:5580';
const apiBase = 'http://127.0.0.1:3301';

async function startApi() {
  api = fork(path.join(__dirname, 'configuration-backend-harness.cjs'), [], {
    cwd: backend,
    env,
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  await new Promise((resolve, reject) => {
    api.once('message', resolve);
    api.once('exit', (code) => reject(new Error('Backend exited ' + code)));
  });
}
async function stopApi() {
  if (api?.connected)
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.error(
          'Backend did not shut down gracefully within 20 seconds.',
        );
        process.exitCode = 1;
        api.kill(); // Only this script's disposable backend child.
      }, 20000);
      api.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      api.send('stop');
    });
}
async function login(page, slug) {
  await page.goto(base + '/login.html');
  await page.locator('#employee-id').fill(employeeIdsBySlug.get(slug));
  await page.locator('#password-input').fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await page.waitForURL('**/views/config-manager/dashboard.html');
}
async function visible(page, text) {
  await page.getByRole('cell', { name: text, exact: true }).waitFor();
}

(async () => {
  const passwordHash = await argon2.hash(password);
  // Login lands on the current subscription dashboard; provide a complete disposable tenant fixture.
  await prisma.plan.create({
    data: {
      id: subscriptionPlanId,
      key: 'pagination-' + subscriptionPlanId,
      name: 'Disposable pagination ' + subscriptionPlanId,
      billingInterval: 'MONTHLY',
      basePrice: 0,
    },
  });
  for (const suffix of ['primary', 'other']) {
    const organization = await prisma.organization.create({
      data: {
        name: 'Disposable browser ' + suffix,
        slug: 'browser-' + randomUUID(),
        primaryEmail: randomUUID() + '@example.test',
      },
    });
    fixtureIds.push(organization.id);
    await prisma.organizationSubscription.create({
      data: {
        organizationId: organization.id,
        planId: subscriptionPlanId,
        status: 'ACTIVE',
        billingInterval: 'MONTHLY',
        currency: 'INR',
        priceAtSubscription: 0,
        employeeCount: 200,
      },
    });
    employeeIdsBySlug.set(organization.slug, `CFG-${organization.id}`);
    await prisma.tenantUser.create({
      data: {
        organizationId: organization.id,
        employeeId: `CFG-${organization.id}`,
        firstName: 'Browser',
        lastName: 'Test',
        email: 'browser@example.test',
        passwordHash,
        role: 'CONFIGURATION_MANAGER',
      },
    });
  }
  const organizations = await prisma.organization.findMany({
    where: { id: { in: fixtureIds } },
  });
  const primary = organizations.find((org) => org.id === fixtureIds[0]);
  const other = organizations.find((org) => org.id === fixtureIds[1]);
  await startApi();
  staticServer = http.createServer((req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, base).pathname);
      const legacy = pathname.startsWith('/legacy/');
      if (legacy) pathname = pathname.slice('/legacy'.length);
      const target = path.resolve(frontend, '.' + pathname);
      if (!target.startsWith(frontend + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      let content;
      if (
        legacy &&
        /\/views\/config-manager\/(?:expense-(?:categories|policies)|manage-users|user-hierarchy)\.html$/.test(
          pathname,
        )
      ) {
        content = execFileSync('git', ['show', 'HEAD:front-end' + pathname], {
          cwd: root,
        });
      } else content = fs.readFileSync(target);
      const ext = path.extname(target);
      const types = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
      };
      if (ext === '.html')
        content = Buffer.from(
          content
            .toString()
            .replace(
              '<head>',
              '<head><script>window.FINSTACK_API_BASE_URL="' +
                apiBase +
                '"</script>',
            ),
        );
      res
        .writeHead(200, {
          'Content-Type': types[ext] || 'application/octet-stream',
        })
        .end(content);
    } catch (error) {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) =>
    staticServer.listen(5580, '127.0.0.1', resolve),
  );
  browser = await chromium.launch({
    executablePath:
      process.env.FINSTACK_BROWSER_EXECUTABLE ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  debugPage = page;
  page.on('pageerror', (error) => events.push({ error: error.message }));
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleErrors.push(message.text() + ' ' + message.location().url);
  });
  const requests = [];
  page.on('request', (req) => {
    if (req.url().startsWith(apiBase))
      requests.push(req.method() + ' ' + new URL(req.url()).pathname);
  });
  // Seed enough employees and managers to exercise middle/last pages and lookups.
  const employeePrefix = 'UI-' + randomUUID().slice(0, 8);
  const fixtureHash = await argon2.hash(password);
  await prisma.tenantUser.createMany({
    data: [
      ...Array.from({ length: 127 }, (_, i) => ({
        organizationId: primary.id,
        employeeId: employeePrefix + '-' + String(i).padStart(3, '0'),
        firstName: 'Employee ' + String(i).padStart(3, '0'),
        lastName: 'Test',
        email: employeePrefix + '-' + i + '@example.test',
        passwordHash: fixtureHash,
        role: 'EXPENSE_SUBMITTER',
        status: i % 2 === 0 ? 'ACTIVE' : 'INACTIVE',
        department: i % 3 === 0 ? 'Engineering' : 'Operations',
      })),
      ...Array.from({ length: 26 }, (_, i) => ({
        organizationId: primary.id,
        employeeId: employeePrefix + '-M' + i,
        firstName: 'Manager ' + String(i).padStart(2, '0'),
        lastName: 'Test',
        email: employeePrefix + '-manager' + i + '@example.test',
        passwordHash: fixtureHash,
        role: 'MANAGER',
        status: 'ACTIVE',
        department: 'Management',
      })),
    ],
  });
  await login(page, primary.slug);
  await page.addInitScript(() => {
    window.__syncXHR = [];
    const original = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async) {
      if (async === false) window.__syncXHR.push(url);
      return original.apply(this, arguments);
    };
  });
  const start = requests.length;
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByText('Showing 1-50 of 154 users', { exact: true }).waitFor();
  const initial = requests.slice(start);
  assert.equal(
    initial.filter((r) => r === 'GET /api/v1/tenant/configuration/employees')
      .length,
    1,
  );
  assert(!initial.includes('GET /api/v1/tenant/configuration/users'));
  assert(
    !initial.some((r) => r.includes('/categories') || r.includes('/policies')),
  );
  assert.deepEqual(await page.evaluate(() => window.__syncXHR), []);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByText('Showing 51-100 of 154 users', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByText('Showing 101-150 of 154 users', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByText('Showing 151-154 of 154 users', { exact: true })
    .waitFor();
  assert(
    await page.getByRole('button', { name: 'Next', exact: true }).isDisabled(),
  );
  events.push({
    pass: 'First, middle and last server pages; only one initial bounded employee request, no legacy list/category/policy downloads or synchronous XHR',
  });
  await page
    .getByRole('combobox', { name: 'Filter by status', exact: true })
    .selectOption('INACTIVE');
  await page.getByText('Showing 1-50 of 63 users', { exact: true }).waitFor();
  await page
    .getByRole('combobox', { name: 'Filter by role', exact: true })
    .selectOption('MANAGER');
  await page.getByText('No users found', { exact: true }).waitFor();
  await page
    .getByRole('combobox', { name: 'Filter by status', exact: true })
    .selectOption('ACTIVE');
  await page.getByText('Showing 1-26 of 26 users', { exact: true }).waitFor();
  await page
    .getByRole('combobox', { name: 'Filter by role', exact: true })
    .selectOption('');
  await page
    .getByRole('searchbox', { name: 'Filter by department', exact: true })
    .fill('engineering');
  await page.getByText('Showing 1-22 of 22 users', { exact: true }).waitFor();
  await page
    .getByRole('searchbox', { name: 'Filter by department', exact: true })
    .fill('');
  await page
    .getByRole('combobox', { name: 'Filter by status', exact: true })
    .selectOption('');
  await page.getByText('Showing 1-50 of 154 users', { exact: true }).waitFor();
  const search = page.getByRole('searchbox', {
    name: 'Search users',
    exact: true,
  });
  const typingStart = requests.length;
  await search.pressSequentially('Employee 042', { delay: 20 });
  await page.getByText('Showing 1-1 of 1 users', { exact: true }).waitFor();
  await page.getByText('Employee 042 Test', { exact: true }).waitFor();
  assert.equal(
    requests
      .slice(typingStart)
      .filter((r) => r === 'GET /api/v1/tenant/configuration/employees').length,
    1,
  );
  await search.fill('no-such-employee');
  await page.getByText('No users found', { exact: true }).waitFor();
  events.push({
    pass: 'Status/role/department filters reset to page one; search/no results; rapid typing sends one debounced request',
  });
  let releaseOld, oldHeld;
  const held = new Promise((resolve) => (oldHeld = resolve));
  const gate = new Promise((resolve) => (releaseOld = resolve));
  let oldFinished;
  const finished = new Promise((resolve) => (oldFinished = resolve));
  await page.route(
    '**/api/v1/tenant/configuration/employees?**',
    async (route) => {
      if (
        new URL(route.request().url()).searchParams.get('search') ===
        'Employee 010'
      ) {
        const response = await route.fetch();
        oldHeld();
        await gate;
        await route.fulfill({ response });
        oldFinished();
      } else await route.continue();
    },
  );
  await search.fill('Employee 010');
  await held;
  await page.getByText('Loading users…', { exact: true }).waitFor();
  await search.fill('Employee 020');
  await page.getByText('Employee 020 Test', { exact: true }).waitFor();
  releaseOld();
  await finished;
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]'),
  );
  assert.equal(
    await page.getByText('Employee 010 Test', { exact: true }).count(),
    0,
  );
  await page.getByText('Employee 020 Test', { exact: true }).waitFor();
  await page.unroute('**/api/v1/tenant/configuration/employees?**');
  events.push({
    pass: 'Delayed older HTTP response cannot replace newer search results',
  });
  await search.fill('Employee 002');
  await page.getByText('Employee 002 Test', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Disable Employee 002 Test', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Enable Employee 002 Test', exact: true })
    .waitFor();
  assert.equal(
    (
      await prisma.tenantUser.findUniqueOrThrow({
        where: { employeeId: employeePrefix + '-002' },
      })
    ).status,
    'INACTIVE',
  );
  await search.fill('Manual Employee');
  await page.getByText('No users found', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page
    .getByText('26 active managers · Page 1 of 2', { exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'Next managers', exact: true })
    .click();
  await page
    .getByText('26 active managers · Page 2 of 2', { exact: true })
    .waitFor();
  const manager = await prisma.tenantUser.findUniqueOrThrow({
    where: { employeeId: employeePrefix + '-M25' },
  });
  await page.locator('#manage-user-manager').selectOption(manager.id);
  for (const [id, value] of Object.entries({
    'first-name': 'Manual',
    'last-name': 'Employee',
    email: employeePrefix + '-manual@example.test',
    'employee-id': employeePrefix + '-manual',
    department: 'Operations',
    password: password,
  }))
    await page.locator('#manage-user-' + id).fill(value);
  const manualStart = requests.length;
  await page
    .getByRole('button', { name: 'Add User', exact: true })
    .last()
    .click();
  await page.getByText('Manual Employee', { exact: true }).waitFor();
  await page
    .getByRole('cell', { name: 'Manager 25 Test', exact: true })
    .waitFor();
  assert.deepEqual(requests.slice(manualStart), [
    'POST /api/v1/tenant/configuration/users',
    'GET /api/v1/tenant/configuration/employees',
  ]);
  assert.equal(
    (
      await prisma.tenantUser.findUniqueOrThrow({
        where: { employeeId: employeePrefix + '-manual' },
      })
    ).managerId,
    manager.id,
  );
  events.push({
    pass: 'Status mutation refreshes current search; manual Add User uses second-page manager; off-page reporting name displayed without employee requests',
  });
  await page
    .getByRole('button', { name: 'Edit Manual Employee', exact: true })
    .click();
  assert.equal(
    await page.locator('#manage-user-employee-id').isDisabled(),
    true,
  );
  assert.equal(await page.locator('.category-success-toast').count(), 0);
  assert.equal(await page.locator('#manage-user-password').count(), 0);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(350);
    const footer = await page
      .getByRole('button', { name: 'Save Changes', exact: true })
      .boundingBox();
    assert.ok(footer && footer.y >= 0 && footer.y + footer.height <= 900);
    await page.screenshot({
      path: path.join(backend, '.tmp', `employee-edit-${width}.png`),
      fullPage: true,
    });
  }
  await page.locator('#manage-user-department').fill('Quality Assurance');
  const editStart = requests.length;
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Edit User', exact: true })
    .waitFor({ state: 'hidden' });
  assert.deepEqual(requests.slice(editStart), [
    'PATCH /api/v1/tenant/configuration/users/' +
      (
        await prisma.tenantUser.findUniqueOrThrow({
          where: { employeeId: employeePrefix + '-manual' },
        })
      ).id,
    'GET /api/v1/tenant/configuration/employees',
  ]);
  assert.equal(
    (
      await prisma.tenantUser.findUniqueOrThrow({
        where: { employeeId: employeePrefix + '-manual' },
      })
    ).department,
    'Quality Assurance',
  );
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  for (const [field, value] of Object.entries({
    'first-name': 'Invalid',
    'last-name': 'Employee',
    email: 'valid@example.test',
    'employee-id': 'bad id',
    password: password,
  }))
    await page.locator('#manage-user-' + field).fill(value);
  const invalidStart = requests.length;
  await page
    .getByRole('dialog', { name: 'Add New User', exact: true })
    .getByRole('button', { name: 'Add User', exact: true })
    .click();
  await page.locator('#employee-error-employeeId').waitFor();
  assert.equal(
    requests.slice(invalidStart).filter((r) => r.startsWith('POST')).length,
    0,
  );
  await page
    .locator('#manage-user-employee-id')
    .fill(employeePrefix + '-corrected');
  assert.equal(await page.locator('#employee-error-employeeId').count(), 0);
  await page.keyboard.press('Escape');
  events.push({
    pass: 'Profile edit persists through existing PATCH, stable login ID/credentials preserved; invalid IDs send no POST; inline errors clear; modal footer visible at all three widths',
  });
  // Explicitly exercise same-page refresh after an imported row appears.
  await search.fill(employeePrefix + '-bulk');
  await page.getByText('No users found', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Bulk Import', exact: true }).click();
  await page.getByText('No import jobs yet.', { exact: true }).waitFor();
  const csv =
    'employeeId,firstName,lastName,email\n' +
    employeePrefix +
    '-bulk,Bulk,Employee,' +
    employeePrefix +
    '-bulk@example.test\n';
  await page.locator('#employee-import-file').setInputFiles({
    name: 'employees.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Clear file', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: 'Validate CSV', exact: true })
      .isDisabled(),
    true,
  );
  await page
    .locator('#employee-import-file')
    .setInputFiles({
      name: 'employees.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
  await page.getByRole('button', { name: 'Validate CSV', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Import READY', exact: true })
    .waitFor();
  await page.getByRole('checkbox', { name: /I reviewed the rows/ }).check();
  const bulkStart = requests.length;
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Import COMPLETED', exact: true })
    .waitFor();
  await page.getByText('Bulk Employee', { exact: true }).waitFor();
  assert(
    requests
      .slice(bulkStart)
      .every(
        (r) =>
          r.includes('/employee-imports') ||
          r === 'GET /api/v1/tenant/configuration/employees',
      ),
  );
  assert.equal(
    requests
      .slice(bulkStart)
      .filter((r) => r === 'GET /api/v1/tenant/configuration/employees').length,
    1,
  );
  events.push({
    pass: 'Bulk completion refreshes exactly one bounded employee page with current search; no roles or unrelated refresh',
  });
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(
      (width) =>
        width > 900 ||
        parseFloat(
          getComputedStyle(document.querySelector('.main-content')).marginLeft,
        ) === 0,
      width,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await page.getByText('Showing 1-50 of 156 users', { exact: true }).waitFor();
  await page.locator('#sidebar-logout').click();
  await login(page, primary.slug);
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByText('Showing 1-50 of 156 users', { exact: true }).waitFor();
  await page.goto(base + '/views/config-manager/user-hierarchy.html');
  await page
    .getByRole('searchbox', { name: 'Find employee or manager' })
    .fill('Employee 126');
  await page.getByText('Employee 126 Test', { exact: true }).first().waitFor();
  await page
    .getByRole('searchbox', { name: 'Find employee or manager' })
    .fill('Manager 25');
  await page.getByText('Manager 25 Test', { exact: true }).first().waitFor();
  events.push({
    pass: '375/768/1280 px layouts, browser refresh and relogin; User Hierarchy can search all employees through bounded server queries',
  });
  await page.goto(base + '/legacy/views/config-manager/manage-users.html');
  await page.getByText('Employee 126 Test', { exact: true }).waitFor();
  assert.equal(await page.locator('#users-tbody tr').count(), 156);
  await page.goto(base + '/legacy/views/config-manager/user-hierarchy.html');
  await page.getByText('Employee 126 Test', { exact: true }).first().waitFor();
  await page.getByText('Manager 25 Test', { exact: true }).first().waitFor();
  events.push({
    pass: 'Legacy Manage Users and User Hierarchy execute existing scripts with HEAD HTML fixtures and retain all 156 tenant users',
  });
  const isolated = await browser.newContext();
  const otherPage = await isolated.newPage();
  await login(otherPage, other.slug);
  await otherPage.goto(base + '/views/config-manager/manage-users.html');
  await otherPage
    .getByText('Showing 1-1 of 1 users', { exact: true })
    .waitFor();
  await otherPage
    .getByRole('searchbox', { name: 'Search users', exact: true })
    .fill(employeePrefix);
  await otherPage.getByText('No users found', { exact: true }).waitFor();
  await isolated.close();
  assert.deepEqual(consoleErrors, []);
  assert.equal(events.filter((e) => e.error).length, 0);
  events.push({
    pass: 'Other tenant employee search isolated; no browser console/page errors',
  });
  console.log(JSON.stringify(events, null, 2));
  fs.writeFileSync(
    path.join(backend, '.tmp', 'employee-pagination-browser-results.json'),
    JSON.stringify({ schema: state.schema, dataset: 154, events }, null, 2),
  );
})()
  .catch(async (error) => {
    if (debugPage && !debugPage.isClosed()) {
      console.error(await debugPage.locator('body').innerText());
      await debugPage.screenshot({
        path: path.join(backend, '.tmp', 'employee-pagination-failure.png'),
        fullPage: true,
      });
    }
    console.error(error.stack);
    console.error('Completed checks:', JSON.stringify(events));
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await stopApi();
    if (staticServer)
      await new Promise((resolve) => staticServer.close(resolve));
    await prisma.expensePolicy.deleteMany({
      where: { organizationId: { in: fixtureIds } },
    });
    await prisma.expenseCategory.deleteMany({
      where: { organizationId: { in: fixtureIds } },
    });
    await prisma.employeeImportJob.deleteMany({
      where: { organizationId: { in: fixtureIds } },
    });
    await prisma.tenantUser.deleteMany({
      where: { organizationId: { in: fixtureIds } },
    });
    await prisma.organizationSubscription.deleteMany({
      where: { organizationId: { in: fixtureIds }, planId: subscriptionPlanId },
    });
    await prisma.organization.deleteMany({ where: { id: { in: fixtureIds } } });
    await prisma.plan.deleteMany({ where: { id: subscriptionPlanId } });
    await prisma.$disconnect();
  });
