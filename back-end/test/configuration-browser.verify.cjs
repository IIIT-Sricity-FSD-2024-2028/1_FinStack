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
let api, browser, staticServer;
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
      api.once('exit', resolve);
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
  page.on('pageerror', (error) => events.push({ error: error.message }));
  const requests = [];
  page.on('request', (req) => {
    if (req.url().startsWith(apiBase))
      requests.push(req.method() + ' ' + new URL(req.url()).pathname);
  });
  await login(page, primary.slug);
  await page.goto(base + '/views/config-manager/expense-categories.html');
  await page.getByRole('button', { name: 'Add Category', exact: true }).click();
  await page.locator('#category-name').fill('Browser Travel');
  await page.locator('#category-description').fill('Created through React UI');
  await page
    .getByRole('button', { name: 'Save Category', exact: true })
    .click();
  await visible(page, 'Browser Travel');
  const category = await prisma.expenseCategory.findFirstOrThrow({
    where: { organizationId: primary.id, name: 'Browser Travel' },
  });
  assert.equal(category.description, 'Created through React UI');
  await page.reload();
  await visible(page, 'Browser Travel');
  await page
    .getByRole('row')
    .filter({ hasText: 'Browser Travel' })
    .getByRole('button', { name: 'Edit category', exact: true })
    .click();
  await page.locator('#category-description').fill('Updated through React UI');
  await page
    .getByRole('button', { name: 'Update Category', exact: true })
    .click();
  await visible(page, 'Updated through React UI');
  events.push({
    pass: 'React category create/update/refresh and direct PostgreSQL read',
  });
  await page.goto(base + '/views/config-manager/expense-policies.html');
  await page.getByRole('button', { name: 'Add Policy', exact: true }).click();
  await page.locator('#policy-name').fill('Browser Travel Cap');
  await page.locator('#policy-amount').fill('1450.25');
  const before = requests.length;
  await page.getByRole('button', { name: 'Save Policy', exact: true }).click();
  await visible(page, 'Browser Travel Cap');
  const after = requests.slice(before);
  assert.deepEqual(after, [
    'POST /api/v1/tenant/expenses/configuration/policies',
    'GET /api/v1/tenant/expenses/configuration/policies',
  ]);
  assert.equal(
    (
      await prisma.expensePolicy.findFirstOrThrow({
        where: { organizationId: primary.id, name: 'Browser Travel Cap' },
      })
    ).maxAmount.toString(),
    '1450.25',
  );
  await page.reload();
  await visible(page, 'Browser Travel Cap');
  events.push({
    pass: 'React policy create/refresh/Decimal persistence; policy-only refresh',
    requests: after,
  });
  await page.locator('#sidebar-logout').click();
  await page.waitForURL('**/login.html');
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem('finstackTenantAccessToken'),
    ),
    null,
  );
  await login(page, primary.slug);
  await page.goto(base + '/views/config-manager/expense-policies.html');
  await visible(page, 'Browser Travel Cap');
  await require('./tenant-audit-browser.check.cjs')({page,prisma,organizationId:primary.id,base,apiBase,output:path.join(backend,'.tmp','tenant-audit-verification'),phase:'before-restart'});
  await context.close();
  await stopApi();
  await startApi();
  const fresh = await browser.newContext();
  const reopened = await fresh.newPage();
  await login(reopened, primary.slug);
  await reopened.goto(base + '/views/config-manager/expense-policies.html');
  await visible(reopened, 'Browser Travel Cap');
  events.push({
    pass: 'UI logout/login, browser context reopen, full backend process restart and PostgreSQL persistence',
  });
  await require('./tenant-audit-browser.check.cjs')({page:reopened,prisma,organizationId:primary.id,base,apiBase,output:path.join(backend,'.tmp','tenant-audit-verification'),phase:'after-restart'});
  await reopened.goto(
    base + '/legacy/views/config-manager/expense-categories.html',
  );
  await visible(reopened, 'Browser Travel');
  await reopened
    .getByRole('button', { name: 'Add Category', exact: true })
    .click();
  await reopened.locator('#category-name').fill('Legacy Meals');
  await reopened
    .getByRole('button', { name: 'Save Category', exact: true })
    .click();
  await visible(reopened, 'Legacy Meals');
  assert.ok(
    await prisma.expenseCategory.findFirst({
      where: { organizationId: primary.id, name: 'Legacy Meals' },
    }),
  );
  await reopened.reload();
  await visible(reopened, 'Legacy Meals');
  await reopened.goto(
    base + '/legacy/views/config-manager/expense-policies.html',
  );
  await reopened
    .getByRole('button', { name: 'Add Policy', exact: true })
    .click();
  await reopened.locator('#policy-name').fill('Legacy Meals Cap');
  await reopened
    .locator('#policy-category')
    .selectOption({ label: 'Legacy Meals' });
  await reopened.locator('#policy-amount').fill('450');
  await reopened
    .getByRole('button', { name: 'Save Policy', exact: true })
    .click();
  await visible(reopened, 'Legacy Meals Cap');
  await reopened.reload();
  await visible(reopened, 'Legacy Meals Cap');
  assert.equal(
    (
      await prisma.expensePolicy.findFirstOrThrow({
        where: { organizationId: primary.id, name: 'Legacy Meals Cap' },
      })
    ).maxAmount.toString(),
    '450',
  );
  events.push({
    pass: 'Legacy category and policy forms persist through actual scripts and refresh (HEAD HTML test fixture)',
  });
  const isolated = await browser.newContext();
  const otherPage = await isolated.newPage();
  await login(otherPage, other.slug);
  await otherPage.goto(base + '/views/config-manager/expense-categories.html');
  await otherPage.getByText('No categories found', { exact: true }).waitFor();
  assert.equal(
    await otherPage
      .getByRole('cell', { name: 'Browser Travel', exact: true })
      .count(),
    0,
  );
  await otherPage.goto(base + '/views/config-manager/expense-policies.html');
  await otherPage.getByText('No policies found', { exact: true }).waitFor();
  events.push({
    pass: 'Other tenant UI sees no primary tenant categories or policies',
  });
  await otherPage.goto(base+'/views/config-manager/audit-logs.html');
  await otherPage.getByText('No logs match the current filters.').waitFor();
  events.push({pass:'Other tenant Audit Logs UI cannot see primary tenant events'});
  await fresh.close();
  await isolated.close();
  console.log(JSON.stringify(events, null, 2));
  fs.writeFileSync(
    path.join(backend, '.tmp', 'configuration-browser-results.json'),
    JSON.stringify({ schema: state.schema, events }, null, 2),
  );
})()
  .catch((error) => {
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
    await prisma.tenantUser.deleteMany({
      where: { organizationId: { in: fixtureIds } },
    });
    await prisma.organization.deleteMany({ where: { id: { in: fixtureIds } } });
    await prisma.$disconnect();
  });
