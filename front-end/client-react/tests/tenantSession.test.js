import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { tenantSession } from '../src/adapters/tenantSession.js'
import { clientApi, legacyStore } from '../src/adapters/clientApi.js'

const previousWindow = globalThis.window

afterEach(() => {
  globalThis.window = previousWindow
})

test('delegates session, request, and logout to the existing runtime', async () => {
  const calls = []
  const session = { user: { id: 'user-1' }, organizationId: 'org-1' }
  globalThis.window = {
    FinStackTenantSession: {
      isTenantAuthenticated: () => true,
      getTenantSession: () => session,
      request: (path, options) => {
        calls.push({ path, options })
        return Promise.resolve({ success: true })
      },
      clearTenantSession: () => calls.push('logout'),
    },
    FinStackApi: { baseUrl: 'https://api.example.test' },
  }

  assert.equal(tenantSession.isAuthenticated(), true)
  assert.equal(tenantSession.current(), session)
  assert.equal(tenantSession.user(), session.user)
  assert.equal(tenantSession.organizationId(), 'org-1')
  assert.deepEqual(await tenantSession.request('/existing-path', { method: 'GET' }), { success: true })
  tenantSession.logout()
  assert.deepEqual(calls, [{ path: '/existing-path', options: { method: 'GET' } }, 'logout'])
  assert.equal(clientApi.baseUrl(), 'https://api.example.test')
  assert.equal(clientApi.supports('tenantSubscription'), true)
  assert.equal(clientApi.supports('users'), true)
})

test('reports absent runtime without creating a session', async () => {
  globalThis.window = {}
  assert.equal(tenantSession.isAuthenticated(), false)
  assert.equal(tenantSession.current(), null)
  assert.equal(tenantSession.user(), null)
  assert.equal(tenantSession.organizationId(), null)
  await assert.rejects(tenantSession.request('/existing-path'), /unavailable/)
})

test('legacyStore waits for the existing store and reads through its public contract', async () => {
  let ready = false
  globalThis.window = {
    FinStackStore: {
      ready: Promise.resolve().then(() => { ready = true }),
      getAuditLogs: () => ['audit-entry'],
    },
  }

  const logs = await legacyStore.read((store) => {
    assert.equal(ready, true)
    return store.getAuditLogs()
  })

  assert.deepEqual(logs, ['audit-entry'])
})

test('legacyStore rejects when the legacy runtime is unavailable', async () => {
  globalThis.window = {}
  await assert.rejects(() => legacyStore.ready(), /FinStackStore is unavailable/)
})
