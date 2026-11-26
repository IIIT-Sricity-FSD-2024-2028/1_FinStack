// Opt-in integration checks. Never run against existing QA or production data.
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../..');
if (!process.env.FINSTACK_CANONICAL_QA_STATE)
  throw Error('Explicit private disposable canonical-QA state required');
const state = JSON.parse(
  fs.readFileSync(process.env.FINSTACK_CANONICAL_QA_STATE, 'utf8'),
);
const qa = JSON.parse(
  fs.readFileSync(
    path.join(repo, 'back-end/.tmp/manual-qa/environment.json'),
    'utf8',
  ),
);
const url = new URL(qa.env.DATABASE_URL);
if (
  !/^finstack_canonical_qa_[a-f0-9]{32}$/.test(state.database) ||
  url.pathname.slice(1) !== state.database ||
  url.hostname !== '127.0.0.1' ||
  url.port !== '15449' ||
  url.searchParams.get('schema') !== state.schema ||
  qa.env.PORT !== '3403'
)
  throw Error(
    'Refusing any database outside the explicit new disposable canonical-ID sandbox',
  );
Object.assign(process.env, qa.env);
process.chdir(path.join(repo, 'back-end'));
const { PrismaClient } = require('@prisma/client'),
  db = new PrismaClient({ datasourceUrl: qa.env.DATABASE_URL });
const fixture = JSON.parse(
  fs.readFileSync(path.join(state.root, 'accounts-private.json'), 'utf8'),
);
const base = 'http://127.0.0.1:3403',
  web = 'http://127.0.0.1:5585';
const canonical = /^[A-Z][A-Z0-9]{1,11}-[1-9][0-9]{3}$/;
const run = crypto.randomUUID().slice(0, 8),
  password = crypto.randomBytes(24).toString('base64url') + '!Q7';
const sessions = {},
  checks = [];
let stage = 'isolation',
  browser,
  rateLimits = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function pass(name) {
  checks.push(name);
  console.log('PASS ' + name);
}
async function call(route, body, token, method) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + route, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      ...(!multipart && body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json() };
}
async function api(...args) {
  const result = await call(...args);
  assert(result.status < 400, 'HTTP ' + result.status);
  return result.json.data;
}
async function login(employeeId, password) {
  for (let i = 0; i < 18; i++) {
    const result = await call('/api/v1/tenant/auth/login', {
      employeeId,
      password,
    });
    if (result.status === 429) {
      rateLimits++;
      await delay(5000);
      continue;
    }
    assert.equal(result.status, 201);
    return result.json.data;
  }
  throw Error('Configured login throttle did not clear');
}
async function eventual(fn) {
  for (let i = 0; i < 160; i++) {
    const result = await fn();
    if (result) return result;
    await delay(250);
  }
  throw Error('Expected workflow state was not observed');
}
async function main() {
  await require('../dist/src/common/config/manual-qa').verifyManualQaDatabase(
    db,
  );
  const [actual] = await db.$queryRawUnsafe(
    "SELECT current_database() AS database, current_setting('data_directory') AS directory",
  );
  assert.equal(actual.database, state.database);
  assert.equal(
    path.resolve(actual.directory).toLowerCase(),
    path.resolve(state.original_cluster_directory).toLowerCase(),
  );
  pass('Explicit fresh disposable database and server identity verified');
  stage = 'five actor canonical and legacy logins';
  for (const key of [
    'config',
    'submitter',
    'manager',
    'finance',
    'compliance',
  ]) {
    const a = fixture.accounts[key],
      current = await login(a.canonicalEmployeeId, a.password),
      old = await login(a.employeeId, a.password);
    assert.equal(current.user.id, a.id);
    assert.equal(old.user.id, a.id);
    assert.equal(current.organizationId, fixture.organizationId);
    assert.equal(current.user.role, a.role.toUpperCase().replace(/\s+/g, '_'));
    assert.equal(current.user.employeeId, a.canonicalEmployeeId);
    assert(canonical.test(current.user.employeeId));
    assert.equal(old.user.employeeId, current.user.employeeId);
    for (const hidden of [
      'employeeCode',
      'canonicalEmployeeId',
      'legacyEmployeeId',
    ])
      assert(!(hidden in current.user));
    sessions[key] = current;
    pass(
      key +
        ': canonical password login and hidden legacy alias preserve UUID, tenant and role',
    );
  }
  let wrong;
  for (let i = 0; i < 18; i++) {
    wrong = await call('/api/v1/tenant/auth/login', {
      employeeId: fixture.accounts.submitter.canonicalEmployeeId,
      password: 'intentionally-wrong-password',
    });
    if (wrong.status !== 429) break;
    rateLimits++;
    await delay(5000);
  }
  assert.equal(wrong.status, 401);
  pass('Incorrect password denied; authentication throttling retained');
  stage = 'original dashboard reproduction';
  const mine = await api(
      '/api/v1/tenant/expenses/mine',
      null,
      sessions.submitter.accessToken,
    ),
    original = mine.find(
      (x) =>
        x.workflowStatus === 'payment_processing' && Number(x.amount) === 400,
    );
  assert(original);
  assert.equal(original.status, 'approved');
  assert.equal(
    original.employeeId,
    fixture.accounts.submitter.canonicalEmployeeId,
  );
  const { summarizeWorkflow } = await import(
    require('node:url').pathToFileURL(
      path.join(
        repo,
        'front-end/client-react/src/features/submitter/workflowSummary.js',
      ),
    ).href
  );
  assert.deepEqual(summarizeWorkflow([original]), {
    pending: 0,
    approved: 1,
    processing: 1,
    paid: 0,
    draft: 0,
    rejected: 0,
    unknown: 0,
  });
  pass(
    'Existing INR 400 payment_processing expense remains approved and processing, never confirmed paid',
  );
  stage = 'onboarding and prefix uniqueness';
  const plans = await api('/api/v1/tenant/onboarding/plans');
  async function register(suffix) {
    return api('/api/v1/tenant/registrations/organizations', {
      registrationCountry: 'IN',
      registrationExemptionReason:
        'Entirely fictional disposable local canonical-ID regression.',
      authorizedContactTitle: 'Local QA tester',
      name: 'Fictional Identity Regression',
      primaryEmail: 'office@identity-' + run + suffix + '.test',
      firstName: 'Identity',
      lastName: 'Configuration',
      email: 'config@identity-' + run + suffix + '.test',
      password,
      planId: plans.items.find((x) => x.key === 'manual-qa-plan').id,
      employeeCount: 50,
    });
  }
  const registered = await register('a'),
    similar = await register('b');
  assert(canonical.test(registered.employeeId));
  assert(canonical.test(similar.employeeId));
  assert.notEqual(
    registered.employeeId.split('-')[0],
    similar.employeeId.split('-')[0],
  );
  const reviewer = await api('/api/v1/platform/auth/login', {
    email: qa.reviewer.email,
    password: qa.reviewer.password,
  });
  await api(
    '/api/v1/platform/organizations/' +
      registered.organizationId +
      '/registration-reviews',
    {
      decision: 'APPROVED',
      note: 'Fictional disposable QA only; no actual business verification asserted.',
    },
    reviewer.accessToken,
  );
  const other = await login(registered.employeeId, password);
  assert.equal(other.user.employeeId, registered.employeeId);
  const beforeRename = await db.organization.findUnique({
    where: { id: registered.organizationId },
  });
  await db.organization.update({
    where: { id: registered.organizationId },
    data: { name: 'Renamed Fictional Organization' },
  });
  assert.equal(
    (
      await db.organization.findUnique({
        where: { id: registered.organizationId },
      })
    ).employeePrefix,
    beforeRename.employeePrefix,
  );
  await assert.rejects(
    db.organization.update({
      where: { id: registered.organizationId },
      data: { employeePrefix: 'OTHER' },
    }),
  );
  pass(
    'Same-name organizations receive distinct persisted prefixes; renaming cannot change an assigned prefix',
  );
  const created = [];
  async function createUser(i, role = 'EXPENSE_SUBMITTER', managerId) {
    const row = await api(
      '/api/v1/tenant/configuration/users',
      {
        firstName: 'Identity',
        lastName: 'Probe ' + i,
        email: 'probe-' + i + '@identity-' + run + 'a.test',
        initialPassword: password,
        role,
        ...(managerId ? { managerId } : {}),
      },
      other.accessToken,
    );
    assert(canonical.test(row.employeeId));
    assert(!('canonicalEmployeeId' in row));
    created.push(row);
    return row;
  }
  const manager = await createUser('manager', 'MANAGER'),
    finance = await createUser('finance', 'FINANCE_OFFICER'),
    compliance = await createUser('compliance', 'COMPLIANCE_OFFICER');
  for (let i = 0; i < 12; i += 4)
    await Promise.all(
      Array.from({ length: 4 }, (_, j) =>
        createUser(i + j, 'EXPENSE_SUBMITTER', manager.id),
      ),
    );
  for (const row of [
    manager,
    finance,
    compliance,
    created.find((x) => x.role === 'EXPENSE_SUBMITTER'),
  ]) {
    const result = await login(row.employeeId, password);
    assert.equal(result.user.id, row.id);
    assert.equal(result.organizationId, registered.organizationId);
  }
  assert.equal(new Set(created.map((x) => x.employeeId)).size, created.length);
  pass(
    'Onboarding and all new actor roles share one scheme; concurrent provisioning assigns distinct IDs atomically',
  );
  stage = 'password change and canonical login';
  const managerSession = await login(manager.employeeId, password),
    changedPassword = crypto.randomBytes(24).toString('base64url') + '!R8';
  await api(
    '/api/v1/tenant/me/settings/password-changes',
    {
      currentPassword: password,
      newPassword: changedPassword,
      confirmPassword: changedPassword,
    },
    managerSession.accessToken,
  );
  const changedSession = await login(manager.employeeId, changedPassword);
  assert.equal(changedSession.user.id, manager.id);
  assert.equal(changedSession.user.employeeId, manager.employeeId);
  assert.equal(
    (await call('/api/v1/tenant/auth/me', null, managerSession.accessToken))
      .status,
    401,
  );
  assert.equal(
    (
      await api(
        '/api/v1/tenant/me/settings/profile',
        null,
        changedSession.accessToken,
      )
    ).employeeId,
    manager.employeeId,
  );
  pass(
    'Supported password change preserves canonical login and profile identity and revokes the previous token',
  );
  stage = 'database uniqueness immutability and exhaustion';
  const hash = await require('argon2').hash(password);
  await assert.rejects(
    db.tenantUser.create({
      data: {
        organizationId: registered.organizationId,
        employeeId: fixture.accounts.submitter.canonicalEmployeeId,
        email: 'duplicate@identity-' + run + '.test',
        firstName: 'Duplicate',
        lastName: 'Probe',
        passwordHash: hash,
      },
    }),
  );
  await assert.rejects(
    db.tenantUser.update({
      where: { id: manager.id },
      data: { canonicalEmployeeId: beforeRename.employeePrefix + '-9998' },
    }),
  );
  await assert.rejects(
    db.$executeRawUnsafe(
      'UPDATE "EmployeeIdentityMapping" SET "operation" = \'tampered\' WHERE "userId" = $1::uuid',
      manager.id,
    ),
  );
  const rangeOrg = await db.organization.create({
    data: {
      name: 'Range Exhaustion Fictional',
      primaryEmail: 'range@identity-' + run + '.test',
    },
  });
  await db.organization.update({
    where: { id: rangeOrg.id },
    data: { nextEmployeeNumber: 9999 },
  });
  const last = await db.tenantUser.create({
    data: {
      organizationId: rangeOrg.id,
      employeeId: '__allocate__:' + crypto.randomUUID(),
      email: 'last@identity-' + run + '.test',
      firstName: 'Last',
      lastName: 'Number',
      role: 'CONFIGURATION_MANAGER',
      passwordHash: hash,
    },
  });
  assert(last.canonicalEmployeeId.endsWith('-9999'));
  const boundarySession = await login(last.canonicalEmployeeId, password);
  const capacity = await call(
    '/api/v1/tenant/configuration/users',
    {
      firstName: 'Capacity',
      lastName: 'Refusal',
      email: 'capacity@identity-' + run + '.test',
      initialPassword: password,
      role: 'EXPENSE_SUBMITTER',
    },
    boundarySession.accessToken,
  );
  assert.equal(capacity.status, 409);
  assert.equal(capacity.json.error.code, 'EMPLOYEE_ID_RANGE_EXHAUSTED');
  assert.equal(
    (await db.organization.findUnique({ where: { id: rangeOrg.id } }))
      .nextEmployeeNumber,
    10000,
  );
  pass(
    'Exhausted organization receives HTTP 409 EMPLOYEE_ID_RANGE_EXHAUSTED without wraparound or account creation',
  );
  await db.tenantUser.update({
    where: { id: last.id },
    data: { status: 'INACTIVE' },
  });
  await assert.rejects(
    db.tenantUser.create({
      data: {
        organizationId: rangeOrg.id,
        employeeId: '__allocate__:' + crypto.randomUUID(),
        email: 'overflow@identity-' + run + '.test',
        firstName: 'Overflow',
        lastName: 'Probe',
        passwordHash: hash,
      },
    }),
    /range exhausted/,
  );
  await assert.rejects(
    db.organization.update({
      where: { id: rangeOrg.id },
      data: { nextEmployeeNumber: 1001 },
    }),
  );
  pass(
    'Database rejects duplicate aliases and identity/audit edits; range exhaustion is explicit and inactive IDs are never reused',
  );
  stage = 'requested canonical example';
  const mainOrg = await db.organization.findUnique({
    where: { id: fixture.organizationId },
  });
  assert.equal(mainOrg.employeePrefix, 'FIC');
  const examplePath = path.join(state.root, 'example-login-private.json');
  let example;
  if (fs.existsSync(examplePath)) {
    example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
    assert.equal(
      (await db.tenantUser.findUnique({ where: { id: example.id } }))
        .canonicalEmployeeId,
      'FIC-1029',
    );
  } else {
    assert(mainOrg.nextEmployeeNumber <= 1029);
    await db.organization.update({
      where: { id: mainOrg.id },
      data: { nextEmployeeNumber: 1029 },
    });
    example = await api(
      '/api/v1/tenant/configuration/users',
      {
        firstName: 'Example',
        lastName: 'Canonical',
        email: 'example@identity-' + run + '.test',
        initialPassword: password,
        role: 'EXPENSE_SUBMITTER',
        managerId: fixture.accounts.manager.id,
      },
      sessions.config.accessToken,
    );
    assert.equal(example.employeeId, 'FIC-1029');
    example = { ...example, password };
    fs.writeFileSync(examplePath, JSON.stringify(example, null, 2));
  }
  assert.equal((await login('FIC-1029', example.password)).user.id, example.id);
  pass(
    'Requested example canonical Employee ID authenticates with its real password',
  );
  stage = 'CSV import hierarchy and activation';
  const csvIds = ['IMPORT-' + run + '-A', 'IMPORT-' + run + '-B'];
  const csv =
    'employeeId,firstName,lastName,email,managerEmployeeId\n' +
    csvIds
      .map((id, i) =>
        [
          id,
          'CSV',
          'Probe',
          `csv-${i}@identity-${run}.test`,
          fixture.accounts.manager.canonicalEmployeeId,
        ].join(','),
      )
      .join('\n');
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'identities.csv');
  const uploadedResponse = await fetch(
    base + '/api/v1/tenant/configuration/employee-imports',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + sessions.config.accessToken,
        'idempotency-key': crypto.randomUUID(),
      },
      body: form,
    },
  );
  assert.equal(uploadedResponse.status, 201);
  const job = (await uploadedResponse.json()).data;
  assert.equal(job.validCount, 2);
  await api(
    '/api/v1/tenant/configuration/employee-imports/' + job.id + '/confirm',
    {},
    sessions.config.accessToken,
  );
  await eventual(
    async () =>
      (
        await api(
          '/api/v1/tenant/configuration/employee-imports/' + job.id,
          null,
          sessions.config.accessToken,
        )
      ).status === 'COMPLETED',
  );
  const resultRows = await api(
    '/api/v1/tenant/configuration/employee-imports/' + job.id + '/rows',
    null,
    sessions.config.accessToken,
  );
  assert.equal(resultRows.length, 2);
  assert(resultRows.every((x) => canonical.test(x.employeeId)));
  const links = await api(
    '/api/v1/tenant/configuration/employee-imports/' +
      job.id +
      '/activation-links',
    {},
    sessions.config.accessToken,
  );
  assert.equal(links.items.length, 2);
  for (let i = 0; i < 2; i++) {
    const item = links.items.find(
      (x) => x.email === `csv-${i}@identity-${run}.test`,
    );
    assert(canonical.test(item.employeeId));
    await api('/api/v1/tenant/employee-activation', {
      employeeId: i ? csvIds[i] : item.employeeId,
      token: item.token,
      password,
    });
    const current = await login(item.employeeId, password),
      old = await login(csvIds[i], password);
    assert.equal(current.user.id, old.user.id);
    assert.equal(current.user.employeeId, item.employeeId);
    assert.equal(
      (await db.tenantUser.findUnique({ where: { id: current.user.id } }))
        .managerId,
      fixture.accounts.manager.id,
    );
    assert.equal(
      (
        await call('/api/v1/tenant/employee-activation', {
          employeeId: item.employeeId,
          token: item.token,
          password,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await call(
        '/api/v1/tenant/configuration/employee-imports/' + job.id,
        null,
        other.accessToken,
      )
    ).status,
    404,
  );
  pass(
    'CSV results and activation links expose canonical IDs; activation aliases, single-use tokens, hierarchy and tenant isolation pass',
  );

  stage = 'real cross-actor browser workflow';
  const { chromium } = require(
    process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright',
  );
  browser = await chromium.launch({
    headless: true,
    ...(process.env.FINSTACK_CHROMIUM_PATH
      ? { executablePath: process.env.FINSTACK_CHROMIUM_PATH }
      : {}),
  });
  const context = await browser.newContext();
  context.setDefaultTimeout(20000);
  context.setDefaultNavigationTimeout(30000);
  const pages = {},
    pageErrors = [];
  for (const [key, route] of [
    ['config', '/configuration/manage-users'],
    ['submitter', '/dashboard'],
    ['manager', '/manager/dashboard'],
    ['finance', '/finance/dashboard'],
    ['compliance', '/compliance/dashboard'],
  ]) {
    const page = await context.newPage();
    pages[key] = page;
    page.on('pageerror', () => pageErrors.push(key));
    await page.addInitScript((session) => {
      sessionStorage.setItem('finstackTenantAccessToken', session.accessToken);
      sessionStorage.setItem(
        'finstackTenantUser',
        JSON.stringify(session.user),
      );
    }, sessions[key]);
    await page.goto(web + route);
    await page.waitForLoadState('networkidle');
    assert.equal(
      await page
        .getByText('This page could not be displayed', { exact: true })
        .count(),
      0,
    );
  }

  for (const [key, route] of [
    ['config', '/configuration/profile-settings'],
    ['submitter', '/profile-settings'],
    ['manager', '/manager/profile-settings'],
    ['finance', '/finance/settings'],
    ['compliance', '/compliance/settings'],
  ]) {
    stage = 'canonical profile ' + key;
    await pages[key].goto(web + route);
    await pages[key]
      .getByText(fixture.accounts[key].canonicalEmployeeId, { exact: true })
      .first()
      .waitFor();
    const text = await pages[key].locator('body').innerText();
    assert(!text.includes(fixture.accounts[key].employeeId));
    assert(!/six-digit login|legacy login id/i.test(text));
  }
  await pages.submitter.goto(web + '/dashboard');
  pass(
    'All five actor headers and profiles display the backend canonical Employee ID with no separate numeric or legacy label',
  );
  async function kpis(pending, approved) {
    await pages.submitter.waitForFunction(
      (expected) => {
        const values = Object.fromEntries(
          [...document.querySelectorAll('.kpi-card')].map((x) => [
            x.querySelector('.kpi-label')?.textContent,
            x.querySelector('.kpi-value')?.textContent,
          ]),
        );
        return (
          values.Pending === String(expected.pending) &&
          values.Approved === String(expected.approved)
        );
      },
      { pending, approved },
    );
  }
  const baseline = summarizeWorkflow(mine);
  await kpis(baseline.pending, baseline.approved);
  assert(
    (await pages.submitter.locator('body').innerText()).includes(
      fixture.accounts.submitter.canonicalEmployeeId,
    ),
  );
  const expense = await pages.submitter.evaluate(
    async ({ categoryId, run }) => {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        amount: '400',
        currency: 'INR',
        categoryId,
        merchant: 'Code Workflow ' + run,
        date: new Date().toISOString().slice(0, 10),
      }))
        form.append(k, v);
      const bytes = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL2kAAAAASUVORK5CYII=',
        ),
        (x) => x.charCodeAt(0),
      );
      form.append(
        'receipt',
        new File([bytes], 'fictional.png', { type: 'image/png' }),
      );
      return window.FinStackTenantSession.request('/api/v1/tenant/expenses', {
        method: 'POST',
        body: form,
      });
    },
    { categoryId: fixture.categoryId, run },
  );
  assert.equal(expense.workflowStatus, 'manager_review');
  await kpis(baseline.pending + 1, baseline.approved);
  async function decision(key, action, body) {
    return pages[key].evaluate(
      ({ route, body }) =>
        window.FinStackTenantSession.request(route, { method: 'POST', body }),
      { route: '/api/v1/tenant/expenses/' + expense.id + '/' + action, body },
    );
  }
  const queue = await api(
    '/api/v1/tenant/expenses/manager/queue',
    null,
    sessions.manager.accessToken,
  );
  const queued = queue.find((x) => x.id === expense.id);
  assert.equal(
    queued.employeeId,
    fixture.accounts.submitter.canonicalEmployeeId,
  );
  assert.equal(
    queued.managerEmployeeId,
    fixture.accounts.manager.canonicalEmployeeId,
  );
  await pages.manager.goto(web + '/manager/expenses');
  const row = pages.manager
    .locator('tr')
    .filter({ hasText: 'Code Workflow ' + run });
  await row.getByRole('link', { name: 'Review', exact: true }).click();
  await pages.manager
    .getByLabel(/Finance Officer/i)
    .selectOption(fixture.accounts.finance.id);
  await pages.manager
    .getByRole('button', { name: 'Approve', exact: true })
    .click();
  const approvalResponse = pages.manager.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.url().endsWith('/' + expense.id + '/manager/approve'),
  );
  await pages.manager
    .getByRole('dialog')
    .getByRole('button', { name: /Confirm|Approve/i })
    .click();
  assert.equal((await approvalResponse).status(), 201);
  await pages.manager.getByRole('dialog').waitFor({ state: 'hidden' });
  await kpis(baseline.pending + 1, baseline.approved);
  assert.equal(
    (
      await api(
        '/api/v1/tenant/expenses/mine',
        null,
        sessions.submitter.accessToken,
      )
    ).find((x) => x.id === expense.id).workflowStatus,
    'finance_review',
  );
  assert.equal(
    (
      await decision('finance', 'finance/flag', {
        note: 'Fictional QA compliance review',
      })
    ).workflowStatus,
    'compliance_review',
  );
  await kpis(baseline.pending + 1, baseline.approved);
  assert.equal(
    (
      await decision('compliance', 'compliance/approve', {
        note: 'Fictional QA exception approved',
      })
    ).workflowStatus,
    'finance_review',
  );
  await kpis(baseline.pending + 1, baseline.approved);
  assert.equal(
    (
      await decision('finance', 'finance/approve', {
        note: 'Fictional QA final finance clearance',
      })
    ).workflowStatus,
    'approved_for_payment',
  );
  await kpis(baseline.pending, baseline.approved + 1);
  await pages.finance.evaluate(
    ({ id }) =>
      window.FinStackTenantSession.request(
        '/api/v1/tenant/expenses/finance/payment-releases',
        { method: 'POST', body: { expenseIds: [id] } },
      ),
    { id: expense.id },
  );
  await pages.submitter
    .getByText(
      `${baseline.processing + 1} processing; ${baseline.paid} confirmed paid`,
      { exact: true },
    )
    .waitFor();
  await kpis(baseline.pending, baseline.approved + 1);
  pass(
    'Real five-tab handoff keeps partial approvals pending, counts finance clearance and processing as approved, and never claims paid',
  );
  stage = 'reload dashboard';
  await pages.submitter.reload();
  await kpis(baseline.pending, baseline.approved + 1);
  await pages.submitter.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  for (const route of ['/expenses', '/status']) {
    stage = 'display route ' + route;
    await pages.submitter.goto(web + route);
    await pages.submitter
      .locator('.badge')
      .filter({ hasText: /^Payment Processing$/ })
      .first()
      .waitFor();
  }
  stage = 'notification display';
  const notices = await api(
    '/api/v1/tenant/expenses/notifications/page?page=1&pageSize=50&state=all',
    null,
    sessions.submitter.accessToken,
  );
  assert(notices.items.length > 0);
  await pages.submitter.goto(web + '/notifications');
  await pages.submitter
    .getByText(notices.items[0].title, { exact: true })
    .first()
    .waitFor();

  stage = 'finance transaction canonical identity';
  const workspace = await api(
    '/api/v1/tenant/expenses/finance/workspace',
    null,
    sessions.finance.accessToken,
  );
  const transaction = workspace.transactions.find(
    (x) => x.expenseId === expense.id,
  );
  assert(transaction);
  assert.equal(
    transaction.employeeId,
    fixture.accounts.submitter.canonicalEmployeeId,
  );
  await pages.finance.goto(web + '/finance/transactions');
  await pages.finance
    .getByText(fixture.accounts.submitter.canonicalEmployeeId, { exact: true })
    .first()
    .waitFor();
  pass(
    'Finance transaction API and UI use canonical Employee IDs while stored payment and expense relationships remain intact',
  );
  stage = 'final persisted and isolation assertions';
  const out = await db.expense.findUnique({ where: { id: expense.id } });
  assert.equal(out.workflowStatus, 'payment_processing');
  assert.equal(out.status, 'approved');
  const foreign = await login(
    created.find((x) => x.role === 'EXPENSE_SUBMITTER').employeeId,
    password,
  );
  assert.equal(
    (
      await call(
        '/api/v1/tenant/expenses/' + expense.id,
        null,
        foreign.accessToken,
      )
    ).status,
    404,
  );
  assert.deepEqual(pageErrors, []);
  pass(
    'Dashboard, expenses, status and notifications agree after reload/focus; PostgreSQL status and cross-tenant denial verified',
  );
  await context.close();
  await browser.close();
  browser = null;

  const users = await db.tenantUser.findMany();
  assert(users.every((x) => canonical.test(x.canonicalEmployeeId)));
  assert.equal(
    new Set(users.map((x) => x.canonicalEmployeeId)).size,
    users.length,
  );
  const aliases = await db.$queryRawUnsafe(
    'SELECT "alias", "userId" FROM "EmployeeLoginAlias"',
  );
  assert.equal(new Set(aliases.map((x) => x.alias)).size, aliases.length);
  for (const user of users) {
    assert(
      aliases.some(
        (x) => x.alias === user.canonicalEmployeeId && x.userId === user.id,
      ),
    );
    assert(
      aliases.some((x) => x.alias === user.employeeId && x.userId === user.id),
    );
  }
  // Compare exact original snapshot IDs; login timestamps and new audit rows may evolve normally.
  const originals = JSON.parse(
    fs.readFileSync(
      path.join(state.root, 'original-preservation-rows-private.json'),
      'utf8',
    ),
  );
  for (const table of [
    'TenantUser',
    'Expense',
    'TenantAuditLog',
    'PlatformAuditLog',
  ]) {
    const expected = originals[table];
    const value =
      table === 'TenantUser'
        ? "to_jsonb(t) - 'canonicalEmployeeId'"
        : 'to_jsonb(t)';
    const rows = await db.$queryRawUnsafe(
      `SELECT ${value} AS value FROM "${state.schema}"."${table}" t WHERE id::text IN (SELECT jsonb_array_elements_text($1::jsonb))`,
      JSON.stringify(expected.map((row) => row.id)),
    );
    assert.equal(
      rows.length,
      expected.length,
      'An original row was removed from ' + table,
    );
    for (const before of expected)
      assert.deepEqual(
        rows.find((row) => row.value.id === before.id).value,
        before,
        'An original row changed in ' + table,
      );
  }
  pass(
    'Exact original user/password, expense/receipt/relationship and historical audit rows match the preserved snapshot',
  );
  const report = {
    passed: checks.length,
    checks,
    errors: [],
    mode: 'real NestJS/PostgreSQL disposable copy and Chromium; no intercepted APIs',
    rate_limit_responses_observed: rateLimits,
    existing_qa_modified: false,
    manual_ui_verification_complete: false,
  };
  fs.writeFileSync(
    path.join(repo, '.qa-fix-evidence/canonical-live-results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      passed: checks.length,
      failed: 0,
      rate_limit_responses_observed: rateLimits,
    }),
  );
}
main()
  .catch((error) => {
    fs.writeFileSync(
      path.join(state.root, 'private-canonical-test-error.log'),
      stage + '\n' + error.stack,
    );
    console.error(
      'Canonical isolated regression failed at stage: ' +
        stage +
        '; diagnostic retained privately.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    await db.$disconnect();
  });
