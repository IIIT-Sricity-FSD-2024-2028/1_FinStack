import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { submitTransactionAction, transactionErrorMessage } from '../src/features/finance/paymentWorkflow.js'

const originalWindow = globalThis.window
afterEach(() => { globalThis.window = originalWindow })

test('transaction requests preserve server responses and never claim settlement', async () => {
  const calls = []
  const record = { id: 'TX-QA', status: 'reconciled' }
  globalThis.window = { FinStackTenantSession: { request: async (path, options) => {
    calls.push({ path, options })
    return record
  } } }
  for (const action of ['process', 'fail', 'reconcile']) {
    const result = await submitTransactionAction(action, record.id)
    assert.equal(result.transaction, record)
    assert.match(result.message, /request recorded/i)
    assert.doesNotMatch(result.message, /marked paid|payment completed|settled successfully/i)
  }
  assert.deepEqual(calls.map(call => call.path), ['process', 'fail', 'reconcile'].map(action => `/api/v1/tenant/expenses/finance/transactions/TX-QA/${action}`))
  assert(calls.every(call => call.options.method === 'POST' && call.options.body === undefined))
})

test('409 bank-evidence rejection is preserved and explained without success', async () => {
  const error = Object.assign(new Error('Evidence required'), { status: 409, code: 'TENANT_BANK_EVIDENCE_REQUIRED' })
  globalThis.window = { FinStackTenantSession: { request: async () => { throw error } } }
  for (const action of ['process', 'reconcile']) {
    await assert.rejects(submitTransactionAction(action, 'TX-QA'), caught => caught === error)
  }
  assert.match(transactionErrorMessage(error), /Bank evidence is required/)
  assert.match(transactionErrorMessage(error), /has not been confirmed/)
  assert.equal(transactionErrorMessage(Object.assign(new Error('State changed'), { status: 409, code: 'OTHER_CONFLICT' })), 'State changed')
  assert.match(transactionErrorMessage(null), /Operation failed/)
})

test('unsupported transaction actions do not send requests', async () => {
  globalThis.window = { FinStackTenantSession: { request: async () => { assert.fail('Unexpected request') } } }
  await assert.rejects(submitTransactionAction('complete-payment', 'TX-QA'), /Unsupported/)
})
