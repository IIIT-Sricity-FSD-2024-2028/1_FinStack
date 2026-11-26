import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClientStore } from '../src/app/store.js'
import {
  decideExpense, fetchComplianceResource, markNotificationsRead, pageQueryChanged,
  queryKey, refreshResources, refreshWorkspace, resourceStatus,
  selectActivePolicies, selectCategories, selectQueue, selectUnreadCount,
} from '../src/features/compliance/store/complianceSlice.js'
import { createLiveRefreshController } from '../src/hooks/liveRefreshController.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise((resolve) => setImmediate(resolve))
const expense = { id: 'EXP-101', organizationId: 'org-a', workflowStatus: 'compliance_review', amount: '12.50', currency: 'USD', riskScore: 80 }
function fixture(overrides = {}) {
  let current = { accessToken: 'fixture-token-a', organizationId: 'org-a', user: {
    id: 'officer-a', organizationId: 'org-a', role: 'COMPLIANCE_OFFICER', status: 'ACTIVE',
  } }
  const calls = []
  const methods = {
    getComplianceQueue: () => [expense],
    getPolicies: () => [{ id: 'active', status: 'Active' }, { id: 'inactive', status: 'Inactive' }],
    getCategories: () => [{ id: 'travel', name: 'Travel' }],
    getUnreadNotificationCount: () => ({ unreadCount: 47 }),
    getNotifications: () => ({ items: [{ id: 'notice-a', unread: true }], total: 83, unreadCount: 47, totalPages: 5 }),
    getAuditLogs: () => ({ items: [{ id: 'event-a' }], total: 51, totalPages: 3 }),
    approveClaim: () => ({ ...expense, workflowStatus: 'finance_review' }),
    rejectClaim: () => ({ ...expense, workflowStatus: 'rejected' }),
    correctiveAction: () => ({ ...expense, complianceDecision: 'Corrective Action' }),
    markNotificationRead: () => ({ id: 'notice-a', unread: false }),
    markAllNotificationsRead: () => ({ updated: 47 }),
    ...overrides,
  }
  const api = Object.fromEntries(Object.entries(methods).map(([name, fn]) => [name, (...args) => {
    calls.push({ name, args })
    return fn(...args)
  }]))
  const store = createClientStore({ complianceApi: api, getSession: () => current })
  store.startSession()
  const load = (resource, query = {}, force = false) => store.dispatch(fetchComplianceResource({ resource, query, force }))
  return { store, api, calls, load, setSession: (value) => { current = value }, getSession: () => current,
    state: () => store.getState().compliance }
}

test('Compliance store starts empty and isolates separate feature instances without credentials in state', async () => {
  const a = fixture(), b = fixture()
  assert.deepEqual(selectQueue(a.store.getState()), [])
  await a.load('queue')
  assert.equal(selectQueue(a.store.getState()).length, 1)
  assert.deepEqual(selectQueue(b.store.getState()), [])
  assert.doesNotMatch(JSON.stringify(a.store.getState()), /fixture-token|accessToken/)
})

test('queue reads deduplicate overlapping consumers and definitions remain cached across navigation', async () => {
  const pending = deferred()
  const f = fixture({ getComplianceQueue: () => pending.promise })
  const first = f.load('queue')
  await f.load('queue')
  await f.load('categories')
  await f.load('categories')
  pending.resolve([expense]); await first
  assert.equal(f.calls.filter((call) => call.name === 'getComplianceQueue').length, 1)
  assert.equal(f.calls.filter((call) => call.name === 'getCategories').length, 1)
  assert.equal(selectCategories(f.store.getState())[0].name, 'Travel')
})

test('policies selectors show only explicitly active policies and memoize results', async () => {
  const f = fixture()
  await f.load('policies')
  const policies = selectActivePolicies(f.store.getState())
  assert.deepEqual(policies.map((policy) => policy.id), ['active'])
  await f.load('queue')
  assert.equal(selectActivePolicies(f.store.getState()), policies)
})

test('resource loading and errors are independent, with recoverable initial failures', async () => {
  const pending = deferred()
  let fail = true
  const f = fixture({ getComplianceQueue: () => pending.promise, getPolicies: () => {
    if (fail) throw new Error('Policies unavailable')
    return []
  } })
  const queueRequest = f.load('queue')
  await f.load('policies')
  assert.equal(f.state().policies.error, 'Policies unavailable')
  assert.ok(f.state().queue.requestId)
  assert.equal(f.state().queue.error, '')
  fail = false; await f.load('policies')
  assert.equal(f.state().policies.error, '')
  pending.resolve([]); await queueRequest
  assert.deepEqual(resourceStatus([f.state().queue]), { loading: false, error: '', refreshError: false })
})

test('empty and malformed list responses retain safe empty states and backend pagination totals', async () => {
  const f = fixture({ getComplianceQueue: () => [], getPolicies: () => null, getCategories: () => ({}),
    getAuditLogs: () => ({ items: [], total: 0, totalPages: 0 }) })
  await Promise.all(['queue', 'policies', 'categories', 'audit'].map((name) => f.load(name)))
  for (const name of ['queue', 'policies', 'categories']) assert.deepEqual(f.state()[name].data, [])
  assert.equal(f.state().audit.data.total, 0)
  assert.equal(f.state().audit.data.totalPages, 1)
})

test('background refresh retains valid queue data, reports failure, and clears errors on retry', async () => {
  let fail = false
  const pending = deferred()
  const f = fixture({ getComplianceQueue: () => fail ? pending.promise : [expense] })
  await f.load('queue')
  fail = true
  const refresh = f.load('queue', {}, true)
  assert.equal(resourceStatus([f.state().queue]).loading, false)
  assert.equal(selectQueue(f.store.getState()).length, 1)
  pending.reject(new Error('Offline')); await refresh
  assert.equal(resourceStatus([f.state().queue]).refreshError, true)
  assert.equal(resourceStatus([f.state().queue]).error, '')
  fail = false; await f.load('queue', {}, true)
  assert.equal(f.state().queue.error, '')
})

test('audit requests retain exact server page/search/outcome/date identity and reject older successes', async () => {
  const old = deferred(), latest = deferred()
  const f = fixture({ getAuditLogs: (query) => query.page === 2 ? old.promise : latest.promise })
  const oldQuery = { page: 2, pageSize: 25, search: 'old', outcome: 'FAILED', from: '2026-01-01', to: '2026-02-01' }
  const newQuery = { ...oldQuery, page: 1, search: 'new' }
  const first = f.load('audit', oldQuery)
  const second = f.load('audit', newQuery)
  latest.resolve({ items: [{ id: 'latest' }], total: 102, totalPages: 5 }); await second
  old.resolve({ items: [{ id: 'obsolete' }], total: 99, totalPages: 4 }); await first
  assert.deepEqual(f.state().audit.query, newQuery)
  assert.deepEqual(f.state().audit.data, { items: [{ id: 'latest' }], total: 102, totalPages: 5 })
  assert.deepEqual(f.calls[0].args[0], oldQuery)
  assert.deepEqual(f.calls[1].args[0], newQuery)
})

test('rapid audit A/B/A queries and late errors cannot replace the active result', async () => {
  const requests = [deferred(), deferred(), deferred()]
  let next = 0
  const f = fixture({ getAuditLogs: () => requests[next++].promise })
  const a = f.load('audit', { search: 'a' }), b = f.load('audit', { search: 'b' }), a2 = f.load('audit', { search: 'a' })
  requests[2].resolve({ items: [{ id: 'new-a' }], total: 1 }); await a2
  requests[1].reject(new Error('Old error')); await b
  requests[0].resolve({ items: [{ id: 'old-a' }], total: 1 }); await a
  assert.equal(f.state().audit.data.items[0].id, 'new-a')
  assert.equal(f.state().audit.error, '')
})

test('corrective action preserves queue display fields if the follow-up read fails', async () => {
  const enriched = { ...expense, employee: { fullName: 'QA Submitter' }, category: 'Travel' }
  let decided = false
  const f = fixture({
    getComplianceQueue: () => {
      if (decided) throw new Error('Queue unavailable')
      return [enriched]
    },
    correctiveAction: () => {
      decided = true
      return { ...expense, employee: null, category: 'category-id', complianceDecision: 'Corrective Action' }
    },
  })
  await f.load('queue')
  await f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'correctiveAction', note: 'Review receipts' }))
  assert.deepEqual(selectQueue(f.store.getState()), [{ ...enriched, complianceDecision: 'Corrective Action' }])
  assert.equal(resourceStatus([f.state().queue]).refreshError, true)
})

test('query changes clear old page results immediately even while a decision blocks reads', async () => {
  const pending = deferred()
  const f = fixture({ approveClaim: () => pending.promise })
  await f.load('audit', { page: 2 })
  const decision = f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' }))
  f.store.dispatch(pageQueryChanged({ name: 'audit', query: { page: 1, outcome: 'FAILED' } }))
  await f.load('audit', { page: 1, outcome: 'FAILED' })
  assert.deepEqual(f.state().audit.data.items, [])
  pending.resolve({ ...expense, workflowStatus: 'finance_review' }); await decision
  assert.deepEqual(f.calls.filter((call) => call.name === 'getAuditLogs').at(-1).args[0], { page: 1, outcome: 'FAILED' })
})

for (const [type, workflowStatus] of [['approve', 'finance_review'], ['reject', 'rejected'], ['correctiveAction', 'compliance_review']]) {
  test(`${type} respects backend status and refreshes queue, audit, notifications and unread data`, async () => {
    let queue = [expense]
    const result = { ...expense, workflowStatus, complianceDecision: type }
    const write = (_id, note) => {
      assert.equal(note, 'Reviewed')
      queue = workflowStatus === 'compliance_review' ? [result] : []
      return result
    }
    const f = fixture({ getComplianceQueue: () => queue,
      approveClaim: write, rejectClaim: write, correctiveAction: write })
    await Promise.all(['queue', 'audit', 'notifications'].map((name) => f.load(name)))
    f.calls.length = 0
    const response = await f.store.dispatch(decideExpense({ expenseId: expense.id, type, note: ' Reviewed ' }))
    assert.deepEqual(response, result)
    assert.deepEqual(selectQueue(f.store.getState()), queue)
    for (const method of ['getComplianceQueue', 'getAuditLogs', 'getNotifications']) {
      assert.equal(f.calls.filter((call) => call.name === method).length, 1, method)
    }
    assert.equal(selectUnreadCount(f.store.getState()), 47)
    assert.equal(f.state().deciding, false)
  })
}

test('failed decisions preserve the expense, reject with an actionable error, and can be retried', async () => {
  let fail = true
  const f = fixture({ approveClaim: () => {
    if (fail) throw new Error('No active Finance Officer is available in this organization.')
    return { ...expense, workflowStatus: 'finance_review' }
  } })
  await f.load('queue')
  await assert.rejects(f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' })), /No active Finance Officer/)
  assert.equal(selectQueue(f.store.getState())[0].id, expense.id)
  assert.equal(f.state().deciding, false)
  fail = false
  await f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' }))
  assert.equal(f.calls.filter((call) => call.name === 'approveClaim').length, 2)
})

test('duplicate decisions are rejected before the API, including within the same render', async () => {
  const pending = deferred()
  const f = fixture({ approveClaim: () => pending.promise })
  const first = f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' }))
  await assert.rejects(f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' })), /already in progress/)
  assert.equal(f.calls.filter((call) => call.name === 'approveClaim').length, 1)
  pending.resolve({ ...expense, workflowStatus: 'finance_review' }); await first
})

test('unsupported decisions and missing required notes do not call the backend', async () => {
  const f = fixture()
  for (const [type, note] of [['return', 'no'], ['reject', ' '], ['correctiveAction', '']]) {
    await assert.rejects(f.store.dispatch(decideExpense({ expenseId: expense.id, type, note })))
  }
  assert.equal(f.calls.filter((call) => ['rejectClaim', 'correctiveAction', 'approveClaim'].includes(call.name)).length, 0)
})

test('a slow pre-decision poll cannot resurrect an approved expense after post-write refresh', async () => {
  const old = deferred(), write = deferred()
  let reads = 0
  const f = fixture({ getComplianceQueue: () => ++reads === 1 ? old.promise : [], approveClaim: () => write.promise })
  const stale = f.load('queue')
  const decision = f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' }))
  await f.load('queue', {}, true)
  assert.equal(reads, 1, 'polling must not read during the decision')
  write.resolve({ ...expense, workflowStatus: 'finance_review' }); await decision
  old.resolve([expense]); await stale
  assert.deepEqual(selectQueue(f.store.getState()), [])
  assert.equal(reads, 2)
})

test('successful writes remain successful when a dependent refresh fails', async () => {
  const f = fixture({ getComplianceQueue: () => { throw new Error('Queue refresh unavailable') } })
  const result = await f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' }))
  assert.equal(result.workflowStatus, 'finance_review')
  assert.equal(f.state().queue.error, 'Queue refresh unavailable')
})

test('notification aggregate remains authoritative across page/filter reads and layout refresh', async () => {
  const f = fixture()
  await f.load('unread')
  await f.load('notifications', { page: 3, pageSize: 20, state: 'unread' })
  assert.equal(f.state().notifications.data.items.length, 1)
  assert.equal(f.state().notifications.data.total, 83)
  assert.equal(selectUnreadCount(f.store.getState()), 47)
  f.calls.length = 0
  await f.store.dispatch(refreshWorkspace(true))
  assert.deepEqual(f.calls.map((call) => call.name).sort(), ['getComplianceQueue', 'getNotifications'])
})

test('late unread-count responses cannot overwrite a newer notification page aggregate', async () => {
  const old = deferred()
  const f = fixture({ getUnreadNotificationCount: () => old.promise })
  const badge = f.load('unread')
  await f.load('notifications', { page: 1 })
  old.resolve({ unreadCount: 100 }); await badge
  assert.equal(selectUnreadCount(f.store.getState()), 47)
})

for (const all of [false, true]) {
  test(`${all ? 'read-all' : 'mark-read'} refetches server-filtered notifications and updates the shared badge`, async () => {
    let unreadCount = 47
    const write = () => { unreadCount = all ? 0 : 46; return { updated: 1 } }
    const f = fixture({ markNotificationRead: write, markAllNotificationsRead: write,
      getNotifications: () => ({ items: [], total: unreadCount, unreadCount }) })
    await f.load('notifications', { page: 1, pageSize: 20, state: 'unread' })
    await f.store.dispatch(markNotificationsRead(all ? {} : { id: 'notice-a' }))
    assert.equal(selectUnreadCount(f.store.getState()), unreadCount)
    assert.equal(f.state().notifications.data.total, unreadCount)
    assert.deepEqual(f.calls.filter((call) => call.name === 'getNotifications').at(-1).args[0], { page: 1, pageSize: 20, state: 'unread' })
  })
}

test('notification write failures leave server state recoverable and suppress duplicate submissions', async () => {
  const pending = deferred()
  const f = fixture({ markNotificationRead: () => pending.promise })
  await f.load('notifications', { page: 1 })
  const first = f.store.dispatch(markNotificationsRead({ id: 'notice-a' }))
  const rejected = assert.rejects(first, /Read failed/)
  await assert.rejects(f.store.dispatch(markNotificationsRead({ id: 'notice-a' })), /already in progress/)
  pending.reject(new Error('Read failed')); await rejected
  assert.equal(f.state().notifications.data.items[0].unread, true)
  assert.equal(f.state().markingRead, false)
})

test('notification page changes reject obsolete page data and totals', async () => {
  const old = deferred()
  const f = fixture({ getNotifications: (query) => query.page === 2 ? old.promise : { items: [], total: 0, unreadCount: 0 } })
  const first = f.load('notifications', { page: 2 })
  await f.load('notifications', { page: 1, state: 'unread' })
  old.resolve({ items: [{ id: 'old' }], total: 90, unreadCount: 90 }); await first
  assert.equal(f.state().notifications.data.total, 0)
  assert.equal(selectUnreadCount(f.store.getState()), 0)
})

for (const change of ['logout', 'account', 'tenant', 'role', 'token']) {
  test(`${change} clears state, aborts requests and rejects late responses across sessions`, async () => {
    const old = deferred()
    let signal
    const f = fixture({ getComplianceQueue: (requestSignal) => { signal = requestSignal; return old.promise } })
    await f.load('policies')
    const request = f.load('queue')
    const previous = f.getSession()
    const next = change === 'logout' ? null : { ...previous, user: { ...previous.user } }
    if (change === 'account') next.user.id = 'officer-b'
    if (change === 'tenant') { next.organizationId = 'org-b'; next.user.organizationId = 'org-b' }
    if (change === 'role') next.user.role = 'FINANCE_OFFICER'
    if (change === 'token') next.accessToken = 'fixture-token-b'
    f.setSession(next); f.store.endSession(); f.store.startSession()
    assert.equal(signal.aborted, true)
    assert.deepEqual(f.state().policies.data, [])
    old.resolve([expense]); await request
    assert.deepEqual(f.state().queue.data, [])
    assert.equal(f.state().queue.error, '')
    assert.equal(f.state().session.identity === null, ['logout', 'role'].includes(change))
  })
}

test('identity guards reject late data even before React processes the session-change event', async () => {
  const old = deferred()
  const f = fixture({ getComplianceQueue: () => old.promise })
  const request = f.load('queue')
  f.setSession({ ...f.getSession(), accessToken: 'replacement-token' })
  old.resolve([expense]); await request
  assert.deepEqual(f.state().queue.data, [])
  assert.match(f.state().queue.error, /session changed/)
})

test('late old-session decision completions cannot change or refresh a new session', async () => {
  const pending = deferred()
  const f = fixture({ approveClaim: () => pending.promise })
  const decision = f.store.dispatch(decideExpense({ expenseId: expense.id, type: 'approve' }))
  const rejected = assert.rejects(decision, /session changed/)
  f.store.endSession(); f.store.startSession()
  pending.resolve({ ...expense, workflowStatus: 'finance_review' }); await rejected
  assert.deepEqual(f.state().queue.data, [])
  assert.equal(f.calls.length, 1)
})

test('Strict Mode setup/cleanup/setup can load again while old requests are outstanding', async () => {
  const old = deferred()
  let reads = 0
  const f = fixture({ getComplianceQueue: () => ++reads === 1 ? old.promise : [] })
  const first = f.load('queue')
  f.store.endSession(); f.store.startSession()
  await f.load('queue')
  old.resolve([expense]); await first
  assert.deepEqual(f.state().queue.data, [])
  assert.equal(reads, 2)
})

test('existing live refresh controller serializes store polling and cleans up deterministic timers', async () => {
  const pending = deferred()
  let interval, cleared = false, reads = 0
  const f = fixture({ getComplianceQueue: () => ++reads === 1 ? pending.promise : [] })
  const controller = createLiveRefreshController({
    refresh: () => f.store.dispatch(refreshWorkspace(false)), minIntervalMs: 0,
    windowTarget: null, documentTarget: null,
    setIntervalFn: (fn) => { interval = fn; return 1 }, clearIntervalFn: () => { cleared = true },
  })
  controller.start(); await tick()
  interval(); interval(); await tick()
  assert.equal(reads, 1)
  pending.resolve([]); await tick(); await tick()
  assert.equal(reads, 2)
  controller.stop(); interval(); await tick()
  assert.equal(reads, 2)
  assert.equal(cleared, true)
})

test('canonical query identity ignores property order and omitted empty parameters', () => {
  assert.equal(queryKey({ page: 2, outcome: 'SUCCESS', search: '' }), queryKey({ outcome: 'SUCCESS', page: 2, from: undefined }))
  assert.notEqual(queryKey({ page: 1 }), queryKey({ page: 2 }))
})

test('refresh without visited paginated resources does not invent audit or notification queries', async () => {
  const f = fixture()
  await f.store.dispatch(refreshResources(['queue', 'audit', 'notifications', 'unread']))
  assert.deepEqual(f.calls.map((call) => call.name).sort(), ['getComplianceQueue', 'getUnreadNotificationCount'])
})
