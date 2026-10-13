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
  for (const suffix of ['primary', 'other']) {
    const organization = await prisma.organization.create({
      data: {
        name: 'Disposable browser ' + suffix,
        slug: 'browser-' + randomUUID(),
        primaryEmail: randomUUID() + '@example.test',
      },
    });
    fixtureIds.push(organization.id);
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
        /\/views\/config-manager\/expense-(categories|policies)\.html$/.test(
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
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const requests = [];
  page.on('request', (req) => {
    if (req.url().startsWith(apiBase))
      requests.push(req.method() + ' ' + new URL(req.url()).pathname);
  });
  await login(page, primary.slug);
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByRole('button', { name: 'Add User', exact: true }).waitFor();
  const initialRequests = requests.length;
  await page.getByRole('button', { name: 'Bulk Import', exact: true }).click();
  await page.getByText('No import jobs yet.', { exact: true }).waitFor();
  assert.deepEqual(requests.slice(initialRequests), [
    'GET /api/v1/tenant/configuration/employee-imports',
  ]);
  const templateDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download CSV template', exact: true })
    .click();
  const template = fs.readFileSync(
    await (await templateDownload).path(),
    'utf8',
  );
  assert.equal(
    template.trim(),
    'employeeId,firstName,lastName,email,department,role,managerEmployeeId',
  );
  const employee = 'BULK-' + randomUUID().slice(0, 8);
  const csv =
    template.trimEnd() +
    '\n' +
    `${employee},Anita,Sharma,${employee}@example.test,Engineering,EXPENSE_SUBMITTER,\nBAD-${employee},Invalid,Role,bad@example.test,General,CONFIGURATION_MANAGER,\n`;
  await page.locator('#employee-import-file').setInputFiles({
    name: 'employees.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Validate CSV', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Import READY', exact: true })
    .waitFor();
  assert.equal(
    await prisma.tenantUser.count({ where: { employeeId: employee } }),
    0,
  );
  await page.getByText(/Bulk import permits EXPENSE_SUBMITTER only/).waitFor();
  assert(
    await page
      .getByRole('button', { name: 'Confirm import', exact: true })
      .isDisabled(),
  );
  await page.getByRole('checkbox', { name: /I reviewed the rows/ }).check();
  const mutationRequests = requests.length;
  await page
    .getByRole('button', { name: 'Confirm import', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Import COMPLETED', exact: true })
    .waitFor();
  await page.getByText('Anita Sharma', { exact: true }).waitFor();
  const user = await prisma.tenantUser.findUniqueOrThrow({
    where: { employeeId: employee },
  });
  assert.equal(user.organizationId, primary.id);
  assert.equal(user.status, 'INACTIVE');
  assert.equal(user.credentialSetupRequired, true);
  assert(
    requests
      .slice(mutationRequests)
      .every(
        (r) =>
          r.includes('/configuration/employee-imports') ||
          r === 'GET /api/v1/tenant/configuration/employees',
      ),
  );
  const errorDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download row errors', exact: true })
    .click();
  assert(
    fs
      .readFileSync(await (await errorDownload).path(), 'utf8')
      .includes('Bulk import permits'),
  );
  page.once('dialog', (dialog) => dialog.accept());
  const linksDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download activation links', exact: true })
    .click();
  const links = fs.readFileSync(await (await linksDownload).path(), 'utf8');
  const activation = links.match(
    /http[^"\r\n]+activate-account\.html#[^"\r\n]+/,
  )[0];
  const stored = await prisma.tenantUser.findUniqueOrThrow({
    where: { employeeId: employee },
  });
  assert.equal(stored.activationTokenHash.length, 64);
  assert(!links.includes(stored.activationTokenHash));
  events.push({
    pass: 'React template/upload/mixed preview/explicit confirm/background completion/error export/activation download, PostgreSQL read, affected users only',
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
      await page
        .getByRole('button', { name: 'Refresh job', exact: true })
        .isVisible(),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  events.push({
    pass: '375, 768 and 1280 pixel layouts; no document overflow',
  });
  await require('./tenant-notifications-browser.check.cjs').before(page, {
    prisma,
    organizationId: primary.id,
    base,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await page.getByRole('button', { name: 'Bulk Import', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Import COMPLETED', exact: true })
    .waitFor();
  await page.locator('#sidebar-logout').click();
  await login(page, primary.slug);
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByText('Anita Sharma', { exact: true }).waitFor();
  await page.evaluate(() => window.FinStackStore?.ready);
  await page.waitForLoadState('networkidle');
  await stopApi();
  await startApi();
  await page.reload();
  await page.getByRole('button', { name: 'Bulk Import', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Import COMPLETED', exact: true })
    .waitFor();
  await context.close();
  const fresh = await browser.newContext();
  const reopened = await fresh.newPage();
  await login(reopened, primary.slug);
  await reopened.goto(base + '/views/config-manager/manage-users.html');
  await reopened.getByText('Anita Sharma', { exact: true }).waitFor();
  events.push({
    pass: 'Refresh, UI logout/login, full backend process restart and fresh browser context preserve users and jobs',
  });
  await require('./tenant-notifications-browser.check.cjs').after(reopened, {
    prisma,
    organizationId: primary.id,
    base,
    stopApi,
    startApi,
    login,
    slug: primary.slug,
  });
  await reopened.getByRole('button', { name: 'Add User', exact: true }).click();
  for (const [id, value] of Object.entries({
    'first-name': 'Manual',
    'last-name': 'Employee',
    email: employee + '-manual@example.test',
    'employee-id': employee + '-manual',
    department: 'Operations',
    password: password,
  }))
    await reopened.locator('#manage-user-' + id).fill(value);
  const manualRequests = [];
  reopened.on('request', (req) => {
    if (req.url().startsWith(apiBase))
      manualRequests.push(req.method() + ' ' + new URL(req.url()).pathname);
  });
  await reopened
    .getByRole('button', { name: 'Add User', exact: true })
    .last()
    .click();
  await reopened.getByText('Manual Employee', { exact: true }).waitFor();
  assert.deepEqual(manualRequests, [
    'POST /api/v1/tenant/configuration/users',
    'GET /api/v1/tenant/configuration/employees',
  ]);
  assert.equal(
    (
      await prisma.tenantUser.findUniqueOrThrow({
        where: { employeeId: employee + '-manual' },
      })
    ).credentialSetupRequired,
    false,
  );
  events.push({
    pass: 'Manual Add User preserved; only users refresh, no roles/categories/policies requests',
  });
  const activationContext = await browser.newContext();
  const activate = await activationContext.newPage();
  activate.on('pageerror', (error) => events.push({ error: error.message }));
  await activate.goto(activation);
  assert.equal(new URL(activate.url()).hash, '');
  await activate.locator('#activation-password').fill(password);
  await activate.locator('#activation-confirm').fill(password);
  await activate
    .getByRole('button', { name: 'Set password', exact: true })
    .click();
  await activate
    .getByText('Your password is set. Sign in with your employee ID.', {
      exact: true,
    })
    .waitFor();
  await activate.goto(base + '/login.html');
  await activate.locator('#employee-id').fill(employee);
  await activate.locator('#password-input').fill(password);
  await activate.locator('#login-form button[type="submit"]').click();
  await activate.waitForURL('**/views/submitter/dashboard.html');
  events.push({
    pass: 'Employee sets own password with single-use link then signs in through existing Employee ID-only JWT login',
  });
  const isolated = await browser.newContext();
  const otherPage = await isolated.newPage();
  await login(otherPage, other.slug);
  await otherPage.goto(base + '/views/config-manager/manage-users.html');
  await otherPage
    .getByRole('button', { name: 'Bulk Import', exact: true })
    .click();
  await otherPage.getByText('No import jobs yet.', { exact: true }).waitFor();
  assert.equal(
    await otherPage.getByText('Anita Sharma', { exact: true }).count(),
    0,
  );
  events.push({
    pass: 'Other tenant sees neither imported users nor import jobs',
  });
  assert.deepEqual(consoleErrors, []);
  assert.equal(events.filter((e) => e.error).length, 0);
  events.push({ pass: 'No browser console or page errors' });
  console.log(JSON.stringify(events, null, 2));
  fs.writeFileSync(
    path.join(backend, '.tmp', 'employee-import-browser-results.json'),
    JSON.stringify({ schema: state.schema, events }, null, 2),
  );
  await activationContext.close();
  await isolated.close();
  await fresh.close();
})()
  .catch(async (error) => {
    if (debugPage && !debugPage.isClosed()) {
      console.error(await debugPage.locator('body').innerText());
      await debugPage.screenshot({
        path: path.join(backend, '.tmp', 'employee-import-failure.png'),
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
    await prisma.organization.deleteMany({ where: { id: { in: fixtureIds } } });
    await prisma.$disconnect();
  });
