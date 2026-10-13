import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../../js/pages/shared/login.js', import.meta.url), 'utf8')
const window = {}
vm.runInNewContext(source, { window, document: { addEventListener() {} } })
const { employeeIdError, passwordError } = window.FinStackLoginValidation

test('login supports existing tenant prefixes and non-EMP identifiers', () => {
  for (const id of ['CFG-1234', 'MGR-2001', 'FIN-2001', 'CMP-2001', 'EMP-1001', 'a', '123', 'alice.smith_01', ' CFG-ABC12345 ']) assert.equal(employeeIdError(id), '')
})
test('login rejects empty, unsupported and malformed employee identifiers', () => {
  assert.equal(employeeIdError('  '), 'Employee ID is required.')
  for (const id of ['EMP@1001', 'EMP 1001', 'EMP/1001', 'é123']) assert.match(employeeIdError(id), /unsupported characters/)
  for (const id of ['-EMP-1', '.123', '_123', 'x'.repeat(81)]) assert.match(employeeIdError(id), /format is invalid/)
})
test('login accepts legacy short passwords without new-password strength rules', () => {
  assert.equal(passwordError(''), 'Password is required.')
  for (const password of ['x', 'Old!7', ' ', 'x'.repeat(200)]) assert.equal(passwordError(password), '')
  assert.match(passwordError('x'.repeat(201)), /at most 200/)
})
