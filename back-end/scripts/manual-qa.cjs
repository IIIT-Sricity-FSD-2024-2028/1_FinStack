const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const http = require('node:http');
const crypto = require('node:crypto');
const backend = path.resolve(__dirname, '..');
const root = path.resolve(backend, '..');
const folder = path.join(backend, '.tmp', 'manual-qa');
const statePath = path.join(folder, 'environment.json');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { isClientSpaPath } = require('../../front-end/client-routing.cjs');
const { manualQaSettings, verifyManualQaDatabase } = require('../dist/src/common/config/manual-qa');
const ordinary = dotenv.parse(fs.readFileSync(path.join(backend, '.env')));
function config() {
  if (!fs.existsSync(statePath)) throw Error('Run init first. No ordinary database fallback is permitted.');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const temp = path.join(folder, 'temp');
  fs.mkdirSync(temp, { recursive: true });
  const env = { ...ordinary, ...state.env, VITE_API_BASE_URL: '/api/v1/platform', TEMP: temp, TMP: temp };
  manualQaSettings(env);
  if (state.schema !== new URL(env.DATABASE_URL).searchParams.get('schema')) throw Error('QA state schema mismatch.');
  return { state, env };
}
async function verify(env) {
  Object.assign(process.env, env);
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try { await verifyManualQaDatabase(db); } finally { await db.$disconnect(); }
}
function command(cwd, args, env) {
  const result = cp.spawnSync(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw Error('QA command failed; no reset or deletion attempted.');
}
async function init() {
  fs.mkdirSync(folder, { recursive: true });
  if (!fs.existsSync(statePath)) {
    const url = new URL(ordinary.DATABASE_URL || '');
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['public', null].includes(url.searchParams.get('schema')) || url.searchParams.has('options') || url.searchParams.has('search_path')) throw Error('Init requires the ordinary local .env database with public schema; nothing was changed.');
    const probe = new PrismaClient({ datasourceUrl: url.toString() });
    try {
      const [row] = await probe.$queryRaw`SELECT host(inet_server_addr()) AS address`;
      if (!['127.0.0.1', '::1'].includes(row.address)) throw Error('PostgreSQL must report a loopback server address.');
    } finally { await probe.$disconnect(); }
    const schema = 'finstack_manual_qa_' + crypto.randomUUID().replaceAll('-', '');
    url.searchParams.set('schema', schema);
    const state = { schema, reviewer: { email: 'qa-reviewer@finstack-local.test', password: crypto.randomBytes(24).toString('base64url') + '!Q7' }, env: {
      DATABASE_URL: url.toString(), FINSTACK_MANUAL_QA: '1', FINSTACK_MANUAL_QA_BIND_HOST: '127.0.0.1', NODE_ENV: 'development', PORT: '3401',
      CORS_ORIGINS: 'http://127.0.0.1:5581,http://127.0.0.1:5174', VITE_API_PROXY_TARGET: 'http://127.0.0.1:3401',
      TENANT_JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'), TENANT_JWT_ISSUER: 'finstack-manual-qa', TENANT_JWT_AUDIENCE: 'finstack-manual-qa-client',
      PLATFORM_JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'), PLATFORM_JWT_ISSUER: 'finstack-manual-qa', PLATFORM_JWT_AUDIENCE: 'finstack-manual-qa-admin', PLATFORM_REFRESH_COOKIE_NAME: 'finstack_manual_qa_refresh',
      LOG_DIRECTORY: path.join(folder, 'logs'), UPLOAD_DIRECTORY: path.join(folder, 'uploads')
    } };
    manualQaSettings(state.env);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), { flag: 'wx', mode: 0o600 });
  }
  const { state, env } = config();
  command(backend, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
  await verify(env);
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    const argon2 = require('argon2');
    await db.$transaction(async tx => {
      const role = await tx.platformRole.upsert({ where: { key: 'manual-qa-reviewer' }, create: { key: 'manual-qa-reviewer', name: 'Local QA organization reviewer' }, update: {} });
      for (const key of ['platform.organization.create','platform.organization.view','platform.organization.update','platform.organization.reactivate']) {
        const permission = await tx.permission.upsert({ where: { key }, create: { key, description: key }, update: {} });
        await tx.platformRolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
      }
      await tx.platformStaff.upsert({ where: { email: state.reviewer.email }, create: { email: state.reviewer.email, firstName: 'Local QA', lastName: 'Reviewer', passwordHash: await argon2.hash(state.reviewer.password), roles: { create: { roleId: role.id } } }, update: {} });
      await tx.plan.upsert({ where: { key: 'manual-qa-plan' }, create: { key: 'manual-qa-plan', name: 'Local QA plan (fictional)', billingInterval: 'MONTHLY', basePrice: 0, currency: 'INR', includedEmployeeCount: 100 }, update: {} });
    });
  } finally { await db.$disconnect(); }
  console.log('Manual QA ready: ' + state.schema + '. Existing QA data preserved. Run credentials to view the isolated reviewer login.');
}
(async () => {
  process.chdir(backend);
  const action = process.argv[2];
  if (action === 'init') return await init();
  const { state, env } = config();
  await verify(env);
  if (action === 'credentials') { console.log('Local QA credentials are stored in the ignored manual-QA state file; use the local login flow.'); return; }
  if (action === 'status') { console.log(JSON.stringify({ schema: state.schema, backend: 'http://127.0.0.1:3401', client: 'http://127.0.0.1:5581/index.html', admin: 'http://127.0.0.1:5174/login', verified: true }, null, 2)); return; }
  if (action === 'backend') {
    // A restarted QA server must use current validators, not a previous build.
    command(backend, ['node_modules/@nestjs/cli/bin/nest.js', 'build'], env);
    require('../dist/src/main');
    return;
  }
  if (action === 'admin') {
    const directory = path.join(root, 'front-end/admin');
    const entry = path.join(directory, 'node_modules/vite/bin/vite.js');
    process.chdir(directory);
    process.argv = [process.execPath, entry, '--host', '127.0.0.1', '--port', '5174', '--strictPort'];
    await import(require('node:url').pathToFileURL(entry).href);
    return;
  }
  if (action === 'client') {
    const frontend = path.join(root, 'front-end');
    const server = http.createServer((req, res) => {
      try {
        if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
        const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1:5581').pathname);
        // History fallback is restricted to this client SPA. Other actors and Admin stay static.
        // Keep history fallback behavior aligned with Vite without rewriting API/assets.
        const spaPath = isClientSpaPath(pathname);
        const file = path.resolve(frontend, '.' + (spaPath ? '/index.html' : pathname));
        if (!file.startsWith(frontend + path.sep) || path.relative(frontend, file).split(path.sep).some(part => part.startsWith('.') || part === 'node_modules' || part === 'admin')) { res.writeHead(403).end(); return; }
        let content = fs.readFileSync(file);
        if (file.endsWith('.html')) content = Buffer.from(content.toString('utf8').replace('<head>', '<head><script>window.FINSTACK_API_BASE_URL="http://127.0.0.1:3401";</script>'));
        res.writeHead(200, { 'Content-Type': { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png' }[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch { res.writeHead(404).end(); }
    });
    server.listen(5581, '127.0.0.1', () => console.log('Local QA client: http://127.0.0.1:5581/index.html'));
    return;
  }
  throw Error('Use init, status, credentials, backend, client or admin.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
