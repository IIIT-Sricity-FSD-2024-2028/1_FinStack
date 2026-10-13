# Team integration handoff readiness

**Audit date:** 2026-10-13
**Repository branch:** `feat/client-react-config-manager`
**HEAD:** `7caf588` (`merge: establish pre-react common base`, also branch `common-base`)
**Purpose:** review the common contracts and integration risks before teams share or commit anything.

## Readiness decision

The current branch is a useful *candidate* for a shared API/React contract review, but it is not a publishable or commit-ready baseline. The worktree is heavily dirty: `git diff --stat` reports 72 tracked files changed (8,299 insertions/5,383 deletions), and `git status --short` has 179 entries, including 107 untracked path entries across backend, Admin, Client actor, test, migration, and documentation work. The checked-in HEAD is the common-base merge commit; the React SPA and most tenant PostgreSQL additions are still worktree changes. Do not distribute a `git diff` from this branch as one team-owned feature.

The actor branch names currently present include `feat/client-react-submitter`, `feat/client-react-manager`, `feat/client-react-finance`, and `feat/client-react-compliance`; they point at an older shared React commit (`35e5ff7`). The current Config Manager branch is at the common-base anchor (`7caf588`). Those older React branches are not evidence that their UI has been ported to the current tenant API, and merging them wholesale risks restoring pre-PostgreSQL contracts or replacing shared SPA files.

## Audit findings

| Area | Finding | Handoff status |
|---|---|---|
| Git/worktree | Current branch is correct; HEAD is `7caf588`. Hundreds of tracked edits plus many untracked files span Admin, tenant backend, legacy client, React, tests, migrations and docs. No single clean feature boundary exists. | **Blocker to baseline commit.** First inventory and assign each path to an owner; review diffs and generated artifacts. |
| Nest/Prisma | A modular Nest monolith contains legacy `src/modules/*`, Platform modules, and newer versioned Tenant modules. PostgreSQL/Prisma tenant models and migration files exist in the worktree. | Candidate backend tenant slices have strong isolated integration evidence; full migration chain still needs a clean local-database deploy review. |
| Latest security migration | `20261013120000_tenant_profile_security` adds `TenantUser.phone`, `location`, `avatarColor`, and `credentialVersion`; it is additive and changes no organization, expense, subscription, invoice, or payment records. | Applied and tested on the isolated recovery schema; before sharing, review generated SQL, Prisma diff and migration order against a fresh local database. |
| Swagger | `back-end/docs/swagger.json` is already user-modified and has a large generated diff (5,338 additions/426 deletions in the current Git diff). Normal non-manual-QA Nest startup regenerates it from the app. It contains both versioned tenant paths and legacy role-header API descriptions; do not treat it as a hand-reviewed, canonical contract. | **Review required.** Preserve the file as-is; compare it with the controllers, decide whether generated documentation belongs in a separate review, and only then consider a deliberate update. |
| React SPA | `front-end/index.html` mounts `#finstack-client-root` and the built client bundle. `ClientApp.jsx` owns BrowserRouter and route registration. The implementation itself is largely untracked/dirty. | Config Manager route set has automated browser evidence. Common shell and API/auth files require designated ownership before actor integration. |
| Authentication | React `AuthContext` calls `/api/v1/tenant/auth/me`; backend reloads the employee, organization, role, status and credential version. The current `ProtectedRoute` only admits `CONFIGURATION_MANAGER`. | Config Manager auth is tested. Other actor React route authorization is **not integrated** into the shared router. |
| Shared styles/components | SPA imports existing `css/base.css`, `components.css`, `layout.css`; `spa.css` scopes additional rules to the React root. Reusable modal, confirmation, notification, table, pagination and data-state primitives exist. | Reuse after API/keyboard/accessibility review; avoid global stylesheet edits by actor PRs. |
| Workflows/tests | Previous recovery verification recorded 14 PostgreSQL e2e suites/168 tests, 55 client tests, client build/typecheck/lint, backend build/typecheck, and browser verification on a disposable schema. Evidence is in ignored local artifacts and the recovery report; not all of it is a checked-in reproducible CI job. | Good evidence for the recovered Config Manager slice. Actor UI parity, clean-clone setup, all migrations on a fresh DB, and per-actor browser workflows still need team verification. |

## What is ready to review and share

- The versioned tenant API conventions documented in [team-backend-api-contracts.md](team-backend-api-contracts.md): bearer JWT, server-derived organization identity, role guards, response envelope and current DTO bounds.
- The Config Manager SPA’s route/auth/API conventions documented in [team-react-integration-guide.md](team-react-integration-guide.md). This is a contract for future integration, not permission for actor branches to replace its files.
- The additive employee profile/session-revocation migration and settings API as a focused security review, alongside its nine settings integration cases.
- The PostgreSQL-backed employee, category/policy, hierarchy, import/activation, audit and notification behavior as implementation candidates backed by the named suites in the API contract document.

These are ready for **review**, not automatic merge. Expense submit/review endpoints exist on the backend, but this branch has not demonstrated completed React integration for Submitter, Manager, Finance or Compliance. Razorpay payment-order/verification endpoints exist behind tenant Configuration Manager auth, but an actual external payment is not part of the local QA proof. Email delivery, support-ticket submission, and browser-side complete actor workflows are not established by this branch.

## Swagger diff assessment

`back-end/src/main.ts` writes `docs/swagger.json` during ordinary (non-manual-QA) app startup. The dirty Swagger file has a multi-thousand-line diff containing route/schema additions and changes. Some versioned tenant paths can be checked against the current source controllers; the file also includes the older Client V1 endpoints that use a `role` header. Since the original uncommitted Swagger edits must be preserved, nobody should regenerate, revert, or replace this file as part of actor work. Review its current diff in isolation against `src/tenant`, `src/platform`, and legacy modules; then agree whether a separate generated-spec update is wanted.

## Evidence and open verification

The Config Manager recovery report is [finstack_spa_regression_recovery_results_2026-10-13.md](finstack_spa_regression_recovery_results_2026-10-13.md). It records the route matrix, screenshots, 168 backend integration tests, 55 client tests, zero Playwright page errors, four viewport widths, and unchanged row fingerprints for 28 public tables. The generated acceptance report, environment fixture, full screenshot matrix, and exact database test target are under ignored `back-end/.tmp/spa-recovery/`; they are local evidence, not shareable credentials or CI configuration.

Before choosing a distributable baseline, still verify:

1. Every uncommitted path has an owner and a review boundary; Admin-only edits must receive Admin-owner review even though this handoff does not edit them.
2. The whole ordered migration chain deploys on a new, isolated local database with no `public`/manual-QA database URL.
3. One clean checkout can generate Prisma Client, build both apps, run tests, and start them from sanitized environment configuration.
4. Each actor supplies its exact role screens, API requests, response expectations and a real browser test using server-issued JWTs.
5. A separate review resolves which backend API family each actor uses; do not mix `/api/v1/tenant/*` JWT APIs with legacy role-header routes.
6. `swagger.json` changes are compared and approved separately while preserving the current dirty file.

## Concise teammate checklist

- Read this readiness audit and the API and React guides before porting a screen.
- Keep actor work in that actor’s feature folder/branch; retain the Config Manager files and tests.
- Integrate through a named API adapter and server-issued bearer session; send neither a client-selected tenant nor a role header to versioned endpoints.
- Agree shared Router/AuthContext/shell changes with the common-front-end owner before editing those files.
- Use only a fresh local PostgreSQL database or a disposable per-developer schema; never use the existing `public` or shared QA data for mutations.
- Add tests for route authorization, tenant isolation, DTO rejection, persistence/audit, and refresh/re-login; include one actual browser workflow.
- Open a focused PR with the paths owned, tests run, API contract changes, migration notes and screenshots; do not commit or merge this dirty working tree.

## Proposed next steps

1. Assign a maintainer for common `AuthContext`, `ClientApp`, shared shell, API transport, tokens, and global CSS.
2. Have each actor owner review the exact tenant API routes in `team-backend-api-contracts.md` and mark a screen-to-endpoint mapping before implementation.
3. Split the current dirty candidate by ownership without resetting or stashing it; make a fresh worktree from an agreed clean parent for any new baseline work.
4. Land/review additive backend contracts and migration first, then the shared React/auth integration layer, then actor feature adapters/pages one at a time.
5. Run the full e2e suite on a fresh isolated PostgreSQL database and per-actor browser suites before proposing any common baseline revision.
6. Review the Swagger diff independently; decide how to preserve and reconcile its existing user edits before generating new docs.

No commit, push, merge, reset, rebase, stash, clean, database operation, or actor source edit was performed for this handoff.
