const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evidence = path.resolve(
  __dirname,
  '../.tmp/tenant-notification-verification',
);
const measurements = [];
const requests = [];
let eventId;
async function visit(page, base) {
  await page.goto(base + '/views/config-manager/notifications.html');
  await page
    .getByText(
      'Notifications and their read or dismissed state are stored securely and persist after a backend restart.',
      { exact: true },
    )
    .waitFor();
}
exports.before = async function (page, { prisma, organizationId, base }) {
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/'))
      requests.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  const events = await prisma.tenantNotification.findMany({
    where: { organizationId },
  });
  assert.equal(events.length, 1);
  eventId = events[0].id;
  page.on('response', async (response) => {
    if (
      response.url().includes('/tenant/expenses/notifications') &&
      response.ok()
    ) {
      try {
        const content = await response.body();
        measurements.push({
          path: new URL(response.url()).pathname,
          bytes: content.length,
          ms: response.request().timing().responseEnd,
        });
      } catch {
        /* Navigation can cancel response body access. */
      }
    }
  });
  await visit(page, base);
  await page
    .locator('#notif-list')
    .getByText('Employee import completed', { exact: true })
    .waitFor();
  assert.equal(await page.locator('#notifications-next').isDisabled(), true);
  const mutationStart = requests.length;
  await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await page
    .getByRole('button', { name: 'Mark as unread', exact: true })
    .waitFor();
  assert(
    requests
      .slice(mutationStart)
      .every((request) => request.includes('/tenant/expenses/notifications')),
  );
  assert(
    (
      await prisma.tenantNotification.findUniqueOrThrow({
        where: { id: eventId },
      })
    ).readAt,
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Mark as unread', exact: true })
    .waitFor();
  await page.locator('[data-filter="pending"]').click();
  await page
    .getByRole('heading', { name: 'No Notifications', exact: true })
    .waitFor();
  assert(
    (await page.locator('#notif-dropdown').textContent()).includes(
      'Employee import completed',
    ),
  );
  await page.locator('[data-filter="all"]').click();
  await page
    .getByRole('button', { name: 'Mark as unread', exact: true })
    .waitFor();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(
      (width) =>
        width > 900 ||
        parseFloat(
          getComputedStyle(document.querySelector('.main-content')).marginLeft,
        ) === 0,
      width,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(
        evidence,
        'notifications-before-restart-' + width + '.png',
      ),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page
    .getByRole('button', { name: 'Bulk Import', exact: true })
    .waitFor();
};
exports.after = async function (
  page,
  { prisma, organizationId, base, stopApi, startApi, login, slug },
) {
  await visit(page, base);
  await page
    .getByRole('button', { name: 'Mark as unread', exact: true })
    .waitFor();
  assert(
    (
      await prisma.tenantNotification.findUniqueOrThrow({
        where: { id: eventId },
      })
    ).readAt,
  );
  await page
    .getByRole('button', { name: 'Mark as unread', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Mark as read', exact: true })
    .waitFor();
  assert.equal(
    (
      await prisma.tenantNotification.findUniqueOrThrow({
        where: { id: eventId },
      })
    ).readAt,
    null,
  );
  await page
    .getByRole('button', { name: 'Delete notification', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'No Notifications', exact: true })
    .waitFor();
  await page.waitForLoadState('networkidle');
  await stopApi();
  await startApi();
  await page.reload();
  await page
    .getByRole('heading', { name: 'No Notifications', exact: true })
    .waitFor();
  await page.locator('#sidebar-logout').click();
  await login(page, slug);
  await visit(page, base);
  await page
    .getByRole('heading', { name: 'No Notifications', exact: true })
    .waitFor();
  const stored = await prisma.tenantNotification.findUniqueOrThrow({
    where: { id: eventId },
  });
  assert(stored.dismissedAt);
  assert.equal(stored.readAt, null);
  assert.equal(stored.organizationId, organizationId);
  fs.writeFileSync(
    path.join(evidence, 'browser-results.json'),
    JSON.stringify(
      {
        eventId,
        checks: [
          'real CSV import completion visible to confirming employee',
          'read and unread persisted in PostgreSQL',
          'refresh and logout/login',
          'read state after full backend restart and fresh browser context',
          'dismissal survives second full process restart and logout/login',
          'genuine filtered and dismissed empty states',
          '375/768/1280 layouts without overflow',
          'legacy page retained',
        ],
        measurements,
        requests,
      },
      null,
      2,
    ),
  );
  await page.goto(base + '/views/config-manager/manage-users.html');
  await page.getByRole('button', { name: 'Add User', exact: true }).waitFor();
};
