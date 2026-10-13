const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { fork } = require('node:child_process');
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
const testUrl = new URL(process.env.DATABASE_URL || '');
if (
  process.env.FINSTACK_CONFIGURATION_E2E !== '1' ||
  !testUrl.searchParams.get('schema')?.startsWith('finstack_config_verify_')
)
  throw new Error('Use an explicitly disposable verification schema.');
const { PrismaClient } = require(
  path.join(backend, 'node_modules/@prisma/client'),
);
const argon2 = require(path.join(backend, 'node_modules/argon2'));
const prisma = new PrismaClient({ datasourceUrl: testUrl.toString() });
const env = {
  ...process.env,
  CORS_ORIGINS: 'http://127.0.0.1:5580',
  TENANT_JWT_ACCESS_SECRET: randomUUID() + randomUUID(),
  NODE_ENV: 'test',
};
const base = 'http://127.0.0.1:5580';
const apiBase = 'http://127.0.0.1:3301';
const fixtureIds = [];
const users = [];
const results = [];
const pageErrors = [];
const password = 'Old!7';
let api, server, browser;
const output = path.join(backend, '.tmp');

async function visibleError(page, selector, text) {
  await page
    .locator(selector)
    .filter({ hasText: text })
    .waitFor({ state: 'visible' });
}
async function fill(page, employeeId, secret = password) {
  await page.getByLabel('Employee ID', { exact: true }).fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(secret);
}
async function stopApi() {
  if (api?.connected)
    await new Promise((resolve) => {
      api.once('exit', resolve);
      api.send('stop');
    });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const passwordHash = await argon2.hash(password);
  for (let i = 0; i < 2; i++) {
    const org = await prisma.organization.create({
      data: {
        name: 'Disposable login browser test',
        slug: `login-browser-${randomUUID()}`,
        primaryEmail: `${randomUUID()}@example.test`,
      },
    });
    fixtureIds.push(org.id);
  }
  const roles = [
    ['CONFIGURATION_MANAGER', 'config-manager'],
    ['MANAGER', 'manager'],
    ['EXPENSE_SUBMITTER', 'submitter'],
    ['FINANCE_OFFICER', 'finance'],
    ['COMPLIANCE_OFFICER', 'compliance'],
  ];
  for (const [index, [role, actorPath]] of roles.entries()) {
    const user = await prisma.tenantUser.create({
      data: {
        organizationId: fixtureIds[index % 2],
        employeeId: `${role.slice(0, 3)}-${randomUUID()}`,
        firstName: 'Browser',
        lastName: 'Employee',
        email: `${randomUUID()}@example.test`,
        passwordHash,
        role,
      },
    });
    users.push({ ...user, actorPath });
  }
  const inactive = await prisma.tenantUser.create({
    data: {
      organizationId: fixtureIds[0],
      employeeId: `INACTIVE-${randomUUID()}`,
      firstName: 'Inactive',
      lastName: 'Employee',
      email: `${randomUUID()}@example.test`,
      passwordHash,
      status: 'INACTIVE',
    },
  });
  api = fork(path.join(__dirname, 'configuration-backend-harness.cjs'), [], {
    cwd: backend,
    env,
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  await new Promise((resolve, reject) => {
    api.once('message', resolve);
    api.once('exit', (code) => reject(new Error('Backend failed: ' + code)));
  });
  server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, base).pathname);
      const target = path.resolve(frontend, '.' + pathname);
      if (!target.startsWith(frontend + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      let content = fs.readFileSync(target);
      const ext = path.extname(target);
      if (ext === '.html')
        content = Buffer.from(
          content
            .toString()
            .replace(
              '<head>',
              `<head><script>window.FINSTACK_API_BASE_URL="${apiBase}"</script>`,
            ),
        );
      res
        .writeHead(200, {
          'Content-Type':
            {
              '.html': 'text/html',
              '.js': 'text/javascript',
              '.css': 'text/css',
              '.svg': 'image/svg+xml',
            }[ext] || 'application/octet-stream',
        })
        .end(content);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(5580, '127.0.0.1', resolve));
  browser = await chromium.launch({
    executablePath:
      process.env.FINSTACK_BROWSER_EXECUTABLE ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await desktop.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const traffic = [];
  page.on('request', (req) => {
    if (req.url().startsWith(apiBase)) traffic.push(req);
  });
  await page.goto(base + '/login.html');
  assert.equal(await page.locator('select').count(), 0);
  assert.equal(
    await page.locator('#org-id, #user-role, .role-shortcut').count(),
    0,
  );
  assert.equal(await page.locator('#login-submit').isDisabled(), true);
  await page.screenshot({
    path: path.join(output, 'employee-login-desktop.png'),
    fullPage: true,
  });
  await page.locator('#employee-id').focus();
  await page.locator('#password-input').focus();
  await visibleError(page, '#employee-id-error', 'Employee ID is required.');
  await page.locator('#employee-id').fill('EMP@123');
  await visibleError(page, '#employee-id-error', 'unsupported characters');
  await page.locator('#employee-id').fill('-EMP-123');
  await visibleError(page, '#employee-id-error', 'format is invalid');
  await page.locator('#employee-id').fill(users[0].employeeId);
  await page.locator('#password-input').focus();
  await page.locator('#employee-id').focus();
  await visibleError(page, '#password-error', 'Password is required.');
  assert.equal(await page.locator('#login-submit').isDisabled(), true);
  assert.equal(traffic.length, 0);
  results.push(
    'Empty/unsupported/malformed ID and empty password show inline errors; button disabled; no API requests or selectors.',
  );
  await fill(page, users[0].employeeId);
  assert.equal(await page.locator('#login-submit').isEnabled(), true);
  await page
    .getByRole('button', { name: 'Show password', exact: true })
    .click();
  assert.equal(
    await page.locator('#password-input').getAttribute('type'),
    'text',
  );
  assert.equal(
    await page.locator('#password-toggle').getAttribute('aria-pressed'),
    'true',
  );
  await page
    .getByRole('button', { name: 'Hide password', exact: true })
    .click();
  assert.equal(
    await page.locator('#password-input').getAttribute('type'),
    'password',
  );
  results.push(
    'Short existing password enables login; accessible show/hide preserves the value.',
  );
  for (const [employeeId, secret] of [
    [users[0].employeeId, 'incorrect'],
    [`UNKNOWN-${randomUUID()}`, password],
    [inactive.employeeId, password],
  ]) {
    await fill(page, employeeId, secret);
    await page.locator('#login-submit').click();
    await visibleError(
      page,
      '#login-error',
      'Employee ID or password is incorrect.',
    );
    assert.equal(await page.locator('#login-submit').isEnabled(), true);
  }
  results.push(
    'Incorrect, unknown and inactive credentials produce identical generic errors.',
  );
  await page.route('**/api/v1/tenant/auth/login', (route) =>
    route.abort('failed'),
  );
  await fill(page, users[0].employeeId);
  await page.locator('#login-submit').click();
  await visibleError(page, '#login-error', 'temporarily unavailable');
  await page.unroute('**/api/v1/tenant/auth/login');
  await page.route('**/api/v1/tenant/auth/login', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Internal database details must not appear',
      }),
    }),
  );
  await fill(page, users[0].employeeId);
  await page.locator('#login-submit').click();
  await visibleError(page, '#login-error', 'temporarily unavailable');
  assert.equal(
    await page.getByText('Internal database details must not appear').count(),
    0,
  );
  await page.unroute('**/api/v1/tenant/auth/login');
  results.push(
    'Network failure and server 503 show a retryable message without server details.',
  );
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/tenant/auth/login', async (route) => {
    const response = await route.fetch();
    await hold;
    await route.fulfill({ response });
  });
  await fill(page, users[0].employeeId);
  const before = traffic.filter((req) =>
    req.url().endsWith('/auth/login'),
  ).length;
  await page.locator('#password-input').press('Enter');
  await page
    .getByRole('button', { name: 'Signing in…', exact: true })
    .waitFor();
  assert.equal(await page.locator('#login-submit').isDisabled(), true);
  assert.equal(
    await page.locator('#login-form').getAttribute('aria-busy'),
    'true',
  );
  await page.locator('#password-input').press('Enter');
  assert.equal(
    traffic.filter((req) => req.url().endsWith('/auth/login')).length - before,
    1,
  );
  release();
  await page.waitForURL('**/views/config-manager/dashboard.html');
  await page.unroute('**/api/v1/tenant/auth/login');
  const session = await page.evaluate(() =>
    window.FinStackTenantSession.getTenantSession(),
  );
  assert.equal(session.organizationId, users[0].organizationId);
  assert.equal(session.user.id, users[0].id);
  assert.equal(session.accessToken.split('.').length, 3);
  const me = await page.evaluate(() =>
    window.FinStackTenantSession.request('/api/v1/tenant/auth/me'),
  );
  assert.deepEqual(me.effectiveRoles, ['CONFIGURATION_MANAGER']);
  assert.equal(me.workspace.path, 'views/config-manager/dashboard.html');
  await page.reload();
  await page.waitForURL('**/views/config-manager/dashboard.html');
  await page.goto(base + '/views/config-manager/expense-categories.html');
  await page.locator('#sidebar-logout').click();
  await page.waitForURL('**/login.html');
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem('finstackTenantAccessToken'),
    ),
    null,
  );
  await page.goto(base + '/views/config-manager/expense-categories.html');
  await page.waitForURL('**/login.html?error=*');
  results.push(
    'Enter submits once; loading disables resubmission; PostgreSQL identity/JWT /me resolve the Config Manager workspace; refresh/logout/protected redirect pass.',
  );
  const { JwtService } = require(path.join(backend, 'node_modules/@nestjs/jwt'));
  const originalClaims = JSON.parse(Buffer.from(session.accessToken.split('.')[1], 'base64url').toString('utf8'));
  const expiredToken = new JwtService().sign(
    { ...originalClaims, exp: Math.floor(Date.now() / 1000) - 60 },
    { secret: env.TENANT_JWT_ACCESS_SECRET, algorithm: 'HS256' },
  );
  await page.evaluate((value) => window.FinStackTenantSession.setTenantSession(value), { ...session, accessToken: expiredToken });
  const expiredCheck = page.waitForResponse((response) => response.url().endsWith('/api/v1/tenant/auth/me'));
  await page.goto(base + '/views/config-manager/expense-categories.html');
  assert.equal((await expiredCheck).status(), 401);
  await page.waitForURL('**/login.html?error=*');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('finstackTenantAccessToken')), null);
  results.push('A genuinely expired, locally signed fixture JWT is rejected by the real backend; protected browser navigation clears the session and redirects to login.');
  for (const req of traffic.filter((req) =>
    req.url().endsWith('/auth/login'),
  )) {
    assert.deepEqual(Object.keys(req.postDataJSON()).sort(), [
      'employeeId',
      'password',
    ]);
    assert.equal(req.headers().role, undefined);
    assert.equal(req.headers().organizationid, undefined);
  }
  assert.equal(
    traffic.some((req) => new URL(req.url()).pathname === '/users'),
    false,
  );
  for (const req of traffic.filter((req) => req.url().endsWith('/auth/me')))
    assert.ok(req.headers().authorization?.startsWith('Bearer '));
  results.push(
    'Login network bodies contain only employeeId/password; /me uses Bearer JWT; no /users password comparison or client role/organization headers.',
  );
  for (const user of users.slice(1)) {
    const context = await browser.newContext();
    const actor = await context.newPage();
    actor.on('pageerror', (error) => pageErrors.push(error.message));
    const loginPage =
      user.role === 'MANAGER'
        ? '/views/shared/login.html?role=configuration_manager&organizationId=ignored'
        : '/login.html';
    await actor.goto(base + loginPage);
    await fill(actor, user.employeeId);
    await actor.locator('#login-submit').click();
    await actor.waitForURL(`**/views/${user.actorPath}/dashboard.html`);
    const current = await actor.evaluate(() =>
      window.FinStackTenantSession.request('/api/v1/tenant/auth/me'),
    );
    assert.equal(current.user.role, user.role);
    assert.equal(current.organizationId, user.organizationId);
    await context.close();
  }
  results.push(
    'Manager, Submitter, Finance and Compliance automatically route to their permitted dashboards; nested login and spoofed query choices are ignored.',
  );
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  await phone.goto(base + '/login.html');
  assert.equal(
    await phone.getByLabel('Employee ID', { exact: true }).isVisible(),
    true,
  );
  assert.equal(
    await phone.getByLabel('Password', { exact: true }).isVisible(),
    true,
  );
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await phone.screenshot({
    path: path.join(output, 'employee-login-mobile.png'),
    fullPage: true,
  });
  results.push(
    'Desktop 1280×900 and mobile 375×812 layouts verified; mobile has no horizontal overflow.',
  );
  assert.deepEqual(pageErrors, []);
  fs.writeFileSync(
    path.join(output, 'employee-login-browser-results.json'),
    JSON.stringify(
      { schema: testUrl.searchParams.get('schema'), results, pageErrors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
  await mobile.close();
  await desktop.close();
})()
  .catch((error) => {
    console.error(error.stack);
    console.error('Completed:', JSON.stringify(results));
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await stopApi();
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.tenantUser.deleteMany({
      where: { organizationId: { in: fixtureIds } },
    });
    await prisma.organization.deleteMany({ where: { id: { in: fixtureIds } } });
    await prisma.$disconnect();
  });
