import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { complianceApi } from '../src/features/compliance/complianceApi.js'

const originalWindow = globalThis.window, originalFetch = globalThis.fetch
afterEach(() => { globalThis.window = originalWindow; globalThis.fetch = originalFetch })
function setup() {
  let session = { accessToken: 'fictional-a', organizationId: 'org-a', user: { id: 'officer-a', role: 'COMPLIANCE_OFFICER' } }
  let logouts = 0
  globalThis.window = { FinStackApi: { baseUrl: 'http://fixture.invalid' }, FinStackTenantSession: {
    getTenantSession: () => session, clearTenantSession: () => { logouts++ },
  } }
  return { switchSession: () => { session = { ...session, accessToken: 'fictional-b' } }, logouts: () => logouts }
}

test('audit CSV downloads forward cancellation and every supported filter without changing Blob content type', async () => {
  setup()
  const controller = new AbortController(), csv = new Blob(['event,outcome\nqa,SUCCESS\n'], { type: 'text/csv' })
  let captured
  globalThis.fetch = async (url, options) => {
    captured = { url: new URL(url), options }
    return { ok: true, blob: async () => csv }
  }
  const result = await complianceApi.exportAuditLogs({ search: 'a & b', eventCode: 'compliance_approved', targetType: 'expense', outcome: 'SUCCESS', from: '2026-10-01', to: '2026-10-31' }, controller.signal)
  assert.equal(result, csv)
  assert.equal(result.type, 'text/csv')
  assert.equal(captured.options.signal, controller.signal)
  assert.equal(captured.options.headers.Authorization, 'Bearer fictional-a')
  assert.deepEqual(Object.fromEntries(captured.url.searchParams), { search: 'a & b', eventCode: 'compliance_approved', targetType: 'expense', outcome: 'SUCCESS', from: '2026-10-01', to: '2026-10-31' })
})

for (const kind of ['receipt', 'export']) {
  test(`${kind} rejects bytes completed after a session replacement`, async () => {
    const f = setup()
    let release
    globalThis.fetch = async () => ({ ok: true, headers: { get: () => 'image/png' },
      blob: () => new Promise((resolve) => { release = resolve }) })
    const request = kind === 'receipt' ? complianceApi.downloadReceipt('EXP-QA') : complianceApi.exportAuditLogs()
    await new Promise((resolve) => setImmediate(resolve))
    f.switchSession(); release(new Blob(['private old-session bytes']))
    await assert.rejects(request, /session changed/)
    assert.equal(f.logouts(), 0)
  })
  test(`${kind} does not clear a replacement session on an obsolete 401`, async () => {
    const f = setup()
    let release
    globalThis.fetch = () => new Promise((resolve) => { release = resolve })
    const request = kind === 'receipt' ? complianceApi.downloadReceipt('EXP-QA') : complianceApi.exportAuditLogs()
    f.switchSession(); release({ ok: false, status: 401 })
    await assert.rejects(request, /session changed/)
    assert.equal(f.logouts(), 0)
  })
}

test('receipt requests forward the local AbortSignal without storing browser objects in Redux', async () => {
  setup()
  const controller = new AbortController()
  let signal
  globalThis.fetch = async (_url, options) => {
    signal = options.signal
    return { ok: true, headers: { get: () => 'image/png' }, blob: async () => new Blob(['receipt'], { type: 'image/png' }) }
  }
  const result = await complianceApi.downloadReceipt('EXP-QA', controller.signal)
  assert.equal(signal, controller.signal)
  assert.equal(result.contentType, 'image/png')
})
