import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/features/config-manager/BulkEmployeeImport.jsx', import.meta.url),
  'utf8',
);

test('bulk import uses the shared custom confirmation instead of a browser popup', () => {
  assert.match(source, /import \{ ConfirmDialog \} from "\.\.\/\.\.\/components\/CrudPrimitives"/);
  assert.match(source, /<ConfirmDialog\s/);
  assert.doesNotMatch(source, /window\.(?:confirm|alert|prompt)\s*\(/);
  assert.match(source, /onClick=\{\(\) => setActivationJobId\(job\.id\)\}/);
});

test('activation links are requested only after confirmation; duplicate and pending clicks are blocked', () => {
  assert.match(source, /open=\{Boolean\(activationJobId\)\}/);
  assert.match(source, /onCancel=\{\(\) => setActivationJobId\(null\)\}/);
  assert.match(source, /onConfirm=\{\(\) => \{/);
  assert.match(source, /if \(!activationJobId \|\| lock\.current\) return/);
  assert.match(source, /employeeImports\.activationLinks\(activationJobId\)/);
  assert.match(source, /submitting=\{busy\}/);
  assert.match(source, /Downloading again replaces any outstanding links/);
});
