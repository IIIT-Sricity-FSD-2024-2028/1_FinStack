# Manual QA fixes and corrected Employee ID design

Updated 2026-11-27 in `FinStack_Manual_QA_Fixes_20261126`, branch `fix/manual-qa-status-and-employee-codes`, based on published integration `b5e15f4b688846b7e0fd9d7ec12dd36ccf842198`. No commits or publication are authorized. This document supersedes the abandoned six-digit login-code design.

## Expense dashboard fix retained

The original fictional INR 400 expense returns `status: approved` and `workflowStatus: payment_processing` from the real API. The old dashboard omitted payment_processing from approved states and counted it as pending. `workflowSummary.js` now treats submitted, Manager review, Finance review, Compliance review and returned as pending; approved_for_payment, payment_processing and paid count as approved. Processing and confirmed paid are reported separately. Partial Manager/Compliance approval does not imply Finance clearance. No bank success or settlement is fabricated. Draft, rejected and unknown states do not become approvals.

The dashboard, My Expenses, Track Status and notifications are exercised across actor mutations, reload and tab focus. The one root Redux store, one Provider, shared RTK Query API and existing session/tenant guards remain unchanged.

## One canonical Employee ID

The backend allocates and returns one public `employeeId`, for example FIC-1029. Password login and every actor's header/profile use that same value. There is no public six-digit login field or separate legacy label. The frontend session transport no longer reformats identities; tenant response serialization happens on the server. Internal authenticated service contexts retain historical keys for authorization.

Organization.employeePrefix is persisted, globally unique and immutable. Initial assignment uses the first three ASCII letters of the organization name (ORG fallback for very short/non-Latin names), then a numeric suffix if that prefix is reserved. A global transaction advisory lock and EmployeePrefixReservation primary key serialize assignment. The name is only an initial candidate: the stored reservation is the authority. Identical names receive distinct prefixes; renaming never changes an assigned prefix. Prefix reservations survive organization deletion.

Organization.nextEmployeeNumber starts at 1001. A PostgreSQL UPDATE with row locking atomically consumes the next number in that organization. IDs use PREFIX-NNNN; occupied legacy/canonical aliases are skipped. Numbers never move backward and inactive or deleted employees do not release identities. The supported range is 1001-9999 (8,999 allocations per prefix, less any skipped reserved numbers). Exhaustion returns HTTP 409 with EMPLOYEE_ID_RANGE_EXHAUSTED; there is no wraparound, five-digit extension or silent reassignment. An exhausted organization requires a separately approved identifier-policy decision.

All successful account creation paths, including onboarding, Configuration Manager and CSV imports, run through the same database trigger. A private insertion marker used by automatic provisioning is replaced with the canonical ID before INSERT. New automatic accounts store their canonical ID in the existing primary employeeId column too. Explicit historical/import identifiers are retained only as hidden aliases; they never choose the canonical ID.

## Existing-user mapping, integrity and reversal

The additive `20261126160000_canonical_employee_ids` migration does not rewrite any existing TenantUser.employeeId, UUID, password hash, managerId, organizationId, Expense.employeeId/managerEmployeeId, receipt, payment or historical audit record. Existing relationship contracts continue to use their immutable keys. canonicalEmployeeId is an additional backend-managed identifier, not a second user-facing identity.

The migration orders organizations by createdAt/id to assign prefixes, then users by organizationId/createdAt/id to allocate numbers deterministically from the same snapshot. EmployeeIdentityMapping records the user UUID, organization UUID, unchanged previousEmployeeId, canonicalEmployeeId, operation (backfill/provision), migration version and assignment time. A private local mapping export contains the exact existing-user rows; it must never be published or pasted into chat. Tenant audit history remains intact; the separate allocation ledger is append-only and audited by migration/version/time.

Canonical IDs have a database unique index. EmployeeLoginAlias has one global primary key shared by both canonical IDs and legacy aliases, preventing cross-column ambiguity even during concurrent provisioning in different tenants. Identity/mapping/reservation triggers reject updates and deletion of allocation history. Existing long aliases authenticate the same stored UUID and organization through normal password verification, without trusting client role or organization. Tokens, rate limits, activation expiry/single-use checks and password validation remain enforced.

Rollback is non-destructive: stop the corrected app and deploy the previous application against the retained additive schema. Existing primary identity keys were never changed, so no inverse FK migration is needed. New automatic users also have a usable primary employeeId. Keep all mapping/reservation tables and columns; do not reset counters, delete ledger rows, or drop aliases. Re-enabling the corrected app restores the same canonical IDs. The unpublished six-digit prototype was never applied to the original QA database; its disposable sandbox was retained separately and was not upgraded in place.

## Public API and display contracts

Only tenant controllers that expose employee DTOs use TenantEmployeeIdentityInterceptor. It converts canonical identity metadata into the public employeeId/managerEmployeeId fields and removes that metadata. Global/platform response serialization and internal actor identity are unchanged. Expense creation, lists, details, mutations, Manager queue/history, Finance transaction lists/payment-release responses, Configuration Manager users, reporting hierarchy, profiles, CSV success rows and activation links carry the same canonical IDs. No relationship authorization is performed using a cosmetic display conversion.

CSV rows keep submitted identifiers internally for provenance and legacy activation compatibility; successfully created rows expose the allocated canonical ID. Invalid/uncreated rows retain the submitted source identifier for correction. Activation accepts either alias with the original secure token. The supported password-change flow preserves Employee ID and revokes old tokens. No new forgot-password provider or reset mechanism is invented.

## Database and review environment

Only a newly created `finstack_canonical_qa_<UUID>` database in the developer-owned loopback PostgreSQL cluster on port 15449 was migrated, using the unchanged manual-QA launcher. The source original fictional QA database was read only for a snapshot. All 31 existing table fingerprints matched after migration, excluding only the new identity columns on Organization and TenantUser. Five original accounts were backfilled without changing existing keys/passwords. Subsequent test organizations, employees and expenses exist only in the disposable copy.

Corrected production preview: http://127.0.0.1:5585/login. Corrected backend: 127.0.0.1:3403. Private canonical login instructions and the exact old-to-new mapping are stored only in the ACL-protected FinStack_Canonical_QA sandbox. The original app/database on 5582/3401 are unchanged. Chrome manual acceptance remains the user's responsibility.

## Verification and publication exclusions

Frontend unit tests: 294 passed. The prior additional six-digit frontend projection test was removed together with that obsolete projection; canonical transport serialization is now tested in backend unit and real browser tests. Backend unit tests: 404 passed across 39 suites after all implementation changes. Frontend lint/typecheck/build and backend typecheck/build pass. Full backend lint still reports the unchanged published baseline of 34 errors and 18 warnings; changed-file lint is checked separately.

Browser suites cover Configuration Manager, Submitter, Compliance, Finance/shared APIs (59 checks), all actor routes (155 checks), and the extended five-tab expense handoff. The final opt-in canonical employee ID live run passed all 20 checks with zero failures. It additionally uses real NestJS/PostgreSQL and Chromium, normal backend-issued credentials/tokens, all five canonical and legacy logins, prefix collision/stability, concurrency, exhaustion, activation/CSV, password change, profiles, Finance transaction display, tenant isolation, historical audit integrity, reload/focus and payment-processing semantics. No HTTP is intercepted in that live suite. The runner requires an explicit private state file and rejects any database outside the fresh named disposable sandbox.

Publish source, migration, tests and this documentation only after separate authorization. Exclude .qa-fix-evidence (including superseded prototypes/backups), .tmp, .env, credentials, private mappings, database assets, uploads, node_modules and build output. Dependency versions, CSS, teammate commits, main and all frozen/published/rehearsal workspaces are unchanged. No commit, push, PR edit or main merge has been performed.
