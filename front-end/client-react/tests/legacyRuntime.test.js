import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'

const apiSource = await readFile(new URL('../../js/api.js', import.meta.url), 'utf8')
const authSource = await readFile(new URL('../../js/auth.js', import.meta.url), 'utf8')

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }
}

const login = {
  accessToken: 'signed-tenant-token', organizationId: 'org-1',
  user: { id: 'user-1', organizationId: 'org-1', employeeId: 'CFG-1', firstName: 'Config', lastName: 'User', email: 'config@example.test', role: 'CONFIGURATION_MANAGER', status: 'ACTIVE' },
}

function authRuntime(response) {
  const replacements = []
  const calls = []
  const sessionStorage = storage()
  const localStorage = storage()
  const window = { location: { pathname: '/login.html', replace: (value) => replacements.push(value) }, FinStackApi: { baseUrl: 'https://api.example.test' } }
  const context = vm.createContext({
    window, sessionStorage, localStorage,
    document: { querySelectorAll: () => [], dispatchEvent: () => {} },
    CustomEvent: function CustomEvent() {},
    fetch: (url, options) => { calls.push({ url, options }); return Promise.resolve(response || { ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ success: true, data: login })) }) },
    console, Promise, Error, JSON, Array, encodeURIComponent,
  })
  vm.runInContext(authSource, context)
  return { window, sessionStorage, localStorage, replacements, calls }
}

test('legacy API resolves configured base URL and preserves compatibility role headers', async () => {
  const calls = []
  const window = { FINSTACK_API_BASE_URL: 'https://client.example.test/' }
  const context = vm.createContext({
    window, document: { querySelector: () => null },
    sessionStorage: storage({ finstackUserSession: JSON.stringify({ role: 'configuration_manager' }) }), localStorage: storage(),
    fetch: (url, options) => { calls.push({ url, options }); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ success: true, data: { id: 1 } })) }) },
    Promise, Error,
  })
  vm.runInContext(apiSource, context)
  assert.equal(window.FinStackApi.baseUrl, 'https://client.example.test')
  assert.equal((await window.FinStackApi.request('/users')).id, 1)
  assert.equal(calls[0].options.headers.role, 'superuser')
})

test('legacy API normalizes HTTP failures', async () => {
  const window = { location: { pathname: '/login.html' } }
  const context = vm.createContext({
    window, document: { querySelector: () => null }, sessionStorage: storage(), localStorage: storage(),
    fetch: () => Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve(JSON.stringify({ success: false, message: 'Forbidden', requestId: 'req-1' })) }), Promise, Error,
  })
  vm.runInContext(apiSource, context)
  await assert.rejects(window.FinStackApi.request('/users'), (error) => error.name === 'FinStackApiError' && error.status === 403 && error.requestId === 'req-1')
})

test('tenant runtime accepts only a valid server-issued active tenant session', () => {
  const runtime = authRuntime()
  const current = runtime.window.FinStackTenantSession.setTenantSession(login)
  assert.equal(current.accessToken, 'signed-tenant-token')
  assert.equal(current.user.role, 'CONFIGURATION_MANAGER')
  assert.equal(runtime.window.FinStackGuard.getCurrentSession().role, 'configuration_manager')
  assert.throws(() => runtime.window.FinStackTenantSession.setTenantSession({ ...login, organizationId: 'org-2' }), /valid active tenant session/)
})

test('tenant requests send bearer identity without role or organization headers', async () => {
  const runtime = authRuntime()
  runtime.window.FinStackTenantSession.setTenantSession(login)
  assert.equal((await runtime.window.FinStackTenantSession.request('/api/v1/tenant/auth/me')).user.id, 'user-1')
  assert.equal(runtime.calls[0].options.headers.Authorization, 'Bearer signed-tenant-token')
  assert.equal('role' in runtime.calls[0].options.headers, false)
  assert.equal('organizationId' in runtime.calls[0].options.headers, false)
})

test('tenant 401 clears the session while tenant 403 preserves it', async () => {
  const unauthorized = authRuntime({ ok: false, status: 401, text: () => Promise.resolve(JSON.stringify({ message: 'Expired' })) })
  unauthorized.window.FinStackTenantSession.setTenantSession(login)
  unauthorized.window.location.pathname = '/views/config-manager/dashboard.html'
  await assert.rejects(unauthorized.window.FinStackTenantSession.request('/api/v1/tenant/auth/me'), (error) => error.code === 'TENANT_SESSION_EXPIRED')
  assert.equal(unauthorized.sessionStorage.getItem('finstackTenantAccessToken'), null)
  assert.equal(unauthorized.localStorage.getItem('currentUser'), null)

  const forbidden = authRuntime({ ok: false, status: 403, text: () => Promise.resolve(JSON.stringify({ message: 'Forbidden' })) })
  forbidden.window.FinStackTenantSession.setTenantSession(login)
  await assert.rejects(forbidden.window.FinStackTenantSession.request('/api/v1/tenant/expenses'), (error) => error.code === 'TENANT_ACCESS_FORBIDDEN')
  assert.equal(forbidden.sessionStorage.getItem('finstackTenantAccessToken'), 'signed-tenant-token')
})

test('tenant logout clears token, authoritative user, and compatibility session', () => {
  const runtime = authRuntime()
  runtime.window.FinStackTenantSession.setTenantSession(login)
  runtime.window.FinStackTenantSession.clearTenantSession()
  assert.equal(runtime.sessionStorage.getItem('finstackTenantAccessToken'), null)
  assert.equal(runtime.sessionStorage.getItem('finstackTenantUser'), null)
  assert.equal(runtime.sessionStorage.getItem('finstackUserSession'), null)
  assert.equal(runtime.localStorage.getItem('currentUser'), null)
})
