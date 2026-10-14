import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { financeApi } from '../src/features/finance/financeApi.js'
import { legacyPaths } from '../src/routes/paths.ts'

const originalWindow = globalThis.window
const originalFetch = globalThis.fetch

function setupMockRuntime(requestFn) {
  const session = {
    accessToken: 'test-token-123',
    organizationId: 'org-1',
    user: { id: 'fin-1', employeeId: 'FIN-001', role: 'FINANCE_OFFICER', status: 'ACTIVE' },
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

test('financeApi getFinanceQueue calls /api/v1/tenant/expenses/finance/queue', async () => {
  let capturedPath = ''
  setupMockRuntime(async (path) => {
    capturedPath = path
    return [{ id: 'EXP-1', status: 'pending' }]
  })

  const result = await financeApi.getFinanceQueue()
  assert.equal(capturedPath, '/api/v1/tenant/expenses/finance/queue')
  assert.deepEqual(result, [{ id: 'EXP-1', status: 'pending' }])
})

test('financeApi getFinanceWorkspace calls /api/v1/tenant/expenses/finance/workspace', async () => {
  let capturedPath = ''
  setupMockRuntime(async (path) => {
    capturedPath = path
    return { expenses: [], transactions: [] }
  })

  const result = await financeApi.getFinanceWorkspace()
  assert.equal(capturedPath, '/api/v1/tenant/expenses/finance/workspace')
  assert.deepEqual(result, { expenses: [], transactions: [] })
})

test('financeApi decision endpoints send note and correct method', async () => {
  const calls = []
  setupMockRuntime(async (path, options) => {
    calls.push({ path, ...options })
    return { id: 'EXP-10' }
  })

  await financeApi.approveExpense('EXP-10', 'Approved for bank release')
  await financeApi.rejectExpense('EXP-10', 'Policy violation')
  await financeApi.requestInfoExpense('EXP-10', 'Itemized receipt required')
  await financeApi.flagExpense('EXP-10', 'Check duplicate submission')

  assert.equal(calls.length, 4)
  assert.equal(calls[0].path, '/api/v1/tenant/expenses/EXP-10/finance/approve')
  assert.deepEqual(calls[0].body, { note: 'Approved for bank release' })
  assert.equal(calls[0].method, 'POST')

  assert.equal(calls[1].path, '/api/v1/tenant/expenses/EXP-10/finance/reject')
  assert.deepEqual(calls[1].body, { note: 'Policy violation' })

  assert.equal(calls[2].path, '/api/v1/tenant/expenses/EXP-10/finance/request-info')
  assert.deepEqual(calls[2].body, { note: 'Itemized receipt required' })

  assert.equal(calls[3].path, '/api/v1/tenant/expenses/EXP-10/finance/flag')
  assert.deepEqual(calls[3].body, { note: 'Check duplicate submission' })
})

test('financeApi releasePayment validates expenseIds and calls release endpoint', async () => {
  setupMockRuntime(async (path, options) => ({ path, options }))
  await assert.rejects(financeApi.releasePayment([]), /Select at least one expense/)
  await assert.rejects(financeApi.releasePayment(null), /Select at least one expense/)

  let captured = null
  setupMockRuntime(async (path, options) => {
    captured = { path, options }
    return { batchId: 'PB-123', count: 2 }
  })

  const res = await financeApi.releasePayment(['EXP-1', 'EXP-2'])
  assert.equal(captured.path, '/api/v1/tenant/expenses/finance/payment-releases')
  assert.deepEqual(captured.options.body, { expenseIds: ['EXP-1', 'EXP-2'] })
  assert.equal(res.batchId, 'PB-123')
})

test('financeApi transaction endpoints process, fail, and reconcile', async () => {
  const calls = []
  setupMockRuntime(async (path, options) => {
    calls.push({ path, ...options })
    return { status: 'updated' }
  })

  await financeApi.processTransaction('TX-1')
  await financeApi.failTransaction('TX-2')
  await financeApi.reconcileTransaction('TX-3')

  assert.equal(calls[0].path, '/api/v1/tenant/expenses/finance/transactions/TX-1/process')
  assert.equal(calls[1].path, '/api/v1/tenant/expenses/finance/transactions/TX-2/fail')
  assert.equal(calls[2].path, '/api/v1/tenant/expenses/finance/transactions/TX-3/reconcile')
})

test('financeApi downloadReceipt retrieves binary blob with bearer auth', async () => {
  setupMockRuntime()
  let capturedHeaders = {}
  const fakeBlob = { size: 1024, type: 'image/png' }

  globalThis.fetch = async (url, options) => {
    capturedHeaders = options.headers
    return {
      ok: true,
      headers: { get: () => 'image/png' },
      blob: async () => fakeBlob,
    }
  }

  const { blob, contentType } = await financeApi.downloadReceipt('EXP-99')
  assert.equal(capturedHeaders.Authorization, 'Bearer test-token-123')
  assert.equal(blob, fakeBlob)
  assert.equal(contentType, 'image/png')
})

test('financeApi notification endpoints query page, unread, and mark read', async () => {
  const calls = []
  setupMockRuntime(async (path, options) => {
    calls.push({ path, ...options })
    return { items: [], total: 0 }
  })

  await financeApi.getNotifications({ page: 2, pageSize: 20, state: 'unread' })
  await financeApi.getUnreadNotificationCount()
  await financeApi.markNotificationRead('notif-1')
  await financeApi.markAllNotificationsRead()

  assert.equal(calls[0].path, '/api/v1/tenant/expenses/notifications/page?page=2&pageSize=20&state=unread')
  assert.equal(calls[1].path, '/api/v1/tenant/expenses/notifications/unread-count')
  assert.equal(calls[2].path, '/api/v1/tenant/expenses/notifications/notif-1/read')
  assert.equal(calls[2].method, 'PATCH')
  assert.equal(calls[3].path, '/api/v1/tenant/expenses/notifications/read-all')
  assert.equal(calls[3].method, 'POST')
})

test('legacyPaths correctly maps legacy finance views to React routes', () => {
  assert.equal(legacyPaths['/views/finance/dashboard.html'], '/finance/dashboard')
  assert.equal(legacyPaths['/views/finance/finance-review.html'], '/finance/queue')
  assert.equal(legacyPaths['/views/finance/payments.html'], '/finance/payments')
  assert.equal(legacyPaths['/views/finance/transactions.html'], '/finance/transactions')
  assert.equal(legacyPaths['/views/finance/reconciliation.html'], '/finance/transactions')
  assert.equal(legacyPaths['/views/finance/flagged-expenses.html'], '/finance/queue')
  assert.equal(legacyPaths['/views/finance/reports.html'], '/finance/dashboard')
  assert.equal(legacyPaths['/views/finance/profile-settings.html'], '/finance/settings')
  assert.equal(legacyPaths['/views/finance/preferences.html'], '/finance/settings')
})
