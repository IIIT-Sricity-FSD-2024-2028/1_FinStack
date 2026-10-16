import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRegistrationEmployeeId } from '../src/features/shared/registrationValidation.js';

test('registration receipt accepts current server-generated organization-linked IDs', () => {
  const organizationId = '4AADA349BB7D483F9CECF0A56F186F23';
  const randomSuffix = '1234567890ABCDEF1234';
  assert.equal(isRegistrationEmployeeId(`FIN-${organizationId}-${randomSuffix}`), true);
  assert.equal(isRegistrationEmployeeId(`A-${organizationId}-${randomSuffix}`), true);
  assert.equal(isRegistrationEmployeeId(`QA1-${organizationId}-${randomSuffix}`), true);
});

test('registration receipt preserves support for legacy IDs', () => {
  assert.equal(isRegistrationEmployeeId('CFG-AB12CD34'), true);
});

test('registration receipt rejects malformed and unrelated IDs', () => {
  const invalid = [
    null,
    undefined,
    '',
    'CFG-1234567',
    'CFG-123456789',
    'FIN-1234',
    'FIN-4AADA349BB7D483F9CECF0A56F186F23-1234567890ABCDE',
    'FIN-4aada349bb7d483f9cecf0a56f186f23-1234567890ABCDEF1234',
    'FIN-4AADA349BB7D483F9CECF0A56F186F23-1234567890ABCDEF1234<script>',
  ];
  for (const id of invalid) assert.equal(isRegistrationEmployeeId(id), false);
});
