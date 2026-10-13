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
function contrast(foreground, background) {
  const luminance = (color) => {
    const rgb = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const channel = v / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
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
  await page.goto(base + '/views/config-manager/expense-categories.html');
  await page
    .getByText('Start with a useful baseline', { exact: true })
    .waitFor();
  await page
    .getByRole('checkbox', { name: 'Select Travel', exact: true })
    .waitFor();
  assert.equal(
    requests.filter(
      (path) => path === 'GET /api/v1/tenant/expenses/configuration/templates',
    ).length,
    1,
  );
  const addCustomButton = page.getByRole('button', {
    name: 'Add custom category',
    exact: true,
  });
  await addCustomButton.click();
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    'Save category',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.getAttribute('aria-label'),
    ),
    'Close Add custom category',
  );
  await page.keyboard.press('Escape');
  assert.equal(
    await page
      .getByRole('dialog', { name: 'Add custom category', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await addCustomButton.evaluate(
      (button) => document.activeElement === button,
    ),
    true,
  );
  await addCustomButton.click();
  await page.locator('#category-name').fill('   ');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Category name is required.' })
    .waitFor();
  await page
    .getByRole('button', { name: 'Close Add custom category', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add custom category', exact: true })
    .click();
  await page.locator('#category-name').fill('  Browser Travel  ');
  await page.locator('#category-description').fill('Created through React UI');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await visible(page, 'Browser Travel');
  const category = await prisma.expenseCategory.findFirstOrThrow({
    where: { organizationId: primary.id, name: 'Browser Travel' },
  });
  assert.equal(category.description, 'Created through React UI');
  assert.equal(category.requiresReceipt, true);
  await page
    .getByRole('button', { name: 'Add custom category', exact: true })
    .click();
  await page.locator('#category-name').fill('browser travel');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await page
    .getByText('This name already exists in your organization.', {
      exact: true,
    })
    .first()
    .waitFor();
  assert.equal(
    await prisma.expenseCategory.count({
      where: { organizationId: primary.id, name: 'Browser Travel' },
    }),
    1,
  );
  await page
    .getByRole('button', { name: 'Close Add custom category', exact: true })
    .click();

  const referencedPolicy = await prisma.expensePolicy.create({
    data: {
      organizationId: primary.id,
      categoryId: category.id,
      name: 'Browser category reference',
      maxAmount: 42,
    },
  });
  await page.reload();
  await visible(page, 'Browser Travel');
  const categoryRow = () =>
    page.getByRole('row').filter({ hasText: 'Browser Travel' });
  await categoryRow()
    .getByRole('button', { name: 'Edit Browser Travel', exact: true })
    .click();
  await page.locator('#category-description').fill('Updated through React UI');
  await page.locator('#category-name').fill('  Browser Travel  ');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await visible(page, 'Updated through React UI');
  assert.equal(
    (
      await prisma.expenseCategory.findUniqueOrThrow({
        where: { id: category.id },
      })
    ).name,
    'Browser Travel',
  );

  await categoryRow()
    .getByRole('button', { name: 'Deactivate Browser Travel', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Deactivate category?', exact: true })
    .getByRole('button', { name: 'Deactivate category', exact: true })
    .click();
  await page
    .getByText(
      'Category deactivated. Existing policies and history were preserved.',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    (
      await prisma.expenseCategory.findUniqueOrThrow({
        where: { id: category.id },
      })
    ).status,
    'Inactive',
  );
  assert.equal(
    (
      await prisma.expensePolicy.findUniqueOrThrow({
        where: { id: referencedPolicy.id },
      })
    ).name,
    'Browser category reference',
  );
  await page.getByLabel('Filter category status').selectOption('Inactive');
  await visible(page, 'Browser Travel');
  await page.getByLabel('Search categories').fill('Updated through React');
  await visible(page, 'Updated through React UI');
  await page.getByLabel('Search categories').fill('no matching category');
  await page
    .getByRole('heading', {
      name: 'No categories match these filters',
      exact: true,
    })
    .waitFor();
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  await page.getByLabel('Filter category status').selectOption('Active');
  assert.equal(await categoryRow().count(), 0);
  await page.getByLabel('Filter category status').selectOption('all');
  await categoryRow()
    .getByRole('button', { name: 'Reactivate Browser Travel', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Reactivate category?', exact: true })
    .getByRole('button', { name: 'Reactivate category', exact: true })
    .click();
  await page.getByText('Category reactivated.', { exact: true }).waitFor();
  assert.equal(
    (
      await prisma.expenseCategory.findUniqueOrThrow({
        where: { id: category.id },
      })
    ).status,
    'Active',
  );
  const lifecycleEvents = await prisma.tenantAuditLog.findMany({
    where: { organizationId: primary.id, targetId: category.id },
    orderBy: { occurredAt: 'asc' },
    select: { eventCode: true },
  });
  assert.deepEqual(
    lifecycleEvents.map((event) => event.eventCode),
    [
      'category.created',
      'category.updated',
      'category.deactivated',
      'category.reactivated',
    ],
  );
  events.push({
    pass: 'Manual category creation trims names, validates duplicate/required input, preserves receipt configuration, edits, filters and audited deactivate/reactivate without changing policies',
  });
  const categoryDeleteChecks = [];
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(350);
    const button = categoryRow().getByRole('button', {
      name: 'Delete Browser Travel',
      exact: true,
    });
    await button.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    const colors = await button.evaluate((e) => ({
      color: getComputedStyle(e).color,
      background: getComputedStyle(e.closest('.card')).backgroundColor,
      opacity: getComputedStyle(e).opacity,
    }));
    assert.equal(colors.opacity, '1');
    assert.ok(contrast(colors.color, colors.background) >= 4.5);
    categoryDeleteChecks.push({
      width,
      iconContrast: contrast(colors.color, colors.background),
    });
    await page.screenshot({
      path: path.join(backend, '.tmp', `category-delete-${width}.png`),
      fullPage: true,
    });
  }
  events.push({
    pass: 'Existing Categories Delete icon has adequate normal-state contrast; category styles unchanged',
    measurements: categoryDeleteChecks,
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  await categoryRow()
    .getByRole('button', { name: 'Delete Browser Travel', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Delete category?', exact: true })
    .getByRole('button', { name: 'Delete category', exact: true })
    .click();
  await page
    .getByRole('alert')
    .filter({
      hasText:
        'This category is used by one or more policies. Deactivate it instead; existing policies will remain unchanged.',
    })
    .waitFor();
  assert.ok(
    await prisma.expenseCategory.findUnique({ where: { id: category.id } }),
  );
  assert.equal(
    await prisma.tenantAuditLog.count({
      where: {
        organizationId: primary.id,
        eventCode: 'category.deleted',
        targetId: category.id,
      },
    }),
    0,
  );
  await page
    .getByRole('button', { name: 'Close confirmation', exact: true })
    .click();

  const catalogStart = requests.length;
  await page
    .getByRole('button', { name: 'Choose predefined categories', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'Select Travel', exact: true })
    .waitFor();
  assert.deepEqual(requests.slice(catalogStart), [
    'GET /api/v1/tenant/expenses/configuration/templates',
  ]);
  await page
    .getByRole('checkbox', { name: 'Select all available templates' })
    .check();
  assert.equal(
    await page
      .getByRole('button', { name: 'Preview (8)', exact: true })
      .count(),
    1,
  );
  await page.getByRole('button', { name: 'Preview (8)', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Review before activation' })
    .waitFor();
  assert.equal(
    await prisma.expenseCategory.count({
      where: { organizationId: primary.id, templateKey: { not: null } },
    }),
    0,
  );
  const activationStart = requests.length;
  await page
    .getByRole('button', { name: 'Activate 8 categories', exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await visible(page, 'Travel');
  await visible(page, 'Meals');
  await visible(page, 'Equipment');
  await page
    .getByText('Activated 8 of 8 selected categories.', { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole('region', { name: 'Predefined categories' }).count(),
    0,
  );
  assert.deepEqual(requests.slice(activationStart), [
    'POST /api/v1/tenant/expenses/configuration/categories/activate-templates',
    'GET /api/v1/tenant/expenses/configuration/categories',
  ]);
  assert.equal(
    await prisma.expenseCategory.count({
      where: { organizationId: primary.id, templateKey: { not: null } },
    }),
    8,
  );
  assert.equal(
    (
      await prisma.expenseCategory.findUniqueOrThrow({
        where: { id: category.id },
      })
    ).description,
    'Updated through React UI',
  );
  await page.reload();
  await visible(page, 'Meals');
  await page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Meals', exact: true }) })
    .getByRole('button', { name: 'Edit Meals', exact: true })
    .click();
  await page.locator('#category-name').fill('Company Meals');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await visible(page, 'Company Meals');
  await page
    .getByRole('button', { name: 'Choose predefined categories' })
    .click();
  assert.equal(
    await page
      .getByRole('checkbox', { name: 'Select Meals', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole('checkbox', { name: 'Select Meals', exact: true })
      .isChecked(),
    true,
  );
  await page
    .getByRole('button', { name: 'Close templates', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add custom category', exact: true })
    .click();
  await page.locator('#category-name').fill('Pagination Alpha');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await visible(page, 'Pagination Alpha');
  await page
    .getByRole('button', { name: 'Add custom category', exact: true })
    .click();
  await page.locator('#category-name').fill('ZZZ Pagination Target');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2 of 2', { exact: true }).waitFor();
  await page
    .getByRole('row')
    .filter({ hasText: 'ZZZ Pagination Target' })
    .getByRole('button', { name: 'Delete ZZZ Pagination Target', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Delete category?', exact: true })
    .getByRole('button', { name: 'Delete category', exact: true })
    .click();
  await page.getByText('Category deleted.', { exact: true }).waitFor();
  await page.getByText('Page 1 of 1', { exact: true }).waitFor();
  assert.equal(
    await prisma.tenantAuditLog.count({
      where: { organizationId: primary.id, eventCode: 'category.deleted' },
    }),
    1,
  );
  events.push({
    pass: 'Referenced-category delete is blocked without a success audit; unreferenced deletion is audited and last-page state clamps after deletion',
  });
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 768, height: 1024 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(350);
    if (
      !(await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ))
    ) {
      console.error(
        'Overflow',
        viewport,
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('body *'))
            .filter(
              (e) =>
                e.getBoundingClientRect().right > window.innerWidth + 1 &&
                getComputedStyle(e).position !== 'fixed',
            )
            .slice(0, 15)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: e.getBoundingClientRect().right,
              width: e.getBoundingClientRect().width,
            })),
        ),
      );
      await page.screenshot({
        path: path.join(backend, '.tmp', 'template-overflow.png'),
        fullPage: true,
      });
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(
        backend,
        '.tmp',
        `template-categories-${viewport.width}.png`,
      ),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  events.push({
    pass: 'Category catalog, select-all/deselect, review, bulk activation, duplicate click lock, PostgreSQL preservation, renamed source and responsive layouts',
    requests: requests.slice(activationStart, activationStart + 2),
  });
  await page.goto(base + '/views/config-manager/expense-policies.html');
  await page.getByRole('button', { name: 'Browse policy templates' }).click();
  await page
    .getByRole('checkbox', { name: 'Select Travel policy', exact: true })
    .check();
  await page
    .getByRole('checkbox', { name: 'Select Meals policy', exact: true })
    .check();
  await page.getByRole('button', { name: 'Preview (2)', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Enter a positive cap' })
    .waitFor();
  const travelFields = page.getByRole('group', {
    name: 'Review Travel policy',
    exact: true,
  });
  const mealFields = page.getByRole('group', {
    name: 'Review Meals policy',
    exact: true,
  });
  await travelFields.getByLabel('Per-expense spending cap').fill('2500.55');
  await travelFields.getByLabel('Currency (three-letter code)').fill('USD');
  await travelFields.getByLabel('Approval levels').selectOption('1');
  await travelFields.getByLabel('Receipt required').uncheck();
  await mealFields.getByLabel('Per-expense spending cap').fill('550.25');
  await mealFields.getByLabel('Currency (three-letter code)').fill('EUR');
  await page.getByRole('button', { name: 'Preview (2)', exact: true }).click();
  await page
    .getByLabel('Activation preview')
    .getByText(/cap USD 2,500.55/)
    .waitFor();
  const policyActivationStart = requests.length;
  await page
    .getByRole('button', { name: 'Activate 2 policies', exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await visible(page, 'Travel policy');
  await visible(page, 'Meals policy');
  assert.deepEqual(requests.slice(policyActivationStart), [
    'POST /api/v1/tenant/expenses/configuration/policies/activate-templates',
    'GET /api/v1/tenant/expenses/configuration/policies',
  ]);
  const travelPolicy = await prisma.expensePolicy.findFirstOrThrow({
    where: { organizationId: primary.id, templateKey: 'travel-policy' },
  });
  assert.equal(travelPolicy.maxAmount.toString(), '2500.55');
  assert.equal(travelPolicy.currency, 'USD');
  assert.equal(travelPolicy.receiptRequired, false);
  assert.equal(travelPolicy.approval, 'Manager Approval');
  await page
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', { name: 'Travel policy', exact: true }),
    })
    .getByRole('button', { name: 'Edit Travel policy', exact: true })
    .click();
  await page.locator('#policy-name').fill('Company Travel Cap');
  await page.locator('#policy-amount').fill('3000.75');
  await page.locator('#policy-currency').fill('GBP');
  await page.locator('#policy-approval').selectOption('Manager + Finance');
  await page
    .getByRole('switch', { name: 'Receipt required', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Update Policy', exact: true })
    .click();
  await visible(page, 'Company Travel Cap');
  const editedPolicy = await prisma.expensePolicy.findUniqueOrThrow({
    where: { id: travelPolicy.id },
  });
  assert.equal(editedPolicy.maxAmount.toString(), '3000.75');
  assert.equal(editedPolicy.currency, 'GBP');
  assert.equal(editedPolicy.receiptRequired, true);
  assert.equal(editedPolicy.approval, 'Manager + Finance');
  await page.getByRole('button', { name: 'Browse policy templates' }).click();
  const sourcedCheckbox = page.getByRole('checkbox', {
    name: 'Select Travel policy',
    exact: true,
  });
  assert.equal(await sourcedCheckbox.isDisabled(), true);
  assert.equal(await sourcedCheckbox.isChecked(), true);
  await page
    .getByRole('checkbox', { name: 'Select Equipment policy', exact: true })
    .check();
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 768, height: 1024 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(350);
    if (
      !(await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ))
    ) {
      console.error(
        'Overflow',
        viewport,
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('body *'))
            .filter(
              (e) =>
                e.getBoundingClientRect().right > window.innerWidth + 1 &&
                getComputedStyle(e).position !== 'fixed',
            )
            .slice(0, 15)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: e.getBoundingClientRect().right,
              width: e.getBoundingClientRect().width,
            })),
        ),
      );
      await page.screenshot({
        path: path.join(backend, '.tmp', 'template-overflow.png'),
        fullPage: true,
      });
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    const equipmentFields = page.getByRole('group', {
      name: 'Review Equipment policy',
      exact: true,
    });
    await equipmentFields.getByLabel('Per-expense spending cap').fill('125.50');
    if (viewport.width === 375) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page
        .locator('#sidebar')
        .getByRole('link', { name: 'Categories', exact: true })
        .waitFor({ state: 'visible' });
      assert.equal(
        await page
          .getByRole('button', { name: 'Close menu', exact: true })
          .getAttribute('aria-expanded'),
        'true',
      );
      await page
        .getByRole('button', { name: 'Close menu', exact: true })
        .click();
    }
    await page.screenshot({
      path: path.join(
        backend,
        '.tmp',
        `template-policies-${viewport.width}.png`,
      ),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  events.push({
    pass: 'Policy templates require explicit caps; preview, batch persistence, currency/receipt/approval edits, renamed source, no duplicate requests and responsive layouts',
    requests: requests.slice(policyActivationStart, policyActivationStart + 2),
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
  const savedPolicy = await prisma.expensePolicy.findFirstOrThrow({
    where: { organizationId: primary.id, name: 'Browser Travel Cap' },
  });
  const deleteChecks = [];
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(350);
    const row = page
      .getByRole('row')
      .filter({
        has: page.getByRole('cell', {
          name: 'Browser Travel Cap',
          exact: true,
        }),
      });
    const button = row.getByRole('button', {
      name: 'Delete Browser Travel Cap',
      exact: true,
    });
    await button.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    assert.equal(await button.isEnabled(), true);
    assert.equal((await button.innerText()).trim(), 'Delete');
    assert.equal(await button.locator('svg').count(), 1);
    const normal = await button.evaluate((e) => {
      const s = getComputedStyle(e);
      return {
        color: s.color,
        background: s.backgroundColor,
        border: s.borderTopColor,
        borderWidth: s.borderTopWidth,
        opacity: s.opacity,
        height: e.getBoundingClientRect().height,
      };
    });
    assert.ok(contrast(normal.color, normal.background) >= 4.5);
    assert.ok(contrast(normal.border, normal.background) >= 3);
    assert.equal(normal.borderWidth, '1px');
    assert.equal(normal.opacity, '1');
    const edit = await row
      .getByRole('button', { name: 'Edit Browser Travel Cap', exact: true })
      .boundingBox();
    assert.equal(normal.height, edit.height);
    await page.screenshot({
      path: path.join(backend, '.tmp', `policy-delete-${width}-normal.png`),
      fullPage: true,
    });
    await button.hover();
    await page.waitForTimeout(350);
    const hover = await button.evaluate((e) => ({
      color: getComputedStyle(e).color,
      background: getComputedStyle(e).backgroundColor,
    }));
    assert.ok(contrast(hover.color, hover.background) >= 4.5);
    await page.screenshot({
      path: path.join(backend, '.tmp', `policy-delete-${width}-hover.png`),
      fullPage: true,
    });
    await row
      .getByRole('button', {
        name: 'Deactivate Browser Travel Cap',
        exact: true,
      })
      .focus();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(350);
    assert.ok(
      await button.evaluate(
        (e) =>
          e === document.activeElement &&
          e.matches(':focus-visible') &&
          getComputedStyle(e).outlineWidth === '2px',
      ),
    );
    await page.screenshot({
      path: path.join(backend, '.tmp', `policy-delete-${width}-focus.png`),
      fullPage: true,
    });
    const beforeConfirmation = requests.length;
    await page.keyboard.press('Enter');
    await page
      .getByRole('dialog', { name: 'Delete policy?', exact: true })
      .waitFor();
    assert.equal(
      requests.slice(beforeConfirmation).filter((r) => r.startsWith('DELETE '))
        .length,
      0,
    );
    await page
      .getByRole('dialog', { name: 'Delete policy?', exact: true })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    assert.ok(
      await prisma.expensePolicy.findUnique({ where: { id: savedPolicy.id } }),
    );
    deleteChecks.push({
      width,
      textContrast: contrast(normal.color, normal.background),
      borderContrast: contrast(normal.border, normal.background),
      hoverContrast: contrast(hover.color, hover.background),
      height: normal.height,
    });
  }
  events.push({
    pass: 'Policy Delete visible without hover, contrasted border/text, keyboard focus, matching action heights and confirmation-only deletion at desktop/tablet/mobile',
    measurements: deleteChecks,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const action of ['Deactivate', 'Reactivate']) {
    await page
      .getByRole('button', {
        name: action + ' Browser Travel Cap',
        exact: true,
      })
      .click();
    await page
      .getByRole('dialog', { name: action + ' policy?', exact: true })
      .getByRole('button', { name: action + ' policy', exact: true })
      .click();
    await page
      .getByText(
        action === 'Deactivate' ? 'Policy deactivated.' : 'Policy reactivated.',
        { exact: true },
      )
      .waitFor();
    const row = await prisma.expensePolicy.findUniqueOrThrow({
      where: { id: savedPolicy.id },
    });
    assert.equal(row.status, action === 'Deactivate' ? 'Inactive' : 'Active');
    assert.equal(row.maxAmount.toFixed(2), '1450.25');
    assert.equal(row.categoryId, savedPolicy.categoryId);
  }
  await page
    .getByRole('button', { name: 'Edit Browser Travel Cap', exact: true })
    .click();
  assert.equal(
    await page.locator('#policy-amount').getAttribute('type'),
    'text',
  );
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    // Allow the existing responsive shell transition to settle before measuring.
    await page.waitForTimeout(350);
    const save = await page
      .getByRole('button', { name: 'Update Policy', exact: true })
      .boundingBox();
    assert.ok(save && save.y >= 0 && save.y + save.height <= viewport.height);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      JSON.stringify(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('body *'))
            .filter(
              (e) =>
                e.getBoundingClientRect().right > innerWidth + 1 &&
                getComputedStyle(e).position !== 'fixed',
            )
            .slice(0, 12)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              width: e.getBoundingClientRect().width,
              right: e.getBoundingClientRect().right,
            })),
        ),
      ),
    );
  }
  await page.keyboard.press('Escape');
  assert.equal(
    await page
      .getByRole('dialog', { name: 'Edit Policy', exact: true })
      .count(),
    0,
  );
  events.push({
    pass: 'React policy create/refresh/Decimal persistence, stable-ID deactivate/reactivate, monetary text input and responsive keyboard modal; policy-only refresh',
    requests: after,
  });
  // POL-01: submit the actual React form and inspect the exact API/DB boundary.
  for (const amount of ['5000', '5000.50', '7500.75', '0.01']) {
    await page.getByRole('button', { name: 'Add Policy', exact: true }).click();
    await page.locator('#policy-name').fill('POL-01 ' + amount);
    for (const invalid of ['', '-1', '0', 'abc', '1.001', '10000000000']) {
      await page.locator('#policy-amount').fill(invalid);
      const beforeInvalid = requests.length;
      await page
        .getByRole('button', { name: 'Save Policy', exact: true })
        .click();
      await page.locator('#policy-amount-error').waitFor();
      assert.equal(
        requests.slice(beforeInvalid).filter((r) => r.startsWith('POST '))
          .length,
        0,
      );
      assert.doesNotMatch(
        await page.locator('#policy-amount-error').innerText(),
        /maxAmount|conforming/,
      );
    }
    await page.locator('#policy-amount').fill(amount);
    assert.equal(await page.locator('#policy-amount-error').count(), 0);
    const request = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().endsWith('/configuration/policies'),
    );
    await page
      .getByRole('button', { name: 'Save Policy', exact: true })
      .click();
    const response = await request;
    assert.equal(response.status(), 201);
    const exact = amount.includes('.') ? amount : amount + '.00';
    assert.equal(response.request().postDataJSON().maxAmount, exact);
    await visible(page, 'POL-01 ' + amount);
    const row = await prisma.expensePolicy.findFirstOrThrow({
      where: { organizationId: primary.id, name: 'POL-01 ' + amount },
    });
    assert.equal(row.maxAmount.toFixed(2), exact);
    await page
      .getByRole('button', { name: 'Edit POL-01 ' + amount, exact: true })
      .click();
    assert.equal(await page.locator('#policy-amount').inputValue(), exact);
    await page
      .getByRole('button', { name: 'Update Policy', exact: true })
      .click();
    await visible(page, 'POL-01 ' + amount);
    assert.equal(
      (
        await prisma.expensePolicy.findUniqueOrThrow({ where: { id: row.id } })
      ).maxAmount.toFixed(2),
      exact,
    );
    await page
      .getByRole('button', { name: 'Delete POL-01 ' + amount, exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Delete policy?', exact: true })
      .getByRole('button', { name: 'Delete policy', exact: true })
      .click();
    await page
      .getByRole('cell', { name: 'POL-01 ' + amount, exact: true })
      .waitFor({ state: 'hidden' });
  }
  await page
    .getByRole('button', { name: 'Browse policy templates', exact: true })
    .click();
  for (const [name, amount] of [
    ['Equipment', '5000'],
    ['Accommodation', '5000.50'],
    ['Training', '7500.75'],
    ['Fuel/Mileage', '0.01'],
  ]) {
    await page
      .getByRole('checkbox', {
        name: 'Select ' + name + ' policy',
        exact: true,
      })
      .check();
    await page
      .getByRole('group', { name: 'Review ' + name + ' policy', exact: true })
      .getByLabel('Per-expense spending cap')
      .fill(amount);
  }
  await page.getByRole('button', { name: 'Preview (4)', exact: true }).click();
  const templateResponse = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.url().endsWith('/policies/activate-templates'),
  );
  await page
    .getByRole('button', { name: 'Activate 4 policies', exact: true })
    .click();
  assert.equal((await templateResponse).status(), 201);
  for (const [key, exact] of [
    ['equipment-policy', '5000.00'],
    ['accommodation-policy', '5000.50'],
    ['training-policy', '7500.75'],
    ['fuel-mileage-policy', '0.01'],
  ]) {
    assert.equal(
      (
        await prisma.expensePolicy.findFirstOrThrow({
          where: { organizationId: primary.id, templateKey: key },
        })
      ).maxAmount.toFixed(2),
      exact,
    );
  }
  await page.getByText(/Activated 4 of 4 selected policies/).waitFor();
  await page
    .getByText(/Activated 4 of 4 selected policies/)
    .waitFor({ state: 'hidden', timeout: 5000 });
  events.push({
    pass: 'POL-01 real manual create/edit and template batch accept 5000, 5000.50, 7500.75 and 0.01 exactly; invalid manual caps make no POST; corrected field errors clear; success toast dismisses',
  });
  await page.goto(base + '/views/config-manager/expense-categories.html');
  await page
    .getByRole('button', { name: 'Deactivate Browser Travel', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Deactivate category?', exact: true })
    .getByRole('button', { name: 'Deactivate category', exact: true })
    .click();
  await page
    .getByText(
      'Category deactivated. Existing policies and history were preserved.',
      { exact: true },
    )
    .waitFor();
  await page.reload();
  await page.getByLabel('Filter category status').selectOption('Inactive');
  await visible(page, 'Browser Travel');
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
  await context.close();
  await stopApi();
  await startApi();
  const fresh = await browser.newContext();
  const reopened = await fresh.newPage();
  await login(reopened, primary.slug);
  await reopened.goto(base + '/views/config-manager/expense-categories.html');
  await reopened.getByLabel('Filter category status').selectOption('Inactive');
  await visible(reopened, 'Browser Travel');
  const retainedCategory = await prisma.expenseCategory.findUniqueOrThrow({
    where: { id: category.id },
  });
  assert.equal(retainedCategory.status, 'Inactive');
  assert.equal(retainedCategory.description, 'Updated through React UI');
  await reopened.goto(base + '/views/config-manager/expense-policies.html');
  await visible(reopened, 'Browser Travel Cap');
  await visible(reopened, 'Company Travel Cap');
  await visible(reopened, 'Meals policy');
  for (const [name, exact] of [
    ['Equipment', '5000.00'],
    ['Accommodation', '5000.50'],
    ['Training', '7500.75'],
    ['Fuel/Mileage', '0.01'],
  ]) {
    await reopened
      .getByRole('button', { name: 'Edit ' + name + ' policy', exact: true })
      .click();
    assert.equal(await reopened.locator('#policy-amount').inputValue(), exact);
    await reopened.keyboard.press('Escape');
    const retained = await prisma.expensePolicy.findFirstOrThrow({
      where: { organizationId: primary.id, name: name + ' policy' },
    });
    assert.equal(retained.maxAmount.toFixed(2), exact);
  }
  assert.equal(
    await prisma.expenseCategory.count({
      where: { organizationId: primary.id, templateKey: { not: null } },
    }),
    8,
  );
  events.push({
    pass: 'UI logout/login, browser context reopen, full backend process restart and PostgreSQL persistence',
  });
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
  await otherPage
    .getByText('No categories configured yet', { exact: true })
    .waitFor();
  assert.equal(
    await otherPage
      .getByRole('cell', { name: 'Browser Travel', exact: true })
      .count(),
    0,
  );
  await otherPage.goto(base + '/views/config-manager/expense-policies.html');
  await otherPage
    .getByText('No policies configured yet', { exact: true })
    .waitFor();
  events.push({
    pass: 'Other tenant UI sees no primary tenant categories or policies',
  });
  // These exact browser resource errors are produced by the deliberate duplicate
  // and referenced-delete checks above; all other console errors still fail.
  assert.deepEqual(consoleErrors, [
    'Failed to load resource: the server responded with a status of 409 (Conflict)',
    'Failed to load resource: the server responded with a status of 400 (Bad Request)',
  ]);
  assert.equal(events.filter((event) => event.error).length, 0);
  await fresh.close();
  await isolated.close();
  console.log(JSON.stringify(events, null, 2));
  fs.writeFileSync(
    path.join(backend, '.tmp', 'configuration-templates-browser-results.json'),
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
