import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatExpenseAmount, formatCurrencyTotals, activePolicies, profileField, managerProfileField } from '../src/features/shared/expensePresentation.js'
import { validatePaymentBatch, selectAllPayments, togglePaymentSelection } from '../src/features/finance/paymentBatch.js'
import { financeApi } from '../src/features/finance/financeApi.js'

test('same-currency totals preserve decimal cents', () => {
  assert.equal(formatCurrencyTotals([{ currency: 'INR', amount: '0.10' }, { currency: 'INR', amount: '0.20' }]), 'INR 0.30')
})
test('mixed-currency totals stay separate with explicit codes', () => {
  assert.equal(formatCurrencyTotals([{ currency: 'INR', amount: 10 }, { currency: 'USD', amount: '12.50' }, { currency: 'INR', amount: 20 }, { currency: 'EUR', amount: 2 }]), 'EUR 2.00 · INR 30.00 · USD 12.50')
})
test('individual values use actual currency and authoritative exact amount', () => {
  assert.equal(formatExpenseAmount({ currency: 'USD', amount: 999, amountExact: '12.50' }), 'USD 12.50')
  assert.equal(formatExpenseAmount({ currency: 'EUR', amount: 0 }), 'EUR 0.00')
  assert.equal(formatCurrencyTotals([]), 'No amounts')
})
test('missing currency and invalid amounts are not invented', () => {
  assert.equal(formatExpenseAmount({ amount: '4.25' }), 'Currency unavailable 4.25')
  assert.equal(formatExpenseAmount({ currency: 'INR' }), 'INR: amount unavailable')
  assert.equal(formatCurrencyTotals([{ currency: 'USD', amount: 'bad' }, { currency: 'USD', amount: 10 }]), 'USD: amount unavailable')
})
test('100 IDs are accepted; selection and transport reject 101 without truncation', async () => {
  const ids = Array.from({ length: 100 }, (_, i) => String(i))
  assert.doesNotThrow(() => validatePaymentBatch(ids))
  const selected = selectAllPayments(new Set(), ids)
  assert.equal(selected.size, 100)
  assert.throws(() => togglePaymentSelection(selected, 'extra'), /at most 100/)
  assert.equal(selected.size, 100)
  assert.equal(togglePaymentSelection(selected, '0').size, 99)
  assert.throws(() => selectAllPayments(new Set(['kept']), [...ids, 'extra']), /at most 100/)
  await assert.rejects(financeApi.releasePayment([...ids, 'extra']), /at most 100/)
  assert.equal(selectAllPayments(selected, ids).size, 0)
})
test('API sends exactly 100 selected IDs unchanged', async () => {
  const ids = Array.from({ length: 100 }, (_, i) => `claim-${i}`)
  let calls = 0
  globalThis.window = { FinStackTenantSession: { request: async (path, options) => {
    calls++
    assert.equal(path, '/api/v1/tenant/expenses/finance/payment-releases')
    assert.equal(options.method, 'POST')
    assert.deepEqual(options.body, { expenseIds: ids })
    return { batchId: 'test-batch' }
  } } }
  try { await financeApi.releasePayment(ids); assert.equal(calls, 1) }
  finally { delete globalThis.window }
})
test('only explicitly active policies are presented as active', () => {
  const active = { id: 'active', status: 'Active' }
  assert.deepEqual(activePolicies([active, { status: 'Inactive' }, { status: undefined }]), [active])
  assert.deepEqual(activePolicies(null), [])
})
test('missing profile fields are unavailable, not unassigned or fabricated', () => {
  assert.equal(profileField(undefined), 'Unavailable in current profile')
  assert.equal(profileField('  '), 'Unavailable in current profile')
  assert.equal(managerProfileField(undefined), 'Unavailable in current profile')
  assert.equal(managerProfileField({ firstName: 'Alex', employeeId: 'M1' }), 'Alex (M1)')
  assert.equal(profileField('Operations'), 'Operations')
})
test('Compliance audit describes restricted expense history', () => {
  const source = readFileSync(new URL('../src/features/compliance/ComplianceAuditView.jsx', import.meta.url), 'utf8')
  assert.match(source, /Authorized expense-workflow and payment-request audit history/)
  assert.doesNotMatch(source, /all organizational actions/)
})
