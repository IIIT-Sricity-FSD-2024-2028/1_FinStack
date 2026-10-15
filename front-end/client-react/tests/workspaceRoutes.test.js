import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loginDestination, roleDashboards, roleOwnsPath } from '../src/routes/workspaces.js'
import { legacyPaths } from '../src/routes/paths.ts'

for (const [role, dashboard] of Object.entries(roleDashboards)) {
  test(`${role} logs in to its own React dashboard and cannot resume another role's workspace`, () => {
    assert.equal(loginDestination(role), dashboard)
    assert.equal(roleOwnsPath(role, dashboard), true)
    for (const [otherRole, otherDashboard] of Object.entries(roleDashboards)) {
      if (role === otherRole) continue
      assert.equal(roleOwnsPath(role, otherDashboard), false)
      assert.equal(loginDestination(role, otherDashboard), dashboard)
    }
    for (const from of ['https://foreign.test', '//foreign.test', '/\\foreign.test', '/manager/../configuration/dashboard']) {
      const destination = loginDestination(role, from)
      assert(roleOwnsPath(role, new URL(destination, 'https://finstack.invalid').pathname))
    }
  })
}

test('login resumes authorized deep links with query/hash and handles legacy entries', () => {
  assert.equal(loginDestination('MANAGER', '/manager/expenses/expense-1?search=tax#receipt'), '/manager/expenses/expense-1?search=tax#receipt')
  assert.equal(loginDestination('EXPENSE_SUBMITTER', '/expenses?search=tax#expense'), '/expenses?search=tax#expense')
  assert.equal(loginDestination('FINANCE_OFFICER', '/views/finance/payments.html?review=1'), '/finance/payments?review=1')
  assert.equal(loginDestination('COMPLIANCE_OFFICER', '/views/compliance/audit.html'), '/compliance/audit')
  assert.equal(loginDestination('MANAGER', '/manager-other/dashboard'), '/manager/dashboard')
  assert.equal(loginDestination('UNSUPPORTED'), '/forbidden')
})

test('Configuration Manager default-view and supported legacy entrypoints remain intact', () => {
  assert.equal(loginDestination('CONFIGURATION_MANAGER', null, 'notifications'), '/configuration/notifications')
  assert.equal(loginDestination('CONFIGURATION_MANAGER', null, 'audit-logs'), '/configuration/audit-logs')
  assert.equal(loginDestination('CONFIGURATION_MANAGER', null, '../manager'), '/configuration/dashboard')
  assert.equal(legacyPaths['/views/config-manager/manage-users.html'], '/configuration/manage-users')
  assert.equal(legacyPaths['/views/submitter/submit.html'], '/submit')
  assert.equal(legacyPaths['/views/manager/expense-review.html'], '/manager/expenses')
  assert.equal(legacyPaths['/views/manager/approval-history.html'], '/manager/history')
  assert.equal(legacyPaths['/login.html'], '/login')
  assert.equal(legacyPaths['/views/shared/login.html'], '/login')
})
