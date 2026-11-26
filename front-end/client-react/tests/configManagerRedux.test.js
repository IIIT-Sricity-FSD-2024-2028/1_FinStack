import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { findNonSerializableValue } from '@reduxjs/toolkit'
import { createTenantStore, installReduxRuntime } from '../src/app/store.js'
import { tenantApi } from '../src/app/api.js'
import { selectSessionScope, sessionChanged, sessionReducer } from '../src/app/sessionSlice.js'
import { configManagerApi as api } from '../src/features/config-manager/configManagerApi.js'
import { createConfigCommands } from '../src/features/config-manager/useConfigResource.js'
import { announceLiveRefresh, LIVE_REFRESH_EVENT } from '../src/hooks/liveRefreshController.js'

let store, dispose, session, calls, respond
const page = items => ({ items, total: items.length, page: 1, pageSize: 25, totalPages: 1 })
beforeEach(() => {
  calls = []
  session = { organizationId: 'org-a', user: { id: 'user-a' }, accessToken: 'private-token' }
  respond = async () => ({ ok: true })
  globalThis.window = new EventTarget()
  window.FinStackTenantSession = {
    getTenantSession: () => session,
    request: async (path, options = {}) => {
      calls.push({ path, ...options })
      return respond(path, options)
    },
  }
  store = createTenantStore()
  dispose = installReduxRuntime(window, store)
})
afterEach(() => { dispose(); store.dispatch(tenantApi.util.resetApiState()) })
const initiate = (name, args, options) => store.dispatch(api.endpoints[name].initiate(
  { scope: selectSessionScope(store.getState()), args }, options))
const commands = () => createConfigCommands(store.dispatch, selectSessionScope(store.getState()))
const settle = () => new Promise(resolve => setImmediate(resolve))
async function until(predicate) {
  for (let i = 0; i < 40; i++) { if (predicate()) return; await settle() }
  assert.ok(predicate(), 'Expected cache/refetch condition was not reached')
}

test('session reducer is pure, serializable, and its selector is narrow', () => {
  const previous = { scope: 4 }
  const next = sessionReducer(previous, sessionChanged())
  assert.deepEqual(previous, { scope: 4 })
  assert.equal(selectSessionScope({ sessionBoundary: next }), 5)
  assert.equal(findNonSerializableValue(next), false)
})

test('employee queries deduplicate, preserve filters/pagination and normalize roles/status', async () => {
  let finish
  respond = () => new Promise(resolve => { finish = resolve })
  const args = { page: 2, pageSize: 10, search: 'Alex & Co', status: 'ACTIVE', role: 'MANAGER', department: '' }
  const first = initiate('employees', args), second = initiate('employees', { ...args })
  assert.equal(calls.length, 1)
  const url = new URL(calls[0].path, 'http://fixture')
  assert.equal(url.searchParams.get('search'), 'Alex & Co')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.has('department'), false)
  finish(page([{ id: 'e1', role: 'MANAGER', status: 'ACTIVE', manager: { employeeId: 'M1' } }]))
  const [a, b] = await Promise.all([first.unwrap(), second.unwrap()])
  assert.deepEqual(a, b)
  assert.deepEqual(a.items[0].roles, ['manager'])
  assert.equal(a.items[0].status, 'Active')
  assert.equal(a.items[0].managerEmployeeId, 'M1')
  first.unsubscribe(); second.unsubscribe()
})

test('employee mutations preserve contracts and invalidate employees, hierarchy, roles and audit', async () => {
  respond = async path => path.includes('/employees?') ? page([]) : { employeeId: 'EMP-NEW' }
  const query = initiate('employees', { page: 1 })
  await query.unwrap()
  const result = await commands().users.create({ firstName: 'A', lastName: 'B', password: 'temporary', role: 'manager', managerId: 'm1' })
  assert.equal(result.employeeId, 'EMP-NEW')
  const write = calls.find(call => call.method === 'POST')
  assert.equal(write.body.initialPassword, 'temporary')
  assert.equal(write.body.role, 'MANAGER')
  assert.equal(write.body.managerId, 'm1')
  await until(() => calls.filter(call => call.path.includes('/employees?')).length === 2)
  await commands().users.update('id/1', { role: 'manager', firstName: 'New' })
  assert.ok(calls.some(call => call.path.endsWith('/users/id%2F1') && call.method === 'PATCH'))
  await commands().users.updateStatus('e1', 'Inactive')
  assert.deepEqual(calls.find(call => call.path.endsWith('/e1/status')).body, { status: 'INACTIVE' })
  await commands().hierarchy.updateManager('e1', 'm2', 'm1')
  assert.deepEqual(calls.find(call => call.path.endsWith('/e1/reporting')).body, { managerId: 'm2', expectedManagerId: 'm1' })
  assert.equal(findNonSerializableValue(store.getState()), false)
  assert.deepEqual(store.getState().tenantApi.mutations, {})
  query.unsubscribe()
})

test('categories, policies and templates refetch affected caches using existing payload conversions', async () => {
  respond = async () => []
  const categories = initiate('categories'), policies = initiate('policies'), templates = initiate('templates')
  await Promise.all([categories.unwrap(), policies.unwrap(), templates.unwrap()])
  await commands().categories.update('cat/1', { name: 'Meals' }, { limit: 120, requiresReceipt: false })
  const update = calls.find(call => call.method === 'PATCH')
  assert.equal(update.body.limit, 120)
  assert.equal(update.body.requiresReceipt, false)
  assert.ok(update.path.endsWith('/categories/cat%2F1'))
  await until(() => calls.filter(call => call.path.endsWith('/categories') && !call.method).length === 2)
  await commands().policies.create({ name: 'Travel', categoryId: 'c1', maxAmount: 45 })
  assert.equal(calls.find(call => call.method === 'POST').body.maxAmount, '45')
  const selection = { version: 'v1', keys: ['travel'] }
  await commands().templates.activateCategories(selection)
  assert.deepEqual(calls.find(call => call.path.endsWith('/activate-templates')).body, selection)
  assert.ok(calls.filter(call => call.path.endsWith('/templates')).length >= 2)
  categories.unsubscribe(); policies.unsubscribe(); templates.unsubscribe()
})

test('errors stay serializable and event handlers receive Error instances with backend codes', async () => {
  respond = async () => { throw Object.assign(new Error('Manager changed'), { status: 409, code: 'REPORTING_CONFLICT' }) }
  const query = initiate('hierarchy', {})
  await assert.rejects(query.unwrap(), { message: 'Manager changed', status: 409 })
  await assert.rejects(commands().hierarchy.updateManager('e1', 'm1', null), error =>
    error instanceof Error && error.code === 'REPORTING_CONFLICT')
  assert.equal(findNonSerializableValue(store.getState()), false)
  query.unsubscribe()
})

test('late search responses remain in their own argument cache', async () => {
  let finishOld
  respond = path => path.includes('search=old') ? new Promise(resolve => { finishOld = resolve }) : page([{ id: 'new', status: 'ACTIVE' }])
  const old = initiate('employees', { search: 'old' })
  const current = initiate('employees', { search: 'new' })
  await current.unwrap()
  finishOld(page([{ id: 'old', status: 'ACTIVE' }]))
  await old.unwrap()
  assert.equal(api.endpoints.employees.select({ scope: 0, args: { search: 'new' } })(store.getState()).data.items[0].id, 'new')
  old.unsubscribe(); current.unsubscribe()
})

test('logout resets caches, aborts work and rejects old commands after another tenant signs in', async () => {
  let finishOld
  respond = () => new Promise(resolve => { finishOld = resolve })
  const old = initiate('employees', { page: 1 })
  const oldCommands = commands()
  session = null
  window.dispatchEvent(new Event('finstack:session'))
  assert.deepEqual(store.getState().tenantApi.queries, {})
  assert.equal(selectSessionScope(store.getState()), 1)
  session = { accessToken: 'replacement-token', organizationId: 'org-b', user: { id: 'user-b' } }
  respond = async () => page([{ id: 'org-b-employee', status: 'ACTIVE' }])
  await assert.rejects(oldCommands.users.create({ firstName: 'stale' }), /Sign in again/)
  const fresh = initiate('employees', { page: 1 })
  assert.equal((await fresh.unwrap()).items[0].id, 'org-b-employee')
  finishOld(page([{ id: 'private-org-a-employee', status: 'ACTIVE' }]))
  await old
  await settle()
  assert.equal(JSON.stringify(store.getState()).includes('private-org-a'), false)
  assert.equal(JSON.stringify(store.getState()).includes('private-token'), false)
  fresh.unsubscribe(); old.unsubscribe()
})

test('identity changes with the same organization also clear cached data', async () => {
  respond = async () => []
  await initiate('roles').unwrap()
  session = { organizationId: 'org-a', user: { id: 'different-user' } }
  window.dispatchEvent(new Event('finstack:session'))
  assert.deepEqual(store.getState().tenantApi.queries, {})
})

test('local writes use mutation tags once; cross-tab changes are not lost during pending mutations', async () => {
  let finish
  respond = async (path, options) => {
    if (options.method) {
      announceLiveRefresh()
      await new Promise(resolve => { finish = resolve })
      return {}
    }
    return page([])
  }
  const query = initiate('employees', {})
  await query.unwrap()
  const mutation = commands().users.updateStatus('e1', 'Inactive')
  await settle()
  assert.equal(calls.filter(call => !call.method).length, 1)
  window.dispatchEvent(new Event(LIVE_REFRESH_EVENT))
  finish()
  await mutation
  await until(() => calls.filter(call => !call.method).length === 2)
  await settle()
  assert.equal(calls.filter(call => !call.method).length, 2)
  dispose()
  window.dispatchEvent(new Event(LIVE_REFRESH_EVENT))
  await settle()
  assert.equal(calls.filter(call => !call.method).length, 2)
  query.unsubscribe()
})

test('notifications, audit and import queries retain route contracts', async () => {
  respond = async () => ({ items: [] })
  for (const [name, args] of [['notifications', { page: 2, pageSize: 25, state: 'unread' }],
    ['audit', { page: 1, eventCode: 'USER_UPDATED', search: 'a&b' }],
    ['auditDetail', 'audit/1'], ['importJob', 'job-1'], ['importRows', { id: 'job-1', page: 3 }]]) {
    const query = initiate(name, args); await query.unwrap(); query.unsubscribe()
  }
  await commands().mutate('updateNotifications', { path: '/read-all', method: 'POST' })
  assert.ok(calls.some(call => call.path.includes('/notifications/page?page=2&pageSize=25&state=unread')))
  assert.ok(calls.some(call => call.path.includes('search=a%26b')))
  assert.ok(calls.some(call => call.path.endsWith('/audit-logs/audit%2F1')))
  assert.ok(calls.some(call => call.path.endsWith('/job-1/rows?page=3')))
  assert.ok(calls.some(call => call.path.endsWith('/notifications/read-all') && call.method === 'POST'))
})

test('role, manager, settings and preference endpoints preserve normalization and exact writes', async () => {
  respond = async path => path.endsWith('/roles') ? { items: [{ key: 'CONFIGURATION_MANAGER', name: 'Administrator', capabilities: ['manage'], userCount: 2 }] }
    : path.includes('/employees?') ? page([]) : { name: 'Org', theme: 'light' }
  const roles = initiate('roles')
  assert.deepEqual((await roles.unwrap())[0], { id: 'configuration_manager', name: 'Administrator', description: undefined, permissions: ['manage'], userCount: 2, enabled: true, required: true })
  const managers = initiate('managers', { search: 'Pat', page: 2 })
  await managers.unwrap()
  const managerUrl = new URL(calls.find(call => call.path.includes('/employees?')).path, 'http://fixture')
  assert.equal(managerUrl.searchParams.get('role'), 'MANAGER')
  assert.equal(managerUrl.searchParams.get('status'), 'ACTIVE')
  assert.equal(managerUrl.searchParams.get('pageSize'), '20')
  for (const name of ['organization', 'profile', 'preferences']) {
    const operation = initiate(name); await operation.unwrap(); operation.unsubscribe()
  }
  const settings = { companySize: '10-50', fiscalYearStart: 'APRIL', defaultPaymentMethod: 'BANK_TRANSFER' }
  await commands().mutate('updateOrganization', settings)
  await commands().mutate('updateProfile', { fullName: 'Pat New', location: 'Remote' })
  await commands().mutate('updatePreferences', { theme: 'light', pageSize: 50 })
  await commands().mutate('changePassword', { currentPassword: 'before', newPassword: 'after', confirmPassword: 'after' })
  await commands().mutate('revokeSessions')
  assert.deepEqual(calls.find(call => call.path.endsWith('/settings/organization') && call.method).body, settings)
  assert.deepEqual(calls.find(call => call.path.endsWith('/settings/profile') && call.method).body, { fullName: 'Pat New', location: 'Remote' })
  assert.equal(calls.find(call => call.path.endsWith('/password-changes')).method, 'POST')
  assert.equal(calls.find(call => call.path.endsWith('/session-revocations')).method, 'POST')
  assert.equal(findNonSerializableValue(store.getState()), false)
  roles.unsubscribe(); managers.unsubscribe()
})

test('import upload keeps File objects out of state; confirmation invalidates employee and import caches', async () => {
  const previousFetch = globalThis.fetch
  let upload
  window.FinStackApi = { baseUrl: 'http://fixture' }
  globalThis.fetch = async (url, options) => {
    upload = { url, options }
    return new Response(JSON.stringify({ data: { id: 'job-1', status: 'READY' } }), { headers: { 'Content-Type': 'application/json' } })
  }
  respond = async path => path.includes('/employees?') ? page([]) : path.endsWith('/confirm') ? { id: 'job-1', status: 'QUEUED' } : []
  const employees = initiate('employees', {}), jobs = initiate('imports')
  await Promise.all([employees.unwrap(), jobs.unwrap()])
  try {
    const file = new File(['firstName,lastName\nA,B'], 'employees.csv', { type: 'text/csv' })
    const result = await commands().mutate('uploadImport', { file, key: 'unique-upload-key' })
    assert.equal(result.id, 'job-1')
    assert.equal(upload.options.headers['idempotency-key'], 'unique-upload-key')
    assert.equal(upload.options.headers.Authorization, 'Bearer private-token')
    assert.ok(upload.options.body instanceof FormData)
    assert.equal(findNonSerializableValue(store.getState()), false)
    await commands().mutate('confirmImport', 'job-1')
    await until(() => calls.filter(call => call.path.includes('/employees?')).length === 2)
    assert.ok(calls.some(call => call.path.endsWith('/job-1/confirm') && call.method === 'POST'))
  } finally { globalThis.fetch = previousFetch; employees.unsubscribe(); jobs.unsubscribe() }
})

test('failed mutations do not invalidate successful data; a later cross-tab event refetches it', async () => {
  respond = async (_path, options) => { if (options.method) throw new Error('Rejected'); return [] }
  const categories = initiate('categories')
  await categories.unwrap()
  await assert.rejects(commands().categories.delete('category-1'), /Rejected/)
  await settle()
  assert.equal(calls.filter(call => !call.method).length, 1)
  window.dispatchEvent(new Event(LIVE_REFRESH_EVENT))
  await until(() => calls.filter(call => !call.method).length === 2)
  categories.unsubscribe()
})
