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
function record(event) {
  events.push(event);
  console.log(JSON.stringify(event));
}
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
  fs.writeFileSync(
    path.join(backend, '.tmp', 'tenant-hierarchy-owned-fixtures.json'),
    JSON.stringify(fixtureIds),
  );
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
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  debugPage = page;
  page.on('pageerror', (error) => record({ error: error.message }));
  const consoleErrors = [];
  const expectedConsoleErrors = [];
  let expectBranchFailure = false;
  page.on('console', (message) => {
    if (message.type() === 'error') {
      if (expectBranchFailure && message.text().includes('503'))
        expectedConsoleErrors.push(message.text());
      else consoleErrors.push(message.text());
    }
  });
  const requests = [];
  page.on('request', (req) => {
    if (req.url().startsWith(apiBase))
      requests.push(req.method() + ' ' + new URL(req.url()).pathname);
  });
  const prefix = 'HUI-' + randomUUID().slice(0, 8),
    fixtureHash = await argon2.hash(password);
  async function person(
    name,
    role = 'EXPENSE_SUBMITTER',
    status = 'ACTIVE',
    managerId = null,
  ) {
    return prisma.tenantUser.create({
      data: {
        organizationId: primary.id,
        employeeId: prefix + '-' + name,
        firstName: name,
        lastName: 'Test',
        email: prefix + '-' + name + '@example.test',
        passwordHash: fixtureHash,
        role,
        status,
        managerId,
        department: 'Engineering',
      },
    });
  }
  const alpha = await person('Alpha', 'FINANCE_OFFICER'),
    bravo = await person('Bravo', 'MANAGER'),
    charlie = await person('Charlie'),
    inactive = await person('Inactive', 'MANAGER', 'INACTIVE');
  await prisma.tenantUser.createMany({
    data: [
      ...Array.from({ length: 1000 }, (_, i) => ({
        organizationId: primary.id,
        employeeId: prefix + '-' + i,
        firstName: 'Report ' + String(i).padStart(4, '0'),
        lastName: 'Test',
        email: prefix + '-' + i + '@example.test',
        passwordHash: fixtureHash,
        managerId: bravo.id,
        department: i % 2 ? 'Engineering' : 'Operations',
      })),
      ...Array.from({ length: 26 }, (_, i) => ({
        organizationId: primary.id,
        employeeId: prefix + '-M' + i,
        firstName: 'Manager ' + String(i).padStart(2, '0'),
        lastName: 'Test',
        email: prefix + '-M' + i + '@example.test',
        passwordHash: fixtureHash,
        role: 'MANAGER',
        department: 'Management',
      })),
    ],
  });
  await page.addInitScript(() => {
    window.__syncXHR = 0;
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, ...rest) {
      if (async === false) window.__syncXHR++;
      return open.call(this, method, url, async, ...rest);
    };
  });
  await login(page, primary.slug);
  requests.length = 0;
  const network = [];
  page.on('response', async (response) => {
    if (response.url().includes('/configuration/hierarchy')) {
      try {
        const bytes = (await response.body()).length;
        network.push({ path: new URL(response.url()).pathname, bytes });
      } catch {}
    }
  });
  const url = base + '/views/config-manager/user-hierarchy.html';
  const tree = () => page.locator('.hierarchy-tree');
  const select = async (name) => {
    await tree()
      .getByRole('button')
      .filter({ has: page.locator('strong', { hasText: name }) })
      .first()
      .click();
    await page
      .getByRole('complementary', { name: 'Employee details' })
      .getByRole('heading', { name, exact: true })
      .waitFor();
  };
  const detail = () =>
    page.getByRole('complementary', { name: 'Employee details' });
  const branchCalls = () =>
    requests.filter(
      (r) => r === 'GET /api/v1/tenant/configuration/hierarchy/branches',
    ).length;
  await page.goto(url);
  await tree().getByText('Bravo Test', { exact: true }).waitFor();
  assert.equal(await tree().locator('.hierarchy-person-row').count(), 20);
  assert.equal(branchCalls(), 1);
  assert.equal(
    requests.filter((r) => r === 'GET /api/v1/tenant/configuration/hierarchy')
      .length,
    1,
  );
  assert.equal(
    requests.filter((r) =>
      /\/configuration\/(users|roles)$|\/expenses\/(configuration\/)?(categories|policies)$/.test(
        r,
      ),
    ).length,
    0,
  );
  assert.equal(await page.evaluate(() => window.__syncXHR), 0);
  record({
    pass: '1,031 employees: initial roots bounded to 20; one branch and one overview request; no full users, roles, categories, policies or synchronous XHR',
  });
  let before = branchCalls();
  await page
    .getByRole('button', { name: 'Expand reports of Bravo Test', exact: true })
    .click();
  const reports = () =>
    page.getByRole('region', { name: 'Reports of Bravo Test', exact: true });
  await reports().getByText('Report 0000 Test', { exact: true }).waitFor();
  assert.equal(await reports().locator('.hierarchy-person-row').count(), 20);
  assert.equal(branchCalls() - before, 1);
  await reports().getByRole('button', { name: 'Next', exact: true }).click();
  await reports().getByText('Report 0020 Test', { exact: true }).waitFor();
  await reports()
    .getByRole('button', { name: 'Previous', exact: true })
    .click();
  await reports().getByText('Report 0000 Test', { exact: true }).waitFor();
  before = branchCalls();
  await page
    .getByRole('button', {
      name: 'Collapse reports of Bravo Test',
      exact: true,
    })
    .click();
  assert.equal(branchCalls(), before);
  record({
    pass: 'Expand fetches only one direct-report page; branch next/previous pagination and collapse work',
  });
  // Hold one expansion response, collapse it, and open a fresh branch instance.
  let heldResolve;
  const held = new Promise((resolve) => (heldResolve = resolve));
  let releaseResolve;
  const release = new Promise((resolve) => (releaseResolve = resolve));
  let deliveredResolve;
  const delivered = new Promise((resolve) => (deliveredResolve = resolve));
  const interceptionErrors = [];
  let delayed = false;
  await page.route('**/configuration/hierarchy/branches?**', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (!delayed && q.get('managerId') === bravo.id) {
      delayed = true;
      try {
        const response = await route.fetch();
        heldResolve();
        await release;
        await route.fulfill({ response });
      } catch (error) {
        interceptionErrors.push(error.message);
        heldResolve();
      } finally {
        deliveredResolve();
      }
    } else await route.continue();
  });
  try {
    await page
      .getByRole('button', {
        name: 'Expand reports of Bravo Test',
        exact: true,
      })
      .click();
    await held;
    await reports()
      .getByText('Loading reporting branch...', { exact: true })
      .waitFor();
    await page
      .getByRole('button', {
        name: 'Collapse reports of Bravo Test',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', {
        name: 'Expand reports of Bravo Test',
        exact: true,
      })
      .click();
    await reports().getByText('Report 0000 Test', { exact: true }).waitFor();
  } finally {
    releaseResolve();
    if (delayed) await delivered;
    await page.unroute('**/configuration/hierarchy/branches?**');
  }
  assert.deepEqual(interceptionErrors, []);
  record({
    pass: 'Rapid expand/collapse with a delayed obsolete response preserves the current branch',
  });
  await select('Charlie Test');
  await detail()
    .getByRole('button', { name: 'Change manager', exact: true })
    .click();
  await page
    .getByLabel('Find reporting manager', { exact: true })
    .fill('Alpha');
  await page
    .locator('#hierarchy-manager option[value="' + alpha.id + '"]')
    .waitFor({ state: 'attached' });
  await page
    .getByLabel('Reporting manager', { exact: true })
    .selectOption(alpha.id);
  await detail()
    .getByRole('button', { name: 'Save manager', exact: true })
    .click();
  await page.getByText('Reporting manager saved.', { exact: true }).waitFor();
  await detail()
    .getByRole('button', { name: 'Change manager', exact: true })
    .waitFor();
  assert.equal(
    (await prisma.tenantUser.findUniqueOrThrow({ where: { id: charlie.id } }))
      .managerId,
    alpha.id,
  );
  // Reassign to a different manager and then remove the link.
  await detail()
    .getByRole('button', { name: 'Change manager', exact: true })
    .click();
  await page
    .getByLabel('Find reporting manager', { exact: true })
    .fill('Bravo');
  await page
    .locator('#hierarchy-manager option[value="' + bravo.id + '"]')
    .waitFor({ state: 'attached' });
  await page
    .getByLabel('Reporting manager', { exact: true })
    .selectOption(bravo.id);
  await detail()
    .getByRole('button', { name: 'Save manager', exact: true })
    .click();
  await page.getByText('Reporting manager saved.', { exact: true }).waitFor();
  await detail()
    .getByRole('button', { name: 'Change manager', exact: true })
    .waitFor();
  assert.equal(
    (await prisma.tenantUser.findUniqueOrThrow({ where: { id: charlie.id } }))
      .managerId,
    bravo.id,
  );
  await page
    .getByRole('button', {
      name: 'Collapse reports of Bravo Test',
      exact: true,
    })
    .waitFor();
  await reports()
    .getByText(/Page 1 of 51 . 1001 people/)
    .waitFor();
  await tree()
    .locator(
      '[data-employee-id="' + alpha.employeeId + '"] > .hierarchy-person-row',
    )
    .getByText(/0 direct reports . Active/)
    .waitFor();
  await detail()
    .getByRole('button', { name: 'Change manager', exact: true })
    .click();
  await page.getByLabel('Reporting manager', { exact: true }).selectOption('');
  await detail()
    .getByRole('button', { name: 'Save manager', exact: true })
    .click();
  await page.getByText('Reporting manager saved.', { exact: true }).waitFor();
  await detail()
    .getByRole('button', { name: 'Change manager', exact: true })
    .waitFor();
  assert.equal(
    (await prisma.tenantUser.findUniqueOrThrow({ where: { id: charlie.id } }))
      .managerId,
    null,
  );
  record({
    pass: 'UI assignment to a finance-role manager, reassignment and removal persist in PostgreSQL; affected reporting branches refresh',
  });
  const token = await page.evaluate(
    () => window.FinStackTenantSession.getTenantSession().accessToken,
  );
  async function apiRequest(pathname, method = 'GET', body) {
    const response = await fetch(
      apiBase + '/api/v1/tenant/configuration' + pathname,
      {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: response.status, body: await response.json() };
  }
  assert.equal(
    (
      await apiRequest('/users/' + charlie.id + '/reporting', 'PATCH', {
        managerId: alpha.id,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await apiRequest('/users/' + alpha.id + '/reporting', 'PATCH', {
        managerId: charlie.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await apiRequest('/users/' + charlie.id + '/reporting', 'PATCH', {
        managerId: charlie.id,
      })
    ).status,
    409,
  );
  const foreign = await prisma.tenantUser.findFirst({
    where: { organizationId: other.id },
  });
  assert.equal(
    (
      await apiRequest('/users/' + charlie.id + '/reporting', 'PATCH', {
        managerId: foreign.id,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await apiRequest('/users/' + alpha.id + '/status', 'PATCH', {
        status: 'INACTIVE',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await apiRequest('/users/' + bravo.id + '/reporting', 'PATCH', {
        managerId: alpha.id,
      })
    ).status,
    409,
  );
  await page.reload();
  await tree().getByText('Alpha Test', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Expand reports of Alpha Test', exact: true })
    .click();
  await tree().getByText('Charlie Test', { exact: true }).waitFor();
  await select('Charlie Test');
  await detail()
    .getByText(/The reporting manager is inactive/)
    .waitFor();
  assert.equal(
    (await prisma.tenantUser.findUniqueOrThrow({ where: { id: charlie.id } }))
      .managerId,
    alpha.id,
  );
  record({
    pass: 'Actual authenticated API rejects self/circular/foreign/inactive assignment; UI preserves and flags existing inactive-manager links',
  });
  assert.equal(
    (
      await apiRequest('/users/' + alpha.id + '/status', 'PATCH', {
        status: 'ACTIVE',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await apiRequest('/users/' + alpha.id + '/reporting', 'PATCH', {
        managerId: bravo.id,
      })
    ).status,
    200,
  );
  // Search finds a deeply linked employee without loading its sibling branches.
  await page.goto(url);
  await tree().getByText('Bravo Test', { exact: true }).waitFor();
  before = branchCalls();
  await page
    .getByRole('searchbox', { name: 'Find employee or manager' })
    .pressSequentially('Charlie', { delay: 20 });
  await tree().getByText('Charlie Test', { exact: true }).waitFor();
  assert.equal(branchCalls() - before, 1);
  await select('Charlie Test');
  const pathNav = detail().getByRole('navigation', {
    name: 'Reporting ancestor path',
  });
  await pathNav
    .getByRole('button', { name: 'Bravo Test', exact: true })
    .waitFor();
  await pathNav
    .getByRole('button', { name: 'Alpha Test', exact: true })
    .click();
  await tree()
    .getByRole('heading', { name: 'Direct reports of Alpha Test' })
    .waitFor();
  await tree().getByText('Charlie Test', { exact: true }).waitFor();
  record({
    pass: 'Debounced targeted search finds deep employees; ancestor path navigates to bounded immediate reports',
  });
  // Manager selection itself is paginated and not restricted to a UI role.
  await detail()
    .getByRole('button', { name: 'Change manager', exact: true })
    .click();
  await page
    .getByLabel('Find reporting manager', { exact: true })
    .fill('Manager');
  await detail()
    .getByRole('navigation', { name: 'Eligible manager pages' })
    .getByText('Page 1 of 2 · 26 people', { exact: true })
    .waitFor();
  await detail()
    .getByRole('navigation', { name: 'Eligible manager pages' })
    .getByRole('button', { name: 'Next', exact: true })
    .click();
  await page
    .locator('#hierarchy-manager option')
    .filter({ hasText: 'Manager 25 Test' })
    .waitFor({ state: 'attached' });
  await detail().getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Hierarchy department' })
    .selectOption('Operations');
  await tree().getByRole('heading', { name: 'Operations employees' }).waitFor();
  await tree().getByText('Report 0000 Test', { exact: true }).waitFor();
  assert.equal(await tree().locator('.hierarchy-person-row').count(), 20);
  await page
    .getByRole('button', {
      name: 'Organization roots / unassigned',
      exact: true,
    })
    .click();
  await tree().getByText('Bravo Test', { exact: true }).waitFor();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        (innerWidth > 900 ||
          (getComputedStyle(document.querySelector('.main-content'))
            .marginLeft === '0px' &&
            getComputedStyle(document.querySelector('.topnav')).left ===
              '0px')),
      undefined,
      { timeout: 3000 },
    );
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.right > innerWidth + 1 &&
            getComputedStyle(e).visibility !== 'hidden'
          );
        })
        .slice(0, 15)
        .map((e) => ({
          tag: e.tagName,
          cls: e.className,
          width: e.getBoundingClientRect().width,
          left: e.getBoundingClientRect().left,
          display: getComputedStyle(e).display,
        })),
    }));
    if (overflow.scroll > width)
      console.log('OVERFLOW', JSON.stringify(overflow));
    assert(overflow.scroll <= width);
    await page.screenshot({
      path: path.join(backend, '.tmp', 'tenant-hierarchy-' + width + '.png'),
      fullPage: true,
    });
    if (width === 375) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page
        .getByRole('button', { name: 'Close menu', exact: true })
        .click();
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await tree().getByText('Bravo Test', { exact: true }).waitFor();
  await page.locator('#sidebar-logout').click();
  await login(page, primary.slug);
  await page.goto(url);
  await tree().getByText('Bravo Test', { exact: true }).waitFor();
  await page.evaluate(() => window.FinStackStore?.ready);
  await page.waitForLoadState('networkidle');
  await stopApi();
  await startApi();
  await page.reload();
  await tree().getByText('Bravo Test', { exact: true }).waitFor();
  assert.equal(
    (await prisma.tenantUser.findUniqueOrThrow({ where: { id: charlie.id } }))
      .managerId,
    alpha.id,
  );
  record({
    pass: 'Paginated eligible managers and real department grouping; mobile/tablet/desktop no overflow; refresh, logout/login and graceful backend restart retain links',
  });
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByText('Showing 1-50 of 1031 users', { exact: true }).waitFor();
  await page
    .getByRole('searchbox', { name: 'Search users', exact: true })
    .fill('Charlie');
  await page.getByText('Showing 1-1 of 1 users', { exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Alpha Test', exact: true }).waitFor();
  await page.goto(url);
  await tree().getByText('Bravo Test', { exact: true }).waitFor();
  await page
    .getByRole('searchbox', { name: 'Find employee or manager' })
    .fill('NoSuchHierarchyEmployee');
  await tree()
    .getByText('No employees in this view.', { exact: true })
    .waitFor();
  expectBranchFailure = true;
  let injected = false;
  await page.route('**/configuration/hierarchy/branches?**', async (route) => {
    if (!injected) {
      injected = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Test branch unavailable' },
        }),
      });
    } else await route.continue();
  });
  await page
    .getByRole('searchbox', { name: 'Find employee or manager' })
    .fill('Charlie');
  await tree().getByRole('alert').waitFor();
  await tree().getByRole('button', { name: 'Try Again', exact: true }).click();
  await tree().getByText('Charlie Test', { exact: true }).waitFor();
  await page.unroute('**/configuration/hierarchy/branches?**');
  expectBranchFailure = false;
  assert.equal(expectedConsoleErrors.length, 1);
  record({
    pass: 'Loading and no-results states; injected HTTP503 displays a recoverable branch error and Retry succeeds',
  });
  const isolated = await browser.newContext(),
    otherPage = await isolated.newPage();
  await login(otherPage, other.slug);
  await otherPage.goto(url);
  await otherPage
    .getByRole('searchbox', { name: 'Find employee or manager' })
    .fill('Charlie');
  await otherPage
    .getByText('No employees in this view.', { exact: true })
    .waitFor();
  await isolated.close();
  assert.deepEqual(consoleErrors, []);
  assert.equal(events.filter((e) => e.error).length, 0);
  record({
    pass: 'Manage Users reflects the persisted manager; another tenant cannot search these employees; no console or page errors',
  });
  console.log(JSON.stringify({ events, network }, null, 2));
  fs.writeFileSync(
    path.join(backend, '.tmp', 'tenant-hierarchy-browser-results.json'),
    JSON.stringify(
      { schema: state.schema, dataset: 1031, events, network },
      null,
      2,
    ),
  );
})()
  .catch(async (error) => {
    if (debugPage && !debugPage.isClosed()) {
      console.error(await debugPage.locator('body').innerText());
      await debugPage.screenshot({
        path: path.join(backend, '.tmp', 'tenant-hierarchy-failure.png'),
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
