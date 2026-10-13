# Local Windows setup for FinStack actor development

Use a developer-owned PostgreSQL instance and fictional test data. Never point local tests at the shared QA or production database. Keep `.env`, logs, dumps, credentials, generated activation URLs, and private employee data out of Git/chat/docs.

## Prerequisites

- Windows PowerShell 7 or Windows PowerShell.
- Node.js LTS compatible with this checkout, npm, Git, and PostgreSQL tools/server (`psql`, `createdb`). Check `node --version`, `npm --version`, and `psql --version`; use the version pinned by the team if CI provides one.
- Access to the repo root `C:\Users\nikhi\Downloads\FFSD\1_FinStack`.

## Create a private local database

Open PowerShell and create an isolated developer database using the local PostgreSQL account configured on that laptop. Example; substitute only local names/credentials:

```powershell
createdb finstack_dev
psql -d finstack_dev -c 'SELECT current_database();'
```

If local PostgreSQL requires a dedicated role, create one for this database using local administration tools. Do not reuse any shared QA credentials or dump. Put the local connection only in ignored `back-end/.env`.

## Install and configure

```powershell
$repo = 'C:\Users\nikhi\Downloads\FFSD\1_FinStack'
Set-Location "$repo\back-end"
npm ci
Copy-Item .env.example .env
```

Edit `.env` locally. Minimum safe local values are shown below; `replace_me` and both secret placeholders must be replaced locally with distinct random values. `DATABASE_URL` targets the developer-owned `finstack_dev` DB. These are examples, not credentials:

```dotenv
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://127.0.0.1:5582,http://localhost:5582
DATABASE_URL=postgresql://local_user:replace_me@localhost:5432/finstack_dev?schema=public
PLATFORM_JWT_ACCESS_SECRET=replace-with-a-random-local-secret-at-least-32-characters
TENANT_JWT_ACCESS_SECRET=replace-with-a-different-random-local-secret-at-least-32-characters
PLATFORM_JWT_ISSUER=finstack-api
PLATFORM_JWT_AUDIENCE=finstack-admin
TENANT_JWT_ISSUER=finstack-api
TENANT_JWT_AUDIENCE=finstack-client
```

The tracked `back-end/.env.example` includes safe placeholders for optional logs, throttling, uploads, platform bootstrap and Razorpay settings. Leave unused provider/bootstrap values empty. Do not copy the existing machine `.env`.

## Apply migrations and generate Prisma Client

Only after checking that `DATABASE_URL` names your local `finstack_dev` database:

```powershell
Set-Location "$repo\back-end"
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` applies all checked-in migrations to the selected database; do not execute it with the manual QA/shared/production URL. The latest profile security migration is `20261013120000_tenant_profile_security`. If your work needs seed records, use the established test fixtures or a developer-local isolated schema with fictional records; never import a shared dump.

## Start a local isolated QA API and React client

The ordinary Nest `start:dev` path regenerates `back-end/docs/swagger.json` on startup. This branch has an important user-modified Swagger diff, so **do not start that mode from this dirty worktree until the Swagger change is separately reviewed/preserved**. For interactive development against your own isolated local QA schema, use the manual-QA launcher described in `manual-local-qa.md`; it uses a generated per-laptop schema and disables the normal Swagger write.

In PowerShell, after configuring `back-end/.env` to your own local PostgreSQL database (not shared QA/production), run:

```powershell
Set-Location "$repo\back-end"
node scripts/manual-qa.cjs init
node scripts/manual-qa.cjs status
```

Build the client bundle and start services in separate PowerShell windows:

```powershell
Set-Location "$repo\back-end"
node scripts/manual-qa.cjs backend
```

```powershell
Set-Location "$repo\front-end\client-react"
npm ci
npm run build
Set-Location "$repo\back-end"
node scripts/manual-qa.cjs client
```

Open `http://127.0.0.1:5581/`. Stop each server with Ctrl+C when done. The manual-QA script binds loopback and uses the generated schema in its local ignored state. Do not expose its ports publicly. The React Vite development server is also available for UI-only work, but its `/api` proxy points at port 3000 by default; configure it only for a local backend. Do not start the ordinary backend from this dirty tree until the Swagger diff is reviewed.

## Create authenticated role test users safely

The versioned API accepts Employee ID and password only; role and tenant scope are derived from PostgreSQL-backed auth. For interactive local testing, create fictional employees from the Configuration Manager workflow/API and use the single-use activation flow for imported users. Assign one of the existing tenant roles only through the authorized Configuration Manager UI/API, then log in separately as that employee and verify `/api/v1/tenant/auth/me` reports the server role/workspace. Never manually edit JWT claims or send a `role`/`organizationId` header. Backend guards still decide access.

For registration/review testing use the opt-in isolated local manual-QA harness described in `manual-local-qa.md`; it creates a dedicated QA schema and local reviewer credentials on that laptop. Print/read credentials only in that local terminal as instructed there; do not paste or save them in this handoff. The harness is local-only and does not provide real email/domain verification.

## Verification commands

```powershell
Set-Location "$repo\back-end"
npm run build
npm run typecheck
npm test -- --runInBand
npm run test:e2e
```

```powershell
Set-Location "$repo\front-end\client-react"
npm test
npm run typecheck
npm run lint
npm run build
```

The backend e2e suite uses PostgreSQL; confirm test database variables in the local test harness before running it. Run against a newly created, disposable local DB/schema. Never invoke a destructive reset command against an unverified database URL. Capture test names/results, not tokens or personal data.
