/* Browser regression against the real ClientApp. All APIs are intercepted;
 * no backend or database is used. Start npm run dev (or preview) separately.
 * Run: FINSTACK_PLAYWRIGHT_MODULE=<playwright path> node --test tests/actorSpa.browser.cjs
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chromium } = require(process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FINSTACK_ACTOR_BASE_URL || 'http://127.0.0.1:5582';
const actors = [
  { role: 'EXPENSE_SUBMITTER', dashboard: '/dashboard', shell: '.submitter-app', pages: ['/dashboard', '/submit', '/expenses', '/status', '/reports', '/notifications', '/profile-settings'] },
  { role: 'MANAGER', dashboard: '/manager/dashboard', shell: '.manager-workspace', pages: ['/manager', '/manager/dashboard', '/manager/expenses', '/manager/expenses/expense-1', '/manager/history', '/manager/notifications', '/manager/profile-settings'] },
  { role: 'FINANCE_OFFICER', dashboard: '/finance/dashboard', shell: '.finance-workspace', pages: ['/finance', '/finance/dashboard', '/finance/queue', '/finance/payments', '/finance/transactions', '/finance/notifications', '/finance/settings'] },
  { role: 'COMPLIANCE_OFFICER', dashboard: '/compliance/dashboard', shell: '.compliance-workspace', pages: ['/compliance', '/compliance/dashboard', '/compliance/queue', '/compliance/policies', '/compliance/audit', '/compliance/notifications', '/compliance/settings'] },
  { role: 'CONFIGURATION_MANAGER', dashboard: '/configuration/dashboard', shell: '.spa-workspace', pages: ['/configuration', '/configuration/dashboard', '/configuration/notifications'] },
];

test('one SPA supports all actor routes, login/logout, legacy refreshes and role boundaries', { timeout: 180000 }, async () => {
  const { legacyPaths } = await import('../src/routes/paths.ts');
  const { roleOwnsPath } = await import('../src/routes/workspaces.js');
  const browser = await chromium.launch({ headless: true, ...(process.env.FINSTACK_CHROMIUM_PATH ? { executablePath: process.env.FINSTACK_CHROMIUM_PATH } : {}) });
  const errors = [], calls = [];
  let checks = 0;
  async function fixture(actor, seeded) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const user = { id: 'qa-user', organizationId: 'qa-org', employeeId: 'QA-USER', firstName: 'Alex', lastName: 'QA', email: 'alex@fictional.test', role: actor.role, status: 'ACTIVE' };
    const session = { accessToken: 'fictional-fixture-token', organizationId: 'qa-org', user };
    let unread = true, expired = false;
    if (seeded) await page.addInitScript(session => {
      if (!sessionStorage.getItem('qa-initialized')) {
        sessionStorage.setItem('qa-initialized', 'true');
        sessionStorage.setItem('finstackTenantAccessToken', session.accessToken);
        sessionStorage.setItem('finstackTenantUser', JSON.stringify(session.user));
      }
    }, session);
    page.on('pageerror', error => errors.push(`${actor.role}: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && /module script|uncaught|cannot be a child|hydration/i.test(message.text())) errors.push(message.text());
    });
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const path = url.pathname, method = request.method();
      calls.push({ role: actor.role, path, method, headers: request.headers() });
      const json = (data, status = 200) => route.fulfill({ status, json: status < 400 ? { data } : { error: { message: data } } });
      if (path.endsWith('/auth/login')) return json({ ...session, workspace: { path: 'ignored-legacy-path' } });
      if (path.endsWith('/auth/me')) return expired ? json('Sign in again.', 401) : json({ user, organizationId: 'qa-org' });
      if (path.includes('/me/settings/')) return json('Profile settings are unavailable for this role.', 404);
      if (path.includes('/configuration/audit-logs')) return actor.role === 'CONFIGURATION_MANAGER' ? json({ items: [], total: 0 }) : json('Audit access requires Configuration Manager.', 403);
      if (path.endsWith('/configuration/settings/preferences')) return actor.role === 'CONFIGURATION_MANAGER' ? json({ theme: 'dark' }) : json('Forbidden', 403);
      if (path.endsWith('/subscription')) return json({ organization: { name: 'Fictional QA' }, plan: { name: 'QA', includedEmployeeCount: 5 }, employeeCount: 5, status: 'ACTIVE', priceAtSubscription: '10.00', currency: 'INR', billingInterval: 'MONTHLY' });
      if (path.endsWith('/finance/workspace')) return json({ expenses: [], transactions: [] });
      if (path.endsWith('/notifications/unread-count')) return json({ count: unread ? 1 : 0 });
      if (path.endsWith('/notifications/read-all') || path.endsWith('/notifications/qa-notice/read')) { unread = false; return json({}); }
      const notices = [{ id: 'qa-notice', title: 'QA notification', message: 'Fictional API fixture', unread, createdAt: '2026-10-15T07:00:00Z' }];
      if (path.endsWith('/notifications/page')) return json({ items: notices, total: 1, unreadCount: unread ? 1 : 0 });
      if (path.endsWith('/notifications')) return json(notices);
      if (/\/(mine|categories|policies|queue|history|finance-officers)$/.test(path)) return json([]);
      if (path.endsWith('/onboarding/plans')) return json({ items: [] });
      return json('Unconfigured fictional API fixture.', 404);
    });
    return { context, page, expire: () => { expired = true; } };
  }
  async function loaded(page, path, shell) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200, path);
    try { await page.locator(shell).first().waitFor(); }
    catch (error) { console.error({ path, errors, body: (await page.locator('body').innerText()).slice(0, 1800) }); throw error; }
    await page.waitForLoadState('networkidle');
    assert.equal(await page.getByText('This page could not be displayed', { exact: true }).count(), 0, path);
    checks++;
  }
  try {
    for (const actor of actors) {
      const { context, page, expire } = await fixture(actor, true);
      try {
        for (const path of actor.pages) {
          await loaded(page, path, actor.shell);
          await page.reload();
          await page.locator(actor.shell).first().waitFor();
          await page.waitForLoadState('networkidle');
          checks++;
          if (path === '/manager/profile-settings') {
            await page.getByRole('alert').filter({ hasText: 'Profile settings are unavailable for this role.' }).waitFor();
          }
          if (path === '/compliance/audit') {
            await page.getByText('Audit access requires Configuration Manager.', { exact: true }).waitFor();
          }
        }
        for (const [old, target] of Object.entries(legacyPaths).filter(([, target]) => roleOwnsPath(actor.role, target))) {
          await loaded(page, old + '?qa=1#entry', actor.shell);
          assert.equal(new URL(page.url()).pathname, target);
          assert.equal(new URL(page.url()).search, '?qa=1');
          assert.equal(new URL(page.url()).hash, '#entry');
        }
        for (const other of actors.filter(other => other.role !== actor.role)) {
          await page.goto(base + other.dashboard);
          await page.waitForURL(base + '/forbidden');
          await page.getByRole('heading', { name: 'Access denied' }).waitFor();
          checks++;
        }
        if (actor.role === 'FINANCE_OFFICER') {
          await loaded(page, '/finance/notifications', actor.shell);
          await page.getByRole('button', { name: 'Mark All as Read', exact: true }).click();
          await page.locator('.client-toast', { hasText: 'All notifications marked read.' }).waitFor();
          await page.getByRole('button', { name: 'Dismiss notification' }).click();
          assert.equal(await page.locator('.client-toast').count(), 0);
          checks++;
        }
        await loaded(page, actor.dashboard, actor.shell);
        await loaded(page, actor.dashboard + '?before-logout=1', actor.shell);
        if (actor.role === 'CONFIGURATION_MANAGER') {
          await page.locator('button[aria-controls="account-menu"]').click();
          await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        } else {
          await page.getByRole('button', { name: actor.role === 'MANAGER' ? 'Log out' : 'Logout', exact: true }).first().click();
        }
        await page.waitForURL(base + '/login');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('finstackTenantAccessToken')), null);
        await page.goBack();
        await page.waitForURL(base + '/login');
        checks++;
        // Expiry on a fresh verified entry clears identity and returns to login.
        await page.evaluate(session => {
          sessionStorage.setItem('finstackTenantAccessToken', session.accessToken);
          sessionStorage.setItem('finstackTenantUser', JSON.stringify(session.user));
        }, { accessToken: 'fictional-fixture-token', user: { id: 'qa-user', organizationId: 'qa-org', role: actor.role, status: 'ACTIVE' } });
        expire();
        await page.goto(base + actor.dashboard);
        await page.waitForURL(base + '/login');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('finstackTenantAccessToken')), null);
        checks++;
      } finally { await context.close(); }
      const login = await fixture(actor, false);
      try {
        // Anonymous deep links resume after login; a plain login uses the dashboard.
        for (const from of [null, actor.pages.find(path => !path.endsWith('/dashboard') && path !== actor.dashboard) || actor.dashboard]) {
          await login.page.goto(base + (from || '/login'));
          await login.page.locator('#employee-id').fill('QA-USER');
          await login.page.locator('#password-input').fill('fixture-only');
          await login.page.locator('#login-submit').click();
          const target = from && !['/manager', '/finance', '/compliance', '/configuration'].includes(from) ? from : actor.dashboard;
          await login.page.waitForURL(base + target);
          await login.page.locator(actor.shell).first().waitFor();
          await login.page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
          checks++;
        }
      } finally { await login.context.close(); }
    }
    assert.deepEqual(errors, []);
    assert(calls.filter(call => !call.path.endsWith('/auth/login') && !call.path.endsWith('/onboarding/plans')).every(call => call.headers.authorization === 'Bearer fictional-fixture-token'));
    assert(calls.every(call => !('role' in call.headers) && !('organizationid' in call.headers)));
    assert(calls.filter(call => call.path.endsWith('/configuration/settings/preferences')).every(call => call.role === 'CONFIGURATION_MANAGER'));
    console.log(`${checks} real-SPA browser checks passed with mocked APIs; no backend/database accessed.`);
  } finally { await browser.close(); }
});
