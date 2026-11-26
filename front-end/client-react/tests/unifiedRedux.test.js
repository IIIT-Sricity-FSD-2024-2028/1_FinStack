import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { findNonSerializableValue } from '@reduxjs/toolkit'
import { createClientStore, installReduxRuntime } from '../src/app/store.js'
import { tenantApi } from '../src/app/api.js'
import { configManagerApi } from '../src/features/config-manager/configManagerApi.js'
import { managerApiSlice } from '../src/features/manager/managerApiSlice.js'
import { financeApiSlice } from '../src/features/finance/financeApiSlice.js'
import { fetchExpenses } from '../src/features/submitter/store/expensesSlice.js'
import { refreshSubmitter, createExpense } from '../src/features/submitter/store/submitterActions.js'
import { fetchComplianceResource, decideExpense } from '../src/features/compliance/store/complianceSlice.js'
import { setQueueSearch } from '../src/features/manager/managerFiltersSlice.js'
import { setReviewFilter } from '../src/features/finance/financeSlice.js'
import { currentSession, saveSession, clearSession, installSessionRuntime, requestBlob } from '../src/services/session.ts'

const original = Object.fromEntries(['window', 'sessionStorage', 'localStorage', 'fetch', 'BroadcastChannel'].map(key => [key, globalThis[key]]))
const memoryStorage = () => {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }
}
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
let store, dispose, calls, respond
const session = (role, organizationId = 'org-a', id = role, token = `${role}-${organizationId}-${id}`) => ({
  accessToken: `fictional-${token}`, organizationId,
  user: { id, organizationId, role, status: 'ACTIVE', employeeId: id, firstName: role, lastName: 'QA', email: `${id}@fixture.test` },
})
beforeEach(() => {
  globalThis.window = new EventTarget()
  window.FINSTACK_API_BASE_URL = 'http://fixture'
  globalThis.sessionStorage = memoryStorage()
  globalThis.localStorage = memoryStorage()
  globalThis.BroadcastChannel = undefined
  calls = []
  respond = async () => []
  globalThis.fetch = async (url, options) => {
    const call = { path: new URL(url).pathname, options, session: currentSession() }
    calls.push(call)
    const data = await respond(call)
    return data instanceof Response ? data : new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } })
  }
  installSessionRuntime()
})
afterEach(() => {
  dispose?.(); dispose = null
  store?.endSession(); store = null
  Object.assign(globalThis, original)
})
function start(dependencies = {}) {
  store = createClientStore(dependencies)
  dispose = installReduxRuntime(window, store)
  return store
}
const dispatchQuery = (name, args, options) => store.dispatch(tenantApi.endpoints[name].initiate(args, options))

test('all actors share exactly one API object, one root reducer tree and uniquely named mutations', () => {
  start()
  assert.equal(tenantApi, configManagerApi)
  assert.equal(tenantApi, financeApiSlice)
  assert.equal(tenantApi, managerApiSlice)
  assert.deepEqual(Object.keys(store.getState()).sort(), ['compliance', 'finance', 'managerFilters', 'sessionBoundary', 'submitter', 'tenantApi'])
  assert.ok(tenantApi.endpoints.financeApproveExpense)
  assert.ok(tenantApi.endpoints.managerApproveExpense)
  assert.notEqual(tenantApi.endpoints.financeApproveExpense, tenantApi.endpoints.managerApproveExpense)
  assert.equal(findNonSerializableValue(store.getState()), false)
})

test('source has one store constructor, one API constructor and one root Redux Provider', async () => {
  const root = new URL('../src/', import.meta.url)
  const files = await readdir(root, { recursive: true })
  const sources = await Promise.all(files.filter(file => /\.(?:js|jsx|ts|tsx)$/.test(file)).map(async file => [file, await readFile(new URL(file.replaceAll('\\', '/'), root), 'utf8')]))
  assert.equal(sources.filter(([, text]) => /configureStore\(/.test(text)).length, 1)
  assert.equal(sources.filter(([, text]) => /createApi\(/.test(text)).length, 1)
  assert.equal(sources.reduce((count, [, text]) => count + (text.match(/<Provider\s/g) || []).length, 0), 1)
  assert.ok(sources.find(([name]) => name === 'main.jsx')[1].includes('<Provider store={store}>'))
  for (const [, text] of sources) assert.doesNotMatch(text, /extra\.api\b|extra\.session\b/)
})

test('Submitter and Compliance thunk dependencies cannot silently call the other actor adapter', async () => {
  const invoked = []
  saveSession(session('EXPENSE_SUBMITTER'))
  start({
    submitterApi: { getMyExpenses: async () => { invoked.push('submitter'); return [{ id: 'own-submitter' }] } },
    complianceApi: { getComplianceQueue: async () => { invoked.push('compliance'); return [{ id: 'own-compliance' }] } },
  })
  await store.dispatch(fetchExpenses()).unwrap()
  assert.equal(store.getState().submitter.expenses.items[0].id, 'own-submitter')
  assert.deepEqual(invoked, ['submitter'])
  saveSession(session('COMPLIANCE_OFFICER'))
  await store.dispatch(fetchComplianceResource({ resource: 'queue' })).unwrap()
  assert.equal(store.getState().compliance.queue.data[0].id, 'own-compliance')
  assert.deepEqual(store.getState().submitter.expenses.items, [])
  assert.deepEqual(invoked, ['submitter', 'compliance'])
})

for (const replacement of ['same-user-token', 'new-user', 'new-tenant', 'logout']) {
  test(`${replacement} revokes late thunk reads and clears all actor filters/caches`, async () => {
    const old = deferred()
    saveSession(session('EXPENSE_SUBMITTER', 'org-a', 'employee-a', 'token-a'))
    start({ submitterApi: { getMyExpenses: () => old.promise } })
    store.dispatch(setQueueSearch('private manager filter'))
    store.dispatch(setReviewFilter({ search: 'private finance filter' }))
    const pending = store.dispatch(fetchExpenses())
    if (replacement === 'logout') clearSession()
    else saveSession(session('EXPENSE_SUBMITTER', replacement === 'new-tenant' ? 'org-b' : 'org-a', replacement === 'new-user' ? 'employee-b' : 'employee-a', 'replacement'))
    const state = store.getState()
    assert.deepEqual(state.submitter.expenses.items, [])
    assert.deepEqual(state.compliance.queue.data, [])
    assert.deepEqual(state.tenantApi.queries, {})
    assert.equal(state.managerFilters.queue.search, '')
    assert.equal(state.finance.review.search, '')
    old.resolve([{ id: 'previous-private-record' }])
    await pending
    assert.equal(JSON.stringify(store.getState()).includes('previous-private-record'), false)
    assert.equal(JSON.stringify(store.getState()).includes('fictional-'), false)
  })
}

test('an obsolete Submitter mutation cannot trigger reads for the replacement Compliance session', async () => {
  const pendingWrite = deferred(), reads = []
  saveSession(session('EXPENSE_SUBMITTER'))
  start({ submitterApi: { createExpense: () => pendingWrite.promise,
    getMyExpenses: async () => { reads.push('expenses'); return [] },
    getNotifications: async () => { reads.push('notifications'); return { items: [] } } } })
  const pending = store.dispatch(createExpense({ amount: '12.50' }, null))
  saveSession(session('COMPLIANCE_OFFICER'))
  pendingWrite.resolve({ id: 'old-write' })
  await assert.rejects(pending, /session changed/)
  assert.deepEqual(reads, [])
  assert.deepEqual(store.getState().submitter.expenses.items, [])
})

test('Manager RTK Query aborts in-flight work and obsolete HTTP 401 does not clear a replacement session', async () => {
  const old = deferred()
  saveSession(session('MANAGER'))
  start()
  respond = () => old.promise
  const pending = dispatchQuery('getManagerQueue')
  assert.equal(calls.length, 1)
  const replacement = session('FINANCE_OFFICER')
  saveSession(replacement)
  assert.equal(calls[0].options.signal.aborted, true)
  old.resolve(new Response(JSON.stringify({ message: 'Expired old session' }), { status: 401 }))
  await pending
  await tick()
  assert.deepEqual(currentSession(), replacement)
  assert.deepEqual(store.getState().tenantApi.queries, {})
})

for (const kind of ['stale-401', 'late-bytes']) {
  test(`shared receipt transport rejects ${kind} without clearing the next login`, async () => {
    saveSession(session('MANAGER'))
    start()
    const old = deferred()
    if (kind === 'stale-401') globalThis.fetch = () => old.promise
    else globalThis.fetch = async () => ({ ok: true, headers: { get: () => 'image/png' }, blob: () => old.promise })
    const pending = requestBlob('/api/v1/tenant/expenses/old/receipt')
    await tick()
    const replacement = session('FINANCE_OFFICER')
    saveSession(replacement)
    old.resolve(kind === 'stale-401' ? new Response(null, { status: 401 }) : new Blob(['private old bytes'], { type: 'image/png' }))
    await assert.rejects(pending)
    assert.deepEqual(currentSession(), replacement)
  })
}

test('real actor transports complete Submitter to Manager to Finance to Compliance and back to Finance', async () => {
  let expense = null
  const workflow = []
  respond = async ({ path, options, session: active }) => {
    if (options.method === 'POST' && path === '/api/v1/tenant/expenses') {
      assert.equal(active.user.role, 'EXPENSE_SUBMITTER')
      assert.ok(options.body instanceof FormData)
      expense = { id: 'EXP-FLOW', amount: options.body.get('amount'), merchant: options.body.get('merchant'), category: 'Travel', workflowStatus: 'manager_review' }
      workflow.push(expense.workflowStatus)
      return expense
    }
    if (path.endsWith('/manager/approve')) {
      assert.equal(active.user.role, 'MANAGER')
      assert.equal(expense.workflowStatus, 'manager_review')
      assert.equal(JSON.parse(options.body).financeOfficerId, 'FINANCE_OFFICER')
      expense = { ...expense, workflowStatus: 'finance_review', managerDecision: 'Approved' }
      workflow.push(expense.workflowStatus); return expense
    }
    if (path.endsWith('/finance/flag')) {
      assert.equal(active.user.role, 'FINANCE_OFFICER')
      assert.equal(expense.workflowStatus, 'finance_review')
      expense = { ...expense, workflowStatus: 'compliance_review', financeDecision: 'Flagged' }
      workflow.push(expense.workflowStatus); return expense
    }
    if (path.endsWith('/compliance/approve')) {
      assert.equal(active.user.role, 'COMPLIANCE_OFFICER')
      assert.equal(expense.workflowStatus, 'compliance_review')
      expense = { ...expense, workflowStatus: 'finance_review', complianceDecision: 'Approved' }
      workflow.push(expense.workflowStatus); return expense
    }
    if (path.endsWith('/mine')) return expense ? [expense] : []
    if (path.endsWith('/manager/queue')) return expense?.workflowStatus === 'manager_review' ? [expense] : []
    if (path.endsWith('/finance/workspace')) return { expenses: expense ? [expense] : [], transactions: [] }
    if (path.endsWith('/compliance/queue')) return expense?.workflowStatus === 'compliance_review' ? [expense] : []
    if (path.endsWith('/categories')) return [{ id: 'travel', name: 'Travel' }]
    if (path.endsWith('/policies')) return []
    if (path.endsWith('/unread-count')) return { count: 0 }
    return { items: [], unreadCount: 0, total: 0, totalPages: 1 }
  }
  saveSession(session('EXPENSE_SUBMITTER')); start()
  await store.dispatch(createExpense({ amount: '12.50', merchant: 'Cross-actor Merchant', categoryId: 'travel', date: '2026-11-25' }, null))
  assert.equal(store.getState().submitter.expenses.items[0].workflowStatus, 'manager_review')
  saveSession(session('MANAGER'))
  const managerQueue = dispatchQuery('getManagerQueue'); await managerQueue.unwrap()
  await dispatchQuery('managerApproveExpense', { id: 'EXP-FLOW', body: { financeOfficerId: 'FINANCE_OFFICER' } }).unwrap()
  saveSession(session('FINANCE_OFFICER'))
  const finance = dispatchQuery('financeWorkspace'); await finance.unwrap()
  await dispatchQuery('financeFlagExpense', { expenseId: 'EXP-FLOW', note: 'Please review' }).unwrap()
  saveSession(session('COMPLIANCE_OFFICER'))
  await store.dispatch(fetchComplianceResource({ resource: 'queue' })).unwrap()
  assert.equal(store.getState().compliance.queue.data[0].id, 'EXP-FLOW')
  await store.dispatch(decideExpense({ expenseId: 'EXP-FLOW', type: 'approve', note: 'Reviewed' }))
  assert.deepEqual(store.getState().compliance.queue.data, [])
  saveSession(session('FINANCE_OFFICER'))
  assert.equal((await dispatchQuery('financeWorkspace').unwrap()).expenses[0].workflowStatus, 'finance_review')
  assert.deepEqual(workflow, ['manager_review', 'finance_review', 'compliance_review', 'finance_review'])
  assert.equal(findNonSerializableValue(store.getState()), false)
  managerQueue.unsubscribe(); finance.unsubscribe()
})


test('documented setupListeners actions update focus/online state and cleanup is idempotent', async () => {
  start()
  window.document = { visibilityState: 'visible' }
  window.dispatchEvent(new Event('blur'))
  assert.equal(store.getState().tenantApi.config.focused, false)
  window.dispatchEvent(new Event('focus'))
  assert.equal(store.getState().tenantApi.config.focused, true)
  window.document.visibilityState = 'hidden'
  window.dispatchEvent(new Event('visibilitychange'))
  assert.equal(store.getState().tenantApi.config.focused, false)
  window.dispatchEvent(new Event('offline'))
  assert.equal(store.getState().tenantApi.config.online, false)
  window.dispatchEvent(new Event('online'))
  assert.equal(store.getState().tenantApi.config.online, true)
  dispose()
  const scope = store.getState().sessionBoundary.scope
  dispose()
  assert.equal(store.getState().sessionBoundary.scope, scope)
  window.dispatchEvent(new Event('blur'))
  window.dispatchEvent(new Event('offline'))
  assert.equal(store.getState().tenantApi.config.focused, true)
  assert.equal(store.getState().tenantApi.config.online, true)
  const source = await readFile(new URL('../src/app/store.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /tenantApi\.internalActions/)
  assert.match(source, /onFocus, onFocusLost, onOnline, onOffline/)
})

for (const field of ['accessToken', 'id', 'organizationId', 'role', 'status']) {
  test(`adapter query rejects an old ${field} identity even if a session event was missed`, async () => {
    saveSession(session('CONFIGURATION_MANAGER'))
    start()
    const old = deferred()
    window.FinStackTenantSession.request = () => old.promise
    const pending = dispatchQuery('employees', { scope: store.getState().sessionBoundary.scope, args: {} })
    const current = currentSession()
    if (field === 'accessToken') sessionStorage.setItem('finstackTenantAccessToken', 'replacement-only')
    else sessionStorage.setItem('finstackTenantUser', JSON.stringify({ ...current.user, [field]: field === 'status' ? 'INACTIVE' : 'changed' }))
    old.resolve({ items: [{ id: 'old-private', role: 'MANAGER', status: 'ACTIVE' }] })
    await assert.rejects(pending.unwrap(), error => error.status === 401)
    assert.equal(JSON.stringify(store.getState()).includes('old-private'), false)
    pending.unsubscribe()
  })
}
