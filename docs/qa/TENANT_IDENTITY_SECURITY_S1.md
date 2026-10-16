# Tenant identity security: Phase S1

Baseline: `77eeb7c6a1035ee289b961c0ff39dca955aa2885` from published `feat/full-workflow-integration`.
Task branch: `feat/tenant-identity-security`.
Implementation lives in the separate `1_FinStack_security` worktree. The running integration worktree, runtime environment, original worktree and databases are outside this task's mutation scope.

## Findings and audit scope

This is a source audit with mocked regression tests, not a penetration test or a database integration certification. No database connection, migration, data backfill, account provisioning or live-server change was performed.

| Area and source | Observed security boundary | S1 outcome |
| --- | --- | --- |
| `back-end/prisma/schema.prisma`: Organization, TenantUser | `employeeId` already has global `@unique`; user and organization UUIDs are authoritative. Expense references are tenant-qualified. The reporting manager foreign key itself uses manager UUID only; same-tenant reporting is enforced by application validation, not a composite manager foreign key. | Schema and migrations unchanged. Two organizations cannot persist the same login ID under this schema. |
| `tenant/auth/tenant-auth.service.ts`, `tenant-token.service.ts`, guards | Login uses global `findUnique(employeeId)`, Argon2 verification and a generic credential error. JWT subject is user UUID and orgId is stored tenant UUID; authentication re-reads the user, tenant, status, setup flag, credential version and role. Suspended/unapproved tenants are denied. | No signing/session change. Legacy and generated IDs follow the same path. |
| `tenant/configuration/tenant-configuration.controller.ts` and DTO/service | Tenant authentication and method-level CM guards protect provisioning. Organization comes from authenticated request context. Global ID conflict and tenant-local email conflict return 409. Update DTO does not permit ID replacement. | Omitted creation ID now invokes generation; explicit valid legacy IDs remain supported. No role widening. |
| `tenant/configuration/tenant-hierarchy.service.ts`, configuration service | Employee lookup/update, hierarchy reads and manager lookup use tenant + UUID. Reporting writers lock the organization; cycle/status checks remain. | Existing behavior preserved. Manual assignment currently permits any active, setup-complete same-tenant user, while ManagerPicker and bulk import restrict to MANAGER. This preexisting role-consistency issue is documented for separate contract review; it is not evidence of cross-tenant access. |
| `tenant/configuration/employee-import.service.ts`, `employee-import-validation.ts`, import controller | Header/password/organization validation; global employeeId checks, tenant-local email checks, same-tenant active MANAGER lookup. Confirming CM and tenant availability rechecked by worker. Stable row user UUIDs distinguish success from skipDuplicates conflicts. Job access is tenant-scoped. | Legacy seven-column contract and Submitter-only role restriction unchanged. Generated bulk mode deferred below. |
| `tenant/configuration/employee-activation.service.ts` and controller | Completed tenant-scoped import required for issuance. Only same-tenant inactive/setup-required users selected. Random token is hashed in storage; expiry and atomic one-time redemption enforced. Globally unique employeeId plus token hash identifies redemption user. Organization approval/status is checked. No-store CM export intentionally contains activation tokens. | No activation contract change. New mock tests cover hashed storage, failed/foreign jobs, invalid tokens, suspension and redemption races without printing tokens. |
| `tenant/onboarding/tenant-onboarding.service.ts`, `registration-identity.ts` | Server-owned tenant creation, domain/legal-identity duplicate checks and advisory lock; pending review state. Previously used a short random CFG prefix. Registration response already exposes the issued login ID. | Bootstrap CM now uses the shared generator and a server-allocated tenant UUID. Whole registration transaction is retried only for generated-ID collisions. No external payment or email side effects added. |
| `tenant/expenses/tenant-expenses.service.ts`, `persistent-expenses.repository.ts` | Tenant-qualified repository reads; immutable UUID + tenant workflow context for writes. Submitter ownership, manager assignment/direct reports, officer role and assignment checks. Employee display/notification lookups tenant-qualified. | Production expense workflow untouched. Existing mocked cross-tenant expense/receipt tests rerun. |
| `tenant/expenses/tenant-expenses.service.ts`: getReceipt | Expense must belong to authenticated tenant before role/ownership/assignment checks; Receipt query uses tenant + expense; storage name comes from DB. | Receipt authorization/storage unchanged. |
| `tenant/notifications/tenant-notifications.service.ts` | Reads/counts/writes scoped by organization + immutable recipient user UUID. Employee-ID resolution is tenant-qualified. Composite recipient foreign key is tenant-aware. | Added tests exercise page/count/read/dismiss and foreign employee resolution. Production source unchanged. |
| Login forms, `tenant/auth/dto/tenant-login.dto.ts`, `features/shared/PublicPages.tsx` | Existing valid ID alphabet and maximum 80 characters accept generated IDs; existing registration success screen displays returned ID. | Shared frontend and login forms unchanged. |
| `app.module.ts`, `common/guards/roles.guard.ts`, `modules/users/*` and related legacy modules | Legacy in-memory endpoints are still registered. Their guard trusts a caller-supplied role header; legacy user lookup can match employeeId without tenant qualification. Tenant JWT routes use separate guards and persisted users. | Confirmed source-level weak authorization on the legacy demo API, not a demonstrated breach of persisted TenantUser/expense records. Restrict or retire legacy endpoints before exposing a deployment to untrusted clients; separate review required because this changes a published contract. No such change is bundled here. |

No duplicate-ID tenant breach was established. Global uniqueness and token-to-stored-tenant checks were already present. A live security assessment and actual PostgreSQL constraint/concurrency verification remain outstanding.

## Generated ID algorithm

Format: `<HINT>-<ORG-CODE>-<RANDOM>`.

- HINT: up to three ASCII letters/digits from the normalized organization name; fallback `ORG`. It is display-only and never selects or authorizes a tenant.
- ORG-CODE: the complete stored organization UUID with hyphens removed, uppercase (32 hex characters). Stable across renames and distinct even for identical organization names. No new schema column is needed.
- RANDOM: 10 cryptographically random bytes from Node crypto, uppercase hex (80 random bits, 20 characters). No sequence, counter or user-controlled suffix.
- Maximum length: 57 characters, within existing VARCHAR(80), DTO and login validators.
- The ID is a public login identifier, not a password or authorization claim; it reveals the tenant UUID association. UUIDs must never be treated as secrets.
- Existing global database uniqueness is the final arbiter. Up to five attempts are allowed only for a Prisma P2002 targeting the global TenantUser employeeId unique constraint. Email, organization identity, unrelated constraints and infrastructure errors are not retried. Exhaustion returns a safe 409.
- Every retry opens a new complete transaction. No queries are retried inside an aborted PostgreSQL transaction. Registration retries retain the server-allocated organization UUID and preserve transactional organization/subscription/audit behavior.

## Backward compatibility and individual provisioning

No existing account, employee ID, user UUID, tenant UUID, reporting link, expense, receipt, audit record or JWT contract is rewritten.

CM POST `/api/v1/tenant/configuration/users` accepts the existing DTO with `employeeId` now optional. When omitted, the service reads the authenticated organization record and generates the ID. Explicit valid legacy IDs remain honored for published API clients; duplicates still return conflict, never silent replacement. Explicit null/empty/malformed IDs remain invalid. Unknown `organizationId` input is rejected by existing global whitelist validation.

The specific Manage Users page no longer asks the CM to invent an ID. It preserves roles, names/email, department, initial password and manager selection. After success it displays the returned ID in a persistent status panel as well as the existing toast. Editing shows an immutable read-only ID. The existing request adapter omits undefined ID values during JSON serialization and requires no shared-source changes. Passwords are neither displayed in the result nor logged to audit.

Bootstrap registration uses the same generator. Organization identity checks, pending-review denial, trial/subscription behavior, initial password hashing and registration response shape remain intact. Existing legacy CFG and other prefixes continue to authenticate.

## Bulk import: retained contract and deferred transition

No automatic bulk-ID implementation is claimed. The published seven-column template remains:
`employeeId,firstName,lastName,email,department,role,managerEmployeeId`.
Explicit source IDs remain required, persisted and visible in import history and activation export. Existing optional-column rules and the EXPENSE_SUBMITTER-only restriction remain intact.

The current row employeeId is simultaneously the source CSV reference, created login ID, duplicate-check key and exported activation reference. Silently substituting generated values would lose that meaning; createMany(skipDuplicates) also cannot distinguish an ID collision from an email conflict for retry. This ambiguous mapping is the deferred portion permitted by S1.

Proposed additive implementation, requiring separate review:

1. Keep current upload behavior as default legacy mode with no template or historical-row changes.
2. Add an explicit generated-ID upload mode (versioned endpoint or validated job option). Preserve every supplied employeeId as sourceEmployeeId in a versioned row payload, not silently discard it. Allocate and persist generated login ID alongside the already preallocated user UUID during preflight, stable across preview/confirm/retry.
3. Keep managerEmployeeId referencing an existing same-tenant active MANAGER's actual FinStack login ID. Do not guess aliases or resolve a manager from another row. Submitter-only imports cannot introduce managers.
4. Expose both sourceEmployeeId and generated FinStack login ID in preview, history, errors and activation export, retaining old output defaults for legacy jobs. Show duplicate-source errors separately from tenant email conflicts.
5. For generated mode, replace blind skipDuplicates retry with explicit conflict classification, bounded fresh transactions/savepoints and durable per-row ID mapping. Preserve atomic progress, lease recovery, idempotency and the row user UUID. Do not regenerate an ID after an account succeeded.
6. Add mocked and isolated-database tests for collisions, duplicate email races, crash/retry, mixed success, manager deactivation, legacy exports and one-time activation. JSON payload versioning may permit an additive implementation without a Prisma migration; validate that design before deciding. No schema migration is assumed or authorized by this plan.

## Test coverage and limits

Tests use mocked Prisma clients and, for HTTP boundaries, real Nest guards/controller/DTO validation with mocked authentication and persistence. All 16 requested categories are covered by new or existing source-level tests; none represents a database integration test.

| Requested category | Relevant tests |
| --- | --- |
| Different tenant UUIDs, identical name hint, generated uniqueness | tenant-login-id.spec.ts; tenant-auth.service.spec.ts |
| Explicit legacy duplicate ID | tenant-user-provisioning.spec.ts; tenant-user-provisioning.controller.spec.ts |
| Concurrent generation and bounded collision retry | tenant-login-id.spec.ts; tenant-user-provisioning.spec.ts; tenant-onboarding.service.spec.ts |
| Existing logins, authoritative UUID/tenant, suspension | tenant-auth.service.spec.ts; tenant-token.service.spec.ts; tenant-authentication.guard.spec.ts |
| Cross-tenant employee denial, provisioning permissions and tenant override rejection | tenant-user-provisioning.spec.ts; tenant-user-provisioning.controller.spec.ts; existing configuration controller/service tests |
| Cross-tenant expense and receipt denial | existing tenant-expenses.service.spec.ts |
| Notification isolation | tenant-notifications.service.spec.ts |
| Manager assignment and individual creation | tenant-user-provisioning.spec.ts; employeeForm.test.js |
| Legacy import validation, role restriction and activation | existing employee-import-validation.spec.ts; employee-activation.service.spec.ts |
| Credential/token non-disclosure | provisioning, registration, activation and auth tests; audit allowlists inspected |

Final source validation:

- Backend: 379 unit tests passed, 37 suites; zero failures/skips. This includes 46 additional cases over the 333-test baseline.
- React: 120 Node tests passed; zero failures/skips, including two added provisioning tests.
- Backend typecheck and Nest build passed. Prisma client generation was local code generation using an inert URL, not migration or database access.
- All 12 changed backend TypeScript files passed lint. React source lint, typecheck and production build passed.
- The existing backend repository lint script still fails with 34 errors and 18 warnings in untouched files; none of its target files changed in S1.
- An initial new notification test fixture used the wrong workspace type; corrected before the final passing suite. An initial mis-scoped lint command scanned generated dist artifacts and failed; the corrected explicit changed-file check passes, with no rule suppression.

PostgreSQL-backed race/rollback/foreign-key tests and visual browser QA for the changed form are not run in S1. The full UUID format is deliberately longer than the old short IDs; copying and responsive display should be checked in isolated live verification.

## Isolated verification sequence after review

Use an explicitly disposable database and separate ports, not the retained QA environment. Verify existing legacy login first, then two same-name organizations, registration review denial, generated individual account creation, same-tenant Manager assignment, login UUID/org claims, role/tenant denial, legacy CSV preview/confirmation/activation and expense/receipt/notification ownership. Exercise forced ID conflicts versus email conflicts in independent transactions. Check that history and preexisting IDs remain unchanged. Database access and live test accounts require separate approval.

No Prisma migration, backfill, shared design-system change or actor-workflow implementation is included.

## Changed-file inventory

```text
back-end/src/tenant/auth/tenant-auth.service.spec.ts
back-end/src/tenant/configuration/dto/create-tenant-user.dto.ts
back-end/src/tenant/configuration/dto/tenant-user-validation.spec.ts
back-end/src/tenant/configuration/employee-activation.service.spec.ts
back-end/src/tenant/configuration/tenant-configuration.service.ts
back-end/src/tenant/configuration/tenant-user-provisioning.controller.spec.ts
back-end/src/tenant/configuration/tenant-user-provisioning.spec.ts
back-end/src/tenant/identity/tenant-login-id.spec.ts
back-end/src/tenant/identity/tenant-login-id.ts
back-end/src/tenant/notifications/tenant-notifications.service.spec.ts
back-end/src/tenant/onboarding/tenant-onboarding.service.spec.ts
back-end/src/tenant/onboarding/tenant-onboarding.service.ts
docs/qa/TENANT_IDENTITY_SECURITY_S1.md
front-end/client-react/src/features/config-manager/ConfigManagerManageUsers.jsx
front-end/client-react/src/features/config-manager/employeeForm.js
front-end/client-react/tests/employeeForm.test.js
```
