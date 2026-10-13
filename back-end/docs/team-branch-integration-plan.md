# Team branch integration plan

No Git operation is performed by this plan. The current worktree remains dirty and must not be committed, pushed, merged, reset, cleaned, stashed or rebased as a single change.

## Candidate base and baseline review

Current HEAD `7caf588` (`merge: establish pre-react common base`) is a useful common code-history anchor and the `common-base` branch points to it. It is **not** the proposed distributable React/API baseline by itself: the current branch contains large uncommitted backend, schema, migration, Admin, Config Manager, legacy client, tests and docs changes (72 modified tracked paths and 107 untracked status entries at audit). Older actor branches are on older React work and need contract adaptation.

**Proposed baseline revision:** create a new reviewed, named common integration revision only after the ownership-split PR sequence below. Do not advertise `7caf588` as containing the checked-out dirty API/React implementation. Before any baseline commit, reviewers must:

- map each `git status --short` path to its actor/shared owner; separate Admin-only work from tenant/common work and preserve all uncommitted originals;
- review all Prisma schema and migration files in order on a fresh local database; include `20261013120000_tenant_profile_security` only after database/security review;
- review tenant endpoint DTOs, role/tenant enforcement, audit behavior and migration-to-frontend adapter compatibility;
- review `back-end/docs/swagger.json` separately. It is a preexisting user-modified file and ordinary Nest startup regenerates it. Preserve both the current diff and any recovered owner copy; do not silently accept or revert regenerated paths;
- require clean build, typecheck, lint, backend unit/e2e, client tests/build, an isolated browser test, and no production/shared-QA mutations;
- record exact included/excluded paths and owner approvals in the proposed baseline PR.

## Branch ownership and pull-request order

1. **Common API/migration review:** backend owner prepares a narrowly scoped, additive tenant API/schema PR. Keep platform Admin contracts separate. Review security, DTO validation, tenant scoping, lifecycle/audit semantics, compatibility, migration and Swagger diff.
2. **Common React boundary review:** shared SPA maintainer reviews `ClientApp`, `AuthContext`, role-route abstraction, session/API transport, generic shell decision, common component exports, route fallback and CSS scope. Current code only protects CM; add actor gates without weakening that route.
3. **Config Manager:** existing Config Manager owner retains `features/config-manager/**`, recovery tests and UI/API adjustments. Review it as an owner slice; actor PRs must not overwrite it.
4. **Actor slices:** create one PR per Submitter, Manager, Finance, Compliance. Rebase only in the actor's separate clean worktree after agreement; port existing UI structures to current API adapters. Each PR contains its owned feature files, one route integration request, actor tests and evidence.
5. **Integration verification:** after API and shared-route PRs land, run all migrations and all actor flows on a fresh disposable PostgreSQL schema; verify authorization denial and tenant isolation as well as successful flows.
6. **Baseline release proposal:** only after the stacked PRs are approved and worktree is clean, designate their resulting merge/base commit as the reviewed common baseline. Publishing/committing remains an explicit team/user action.

## Shared-file ownership rules

- `ClientApp.jsx`, `AuthContext.tsx`, `services/session.ts`, route guards, package/build entry and root bundle wiring: shared SPA owner. Actor teams propose changes by focused PR; do not independently replace these files.
- `ConfigurationManagerLayout.tsx`, `workspacePages`, `features/config-manager/**`: Configuration Manager owner. Generalize only with CM approval and regression tests proving all current CM paths survive.
- `components/**`, `styles/legacy.css`, design tokens and any global `css/*.css`: shared UI/CSS owner with every affected actor reviewer. Actor CSS stays root-scoped.
- `back-end/src/tenant/**`, tenant role enums, global validation/auth, Prisma schema and migration order: backend owner plus actor consumers. API shapes are contracts; coordinate changes before clients update.
- `back-end/src/platform/**`, `front-end/admin/**`, and legacy modules: their designated Admin/legacy owners. Keep out of actor React PRs unless explicitly reviewed.
- `back-end/docs/swagger.json`: generated artifact with a user-edited starting diff; separate approval and preserve its source history.

## API change coordination

Every breaking/additive API change should include: route and auth role, DTO fields/bounds, success/error shape, status/lifecycle behavior, tenant isolation, audit/notification side effects, migration/backfill notes, and tests. Backend PR links its contract update. Consuming actor owners acknowledge it before merge. If the code contract differs from Swagger, settle the discrepancy in the API PR; do not let each React branch infer its own version.

Avoid conflicts by restricting each actor PR to its feature folder and adapter plus one agreed Router registration change. Put shared Router, AuthContext, shell and global CSS edits in a separate common PR where possible. Do not cherry-pick broad old React commits over current worktree or use a merge to resolve unclear ownership.

## Required integration checks

- Fresh isolated PostgreSQL database: ordered `prisma migrate deploy`, Prisma generation/validation, no use of QA/public records.
- Backend: full unit and e2e suites; unauthenticated and wrong-role denial; foreign-tenant ID denial; lifecycle validation; audit/notification writes and restart persistence.
- Client: tests, lint, typecheck and production build for client and Admin independently when their files change.
- Browser per actor: login as correct role, deep link/refresh, route/shell, success/empty/error, create/review/reject/release as appropriate, persisted state after reload/re-login, unauthorized route/API denial, responsive layout and no console errors.
- Shared nav/auth: CM regression suite plus each actor route; verify 401 clears auth while 403 preserves it; no role headers or client tenant IDs.
- Review data: no live gateway/bank operation, no shared QA cancellation, no test fixture/activation token or personal data in artifacts.

## Ready-to-use handoff checklist

- [ ] Confirm actor owner and touched paths before branch work.
- [ ] Map each existing React screen to a current versioned API route and DTO.
- [ ] Agree route-guard/shell registration with shared SPA owner.
- [ ] Keep component/CSS work inside actor ownership unless separately approved.
- [ ] Add backend/browser authorization and persistence coverage.
- [ ] Use only private local DB/disposable schema and fictional data.
- [ ] Attach test commands/results and screens to a focused PR.
- [ ] Review migration and generated Swagger diff without erasing prior user work.
- [ ] Wait for all owners' reviews before designating a common baseline.

## Remaining blockers

The 335-file tracked diff plus numerous untracked files has not been split or owner-approved. Current `ProtectedRoute` is CM-specific. Fresh-machine migration/setup and complete actor browser workflows remain unverified. The generated Swagger diff's original user edits must be reviewed/preserved. Actor owners still need to identify which older components can be reused without carrying old JSON API semantics. Therefore no baseline revision is yet approved for distribution.
