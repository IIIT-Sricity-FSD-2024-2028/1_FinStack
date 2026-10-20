/* eslint @typescript-eslint/no-require-imports: "off" */
/* global require, process, console, URL, Buffer, sessionStorage, innerWidth, document */
/* Browser acceptance with fictional, intercepted tenant API responses only.
 * No backend, database, migrations, provider, or shared QA records are accessed.
 * Run with FINSTACK_PLAYWRIGHT_MODULE and (if needed) FINSTACK_CHROMIUM_PATH.
 * Start the React dev server separately; FINSTACK_ACTOR_BASE_URL defaults to 5583.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FINSTACK_ACTOR_BASE_URL || 'http://127.0.0.1:5583';
const output = process.env.FINSTACK_ACTOR_OUTPUT || '/tmp/finstack-actor-readiness/browser';
const checks = [], errors = [], apiCalls = [];
let browser, page, actor = 'finance', failure = '', empty = false, bankConflict = false, receiptStatus = 200;
let expenses, transactions, notifications;
const user = () => ({ id: `${actor}-qa`, organizationId: 'org-qa', employeeId: `${actor.toUpperCase()}-QA`, firstName: actor === 'finance' ? 'Finance' : 'Compliance', lastName: 'QA', email: `${actor}@fictional.test`, role: actor === 'finance' ? 'FINANCE_OFFICER' : 'COMPLIANCE_OFFICER', status: 'ACTIVE' });
const expense = (id, workflowStatus, extra = {}) => ({ id, organizationId: 'org-qa', employeeId: 'SUBMITTER-QA', managerEmployeeId: 'MANAGER-QA', assignedFinanceOfficerId: 'finance-qa', amount: '1234.50', currency: 'INR', categoryId: 'category-qa', category: 'Travel', merchant: `QA merchant ${id}`, date: '2026-10-14', workflowStatus, receiptFileName: 'fixture.png', managerDecision: 'Approved', history: [], ...extra });
function reset() {
  failure = ''; empty = false; bankConflict = false; receiptStatus = 200;
  expenses = [expense('FIN-REVIEW', 'finance_review'), expense('FIN-RELEASE', 'approved_for_payment'), expense('CMP-MANAGER', 'compliance_review', { managerDecision: 'Escalated', riskScore: 80 }), expense('CMP-FINANCE', 'compliance_review', { financeDecision: 'Flagged', riskScore: 50 }), expense('FIN-PAID', 'paid')];
  transactions = [{ id: 'TX-PENDING', expenseId: 'FIN-RELEASE', amount: '1234.50', currency: 'INR', status: 'pending', merchant: 'QA merchant', employeeId: 'SUBMITTER-QA' }, { id: 'TX-PROCESSED', expenseId: 'FIN-PAID', amount: '12.50', currency: 'INR', status: 'processed' }, { id: 'TX-FAILED', expenseId: 'FIN-RELEASE', amount: '3.50', currency: 'INR', status: 'failed' }];
  notifications = [{ id: 'NOTICE-1', title: 'QA review request', message: 'Fictional review event', type: 'info', unread: true, createdAt: '2026-10-14T08:00:00Z' }, { id: 'NOTICE-2', title: 'QA audit event', message: 'Fictional audit event', type: 'success', unread: true, createdAt: '2026-10-14T07:00:00Z' }];
}
function check(name) { checks.push(name); console.log(`PASS ${name}`); }
async function idle() { await page.waitForLoadState('networkidle'); }
async function goto(route) {
  await page.context().addCookies([{ name: 'qaActor', value: actor, url: base }]);
  const response = await page.goto(base + route);
  assert.equal(response.status(), 200, route);
  await idle();
  if (failure === 'auth-401' || route === '/login') await page.locator('#login-form').waitFor();
  else if (route.startsWith('/configuration/') || (route.startsWith('/finance/') && actor !== 'finance') || (route.startsWith('/compliance/') && actor !== 'compliance')) await page.waitForURL(`${base}/forbidden`);
  else await page.locator(`.${actor}-workspace`).waitFor();
}
async function textIncludes(text) { await page.getByText(text, { exact: false }).first().waitFor(); }
async function dialogSubmit(label, note) {
  const dialog = page.getByRole('dialog').last();
  if (note !== undefined) await dialog.locator('textarea').fill(note);
  const submitted = note !== undefined || label === 'Confirm' || label.startsWith('Confirm Release');
  const response = submitted ? page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/')) : null;
  await dialog.getByRole('button', { name: label, exact: true }).click();
  if (response && (await response).ok()) await dialog.waitFor({ state: 'hidden' });
  await idle();
}
async function fixtureRoute(route) {
  const request = route.request(), url = new URL(request.url());
  const endpoint = url.pathname, method = request.method();
  const json = (data, status = 200) => route.fulfill({ status, json: status < 400 ? { success: true, data } : { success: false, error: data } });
  if (!endpoint.startsWith('/api/')) {
    // Permit only this local frontend's assets and HTML. External calls are blocked.
    return url.origin === base ? route.continue() : route.abort();
  }
  apiCalls.push({ endpoint, method, origin: url.origin, headers: request.headers(), body: request.postDataJSON() });
  if (method === 'OPTIONS') return route.fulfill({ status: 204 });
  if (endpoint.endsWith('/auth/login')) return json({ accessToken: 'fictional-fixture-token', expiresIn: 3600, organizationId: 'org-qa', user: user(), workspace: { key: actor + '_officer', path: `/views/${actor}/dashboard.html` } });
  if (endpoint.endsWith('/auth/me')) return failure === 'auth-401' ? json({ code: 'EXPIRED', message: 'Sign in again' }, 401) : json({ organizationId: 'org-qa', user: user() });
  if (endpoint === failure) return json({ code: 'UNAVAILABLE', message: 'Fictional service error' }, 500);
  if (endpoint.endsWith('/receipt')) return receiptStatus === 200 ? route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL2kAAAAASUVORK5CYII=', 'base64') }) : json({ code: 'RECEIPT_DENIED', message: 'Receipt unavailable' }, receiptStatus);
  if (endpoint.endsWith('/categories')) return json(empty ? [] : [{ id: 'category-qa', name: 'Travel' }]);
  if (endpoint.endsWith('/policies')) return json(empty ? [] : [{ id: 'policy-qa', name: 'QA travel policy', categoryId: 'category-qa', maxAmount: '2000.50', currency: 'INR', receiptRequired: true }]);
  if (endpoint.endsWith('/finance/workspace')) return json({ expenses: empty ? [] : expenses, transactions: empty ? [] : transactions });
  if (endpoint.endsWith('/finance/queue')) return json(empty ? [] : expenses.filter(e => e.workflowStatus === 'finance_review'));
  if (endpoint.endsWith('/compliance/queue')) return json(empty ? [] : expenses.filter(e => e.workflowStatus === 'compliance_review'));
  if (/\/finance\/transactions\/[^/]+\/(process|fail|reconcile)$/.test(endpoint)) {
    const parts = endpoint.split('/'), action = parts.pop(), id = parts.pop();
    if (bankConflict && action !== 'fail') return json({ code: 'TENANT_BANK_EVIDENCE_REQUIRED', message: 'Verified bank evidence required' }, 409);
    const tx = transactions.find(t => t.id === id);
    tx.status = { process: 'processed', fail: 'failed', reconcile: 'reconciled' }[action];
    return json(tx);
  }
  if (endpoint.endsWith('/finance/payment-releases')) {
    const ids = request.postDataJSON().expenseIds;
    const released = expenses.filter(e => ids.includes(e.id));
    released.forEach(e => { e.workflowStatus = 'payment_processing'; });
    return json({ batchId: 'BATCH-QA', expenses: released, transactions: [{ id: 'TX-BATCH-QA', status: 'pending' }] });
  }
  if (/\/(finance|compliance)\/(approve|reject|request-info|flag|corrective-action)$/.test(endpoint)) {
    const parts = endpoint.split('/'), action = parts.pop(), role = parts.pop(), id = parts.pop();
    const record = expenses.find(e => e.id === id);
    record.workflowStatus = role === 'finance' ? { approve: 'approved_for_payment', reject: 'rejected', 'request-info': 'returned', flag: 'compliance_review' }[action] : { approve: 'finance_review', reject: 'rejected', 'corrective-action': 'compliance_review' }[action];
    return json(record);
  }
  if (endpoint.endsWith('/notifications/unread-count')) return json({ count: notifications.filter(n => n.unread).length });
  if (endpoint.endsWith('/notifications/page')) {
    const state = url.searchParams.get('state');
    const items = empty ? [] : notifications.filter(n => !state || (state === 'unread' ? n.unread : !n.unread));
    return json({ items, total: items.length, unreadCount: notifications.filter(n => n.unread).length, page: 1, pageSize: 20, totalPages: 1 });
  }
  if (endpoint.endsWith('/notifications/read-all')) { notifications.forEach(n => { n.unread = false; }); return json({ count: notifications.length }); }
  if (/\/notifications\/[^/]+\/read$/.test(endpoint)) { notifications.find(n => n.id === endpoint.split('/').at(-2)).unread = false; return json({ unread: false }); }
  if (endpoint.endsWith('/audit-logs/export')) return route.fulfill({ contentType: 'text/csv', body: 'eventCode,outcome\nqa_event,SUCCESS\n' });
  if (endpoint.endsWith('/audit-logs')) {
    const currentPage = Number(url.searchParams.get('page') || 1);
    return json({ items: empty ? [] : [{ id: `audit-${currentPage}`, eventCode: `qa_event_${currentPage}`, occurredAt: '2026-10-14T07:00:00Z', actorName: 'QA reviewer', targetType: 'employee', outcome: 'SUCCESS' }], total: empty ? 0 : 26, page: currentPage, pageSize: 25, totalPages: empty ? 0 : 2 });
  }
  throw new Error(`Unexpected API endpoint: ${method} ${endpoint}`);
}
async function actorRoutes() {
  for (actor of ['finance', 'compliance']) {
    reset();
    const pages = actor === 'finance' ? ['dashboard', 'queue', 'payments', 'transactions', 'notifications', 'settings'] : ['dashboard', 'queue', 'policies', 'audit', 'notifications', 'settings'];
    for (const route of pages) {
      await goto(`/${actor}/${route}`);
      assert.equal(await page.locator(`.${actor}-workspace`).count(), 1);
      assert.equal(await page.getByText('This page could not be displayed', { exact: true }).count(), 0);
      await page.reload(); await idle();
      await page.locator(`.${actor}-workspace`).waitFor();
      assert.equal(await page.locator(`.${actor}-workspace`).count(), 1);
      check(`${actor}: ${route} deep link and reload`);
    }
    const legacy = actor === 'finance' ? { 'dashboard': 'dashboard', 'finance-review': 'queue', 'payments': 'payments', 'transactions': 'transactions', 'reconciliation': 'transactions', 'flagged-expenses': 'queue', 'reports': 'dashboard', 'profile-settings': 'settings', 'preferences': 'settings' } : { 'dashboard': 'dashboard', 'escalated-expenses': 'queue', 'compliance': 'queue', 'policies': 'policies', 'audit': 'audit', 'communications': 'notifications', 'profile-settings': 'settings' };
    for (const [old, next] of Object.entries(legacy)) {
      await goto(`/views/${actor}/${old}.html?review=1#actor`);
      assert.equal(new URL(page.url()).pathname, `/${actor}/${next}`);
      assert.equal(new URL(page.url()).search, '?review=1');
      assert.equal(new URL(page.url()).hash, '#actor');
    }
    check(`${actor}: all legacy URLs enter React and preserve query/hash`);
    await goto('/login');
    await page.locator('#employee-id').fill(`${actor.toUpperCase()}-QA`);
    await page.locator('#password-input').fill('fixture-only');
    await page.locator('#login-form button[type=submit]').click();
    await page.waitForURL(`${base}/${actor}/dashboard`); await idle();
    assert.equal(new URL(page.url()).pathname, `/${actor}/dashboard`);
    check(`${actor}: login destination`);
    await goto(`/${actor === 'finance' ? 'compliance' : 'finance'}/queue`);
    assert.equal(new URL(page.url()).pathname, '/forbidden');
    check(`${actor}: other actor route denied`);
    await goto('/configuration/manage-users');
    assert.equal(new URL(page.url()).pathname, '/forbidden');
    check(`${actor}: Configuration Manager gate preserved`);
    await goto(`/${actor}/settings`);
    assert(await page.getByRole('button', { name: 'Save Preferences', exact: true }).isDisabled());
    await textIncludes('saving is unavailable');
    check(`${actor}: unavailable preference saving is explicit`);
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    assert(await page.locator(`.${actor}-workspace.nav-collapsed`).count());
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await page.getByRole('button', { name: `${user().firstName} QA ▾`, exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL(`${base}/login`); await idle();
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finstackTenantAccessToken')), null);
    check(`${actor}: sidebar/profile menu and logout`);
  }
}
async function reviewActions() {
  actor = 'finance';
  for (const action of ['approve', 'reject', 'request-info', 'flag']) {
    reset(); await goto('/finance/queue');
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    await page.getByAltText('Receipt for FIN-REVIEW').waitFor();
    assert.equal(await page.getByRole('dialog').locator('.finance-modal-content').count(), 1);
    await page.getByRole('dialog').getByRole('button', { name: { approve: 'Approve for Payment', reject: 'Reject', 'request-info': 'Request Info', flag: 'Flag' }[action], exact: true }).click();
    const label = { approve: 'Confirm Approval', reject: 'Confirm Rejection', 'request-info': 'Send Request', flag: 'Flag Expense' }[action];
    if (action !== 'approve') { await dialogSubmit(label); await textIncludes('Please provide a note'); }
    await dialogSubmit(label, '  QA decision note  ');
    const call = apiCalls.filter(c => c.endpoint.endsWith(`/FIN-REVIEW/finance/${action}`)).at(-1);
    assert.equal(call.method, 'POST'); assert.deepEqual(call.body, { note: 'QA decision note' });
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.reload(); await idle();
    assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).count(), 0);
    check(`finance: receipt/details, ${action}, validation and server refresh`);
  }
  reset(); await goto('/finance/dashboard');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await dialogSubmit('Confirm Approval', 'QA dashboard approval');
  assert(expenses.find(e => e.id === 'FIN-REVIEW').workflowStatus === 'approved_for_payment');
  check('finance: dashboard approval');
  actor = 'compliance';
  for (const action of ['approve', 'reject', 'correctiveAction']) {
    reset(); await goto('/compliance/queue');
    await page.locator('select').nth(1).selectOption('manager'); await idle();
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Inspect Receipt', exact: true }).click();
    await page.getByAltText('Receipt for CMP-MANAGER').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: { approve: 'Approve Exception', reject: 'Reject Claim', correctiveAction: 'Corrective Action' }[action], exact: true }).click();
    const label = { approve: 'Approve Exception', reject: 'Confirm Rejection', correctiveAction: 'Submit Action' }[action];
    if (action !== 'approve') { await dialogSubmit(label); assert.equal(await page.getByRole('alert').count(), 1); }
    await dialogSubmit(label, '  QA compliance note  ');
    const endpoint = action === 'correctiveAction' ? 'corrective-action' : action;
    const call = apiCalls.filter(c => c.endpoint.endsWith(`/CMP-MANAGER/compliance/${endpoint}`)).at(-1);
    assert.deepEqual(call.body, { note: 'QA compliance note' });
    if (action === 'approve') {
      actor = 'finance'; await goto('/finance/queue'); await textIncludes('CMP-MANAGER'); actor = 'compliance';
    }
    check(`compliance: manager escalation filter, receipt, ${action}, validation${action === 'approve' ? ' and routing to Finance' : ''}`);
  }
  for (const route of ['dashboard', 'policies']) {
    reset(); await goto(`/compliance/${route}`);
    await page.getByRole('button', { name: route === 'dashboard' ? 'Inspect' : 'Review', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve Exception', exact: true }).click();
    await dialogSubmit('Approve Exception', 'QA exception approval');
    check(`compliance: ${route} case approval`);
  }
}
async function paymentActions() {
  actor = 'finance'; reset(); await goto('/finance/payments');
  await page.getByLabel('Select FIN-RELEASE', { exact: true }).check();
  await page.getByRole('button', { name: 'Release Batch (1)', exact: true }).click();
  await dialogSubmit('Confirm Release (1)'); await textIncludes('Batch Created: BATCH-QA');
  assert(expenses.find(e => e.id === 'FIN-RELEASE').workflowStatus === 'payment_processing');
  check('finance: internal payment batch creation and refreshed eligibility');
  for (const action of ['process', 'fail', 'reconcile']) {
    reset(); await goto('/finance/transactions');
    await page.getByRole('button', { name: { process: 'Request Processing', fail: 'Mark Failed', reconcile: 'Request Reconciliation' }[action], exact: true }).click();
    await dialogSubmit('Confirm'); await textIncludes('request recorded');
    assert.doesNotMatch(await page.locator('main').innerText(), /marked paid|payment completed|full settlement/i);
    check(`finance: ${action} request uses server state and never asserts payment completion`);
  }
  for (const action of ['process', 'reconcile']) {
    reset(); bankConflict = true; await goto('/finance/transactions');
    await page.getByRole('button', { name: action === 'process' ? 'Request Processing' : 'Request Reconciliation', exact: true }).click();
    await dialogSubmit('Confirm'); await textIncludes('Bank evidence is required');
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(transactions.find(t => t.id === 'TX-PENDING').status, 'pending');
    assert.equal(transactions.find(t => t.id === 'TX-PROCESSED').status, 'processed');
    assert.equal(await page.getByText('request recorded', { exact: false }).count(), 0);
    check(`finance: ${action} 409 TENANT_BANK_EVIDENCE_REQUIRED retains modal/state without success`);
  }
}
async function notificationsAndAudit() {
  for (actor of ['finance', 'compliance']) {
    reset(); await goto(`/${actor}/notifications`);
    await page.getByRole('button', { name: 'Mark Read', exact: true }).first().click(); await idle();
    assert.equal(notifications.filter(n => n.unread).length, 1);
    await page.getByRole('button', { name: actor === 'finance' ? 'Mark All as Read' : 'Mark All Read', exact: true }).click(); await idle();
    assert.equal(notifications.filter(n => n.unread).length, 0);
    if (actor === 'finance') await page.locator('main select').selectOption('unread');
    else await page.getByRole('button', { name: 'Unread Only', exact: true }).click();
    await idle(); await textIncludes('No Notifications');
    check(`${actor}: mark read/all read and refreshed unread filter`);
  }
  actor = 'compliance'; reset(); await goto('/compliance/audit');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await idle(); await textIncludes('qa_event_2');
  await page.getByPlaceholder('Search actor, event code, or target ID...').fill('qa');
  await page.getByRole('button', { name: 'Filter', exact: true }).click(); await idle(); await textIncludes('qa_event_1');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'finstack-compliance-audit.csv');
  check('compliance: audit pagination, filter reset and CSV export (branch-specific permission)');
}
async function statesAndMobile() {
  for (actor of ['finance', 'compliance']) {
    reset(); empty = true; await goto(`/${actor}/queue`);
    await textIncludes(actor === 'finance' ? 'No Expenses Found' : 'All Clear');
    check(`${actor}: empty queue`);
    reset(); failure = `/api/v1/tenant/expenses/${actor === 'finance' ? 'finance/workspace' : 'compliance/queue'}`;
    await goto(`/${actor}/queue`); await textIncludes('temporarily unavailable');
    failure = ''; await page.getByRole('button', { name: actor === 'finance' ? 'Try Again' : 'Retry', exact: true }).click(); await idle();
    assert(await page.locator('tbody tr').count() > 0);
    check(`${actor}: queue error and retry`);
    reset(); receiptStatus = 404; await goto(`/${actor}/queue`);
    await page.getByRole('button', { name: actor === 'finance' ? 'Details' : 'Inspect', exact: true }).first().click();
    if (actor === 'compliance') await page.getByRole('dialog').getByRole('button', { name: 'Inspect Receipt', exact: true }).click();
    await textIncludes('Receipt not found.'); await page.keyboard.press('Escape');
    check(`${actor}: missing receipt and modal escape`);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['dashboard', 'settings']) {
      reset(); await goto(`/${actor}/${route}`);
      const width = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth }));
      assert(width.body <= width.viewport + 1, `${actor}/${route} overflow: ${JSON.stringify(width)}`);
    }
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    assert.equal(await page.locator(`.${actor}-workspace.nav-mobile-open`).count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(`.${actor}-workspace.nav-mobile-open`).count(), 0);
    await page.screenshot({ path: path.join(output, `${actor}-mobile.png`), fullPage: true });
    check(`${actor}: mobile dashboard/settings and navigation`);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  actor = 'finance'; reset(); failure = 'auth-401'; await goto('/finance/queue');
  assert.equal(new URL(page.url()).pathname, '/login');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('finstackTenantAccessToken')), null);
  check('shared auth: 401 clears actor session and redirects');
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.FINSTACK_CHROMIUM_PATH ? { executablePath: process.env.FINSTACK_CHROMIUM_PATH } : {}) });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /cannot be a child|hydration|uncaught/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/*', fixtureRoute);
  // Seed only on full document load; route guards still verify the server fixture.
  await page.addInitScript(() => {
    const role = document.cookie.includes('qaActor=compliance') ? 'COMPLIANCE_OFFICER' : 'FINANCE_OFFICER';
    const actor = role === 'COMPLIANCE_OFFICER' ? 'compliance' : 'finance';
    sessionStorage.setItem('finstackTenantAccessToken', 'fictional-fixture-token');
    sessionStorage.setItem('finstackTenantUser', JSON.stringify({ id: `${actor}-qa`, organizationId: 'org-qa', employeeId: `${actor.toUpperCase()}-QA`, role, status: 'ACTIVE' }));
  });
  // Fixture identity follows the test actor, including cross-role route denial.
  await actorRoutes(); await reviewActions(); await paymentActions(); await notificationsAndAudit(); await statesAndMobile();
  assert.deepEqual(errors, []);
  assert(apiCalls.every(call => call.origin === base), 'Actor API transport must use injected same-origin base');
  assert(apiCalls.filter(call => !call.endpoint.endsWith('/auth/login')).every(call => call.headers.authorization === 'Bearer fictional-fixture-token'));
  assert(apiCalls.every(call => !('role' in call.headers) && !('organizationid' in call.headers)));
  check('all actor APIs: bearer only, same-origin base, no browser runtime/DOM nesting errors');
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ mode: 'mocked API browser acceptance; no database verification', passed: checks.length, checks, errors }, null, 2) + '\n');
  console.log(`${checks.length} browser checks passed. No backend/database was accessed.`);
})().catch(async error => {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ checks, errors, failure: error.message }, null, 2) + '\n');
  process.exitCode = 1;
}).finally(async () => { await browser?.close(); });
