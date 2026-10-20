import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { complianceApi } from '../src/features/compliance/complianceApi.js'
import { legacyPaths } from '../src/routes/paths.ts'

const originalWindow = globalThis.window
const originalFetch = globalThis.fetch

test('compliance receipt and audit export clear authentication on 401', async () => {
  let cleared = 0
  setupMockRuntime()
  window.FinStackTenantSession.clearTenantSession = () => { cleared++ }
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { code: 'EXPIRED', message: 'Sign in again' } }) })
  await assert.rejects(complianceApi.downloadReceipt('EXP-QA'), error => error.status === 401 && error.code === 'EXPIRED')
  await assert.rejects(complianceApi.exportAuditLogs(), error => error.status === 401)
  assert.equal(cleared, 2)
})

function setupMockRuntime(requestFn) {
  const session = {
    accessToken: 'compliance-token-xyz',
    organizationId: 'org-test-compliance',
    user: { id: 'cmp-1', employeeId: 'CMP-2001', role: 'COMPLIANCE_OFFICER', status: 'ACTIVE' },
  }
  globalThis.window = {
    FinStackApi: { baseUrl: 'http://localhost:3000' },
    FinStackTenantSession: {
      isTenantAuthenticated: () => true,
      getTenantSession: () => session,
      request: requestFn || ((path, opts) => Promise.resolve({ path, opts })),
      clearTenantSession: () => {},
    },
  }
}

afterEach(() => {
  globalThis.window = originalWindow
  globalThis.fetch = originalFetch
})

test('complianceApi getComplianceQueue calls /api/v1/tenant/expenses/compliance/queue', async () => {
  let capturedPath = ''
  setupMockRuntime(async (path) => {
    capturedPath = path
    return [{ id: 'EXP-101', status: 'pending', workflowStatus: 'compliance_review' }]
  })

  const result = await complianceApi.getComplianceQueue()
  assert.equal(capturedPath, '/api/v1/tenant/expenses/compliance/queue')
  assert.deepEqual(result, [{ id: 'EXP-101', status: 'pending', workflowStatus: 'compliance_review' }])
})

test('complianceApi decision endpoints send note and correct method', async () => {
  const calls = []
  setupMockRuntime(async (path, options) => {
    calls.push({ path, ...options })
    return { id: 'EXP-101', updated: true }
  })

  await complianceApi.approveClaim('EXP-101', 'Approved per director exception')
  await complianceApi.rejectClaim('EXP-101', 'Violates section 3 travel per diem policy')
  await complianceApi.correctiveAction('EXP-101', 'Request tax invoice copy')

  assert.equal(calls.length, 3)

  // Approve
  assert.equal(calls[0].path, '/api/v1/tenant/expenses/EXP-101/compliance/approve')
  assert.deepEqual(calls[0].body, { note: 'Approved per director exception' })
  assert.equal(calls[0].method, 'POST')

  // Reject
  assert.equal(calls[1].path, '/api/v1/tenant/expenses/EXP-101/compliance/reject')
  assert.deepEqual(calls[1].body, { note: 'Violates section 3 travel per diem policy' })
  assert.equal(calls[1].method, 'POST')

  // Corrective action
  assert.equal(calls[2].path, '/api/v1/tenant/expenses/EXP-101/compliance/corrective-action')
  assert.deepEqual(calls[2].body, { note: 'Request tax invoice copy' })
  assert.equal(calls[2].method, 'POST')
})

test('complianceApi decision endpoints trim and omit empty notes', async () => {
  const calls = []
  setupMockRuntime(async (path, options) => {
    calls.push({ path, ...options })
    return { id: 'EXP-102' }
  })

  await complianceApi.approveClaim('EXP-102', '   ')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].body, { note: undefined })
})

test('complianceApi downloadReceipt retrieves binary blob with bearer auth', async () => {
  setupMockRuntime()
  let capturedHeaders = {}
  const fakeBlob = { size: 2048, type: 'image/jpeg' }

  globalThis.fetch = async (url, options) => {
    capturedHeaders = options.headers
    return {
      ok: true,
      headers: { get: () => 'image/jpeg' },
      blob: async () => fakeBlob,
    }
  }

  const { blob, contentType } = await complianceApi.downloadReceipt('EXP-105')
  assert.equal(capturedHeaders.Authorization, 'Bearer compliance-token-xyz')
  assert.equal(blob, fakeBlob)
  assert.equal(contentType, 'image/jpeg')
})

test('complianceApi downloadReceipt handles 404 and 403 errors with clear messaging', async () => {
  setupMockRuntime()

  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ message: 'Receipt not found' }),
  })
  await assert.rejects(complianceApi.downloadReceipt('EXP-MISSING'), /Receipt not found\./)

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: 'Forbidden' }),
  })
  await assert.rejects(complianceApi.downloadReceipt('EXP-FORBIDDEN'), /Access denied to this receipt\./)
})

test('complianceApi getPolicies and getCategories query active tenant definitions', async () => {
  const calls = []
  setupMockRuntime(async (path) => {
    calls.push(path)
    return []
  })

  await complianceApi.getPolicies()
  await complianceApi.getCategories()

  assert.equal(calls[0], '/api/v1/tenant/expenses/policies')
  assert.equal(calls[1], '/api/v1/tenant/expenses/categories')
})

test('complianceApi getAuditLogs builds paginated and filtered query string', async () => {
  let capturedPath = ''
  setupMockRuntime(async (path) => {
    capturedPath = path
    return { items: [], total: 0 }
  })

  await complianceApi.getAuditLogs({
    page: 2,
    pageSize: 10,
    search: 'policy',
    outcome: 'SUCCESS',
    from: '2026-03-01',
    to: '2026-03-31',
  })

  const url = new URL('http://localhost:3000' + capturedPath)
  assert.equal(url.pathname, '/api/v1/tenant/configuration/audit-logs')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.get('pageSize'), '10')
  assert.equal(url.searchParams.get('search'), 'policy')
  assert.equal(url.searchParams.get('outcome'), 'SUCCESS')
  assert.equal(url.searchParams.get('from'), '2026-03-01')
  assert.equal(url.searchParams.get('to'), '2026-03-31')
})

test('complianceApi notification endpoints query page, unread count, and mark read', async () => {
  const calls = []
  setupMockRuntime(async (path, options) => {
    calls.push({ path, ...options })
    return { items: [], total: 0 }
  })

  await complianceApi.getNotifications({ page: 1, pageSize: 20, state: 'unread' })
  await complianceApi.getUnreadNotificationCount()
  await complianceApi.markNotificationRead('notif-cmp-1')
  await complianceApi.markAllNotificationsRead()

  assert.equal(calls[0].path, '/api/v1/tenant/expenses/notifications/page?page=1&pageSize=20&state=unread')
  assert.equal(calls[1].path, '/api/v1/tenant/expenses/notifications/unread-count')
  assert.equal(calls[2].path, '/api/v1/tenant/expenses/notifications/notif-cmp-1/read')
  assert.equal(calls[2].method, 'PATCH')
  assert.equal(calls[3].path, '/api/v1/tenant/expenses/notifications/read-all')
  assert.equal(calls[3].method, 'POST')
})

test('legacyPaths correctly maps legacy compliance views to React routes', () => {
  assert.equal(legacyPaths['/views/compliance/dashboard.html'], '/compliance/dashboard')
  assert.equal(legacyPaths['/views/compliance/escalated-expenses.html'], '/compliance/queue')
  assert.equal(legacyPaths['/views/compliance/compliance.html'], '/compliance/queue')
  assert.equal(legacyPaths['/views/compliance/policies.html'], '/compliance/policies')
  assert.equal(legacyPaths['/views/compliance/audit.html'], '/compliance/audit')
  assert.equal(legacyPaths['/views/compliance/communications.html'], '/compliance/notifications')
  assert.equal(legacyPaths['/views/compliance/profile-settings.html'], '/compliance/settings')
})
