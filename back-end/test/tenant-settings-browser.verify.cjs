// Authenticated Settings acceptance against an explicitly isolated local PostgreSQL schema.
if (process.env.FINSTACK_SETTINGS_BROWSER_QA !== '1') {
  throw Error(
    'Set FINSTACK_SETTINGS_BROWSER_QA=1 for this local-only browser test.',
  );
}
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const { chromium } = require(
  process.env.FINSTACK_PLAYWRIGHT_MODULE ||
    'C:/Users/nikhi/AppData/Local/ms-playwright-go/1.57.0/package',
);
const backend = path.resolve(__dirname, '..');
const repo = path.resolve(backend, '..');
const schema = new URL(process.env.DATABASE_URL || '').searchParams.get(
  'schema',
);
if (!/^finstack_manual_qa_[a-f0-9]{32}$/.test(schema || '')) {
  throw Error(
    'A unique, isolated finstack_manual_qa_<UUID> schema is required.',
  );
}
const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const fixture = {
  suffix: crypto.randomUUID().replaceAll('-', '').slice(0, 12),
  password: crypto.randomBytes(24).toString('base64url') + '!Aa1',
};
let apiProcess;
let browser;
let webServer;
let page;
const errors = [];
const apiPort = Number(process.env.FINSTACK_SETTINGS_API_PORT || 3492);
const webPort = Number(process.env.FINSTACK_SETTINGS_WEB_PORT || 5592);
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const apiSecret = crypto.randomBytes(48).toString('hex');
const output = path.join(backend, 'docs', 'settings-verification');
const endpoint = '/api/v1/tenant/configuration/settings';
let expectedValidationResponse = false;

function startWeb() {
  webServer = http.createServer((req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method))
        return res.writeHead(405).end();
      const pathname = decodeURIComponent(new URL(req.url, webBase).pathname);
      const spa =
        pathname === '/' ||
        /^\/(?:configuration(?:\/[^.]*)?|login|help|contact|support|forbidden)\/?$/.test(
          pathname,
        );
      const root = path.join(repo, 'front-end');
      const file = path.resolve(root, '.' + (spa ? '/index.html' : pathname));
      if (
        !file.startsWith(root + path.sep) ||
        path
          .relative(root, file)
          .split(path.sep)
          .some(
            (part) =>
              part.startsWith('.') ||
              part === 'node_modules' ||
              part === 'admin',
          )
      )
        return res.writeHead(403).end();
      let content = fs.readFileSync(file);
      if (file.endsWith('.html'))
        content = Buffer.from(
          content
            .toString('utf8')
            .replace(
              '<head>',
              `<head><script>window.FINSTACK_API_BASE_URL=${JSON.stringify(apiBase)};</script>`,
            ),
        );
      res.writeHead(200, {
        'Content-Type':
          {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
          }[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    webServer.once('error', reject);
    webServer.listen(webPort, '127.0.0.1', resolve);
  });
}

function startApi() {
  apiProcess = spawn(process.execPath, ['dist/src/main.js'], {
    cwd: backend,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      FINSTACK_MANUAL_QA: '1',
      FINSTACK_MANUAL_QA_BIND_HOST: '127.0.0.1',
      CORS_ORIGINS: webBase,
      TENANT_JWT_ACCESS_SECRET: apiSecret,
      TENANT_JWT_ISSUER: 'finstack-local-settings-qa',
      TENANT_JWT_AUDIENCE: 'finstack-local-settings-client',
      PLATFORM_JWT_ACCESS_SECRET: apiSecret + apiSecret,
      PLATFORM_JWT_ISSUER: 'finstack-local-settings-qa',
      PLATFORM_JWT_AUDIENCE: 'finstack-local-settings-admin',
      LOG_DIRECTORY: path.join(backend, '.tmp', 'settings-qa', 'logs'),
      UPLOAD_DIRECTORY: path.join(backend, '.tmp', 'settings-qa', 'uploads'),
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  return waitForApi();
}

async function waitForApi() {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    if (apiProcess.exitCode !== null)
      throw Error('Local Nest QA server exited before readiness.');
    try {
      const result = await fetch(`${apiBase}/api/v1/tenant/auth/me`);
      if (result.status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error('Local Nest QA server did not become ready.');
}

async function stopApi() {
  if (!apiProcess || apiProcess.exitCode !== null) return;
  const proc = apiProcess;
  await new Promise((resolve) => {
    proc.once('exit', resolve);
    proc.kill();
    setTimeout(resolve, 5000).unref();
  });
  apiProcess = undefined;
}

async function login(password = fixture.password) {
  await page.goto(`${webBase}/login?settings-qa=${crypto.randomUUID()}`);
  await page.locator('#employee-id').fill(fixture.employeeId);
  await page.locator('#password-input').fill(password);
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForURL((url) => url.pathname.startsWith('/configuration/'));
}

async function savePreferences(theme) {
  await page.getByRole('button', { name: theme, exact: true }).click();
  await page
    .getByRole('button', { name: 'Save Preferences', exact: true })
    .click();
  await page
    .getByText('Preferences saved to your account.', { exact: true })
    .waitFor();
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const [dbIdentity] =
    await db.$queryRaw`SELECT current_schema() AS schema, host(inet_server_addr()) AS address`;
  assert.equal(dbIdentity.schema, schema);
  assert(
    ['127.0.0.1', '::1'].includes(dbIdentity.address),
    'PostgreSQL must be loopback-only',
  );
  const organization = await db.organization.create({
    data: {
      name: `Fictional Settings QA ${fixture.suffix}`,
      primaryEmail: `office-${fixture.suffix}@settings.test`,
      status: 'ACTIVE',
      metadata: { address: 'Fictional QA address', taxId: 'QA-IMMUTABLE' },
    },
  });
  const user = await db.tenantUser.create({
    data: {
      organizationId: organization.id,
      employeeId: `SET-${fixture.suffix}`,
      email: `manager-${fixture.suffix}@settings.test`,
      firstName: 'Local',
      lastName: 'Settings QA',
      role: 'CONFIGURATION_MANAGER',
      passwordHash: await argon2.hash(fixture.password),
    },
  });
  fixture.employeeId = user.employeeId;
  const submitter = await db.tenantUser.create({
    data: {
      organizationId: organization.id,
      employeeId: `SUB-${fixture.suffix}`,
      email: `submitter-${fixture.suffix}@settings.test`,
      firstName: 'Local',
      lastName: 'Submitter',
      passwordHash: await argon2.hash(fixture.password),
    },
  });

  await startWeb();
  await startApi();
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.FINSTACK_BROWSER_EXECUTABLE ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !(
        expectedValidationResponse &&
        message.text().includes('400 (Bad Request)')
      )
    )
      errors.push(message.text());
  });
  await login();

  await page.goto(`${webBase}/configuration/organization-settings`);
  await page.getByLabel('Organization Name', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Organization Name', { exact: true }).inputValue(),
    organization.name,
  );
  assert.equal(
    await page.getByLabel('Organization ID', { exact: true }).inputValue(),
    organization.id,
  );
  assert.equal(
    await page.getByLabel('Organization Email', { exact: true }).inputValue(),
    organization.primaryEmail,
  );
  assert.equal(
    await page.getByLabel('Address', { exact: true }).inputValue(),
    'Fictional QA address',
  );
  assert.equal(
    await page.getByLabel('Tax ID / EIN', { exact: true }).inputValue(),
    'QA-IMMUTABLE',
  );
  for (const field of [
    'Organization Name',
    'Organization ID',
    'Organization Email',
    'Address',
    'Default Currency',
    'Tax ID / EIN',
  ])
    assert.equal(
      await page.getByLabel(field, { exact: true }).isEditable(),
      false,
      `${field} stays immutable`,
    );
  await page
    .getByLabel('Company Size', { exact: true })
    .selectOption('11-50 employees');
  await page
    .getByLabel('Fiscal Year Start', { exact: true })
    .selectOption('July');
  await page
    .getByLabel('Default Payment Method', { exact: true })
    .selectOption('Corporate Card');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page
    .getByText('Organization settings saved.', { exact: true })
    .waitFor();
  await page.reload();
  await page.getByLabel('Company Size', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Fiscal Year Start', { exact: true }).inputValue(),
    'July',
  );
  const persistedOrg = await db.organization.findUniqueOrThrow({
    where: { id: organization.id },
  });
  assert.deepEqual(persistedOrg.metadata.tenantSettings, {
    companySize: '11-50 employees',
    fiscalYearStart: 'July',
    defaultPaymentMethod: 'Corporate Card',
  });
  const [exportDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export', exact: true }).click(),
  ]);
  assert.equal(
    exportDownload.suggestedFilename(),
    'organization-configuration.json',
  );
  await page
    .getByText(/Configuration export downloaded/, { exact: false })
    .waitFor();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `organization settings fit ${width}px`,
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const name of [
    'Email Notifications',
    'Slack Integration',
    'Budget Alerts',
  ])
    assert.equal(
      await page.getByRole('switch', { name, exact: true }).isDisabled(),
      true,
    );
  assert.equal(
    await page
      .getByRole('button', { name: 'Delete', exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole('link', { name: 'View alerts', exact: true }).click();
  await page.waitForURL(`${webBase}/configuration/notifications`);

  await page.goto(`${webBase}/configuration/profile-settings`);
  assert.equal(
    await page.getByLabel('Email Address', { exact: true }).inputValue(),
    user.email,
  );
  assert.equal(
    await page.getByLabel('Employee ID', { exact: true }).inputValue(),
    user.employeeId,
  );
  assert.equal(
    await page.getByLabel('Department', { exact: true }).isEditable(),
    false,
  );
  await page.getByLabel('Full Name', { exact: true }).fill('Local Profile QA');
  await page.getByLabel('Phone Number', { exact: true }).fill('+91 1234567890');
  await page.getByLabel('Location', { exact: true }).fill('Pune QA');
  await page
    .getByRole('button', { name: 'Change Avatar', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Avatar color #22D3EE', exact: true })
    .click();
  await page
    .getByLabel('Full Name', { exact: true })
    .fill(`${'N'.repeat(101)} Remaining`);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page
    .getByText(
      'Use a first name and remaining names of up to 100 characters each.',
      { exact: true },
    )
    .waitFor();
  await page.getByLabel('Full Name', { exact: true }).fill('Local Profile QA');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Profile updated.', { exact: true }).waitFor();
  await page.reload();
  await page.getByLabel('Full Name', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Phone Number', { exact: true }).inputValue(),
    '+91 1234567890',
  );
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: user.id } }))
      .firstName,
    'Local',
  );
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: user.id } }))
      .lastName,
    'Profile QA',
  );
  assert.equal(
    (await db.tenantUser.findUniqueOrThrow({ where: { id: user.id } }))
      .avatarColor,
    '#22D3EE',
  );
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `profile settings fit ${width}px`,
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  const tokenBeforeHelp = await page.evaluate(() =>
    sessionStorage.getItem('finstackTenantAccessToken'),
  );
  await page
    .getByRole('link', { name: 'Password assistance', exact: true })
    .click();
  await page.getByRole('heading', { name: /password assistance/i }).waitFor();
  assert.equal(
    await page.locator('.spa-sidebar').count(),
    1,
    'password help stays in authenticated layout',
  );
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem('finstackTenantAccessToken'),
    ),
    tokenBeforeHelp,
  );
  assert.equal(
    (
      await page.request.get(`${apiBase}/api/v1/tenant/auth/me`, {
        headers: { Authorization: `Bearer ${tokenBeforeHelp}` },
      })
    ).status(),
    200,
  );
  await page.goto(`${webBase}/configuration/preferences`);
  await page.getByRole('button', { name: 'Light', exact: true }).waitFor();
  await savePreferences('Light');
  assert.equal(
    await page.locator('#finstack-client-root').getAttribute('data-theme'),
    'light',
  );
  await page.screenshot({
    path: path.join(output, 'settings-light.png'),
    fullPage: true,
  });
  const lightControl = await page
    .locator('.form-input')
    .first()
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
      opacity: getComputedStyle(el).opacity,
      disabled: el.disabled,
      theme: document
        .getElementById('finstack-client-root')
        ?.getAttribute('data-theme'),
    }));
  const lightColor = lightControl.background.match(/\d+/g).map(Number);
  const lightText = lightControl.color.match(/\d+/g).map(Number);
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (channels) =>
    0.2126 * linear(channels[0]) +
    0.7152 * linear(channels[1]) +
    0.0722 * linear(channels[2]);
  const contrast =
    (Math.max(luminance(lightColor), luminance(lightText)) + 0.05) /
    (Math.min(luminance(lightColor), luminance(lightText)) + 0.05);
  assert(
    lightColor.every((channel) => channel > 180) && contrast >= 4.5,
    `light-mode controls retain readable contrast: ${JSON.stringify({ ...lightControl, contrast })}`,
  );
  await page
    .getByRole('link', { name: 'Organization', exact: true })
    .click()
    .catch(async () =>
      page.goto(`${webBase}/configuration/organization-settings`),
    );
  assert.equal(
    await page.locator('#finstack-client-root').getAttribute('data-theme'),
    'light',
  );
  await page.goto(`${webBase}/configuration/preferences`);
  await savePreferences('Dark');
  assert.equal(
    await page.locator('#finstack-client-root').getAttribute('data-theme'),
    'dark',
  );
  await page.screenshot({
    path: path.join(output, 'settings-dark.png'),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await savePreferences('System');
  assert.equal(
    await page.locator('#finstack-client-root').getAttribute('data-theme'),
    'light',
  );
  await page.screenshot({
    path: path.join(output, 'settings-system-light.png'),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(
    () =>
      document
        .getElementById('finstack-client-root')
        ?.getAttribute('data-theme') === 'dark',
  );
  assert.equal((await getPreferences(user.id)).theme, 'system');
  await page.reload();
  await page.getByRole('button', { name: 'System', exact: true }).waitFor();
  assert.equal(
    await page.locator('#finstack-client-root').getAttribute('data-theme'),
    'dark',
  );

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `no horizontal overflow at ${width}px`,
    );
  }
  for (const field of [
    'Language',
    'Date Format',
    'Time Zone',
    'Number Format',
    'Default View',
    'Users Per Page',
  ])
    assert(
      await page.getByLabel(field, { exact: true }).count(),
      `${field} control exists`,
    );
  for (const name of [
    'Compact Mode',
    'Animations',
    'Desktop Notifications',
    'Auto-refresh Dashboard',
  ])
    assert(
      await page.getByRole('switch', { name, exact: true }).count(),
      `${name} control exists`,
    );
  assert.equal(
    await page
      .getByRole('switch', { name: 'Email Digest', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole('switch', { name: 'Sound Alerts', exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole('switch', { name: 'Compact Mode', exact: true }).click();
  await page.getByRole('switch', { name: 'Animations', exact: true }).click();
  await page
    .getByRole('switch', { name: 'Auto-refresh Dashboard', exact: true })
    .click();
  await page.getByLabel('Users Per Page', { exact: true }).selectOption('50');
  await page
    .getByLabel('Date Format', { exact: true })
    .selectOption('YYYY-MM-DD');
  await page.getByLabel('Language', { exact: true }).selectOption('en-GB');
  await page.getByLabel('Time Zone', { exact: true }).selectOption('UTC');
  await page.getByLabel('Number Format', { exact: true }).selectOption('de-DE');
  await page
    .getByLabel('Default View', { exact: true })
    .selectOption('notifications');
  await savePreferences('System');
  assert.equal((await getPreferences(user.id)).defaultView, 'notifications');
  assert.equal((await getPreferences(user.id)).pageSize, 50);
  assert(await page.locator('#finstack-client-root.compact-workspace').count());
  assert(
    await page
      .locator('#finstack-client-root.reduced-workspace-motion')
      .count(),
  );
  await page.goto(`${webBase}/configuration/manage-users`);
  await page.getByLabel('Employees per page', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Employees per page', { exact: true }).inputValue(),
    '50',
  );
  await page.goto(`${webBase}/configuration/preferences`);

  const oldToken = await page.evaluate(() =>
    sessionStorage.getItem('finstackTenantAccessToken'),
  );
  const forbidden = await page.request.patch(
    `${apiBase}${endpoint}/preferences`,
    {
      headers: {
        Authorization: `Bearer ${await loginAs(submitter.employeeId, fixture.password)}`,
      },
      data: await db.tenantUser
        .findUniqueOrThrow({ where: { id: user.id } })
        .then((row) => row.preferences),
    },
  );
  assert.equal(
    forbidden.status(),
    403,
    'other tenant roles cannot change Config Manager settings',
  );

  await stopApi();
  await startApi();
  await page.reload();
  await page.getByRole('button', { name: 'System', exact: true }).waitFor();
  assert.equal(
    await page.locator('#finstack-client-root').getAttribute('data-theme'),
    'dark',
  );
  assert.equal(
    await page.getByLabel('Date Format', { exact: true }).inputValue(),
    'YYYY-MM-DD',
  );
  assert.equal(
    await page.getByLabel('Language', { exact: true }).inputValue(),
    'en-GB',
  );
  await page.getByRole('button', { name: /Local Profile QA/i }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem('finstackTenantAccessToken'),
    ),
    null,
  );
  await page.evaluate(() => history.replaceState({}, '', location.href));
  await login();
  assert.equal(
    new URL(page.url()).pathname,
    '/configuration/notifications',
    'Default View controls the post-login destination',
  );
  await page.goto(`${webBase}/configuration/organization-settings`);
  await page.getByLabel('Company Size', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Company Size', { exact: true }).inputValue(),
    '11-50 employees',
  );
  assert.equal(
    await page.getByLabel('Fiscal Year Start', { exact: true }).inputValue(),
    'July',
  );
  assert.equal(
    await page
      .getByLabel('Default Payment Method', { exact: true })
      .inputValue(),
    'Corporate Card',
  );
  await page.goto(`${webBase}/configuration/profile-settings`);
  await page.getByLabel('Full Name', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Full Name', { exact: true }).inputValue(),
    'Local Profile QA',
  );
  assert.equal(
    await page.getByLabel('Phone Number', { exact: true }).inputValue(),
    '+91 1234567890',
  );
  assert.equal(
    await page.getByLabel('Location', { exact: true }).inputValue(),
    'Pune QA',
  );
  await page.goto(`${webBase}/configuration/preferences`);
  await page.getByRole('button', { name: 'System', exact: true }).waitFor();
  assert.equal((await getPreferences(user.id)).pageSize, 50);

  await page.goto(`${webBase}/configuration/profile-settings`);
  for (const label of [
    'Current Password',
    'New Password',
    'Confirm Password',
  ]) {
    await page
      .getByRole('button', { name: `Show ${label}`, exact: true })
      .click();
    assert.equal(
      await page.getByLabel(label, { exact: true }).getAttribute('type'),
      'text',
    );
    await page
      .getByRole('button', { name: `Hide ${label}`, exact: true })
      .click();
    assert.equal(
      await page.getByLabel(label, { exact: true }).getAttribute('type'),
      'password',
    );
  }
  const invalid = 'wrong-password';
  await page.getByLabel('Current Password', { exact: true }).fill(invalid);
  await page
    .getByLabel('New Password', { exact: true })
    .fill('Strong-password-239!Aa');
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('Strong-password-239!Aa');
  expectedValidationResponse = true;
  await page
    .getByRole('button', { name: 'Update Password', exact: true })
    .click();
  await page
    .getByText('Current password is incorrect.', { exact: true })
    .waitFor();
  expectedValidationResponse = false;
  await page
    .getByLabel('Current Password', { exact: true })
    .fill(fixture.password);
  await page
    .getByLabel('New Password', { exact: true })
    .fill('alllowercasepassword');
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('alllowercasepassword');
  await page
    .getByRole('button', { name: 'Update Password', exact: true })
    .click();
  await page
    .getByText(
      'Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol.',
      { exact: true },
    )
    .waitFor();
  const nextPassword = crypto.randomBytes(24).toString('base64url') + '!Bb2';
  await page
    .getByLabel('Current Password', { exact: true })
    .fill(fixture.password);
  await page.getByLabel('New Password', { exact: true }).fill(nextPassword);
  await page.getByLabel('Confirm Password', { exact: true }).fill(nextPassword);
  await page
    .getByRole('button', { name: 'Update Password', exact: true })
    .click();
  await page.waitForURL(`${webBase}/login`);
  assert.equal(
    (
      await page.request.get(`${apiBase}/api/v1/tenant/auth/me`, {
        headers: { Authorization: `Bearer ${oldToken}` },
      })
    ).status(),
    401,
  );
  fixture.password = nextPassword;
  await login();
  await page.goto(`${webBase}/configuration/profile-settings`);
  await page
    .getByRole('button', { name: 'Revoke all sessions', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Revoke sessions', exact: true })
    .click();
  await page.waitForURL(`${webBase}/login`);
  assert.equal(
    (
      await page.request.get(`${apiBase}/api/v1/tenant/auth/me`, {
        headers: { Authorization: `Bearer ${oldToken}` },
      })
    ).status(),
    401,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: 'PASS',
      schema,
      checks: [
        'organization load/save/reload',
        'immutable organization identity and role boundaries',
        'profile load/save/reload',
        'light/dark/system theme and OS changes',
        'saved preferences through refresh, relogin and backend restart',
        'unsupported delivery controls disabled',
        'password validation/change/token revocation/new login',
        'revoke all sessions',
        'role denial',
        'responsive widths 390/768/1280',
        'zero browser page errors',
      ],
      screenshots: [
        'settings-light.png',
        'settings-dark.png',
        'settings-system-light.png',
      ],
      pageErrors: errors,
    }),
  );
})()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await stopApi();
    await new Promise((resolve) => webServer?.close(resolve) || resolve());
    await db.$disconnect();
  });

async function loginAs(employeeId, password) {
  const response = await fetch(`${apiBase}/api/v1/tenant/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId, password }),
  });
  return (await response.json()).data.accessToken;
}

async function getPreferences(userId) {
  const [row] =
    await db.$queryRaw`SELECT preferences FROM "TenantUser" WHERE id = ${userId}::uuid`;
  return row.preferences;
}
