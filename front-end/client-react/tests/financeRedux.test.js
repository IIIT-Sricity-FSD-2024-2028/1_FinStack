import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createClientStore, installStoreRuntime } from '../src/app/store.js'
import { financeApiSlice as api } from '../src/features/finance/financeApiSlice.js'
import { financeSlice } from '../src/features/finance/financeSlice.js'
import { LIVE_REFRESH_EVENT } from '../src/hooks/liveRefreshController.js'

const originalWindow = globalThis.window
const cleanups = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
  globalThis.window = originalWindow
})

function fixture(request) {
  globalThis.window = Object.assign(new EventTarget(), {
    FinStackTenantSession: { request },
  })
  const store = createClientStore()
  cleanups.push(() => store.dispatch(api.util.resetApiState()))
  return store
}
const read = (store, name, args) => store.dispatch(api.endpoints[name].initiate(args))
const select = (store, name, args) => api.endpoints[name].select(args)(store.getState())
async function settle(store) {
  await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()))
}

test('dashboard, lists and details share a deduplicated workspace without changing decimal strings', async () => {
  let resolveRequest, calls = 0, signal
  const store = fixture((_path, options) => {
    calls++
    signal = options.signal
    return new Promise((resolve) => { resolveRequest = resolve })
  })
  const dashboard = read(store, 'financeWorkspace')
  const list = read(store, 'financeWorkspace')
  assert.equal(calls, 1)
  assert(signal instanceof AbortSignal)
  resolveRequest({ expenses: [{ id: 'EXP-QA', amount: '1234.50', currency: 'INR' }], transactions: [] })
  const [first, second] = await Promise.all([dashboard.unwrap(), list.unwrap()])
  assert.equal(first, second)
  assert.equal(first.expenses[0].amount, '1234.50')
  await store.dispatch(api.endpoints.financeWorkspace.initiate(undefined, { forceRefetch: false })).unwrap()
  assert.equal(calls, 1)
  assert.equal(select(store, 'financeWorkspace').data, first)
})

test('every financial mutation refreshes workspace, queue, notifications and unread count', async () => {
  const gets = new Map()
  const writes = []
  let version = 0
  const store = fixture(async (path, options) => {
    if (options.method) {
      version++
      writes.push({ path, ...options })
      return { id: 'EXP-QA', batchId: 'BATCH-QA' }
    }
    gets.set(path, (gets.get(path) || 0) + 1)
    if (path.endsWith('/workspace')) return { expenses: [{ id: 'EXP-QA', version }], transactions: [] }
    if (path.endsWith('/queue')) return [{ id: 'EXP-QA', version }]
    if (path.endsWith('/unread-count')) return { count: version }
    return { items: [{ id: 'NOTICE-QA', version }], total: 1 }
  })
  await Promise.all(['financeWorkspace', 'financeQueue', 'financeUnreadCount'].map((name) => read(store, name).unwrap()))
  await read(store, 'financeNotifications', { page: 1 }).unwrap()
  const cases = [
    ['approveExpense', { expenseId: 'EXP-QA', note: '  Approved  ' }, '/EXP-QA/finance/approve'],
    ['rejectExpense', { expenseId: 'EXP-QA', note: 'Reason' }, '/EXP-QA/finance/reject'],
    ['requestInfoExpense', { expenseId: 'EXP-QA', note: 'Receipt needed' }, '/EXP-QA/finance/request-info'],
    ['flagExpense', { expenseId: 'EXP-QA', note: 'Audit' }, '/EXP-QA/finance/flag'],
    ['releasePayment', ['EXP-QA'], '/finance/payment-releases'],
    ['processTransaction', 'TX-QA', '/finance/transactions/TX-QA/process'],
    ['failTransaction', 'TX-QA', '/finance/transactions/TX-QA/fail'],
    ['reconcileTransaction', 'TX-QA', '/finance/transactions/TX-QA/reconcile'],
  ]
  for (const [name, args, suffix] of cases) {
    await read(store, name, args).unwrap()
    await settle(store)
    assert(writes.at(-1).path.endsWith(suffix))
    assert.equal(writes.at(-1).method, 'POST')
    assert(writes.at(-1).signal instanceof AbortSignal)
    assert.equal(select(store, 'financeWorkspace').data.expenses[0].version, version)
    assert.equal(select(store, 'financeQueue').data[0].version, version)
    assert.equal(select(store, 'financeNotifications', { page: 1 }).data.items[0].version, version)
    assert.equal(select(store, 'financeUnreadCount').data.count, version)
    assert([...gets.values()].every((count) => count === version + 1))
  }
  assert.deepEqual(writes[0].body, { note: 'Approved' })
  assert.deepEqual(writes[4].body, { expenseIds: ['EXP-QA'] })
})

test('bank-evidence and permission errors remain serializable and preserve cached financial state', async () => {
  let gets = 0
  let status = 409
  const store = fixture(async (_path, options) => {
    if (options.method) throw Object.assign(new Error('Bank evidence required'), { status, code: 'TENANT_BANK_EVIDENCE_REQUIRED' })
    gets++
    return { expenses: [{ id: 'EXP-QA', workflowStatus: 'payment_processing' }], transactions: [{ id: 'TX-QA', status: 'pending' }] }
  })
  await read(store, 'financeWorkspace').unwrap()
  const cached = select(store, 'financeWorkspace').data
  for (status of [409, 403, 500]) {
    await assert.rejects(read(store, 'processTransaction', 'TX-QA').unwrap(), (error) => {
      assert.equal(error.status, status)
      assert.equal(error.code, 'TENANT_BANK_EVIDENCE_REQUIRED')
      assert.equal(error.message, 'Bank evidence required')
      assert.equal(Object.getPrototypeOf(error), Object.prototype)
      return true
    })
    await settle(store)
    assert.equal(select(store, 'financeWorkspace').data, cached)
    assert.equal(gets, 1)
  }
})

test('notification filters use distinct cache keys and read mutations refresh every page and badge', async () => {
  const gets = new Map()
  const writes = []
  const store = fixture(async (path, options) => {
    if (options.method) { writes.push({ path, ...options }); return { count: 0 } }
    gets.set(path, (gets.get(path) || 0) + 1)
    if (path.endsWith('/workspace')) return { expenses: [], transactions: [] }
    if (path.endsWith('/unread-count')) return { count: 1 }
    return { items: [{ id: path }], total: 1 }
  })
  const first = { page: 1, pageSize: 15, state: 'unread' }
  const second = { page: 2, pageSize: 15, state: 'read' }
  const [page1, page2] = await Promise.all([read(store, 'financeNotifications', first).unwrap(), read(store, 'financeNotifications', second).unwrap()])
  assert.notEqual(page1.items[0].id, page2.items[0].id)
  assert.match(page1.items[0].id, /page=1&pageSize=15&state=unread/)
  assert.match(page2.items[0].id, /page=2&pageSize=15&state=read/)
  await read(store, 'financeUnreadCount').unwrap()
  await read(store, 'financeWorkspace').unwrap()
  for (const [name, args] of [['markFinanceNotificationRead', 'NOTICE-QA'], ['markAllFinanceNotificationsRead']]) {
    await read(store, name, args).unwrap()
    await settle(store)
  }
  assert.equal(writes[0].method, 'PATCH')
  assert(writes[0].path.endsWith('/NOTICE-QA/read'))
  assert.equal(writes[1].method, 'POST')
  assert(writes[1].path.endsWith('/read-all'))
  for (const [path, count] of gets) assert.equal(count, path.endsWith('/workspace') ? 1 : 3)
})

test('payment validation rejects empty and oversized batches before any HTTP request', async () => {
  let calls = 0
  const store = fixture(async () => { calls++; return { batchId: 'BATCH-QA' } })
  for (const ids of [[], null, Array.from({ length: 101 }, (_, index) => `EXP-${index}`)]) {
    await assert.rejects(read(store, 'releasePayment', ids).unwrap(), (error) => /Select at least one|at most 100/.test(error.message))
  }
  assert.equal(calls, 0)
  await read(store, 'releasePayment', Array.from({ length: 100 }, (_, index) => `EXP-${index}`)).unwrap()
  assert.equal(calls, 1)
})

test('background refresh errors retain data and a subsequent refresh recovers', async () => {
  let unavailable = false
  const store = fixture(async () => {
    if (unavailable) throw new Error('Offline')
    return { expenses: [{ id: 'EXP-QA' }], transactions: [] }
  })
  const subscription = read(store, 'financeWorkspace')
  await subscription.unwrap()
  unavailable = true
  await assert.rejects(subscription.refetch().unwrap())
  assert.equal(select(store, 'financeWorkspace').data.expenses[0].id, 'EXP-QA')
  assert.equal(select(store, 'financeWorkspace').error.message, 'Offline')
  unavailable = false
  await subscription.refetch().unwrap()
  assert.equal(select(store, 'financeWorkspace').error, undefined)
})

test('focus, reconnect and cross-actor events refresh active finance subscriptions', async () => {
  let gets = 0
  const store = fixture(async () => { gets++; return { expenses: [], transactions: [] } })
  const stop = installStoreRuntime(store)
  cleanups.push(stop)
  await read(store, 'financeWorkspace').unwrap()
  window.dispatchEvent(new Event('focus'))
  await settle(store)
  assert.equal(gets, 2)
  window.dispatchEvent(new Event('online'))
  await settle(store)
  assert.equal(gets, 3)
  window.dispatchEvent(new Event(LIVE_REFRESH_EVENT))
  await settle(store)
  assert.equal(gets, 4)
  stop()
  window.dispatchEvent(new Event(LIVE_REFRESH_EVENT))
  await settle(store)
  assert.equal(gets, 4)
})

test('session changes abort requests and clear financial records, mutations and filters before another login', async () => {
  let resolveOldQuery, resolveOldMutation, querySignal, mutationSignal
  const store = fixture((path, options) => {
    if (options.method) {
      mutationSignal = options.signal
      return new Promise((resolve) => { resolveOldMutation = resolve })
    }
    if (path.endsWith('/categories')) return Promise.resolve([{ id: 'OLD-CATEGORY' }])
    querySignal = options.signal
    return new Promise((resolve) => { resolveOldQuery = resolve })
  })
  const stop = installStoreRuntime(store)
  cleanups.push(stop)
  await read(store, 'financeCategories').unwrap()
  store.dispatch(financeSlice.actions.setReviewFilter({ search: 'private old tenant' }))
  const oldQuery = read(store, 'financeWorkspace')
  const oldMutation = read(store, 'approveExpense', { expenseId: 'OLD-EXPENSE' })
  window.dispatchEvent(new Event('finstack:session'))
  assert.equal(querySignal.aborted, true)
  assert.equal(mutationSignal.aborted, true)
  assert.equal(store.getState().finance.review.search, '')
  assert.deepEqual(store.getState().financeApi.queries, {})
  assert.deepEqual(store.getState().financeApi.mutations, {})
  window.FinStackTenantSession.request = async () => ({ expenses: [{ id: 'NEW-EXPENSE' }], transactions: [] })
  await read(store, 'financeWorkspace').unwrap()
  resolveOldQuery({ expenses: [{ id: 'OLD-EXPENSE' }], transactions: [] })
  resolveOldMutation({ id: 'OLD-EXPENSE' })
  await Promise.all([oldQuery, oldMutation])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(select(store, 'financeWorkspace').data.expenses[0].id, 'NEW-EXPENSE')
  assert.doesNotMatch(JSON.stringify(store.getState()), /OLD-EXPENSE|OLD-CATEGORY|private old tenant/)
})

test('review and notification filter changes reset pagination and preserve independent transaction filters', () => {
  const store = fixture(async () => ({}))
  store.dispatch(financeSlice.actions.setReviewPage(4))
  store.dispatch(financeSlice.actions.setNotificationPage(3))
  store.dispatch(financeSlice.actions.setTransactionFilter({ statusFilter: 'pending', search: 'TX-QA' }))
  store.dispatch(financeSlice.actions.setReviewFilter({ search: 'merchant', categoryFilter: 'travel', sortKey: 'amount_desc' }))
  store.dispatch(financeSlice.actions.setNotificationFilter('unread'))
  assert.deepEqual(store.getState().finance.review, { page: 1, search: 'merchant', categoryFilter: 'travel', sortKey: 'amount_desc', stageFilter: 'finance_review' })
  assert.deepEqual(store.getState().finance.notifications, { page: 1, stateFilter: 'unread' })
  assert.deepEqual(store.getState().finance.transactions, { statusFilter: 'pending', search: 'TX-QA' })
})
