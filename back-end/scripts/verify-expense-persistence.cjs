const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const envFile = require('dotenv').parse(
  fs.readFileSync(path.join(backend, '.env')),
);
const url = new URL(process.env.DATABASE_URL || envFile.DATABASE_URL);
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  url.searchParams.has('options') ||
  url.searchParams.has('search_path')
)
  throw Error('Use a plain PostgreSQL connection URL.');
// Always a fresh schema; retained QA/public schemas cannot be selected by this runner.
const schema =
  'finstack_config_verify_expense_' + crypto.randomUUID().replaceAll('-', '');
url.searchParams.set('schema', schema);
const env = {
  ...envFile,
  ...process.env,
  DATABASE_URL: url.toString(),
  FINSTACK_EXPENSE_E2E: '1',
  FINSTACK_CONFIGURATION_E2E: '1',
  NODE_ENV: 'test',
};
function run(script, args) {
  const result = spawnSync(
    process.execPath,
    [path.join(backend, script), ...args],
    { cwd: backend, env, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Fresh verification schema: ' + schema);
run('node_modules/@nestjs/cli/bin/nest.js', ['build']);
run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
run('node_modules/jest/bin/jest.js', [
  '--config',
  'test/jest-e2e.json',
  '--runInBand',
  'shared-expense-workflow',
  'configuration-persistence',
  'tenant-hierarchy',
  'tenant-audit',
  'tenant-notifications',
]);
console.log(
  'Verified; isolated schema retained for evidence. No existing data reset or db push.',
);
