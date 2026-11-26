/* Real ClientApp smoke test with in-memory API responses only.
 * Start npm run dev (or preview), then set FINSTACK_PLAYWRIGHT_MODULE to an
 * existing playwright/playwright-core installation and run node --test on this file.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chromium } = require(process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FINSTACK_ACTOR_BASE_URL || 'http://127.0.0.1:5582';
const expenseBase = '/api/v1/tenant/expenses';

test('Submitter Redux routes, mutations, validation, refresh and session isolation in the real SPA', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.FINSTACK_CHROMIUM_PATH ? { executablePath: process.env.FINSTACK_CHROMIUM_PATH } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [], calls = [];
  const makeSession = (suffix) => ({
    accessToken: `fictional-${suffix}`,
    organizationId: `qa-org-${suffix}`,
    user: {
      id: `qa-user-${suffix}`, organizationId: `qa-org-${suffix}`, employeeId: `QA-${suffix}`,
      firstName: 'Alex', lastName: suffix, email: `qa-${suffix}@fictional.test`,
      role: 'EXPENSE_SUBMITTER', status: 'ACTIVE', organizationName: `QA Organization ${suffix}`,
      manager: { firstName: 'Morgan', lastName: 'Manager', employeeId: 'QA-MANAGER' },
    },
  });
  const sessions = { 'fictional-a': makeSession('a'), 'fictional-b': makeSession('b') };
  let expenses = [
    { id: 'returned-1', merchant: 'Returned Merchant', amount: '125', date: '2026-10-01', categoryId: 'travel', category: { name: 'Travel' }, workflowStatus: 'returned', history: [] },
    { id: 'review-1', merchant: 'Review Merchant', amount: '250', date: '2026-10-01', categoryId: 'travel', category: { name: 'Travel' }, workflowStatus: 'manager_review', history: [] },
  ];
  let notices = [{ id: 'notice-1', title: 'Expense review', message: 'Your travel expense needs a correction.', unread: true, createdAt: '2026-10-01T10:00:00Z' }];
  let categoryError = false, holdNextMine = false, releaseMine, heldStarted;
  let heldReady = new Promise((resolve) => { heldStarted = resolve; });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /<path>|SVG|non-serializable/i.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript((session) => {
    sessionStorage.setItem('finstackTenantAccessToken', session.accessToken);
    sessionStorage.setItem('finstackTenantUser', JSON.stringify(session.user));
  }, sessions['fictional-a']);

  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (url.origin !== base) return route.abort();
    if (!path.startsWith('/api/')) return route.continue();
    calls.push({ path, method: request.method(), token: request.headers().authorization });
    const session = sessions[request.headers().authorization?.replace('Bearer ', '')];
    const json = (data, status = 200) => route.fulfill({ status, json: status < 400 ? { data } : { error: { message: data } } });
    if (path.endsWith('/auth/me')) return json({ user: session.user, organizationId: session.organizationId });
    if (path.endsWith('/mine')) {
      const snapshot = session.user.id === 'qa-user-b'
        ? [{ ...expenses[0], id: 'new-user-expense', merchant: 'New Employee Merchant' }]
        : structuredClone(expenses);
      if (holdNextMine) {
        holdNextMine = false;
        await new Promise((resolve) => { releaseMine = resolve; heldStarted(); });
      }
      return json(snapshot);
    }
    if (path.endsWith('/categories')) return categoryError ? json('Category service offline', 503) : json([{ id: 'travel', name: 'Travel' }]);
    if (path.endsWith('/notifications/page')) return json({ items: notices, total: notices.length });
    if (path.endsWith('/notifications/notice-1/read')) { notices[0].unread = false; return json({}); }
    if (path.endsWith('/notifications/notice-1/unread')) { notices[0].unread = true; return json({}); }
    if (path.endsWith('/notifications/read-all')) { notices.forEach((item) => { item.unread = false; }); return json({}); }
    if (path.endsWith('/notifications/notice-1') && request.method() === 'DELETE') { notices = []; return json({}); }
    if (path.endsWith('/receipt')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' });
    if (path === expenseBase && request.method() === 'POST') {
      const multipart = request.postDataBuffer().toString();
      assert.ok(multipart.includes('name="receipt"'));
      assert.ok(multipart.includes('name="amount"'));
      assert.equal(/name="(?:workflowStatus|ocr|riskScore|employeeId|organizationId)"/.test(multipart), false);
      const created = { ...expenses[1], id: 'created-1', merchant: 'Created Merchant', amount: '99', workflowStatus: 'manager_review' };
      expenses.push(created);
      return json(created);
    }
    if (path === `${expenseBase}/returned-1` && request.method() === 'PATCH') {
      const updates = request.postDataJSON();
      assert.equal('workflowStatus' in updates, false);
      expenses[0] = { ...expenses[0], ...updates, workflowStatus: 'manager_review' };
      return json(expenses[0]);
    }
    if (path === `${expenseBase}/review-1` && request.method() === 'DELETE') {
      expenses = expenses.filter((item) => item.id !== 'review-1');
      return json({});
    }
    return json('Unconfigured test API', 404);
  });

  const visit = async (path) => {
    await page.locator(`a[href="${path}"]`).first().click();
    await page.waitForURL(base + path);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.getByText('This page could not be displayed', { exact: true }).count(), 0);
  };
  const reads = (suffix) => calls.filter((call) => call.path.endsWith(suffix) && call.method === 'GET').length;
  try {
    await page.goto(base + '/dashboard');
    await page.getByRole('heading', { name: 'Expense Submitter Dashboard' }).waitFor();
    await page.getByText('Returned Merchant', { exact: true }).waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(reads('/mine'), 1);
    assert.equal(reads('/categories'), 1);
    assert.equal(reads('/notifications/page'), 1);
    assert.equal(await page.locator('svg[aria-label="Expense submission trend"] circle').count(), 2);
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();

    for (const path of ['/submit', '/expenses', '/status', '/reports', '/notifications', '/profile-settings', '/dashboard']) await visit(path);
    assert.equal(reads('/mine'), 1, 'navigation preserves one shared store without refetching');
    await visit('/profile-settings');
    await page.getByText('QA Organization a', { exact: true }).waitFor();
    await page.getByText(/Morgan Manager/).waitFor();

    await visit('/notifications');
    const bell = page.getByRole('button', { name: 'Notifications', exact: true });
    assert.equal(await bell.locator('span').innerText(), '1');
    await page.getByRole('button', { name: 'Mark read', exact: true }).click();
    await page.getByRole('button', { name: 'Mark unread', exact: true }).waitFor();
    assert.equal(await bell.locator('span').count(), 0);
    await page.getByRole('button', { name: 'Mark unread', exact: true }).click();
    await page.getByRole('button', { name: 'Mark read', exact: true }).waitFor();
    await bell.click();
    await page.locator('#tenant-notification-panel').getByRole('button', { name: 'Mark all read' }).click();
    await page.getByRole('button', { name: 'Mark unread', exact: true }).waitFor();
    await bell.click();
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.getByRole('heading', { name: 'All caught up' }).waitFor();

    await visit('/submit');
    await page.getByRole('button', { name: 'Submit Expense', exact: true }).click();
    await page.getByText('Please fill in all required fields', { exact: true }).waitFor();
    await page.getByLabel('Amount (₹)', { exact: true }).fill('99');
    await page.getByLabel('Date', { exact: true }).fill('2026-10-01');
    await page.getByLabel('Merchant / vendor', { exact: true }).fill('Created Merchant');
    await page.locator('#expense-category').selectOption('travel');
    await page.locator('input[type="file"]').setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
    const beforeCreate = reads('/mine');
    await page.getByRole('button', { name: 'Submit Expense', exact: true }).click();
    await page.getByText(/submitted successfully!/).waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(reads('/mine'), beforeCreate + 1, 'one post-create expense read');

    await visit('/expenses');
    await page.getByText('Created Merchant', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fix and resubmit RETURNED', exact: true }).click();
    await page.locator('#edit-expense-amount').fill('175');
    await page.getByRole('button', { name: 'Fix & Resubmit', exact: true }).click();
    await page.getByText('Expense RETURNED resubmitted.', { exact: true }).waitFor();
    assert.equal(expenses[0].workflowStatus, 'manager_review');
    await page.getByRole('button', { name: 'Delete REVIEW-1' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByText('Expense REVIEW-1 deleted.', { exact: true }).waitFor();
    assert.equal(await page.getByText('Review Merchant', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'View CREATED-' }).click();
    await page.getByRole('dialog').getByText('Created Merchant', { exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').getByText('CREATED-', { exact: true }).count(), 1);
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/receipt')),
      page.getByRole('dialog').getByRole('button', { name: 'View Receipt', exact: true }).click(),
    ]);
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('search').getByLabel('Search expenses', { exact: true }).fill('Created');
    await page.getByRole('search').getByLabel('Search expenses', { exact: true }).press('Enter');
    await page.waitForURL(/search=Created/);
    await page.getByText('Returned Merchant', { exact: true }).waitFor({ state: 'hidden' });

    categoryError = true;
    await page.evaluate(() => window.dispatchEvent(new Event('finstack:live-refresh')));
    await page.waitForLoadState('networkidle');
    // Explicit retry is tested via a foreground read after a fresh protected entry.
    await page.reload();
    await visit('/submit');
    await page.getByText('The service is temporarily unavailable. Please retry.', { exact: false }).waitFor();
    categoryError = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.locator('#expense-category option[value="travel"]').waitFor({ state: 'attached' });

    await visit('/expenses');
    holdNextMine = true;
    await page.evaluate(() => window.dispatchEvent(new Event('finstack:live-refresh')));
    await heldReady;
    await page.evaluate((session) => window.FinStackTenantSession.setTenantSession(session), sessions['fictional-b']);
    await page.getByText('New Employee Merchant', { exact: true }).waitFor();
    releaseMine();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.getByText('Returned Merchant', { exact: true }).count(), 0);

    heldReady = new Promise((resolve) => { heldStarted = resolve; });
    holdNextMine = true;
    await page.evaluate(() => window.dispatchEvent(new Event('finstack:live-refresh')));
    await heldReady;
    await page.locator('button[aria-controls="tenant-account-menu"]').click();
    await page.locator('#tenant-account-menu').getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click();
    await page.waitForURL(base + '/login');
    releaseMine();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finstackTenantAccessToken')), null);
    assert.equal(await page.getByText('New Employee Merchant', { exact: true }).count(), 0);
    const baselineSvgWarnings = errors.filter(message => message.includes('<path> attribute d: Expected number') && message.includes('8-4 8-11 8-11-8z'));
    assert.deepEqual(errors.filter(message => !baselineSvgWarnings.includes(message)), []);
    if (baselineSvgWarnings.length) console.log(`Known main-branch SVG warning preserved: ${baselineSvgWarnings.length} occurrences; no icon/UI changes imported.`);
    assert.ok(calls.every((call) => /^Bearer fictional-[ab]$/.test(call.token)));
    console.log('All 7 routes, multipart creation, returned correction, deletion, receipt, notifications, retries, search, user switch, logout and request counts checked with intercepted APIs.');
  } catch (error) {
    console.error({ url: page.url(), errors, lastCalls: calls.slice(-8), body: (await page.locator('body').innerText()).slice(-2400) });
    throw error;
  } finally {
    releaseMine?.();
    await context.close();
    await browser.close();
  }
});
