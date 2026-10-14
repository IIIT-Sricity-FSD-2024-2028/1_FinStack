import test from 'node:test'
import assert from 'node:assert/strict'
import { demoAiForExpense, riskLabel } from '../src/features/submitter/aiDemo.js'

test('demo AI results are stable per expense and stay within display ranges', () => {
  const expense = { id: 'expense-123', merchant: 'Local Travel', amount: '125.00', date: '2026-10-14' }
  const first = demoAiForExpense(expense)
  const second = demoAiForExpense(expense)

  assert.deepEqual(first, second)
  assert.ok(first.confidence >= 72 && first.confidence <= 99)
  assert.ok(first.riskScore >= 0 && first.riskScore <= 100)
  assert.equal(first.riskLevel, riskLabel(first.riskScore))
})
