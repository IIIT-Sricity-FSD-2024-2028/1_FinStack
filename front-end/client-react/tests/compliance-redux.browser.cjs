/* eslint @typescript-eslint/no-require-imports: "off" */
/* global require, process, console, URL, window, document, sessionStorage, Event, Buffer, structuredClone */
/* Real ClientApp/React/Redux integration, fictional intercepted APIs only.
 * Start npm run dev -- --port 5583, then run:
 * node --test tests/compliance-redux.browser.cjs
 * FINSTACK_PLAYWRIGHT_MODULE and FINSTACK_CHROMIUM_PATH match the existing harness.
 * No backend, database or real credentials are used. Evidence goes outside Git.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FINSTACK_ACTOR_BASE_URL || 'http://127.0.0.1:5583';
const output = process.env.FINSTACK_COMPLIANCE_OUTPUT || path.join(os.tmpdir(), 'finstack-fin84-browser');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

test('FIN-84 Compliance Redux workflows, race protection, polling and session boundaries', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.FINSTACK_CHROMIUM_PATH ? { executablePath: process.env.FINSTACK_CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], calls = [], checks = [];
  let user = { id: 'officer-a', organizationId: 'org-a', employeeId: 'CMP-QA', firstName: 'Compliance', lastName: 'QA', role: 'COMPLIANCE_OFFICER', status: 'ACTIVE', email: 'officer@fictional.test' };
  const claim = (i) => ({ id: `CMP-${String(i).padStart(2, '0')}`, organizationId: user.organizationId, employeeId: 'SUB-QA', employee: { fullName: 'Submitter QA' },
    workflowStatus: 'compliance_review', categoryId: i % 2 ? 'travel' : 'meals', category: i % 2 ? 'Travel' : 'Meals', amount: String(10 + i), currency: 'INR',
    riskScore: i % 3 === 0 ? 80 : i % 3 === 1 ? 50 : 20, managerDecision: i % 2 ? 'Escalated' : 'Approved', financeDecision: i % 2 ? null : 'Flagged',
    merchant: `QA merchant ${i}`, notes: 'Review fixture', createdAt: `2026-10-${String(i).padStart(2, '0')}T08:00:00Z`, date: `2026-10-${String(i).padStart(2, '0')}`, history: [], receiptFileName: 'receipt.png' });
  let expenses = Array.from({ length: 17 }, (_, i) => claim(i + 1));
  let notices = Array.from({ length: 43 }, (_, i) => ({ id: `NOTICE-${i}`, unread: true, title: `QA notice ${i}`, message: 'Fictional review event', type: 'info', createdAt: '2026-10-14T08:00:00Z' }));
  let failQueue = false, failCategories = false, failDecision = false, failNotice = false, failAudit = false, failExport = false, expire = false;
  let delayedAudit = null, delayedQueue = null, delayedExport = null, delayedDecision = null;
  const countCalls = suffix => calls.filter(call => call.endpoint.endsWith(suffix)).length;
  const check = name => { checks.push(name); console.log(`PASS ${name}`); };
  const visible = text => page.getByText(text, { exact: false }).first().waitFor();
  const idle = () => page.waitForLoadState('networkidle');
  const nav = async (route) => {
    await page.locator(`nav a[href="/compliance/${route}"]`).click();
    await page.getByRole('heading', { name: { queue: 'Escalated & Flagged Expenses', dashboard: 'Compliance Overview',
      policies: 'Policy & Violation Monitoring', notifications: 'Compliance Notifications', audit: 'Compliance Audit Trail', settings: 'Profile & Settings' }[route] }).waitFor();
    await idle();
  };
  const badge = () => page.locator('nav a[href="/compliance/notifications"] b');
  const queueBadge = () => page.locator('nav a[href="/compliance/queue"] b');
  const submit = async (label, note = 'QA review note') => {
    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill(note);
    const response = note.trim() ? page.waitForResponse(response => response.request().method() === 'POST' && /\/compliance\/(approve|reject|corrective-action)$/.test(new URL(response.url()).pathname)) : null;
    await dialog.getByRole('button', { name: label, exact: true }).click();
    if (response && (await response).ok()) await dialog.waitFor({ state: 'hidden' });
    await idle();
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /non-serializable|maximum update|uncaught|selector.*returned/i.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    window.fin84ObjectUrls = new Set();
    URL.createObjectURL = blob => { const url = create(blob); window.fin84ObjectUrls.add(url); return url; };
    URL.revokeObjectURL = url => { window.fin84ObjectUrls.delete(url); revoke(url); };
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname;
    if (url.origin !== base) return route.abort();
    if (endpoint === '/client-react/src/main.jsx') {
      // Exercise actual consumers under Strict Mode, including layout-effect replay.
      const response = await route.fetch();
      const main = await response.text();
      const wrapped = main.replace('createRoot(root).render(', 'createRoot(root).render(FIN84React.createElement(FIN84React.StrictMode, null, ')
        .replace('}, this));', '}, this)));');
      assert.notEqual(wrapped, main, 'Strict Mode instrumentation must wrap the actual entry');
      return route.fulfill({ response, body: `import FIN84React from '/.vite/deps/react.js';\n${wrapped}` });
    }
    if (!endpoint.startsWith('/api/')) return route.continue();
    calls.push({ endpoint, query: Object.fromEntries(url.searchParams), method: request.method(), body: request.postDataJSON() });
    const json = (data, status = 200) => route.fulfill({ status, json: status < 400 ? { success: true, data } : { success: false, error: { code: 'QA_ERROR', message: data } } });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (endpoint.endsWith('/auth/login')) return json({ accessToken: 'fixture-session-a', user, organizationId: user.organizationId, expiresIn: 3600, workspace: { key: 'compliance_officer', path: '/compliance/dashboard' } });
    if (endpoint.endsWith('/auth/me')) return expire ? json('Session expired', 401) : json({ user, organizationId: user.organizationId });
    if (endpoint.endsWith('/compliance/queue')) {
      const snapshot = structuredClone(expenses);
      if (delayedQueue) { const wait = delayedQueue; delayedQueue = null; wait.started.resolve(); await wait.release.promise; return json(snapshot); }
      return failQueue ? json('Queue unavailable', 500) : json(snapshot);
    }
    if (endpoint.endsWith('/categories')) return failCategories ? json('Categories unavailable', 500) : json([{ id: 'travel', name: 'Travel' }, { id: 'meals', name: 'Meals' }]);
    if (endpoint.endsWith('/policies')) return json([{ id: 'policy-a', name: 'Active QA travel policy', categoryId: 'travel', status: 'Active', maxAmount: '200.50', currency: 'INR' }, { id: 'inactive', name: 'Inactive QA policy', status: 'Inactive' }]);
    if (/\/compliance\/(approve|reject|corrective-action)$/.test(endpoint)) {
      if (delayedDecision) { const wait = delayedDecision; delayedDecision = null; wait.started.resolve(); await wait.release.promise; }
      if (failDecision) return json('No active Finance Officer is available in this organization.', 400);
      const id = endpoint.split('/').at(-3), action = endpoint.split('/').at(-1);
      const expense = expenses.find(expense => expense.id === id);
      assert(expense, id);
      expense.workflowStatus = { approve: 'finance_review', reject: 'rejected', 'corrective-action': 'compliance_review' }[action];
      expense.complianceDecisionNote = request.postDataJSON().note;
      const result = { ...expense };
      expenses = expenses.filter(expense => expense.workflowStatus === 'compliance_review');
      return json(result);
    }
    if (endpoint.endsWith('/notifications/unread-count')) return json({ unreadCount: notices.filter(n => n.unread).length });
    if (endpoint.endsWith('/notifications/page')) {
      const pageNumber = Number(url.searchParams.get('page')), pageSize = Number(url.searchParams.get('pageSize'));
      const filtered = notices.filter(n => url.searchParams.get('state') !== 'unread' || n.unread);
      return json({ items: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: filtered.length, unreadCount: notices.filter(n => n.unread).length, page: pageNumber, pageSize, totalPages: Math.ceil(filtered.length / pageSize) });
    }
    if (endpoint.endsWith('/notifications/read-all')) { notices.forEach(n => { n.unread = false; }); return json({ updated: notices.length }); }
    if (/\/notifications\/[^/]+\/read$/.test(endpoint)) {
      if (failNotice) return json('Read failed', 400);
      const notice = notices.find(n => n.id === endpoint.split('/').at(-2)); notice.unread = false; return json(notice);
    }
    if (endpoint.endsWith('/audit-logs/export')) {
      if (delayedExport) { const wait = delayedExport; delayedExport = null; wait.started.resolve(); await wait.release.promise; }
      return failExport ? json('Export unavailable', 500) : route.fulfill({ contentType: 'text/csv', body: 'eventCode,outcome\nqa_event,SUCCESS\n' });
    }
    if (endpoint.endsWith('/audit-logs')) {
      const query = Object.fromEntries(url.searchParams);
      if (delayedAudit && query.search === 'old') { const wait = delayedAudit; delayedAudit = null; wait.started.resolve(); await wait.release.promise; }
      if (failAudit) return json('Audit unavailable', 500);
      return json({ items: [{ id: `${query.search}-${query.page}`, eventCode: `qa_${query.search || 'event'}_${query.page}`, occurredAt: '2026-10-14T07:00:00Z', outcome: query.outcome || 'SUCCESS' }], total: 51, totalPages: 3, page: Number(query.page), pageSize: Number(query.pageSize) });
    }
    if (endpoint.endsWith('/receipt')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL2kAAAAASUVORK5CYII=', 'base64') });
    throw new Error(`Unexpected API: ${request.method()} ${endpoint}`);
  });
  try {
    await fs.mkdir(output, { recursive: true });
    await page.clock.install();
    await page.goto(base + '/login');
    await page.locator('#employee-id').fill('CMP-QA'); await page.locator('#password-input').fill('fixture-only');
    await page.locator('#login-form button[type="submit"]').click(); await idle();
    await visible('Compliance Overview');
    assert.equal(await queueBadge().innerText(), '17'); assert.equal(await badge().innerText(), '43');
    assert.equal(await page.getByText('Inactive QA policy', { exact: true }).count(), 0);
    check('authenticated Provider and dashboard initialize in Strict Mode with real backend count shape');
    const categoryReads = countCalls('/categories'), policyReads = countCalls('/policies');
    await nav('queue');
    assert.equal(await page.locator('tbody tr').count(), 15);
    await page.getByRole('button', { name: 'Next', exact: true }).click(); assert.equal(await page.locator('tbody tr').count(), 2);
    check('complete queue retains 15-row client pagination');
    await page.getByPlaceholder('Search by ID, submitter, merchant, notes...').fill('CMP-03');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByPlaceholder('Search by ID, submitter, merchant, notes...').fill('');
    await page.locator('main select').nth(0).selectOption('high');
    assert.equal(await page.locator('tbody tr').count(), 5);
    await page.locator('main select').nth(1).selectOption('manager');
    assert.equal(await page.locator('tbody tr').count(), 3);
    await page.locator('main select').nth(2).selectOption('travel');
    await page.locator('main select').nth(3).selectOption('risk-desc');
    assert.equal(await page.locator('tbody tr').count(), 3);
    check('search, risk/source/category filters and sorting combine without losing queue records');
    await nav('policies'); await visible('Active QA travel policy');
    assert.equal(countCalls('/categories'), categoryReads); assert.equal(countCalls('/policies'), policyReads);
    check('shared catalog cache and Provider survive internal navigation');
    await nav('queue');
    await page.getByRole('button', { name: 'Inspect', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Inspect Receipt', exact: true }).click();
    await page.getByRole('dialog').locator('img').waitFor();
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.waitForFunction(() => window.fin84ObjectUrls.size === 0);
    check('local receipt preview and modal Escape remain functional');

    await page.getByRole('button', { name: 'Reject', exact: true }).first().click();
    await submit('Confirm Rejection', ''); await visible('A rejection reason is required');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    check('local decision-note validation prevents an empty rejection');
    failDecision = true;
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
    await submit('Approve Exception'); await visible('No active Finance Officer');
    assert.equal(await queueBadge().innerText(), '17'); assert.equal(await page.getByRole('dialog').count(), 1);
    check('failed decision retains expense, note, dialog and retry workflow');
    failDecision = false;
    const write = { started: deferred(), release: deferred() }; delayedDecision = write;
    const beforeWrite = countCalls('/compliance/approve');
    await page.getByRole('dialog').getByRole('button', { name: 'Approve Exception', exact: true }).click();
    await write.started.promise;
    assert(await page.getByRole('dialog').getByRole('button', { name: 'Submitting…', exact: true }).isDisabled());
    assert.equal(countCalls('/compliance/approve'), beforeWrite + 1);
    write.release.resolve(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); await idle();
    assert.equal(await queueBadge().innerText(), '16');
    check('successful decision prevents duplicate submission and updates queue badge');
    await nav('dashboard'); await visible('View All (16)');
    await nav('policies'); await visible('Policy Exceptions Awaiting Review (16)');
    check('dashboard, queue and violations share post-decision authoritative state');

    await nav('notifications'); assert.equal(await page.locator('.compliance-notif-item').count(), 20);
    assert.equal(await badge().innerText(), '43');
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await idle();
    await visible('QA notice 20');
    failNotice = true;
    await page.getByRole('button', { name: 'Mark Read', exact: true }).first().click(); await idle(); await visible('Read failed');
    assert.equal(await badge().innerText(), '43');
    failNotice = false;
    await page.getByRole('button', { name: 'Unread Only', exact: true }).click(); await idle();
    await page.getByRole('button', { name: 'Mark Read', exact: true }).first().click(); await idle();
    await page.waitForFunction(() => document.querySelector('nav a[href="/compliance/notifications"] b')?.textContent === '42');
    assert.equal(await badge().innerText(), '42'); assert.equal(await page.getByText('QA notice 0', { exact: true }).count(), 0);
    check('server notification pagination/filtering, failed read and successful read keep aggregate badge consistent');
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await idle(); await visible('QA notice 21');
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await idle(); await visible('QA notice 41');
    for (const [id, remaining] of [[41, 41], [42, 40]]) {
      const response = page.waitForResponse(response => response.url().endsWith(`/notifications/NOTICE-${id}/read`));
      await page.getByRole('button', { name: 'Mark Read', exact: true }).first().click(); await response;
      await page.waitForFunction(expected => document.querySelector('nav a[href="/compliance/notifications"] b')?.textContent === expected, String(remaining));
    }
    await visible('Page 2 of 2');
    assert.equal(await page.locator('.compliance-notif-item').count(), 20);
    check('notification mutations clamp a removed last page using the authoritative filtered total');
    await page.getByRole('button', { name: 'Mark All Read', exact: true }).click(); await idle();
    await visible('No Notifications'); assert.equal(await badge().count(), 0);
    check('read-all updates unread list, total and layout badge');

    await nav('audit'); await visible('qa_event_1');
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await idle(); await visible('qa_event_2');
    const search = page.getByPlaceholder('Search actor, event code, or target ID...');
    const applyAuditFilters = () => page.getByRole('button', { name: 'Filter', exact: true }).click();
    const slowAudit = { started: deferred(), release: deferred() }; delayedAudit = slowAudit;
    await search.fill('old'); await applyAuditFilters(); await slowAudit.started.promise;
    await search.fill('latest'); await applyAuditFilters(); await visible('qa_latest_1');
    slowAudit.release.resolve(); await idle(); assert.equal(await page.getByText('qa_old_1', { exact: true }).count(), 0);
    assert.equal(calls.filter(c => c.endpoint.endsWith('/audit-logs') && c.query.search === 'old').length, 1);
    await page.locator('main select').selectOption('FAILED');
    await page.getByTitle('From date').fill('2026-10-01'); await page.getByTitle('To date').fill('2026-10-31'); await applyAuditFilters(); await idle();
    const audit = calls.filter(c => c.endpoint.endsWith('/audit-logs')).at(-1);
    assert.deepEqual(audit.query, { page: '1', pageSize: '25', search: 'latest', outcome: 'FAILED', from: '2026-10-01', to: '2026-10-31T23:59:59.999Z' });
    check('audit server pagination and rapid filter changes reject stale responses and preserve query parameters');
    failExport = true;
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click(); await idle(); await visible('Failed to export audit logs.');
    failExport = false;
    const slowExport = { started: deferred(), release: deferred() }; delayedExport = slowExport;
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click(); await slowExport.started.promise;
    await search.fill('during-export'); await applyAuditFilters(); await visible('qa_during-export_1');
    const download = page.waitForEvent('download'); slowExport.release.resolve();
    const file = await download; assert.equal(file.suggestedFilename(), 'finstack-compliance-audit.csv');
    assert.equal(await fs.readFile(await file.path(), 'utf8'), 'eventCode,outcome\nqa_event,SUCCESS\n');
    assert.equal(await page.evaluate(() => window.fin84ObjectUrls.size), 0);
    check('CSV export retains filename/content and remains independent of audit query loading');

    let beforeAudit = countCalls('/audit-logs');
    await page.clock.runFor(30_001); await idle();
    assert(countCalls('/audit-logs') > beforeAudit);
    check('30-second audit polling refreshes active server query');
    failAudit = true; await page.clock.runFor(30_001); await idle();
    await visible('Unable to refresh audit history'); await visible('qa_during-export_1');
    failAudit = false; await page.clock.runFor(30_001); await idle();
    assert.equal(await page.getByText('Unable to refresh audit history.', { exact: false }).count(), 0);
    check('background errors retain valid audit data and recover on the next refresh');
    await nav('queue');
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
    await page.getByRole('dialog').locator('textarea').fill('draft survives polling');
    await page.clock.runFor(15_001); await idle();
    assert.equal(await page.getByRole('dialog').locator('textarea').inputValue(), 'draft survives polling');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    check('15-second background queue refresh preserves open dialog drafts');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: 'Approve', exact: true }).click(); await submit('Approve Exception');
    assert.equal(await page.locator('tbody tr').count(), 15);
    assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).count(), 0);
    check('deciding the last row on a later queue page clamps pagination to valid remaining results');
    const slowQueue = { started: deferred(), release: deferred() }; delayedQueue = slowQueue;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await slowQueue.started.promise;
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click(); await submit('Approve Exception');
    slowQueue.release.resolve(); await idle(); assert.equal(await queueBadge().innerText(), '14');
    check('a pre-decision queued refresh cannot restore the resolved claim');
    await page.clock.resume();
    await page.screenshot({ path: path.join(output, 'compliance-queue.png'), fullPage: true });

    failCategories = true;
    await page.reload(); await visible('Retry categories');
    assert.equal(await page.locator('tbody tr').count(), 14);
    failCategories = false; await page.getByRole('button', { name: 'Retry categories', exact: true }).click();
    await page.locator('main select option[value="travel"]').waitFor({ state: 'attached' });
    check('optional category failure leaves the queue available and has an independent retry');
    failQueue = true;
    await page.reload(); await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    failQueue = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect', exact: true }).first().waitFor();
    expenses = []; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await visible('All Clear');
    expenses = [claim(1)]; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await visible('CMP-01');
    check('queue initial error/retry and empty-data states remain recoverable');
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Corrective Action', exact: true }).click();
    await submit('Submit Action');
    assert.equal(await queueBadge().innerText(), '1');
    await page.getByRole('button', { name: 'Reject', exact: true }).click(); await submit('Confirm Rejection');
    await visible('All Clear'); assert.equal(await queueBadge().count(), 0);
    check('corrective action retains the server workflow while rejection removes the reviewed claim');
    expenses = [claim(1)]; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await visible('CMP-01');
    await nav('dashboard');
    await page.screenshot({ path: path.join(output, 'compliance-dashboard.png'), fullPage: true });

    await nav('settings'); assert(await page.getByRole('button', { name: 'Save Preferences', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    assert.equal(await page.locator('.compliance-workspace.is-collapsed').count(), 1);
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    assert.equal(await page.locator('.compliance-workspace.is-mobile-open').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.compliance-workspace.is-mobile-open').count(), 0);
    check('settings stay local/unavailable; sidebar and mobile keyboard navigation work');
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Simulate supported session replacement events with fictional identities.
    const switchSession = async (nextUser, token) => {
      user = nextUser;
      await page.evaluate(({ user, token }) => {
        sessionStorage.setItem('finstackTenantAccessToken', token);
        sessionStorage.setItem('finstackTenantUser', JSON.stringify(user));
        window.dispatchEvent(new Event('finstack:session'));
      }, { user, token });
      await idle();
    };
    await nav('queue');
    const oldQueue = { started: deferred(), release: deferred() }; delayedQueue = oldQueue;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await oldQueue.started.promise;
    expenses = [{ ...claim(1), id: 'TENANT-B-ONLY', organizationId: 'org-b' }];
    await switchSession({ ...user, id: 'officer-b', organizationId: 'org-b', employeeId: 'CMP-B' }, 'fixture-session-b');
    oldQueue.release.resolve(); await visible('TENANT-B-ONLY'); await idle();
    assert.equal(await page.locator('tbody tr').count(), 1); assert.equal(await queueBadge().innerText(), '1');
    check('account/tenant switch aborts old requests and displays only the new session');
    await switchSession({ ...user, role: 'FINANCE_OFFICER' }, 'fixture-session-c');
    await page.waitForURL(base + '/forbidden'); assert.equal(await page.locator('.compliance-workspace').count(), 0);
    check('role switch preserves protected-route denial and removes Compliance data');
    user = { ...user, role: 'COMPLIANCE_OFFICER' };
    await switchSession(user, 'fixture-session-d');
    await page.goto(base + '/compliance/queue'); await visible('TENANT-B-ONLY');
    await nav('settings'); await page.getByRole('button', { name: 'Sign Out of FinStack', exact: true }).click();
    await page.waitForURL(base + '/login');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finstackTenantAccessToken')), null);
    assert.equal(await page.locator('.compliance-workspace').count(), 0);
    check('logout clears the session and unmounts the Provider');

    await page.locator('#employee-id').fill('CMP-QA'); await page.locator('#password-input').fill('fixture-only');
    await page.locator('#login-form button[type="submit"]').click(); await idle();
    expire = true; await page.reload(); await page.waitForURL(base + '/login');
    check('expired authentication removes the Compliance workspace');
    assert.deepEqual(errors, []);
    check('no uncaught browser errors, Redux serialization warnings or effect loops');
  } finally {
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ mode: 'mocked API browser integration; no backend/database verification', passed: checks.length, checks, errors }, null, 2));
    await browser.close();
  }
});
