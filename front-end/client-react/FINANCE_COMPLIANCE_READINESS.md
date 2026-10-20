# FinStack Finance and Compliance integration readiness

Review date: 14 October 2026 (Asia/Calcutta). Scope: Finance Officer and Compliance Officer only.

**Disposition: 26 focused frontend/report files staged for a local preservation commit, pending explicit user approval. Integration with the newly persistent backend is not yet verified. No new commit has been created.**

## Branch and preservation

- Actual working branch: `feat/client-react-compliance`.
- Existing HEAD: `feb91123069825e5eadaa4c795b7dda30320519c` (`feat: complete Finance Officer SPA routing and login redirection`).
- GitHub `refs/heads/common-base` at the readiness review: `16959d5d882ed379d722eb7370c7aa57361fc30f`, verified with `git ls-remote origin refs/heads/common-base`. Local `common-base` and `origin/common-base` match that reviewed revision. It must not be assumed to include the team lead's unpublished backend.
- GitHub `refs/heads/feat/client-react-compliance`: the same `feb9112` HEAD, also verified remotely. There is no remote branch named exactly `client-react-compliance` in that lookup.
- Starting tracked worktree/index: clean. Existing untracked files: 12 generated bundles in `front-end/js/react/client/`. All original files were backed up and SHA-256 recorded in `/tmp/finstack-actor-readiness/initial-state.json` and `initial-untracked.tar.gz`; all 12 retain their original bytes.
- Build output was redirected to `/tmp/finstack-actor-readiness/final-build` to avoid Vite's configured `emptyOutDir` replacing the existing bundles. The normal bundle directory was not rebuilt.
- No reset, clean, stash, checkout, rebase, merge, push, database migration, schema change, or persistence implementation was performed. Backend files were only read. Generated dev cache under `front-end/.vite/` is excluded from the proposed commit.

## API compatibility findings

The published API guide is `back-end/docs/team-backend-api-contracts.md`. The controller, DTOs, and service source are the contract authority. The available base and this actor branch still use `ExpensesRepository` and `TransactionsRepository` backed by `src/data/store.ts`. `TenantExpensesService.listFinanceWorkspace`, its review queues, transitions, and payment actions call those repositories. The Prisma schema has categories/policies but no expense/payment persistence model. Neither checked-out backend nor the common-base API guide contains `TENANT_BANK_EVIDENCE_REQUIRED`.

The user has now identified the team lead's persistent backend as branch `feat/tenant-expense-persistence`, commit `ddb25f283a2a7343adc783ea21827288b33ccf5f`. That commit currently exists only on the team lead's laptop and has not been published to GitHub. It is also absent from this repository's Git object database. The earlier Compliance-branch suggestion is superseded by this identification. The backend source and updated contract remain unavailable here; this report cannot certify PostgreSQL expense/payment persistence, bank-evidence handling, or restart behavior against that revision. No fetch, merge, backend replacement, or competing persistence implementation was attempted.

| Consumer | Contract used | Finding |
| --- | --- | --- |
| Finance dashboard/review | `GET /api/v1/tenant/expenses/finance/workspace` → `{ expenses, transactions }`; categories → array | Matches available base. Queue UI filters the assigned workspace by `workflowStatus`; it does not use legacy root APIs. New persistent response shape needs confirmation. |
| Finance decisions | `POST /expenses/:id/finance/approve`, `/reject`, `/request-info`, `/flag`, each `{ note? }` | Paths/methods/whitelisted body match base. Reject/info/flag require a nonblank note in the UI. JWT-derived server ownership remains authoritative. |
| Finance release | `POST /expenses/finance/payment-releases`, `{ expenseIds: string[] }` | Matches base. UI selects `approved_for_payment` records and refreshes eligibility after success. Batch result expects `{ batchId, expenses, transactions }`; confirm that projection against the new backend. |
| Finance requests | `POST /expenses/finance/transactions/:id/process`, `/fail`, `/reconcile`, no body | Matches available base. Handles `409` plus code `TENANT_BANK_EVIDENCE_REQUIRED` explicitly. Failure keeps the confirmation dialog and existing server state; success only reports a recorded workflow request. No client evidence fields were invented. |
| Payment display | Base statuses: `pending`, `processed`, `failed`, `reconciled`; expense `paid` | Workflow records never establish settlement in the revised UI. Completion/paid claims were removed. Settlement remains unverified until an authoritative bank-evidence projection is published. Showing verified completion will require that contract. |
| Compliance queue | `GET /expenses/compliance/queue` → array | Matches base. Manager escalation is derived from `managerDecision === 'Escalated'` because the base projection omits `escalatedByManager`. Finance source derives from `financeDecision === 'Flagged'`. |
| Compliance decisions | `POST /expenses/:id/compliance/approve`, `/reject`, `/corrective-action`, `{ note? }` | Matches base. Approval returns `finance_review` with an active assigned Finance Officer chosen by the backend. Corrective action records the decision and remains in Compliance review on the available base. |
| Receipts | `GET /expenses/:id/receipt`, binary stream with bearer JWT | Matches base. Both actor adapters clear authentication on 401, retain it on 403, preserve error codes, and support receipt preview/download. |
| Notifications | Paged GET, unread-count GET, read PATCH, read-all POST under `/expenses/notifications` | Matches base. Mark-read actions refetch authoritative list/filter results; failures are visible. |
| Compliance audit/export | `GET /configuration/audit-logs` and `/export` | **Incompatible with published common-base:** base permits only Configuration Manager. This branch already broadened access to Compliance in the backend; that existing change needs backend-owner review. Expense workflow history on this base is not a complete persistent tenant audit trail. No new backend permission change was made. |
| Actor settings | Profile display, logout, alert preference controls | Profile is read-only. Existing Save buttons only displayed success without storing anything. Saving is now disabled with an explicit unavailable message. No role-supported alert-preference endpoint is established. |
| Authentication | Shared session transport + `/tenant/auth/me`, `FINANCE_OFFICER`/`COMPLIANCE_OFFICER` guards | No client role/organization authorization headers. Existing Configuration Manager gate retains its default role. 401 clears auth; 403 preserves the session. |

All shortened `/expenses` and `/configuration` paths above are prefixed by `/api/v1/tenant`.

## Pages and action review

All 12 active routes were inspected in source. Browser results below use intercepted fictional API responses, including decimal-string amounts, rather than a live persistence backend.

| Actor/page | Actions reviewed |
| --- | --- |
| Finance `/finance/dashboard` | Refresh workspace, queue/payment links, review details and receipt, approve, lifecycle totals. Reconciled metric is explicitly settlement-unverified. |
| Finance `/finance/queue` | Stage/category/search filters, sorting, pagination, details/receipt, approve, reject, request information, flag for Compliance; actions only on `finance_review`. |
| Finance `/finance/payments` | Select one/all eligible records, confirmation/cancel, submit batch, show saved result, dismiss result, refresh eligibility. No transfer-completion claim. |
| Finance `/finance/transactions` | Search/status filter, refresh, processing/failure/reconciliation requests, confirmation/cancel, pending and processed gates, bank-evidence conflict. |
| Finance `/finance/notifications` | State filter/pagination, refresh, mark one/all read, display operation failures. |
| Finance `/finance/settings` | Server-derived profile, disabled unavailable preference controls, logout. |
| Compliance `/compliance/dashboard` | Refresh, queue/policies navigation, inspect case/receipt/history, approve/reject/corrective-action dialog. |
| Compliance `/compliance/queue` | Search/risk/source/category filters, sorting/pagination, inspect, approve/reject/corrective action. Empty filtered results no longer imply all reviews are clear. |
| Compliance `/compliance/policies` | Read active policies/limits, queue exceptions, inspect/decide. Invalid nested `thead` fixed; queue errors no longer masquerade as zero exceptions. |
| Compliance `/compliance/audit` | Search/outcome/date filters, pagination, filter reset, CSV export, error display/retry. Real availability depends on shared backend permission review. |
| Compliance `/compliance/notifications` | Filter/pagination, mark one/all read, retry. Individual mark-read now has a keyboard-accessible button and failures are visible. |
| Compliance `/compliance/settings` | Server-derived profile, disabled unavailable preference controls, logout. |

Both layouts provide sidebar collapse, mobile menu, profile menu, role navigation, notification badge, and logout. Existing React guards and login redirection were preserved. Vite hosting now recognizes Finance/Compliance SPA paths and actor legacy HTML entry URLs, injects same-origin API configuration, and sends those legacy entries through React redirects. Query strings/hashes survive. Actual deployment/server hosting outside Vite still requires its own SPA fallback check.

## Changes prepared in this review

- Added explicit bank-evidence error handling and request-only Finance messaging; removed payment-completion assertions without bank evidence.
- Added contained Finance modal surfaces and blocked dismissal during mutations; reset notes/errors when the decision target/action changes.
- Corrected Compliance escalation-source detection, misleading filtered empty state, policy table markup, and hidden queue failures.
- Corrected receipt 401 handling and notification operation errors/list refresh.
- Disabled unsupported preference saving and improved mobile settings/dashboard grids.
- Scoped generic actor badge/button CSS to its actor root.
- Fixed audit filter submission from later pages to avoid an old-page fetch competing with the page-one fetch.
- Extended actor adapter/workflow tests and added a browser acceptance harness that blocks external APIs and never connects to a backend/database.
- Made focused changes to the shared Vite host routing only. Shared router, AuthContext, session transport, and other actors were not edited in this review.

## Ownership inventory

Paths below are relative to `front-end/client-react/`.

**Finance-owned components, CSS, adapter, and route reference:**

```text
src/features/finance/ExpenseDetailModal.jsx
src/features/finance/FinanceDashboard.jsx
src/features/finance/FinanceDecisionDialog.jsx
src/features/finance/FinanceLayout.jsx
src/features/finance/FinanceNotifications.jsx
src/features/finance/FinanceReviewQueue.jsx
src/features/finance/FinanceSettings.jsx
src/features/finance/PaymentReleaseView.jsx
src/features/finance/TransactionsView.jsx
src/features/finance/finance.css
src/features/finance/financeApi.js
src/features/finance/paymentWorkflow.js
src/features/finance/routes.js
tests/finance.test.js
tests/paymentWorkflow.test.js
```

**Compliance-owned components, CSS, adapter, and route reference:**

```text
src/features/compliance/ComplianceAuditView.jsx
src/features/compliance/ComplianceCaseModal.jsx
src/features/compliance/ComplianceDashboard.jsx
src/features/compliance/ComplianceDecisionDialog.jsx
src/features/compliance/ComplianceLayout.jsx
src/features/compliance/ComplianceNotifications.jsx
src/features/compliance/ComplianceReviewQueue.jsx
src/features/compliance/ComplianceSettings.jsx
src/features/compliance/PoliciesViolationsView.jsx
src/features/compliance/compliance.css
src/features/compliance/complianceApi.js
src/features/compliance/routes.js
tests/compliance.test.js
```

**Joint actor artifacts:** `tests/financeCompliance.browser.cjs` and this report. There are no dedicated actor-owned hook files; actors use React's `useState`, `useEffect`, `useMemo`, `useRef` and shared `useAuth`. The actor `routes.js` files are compatibility/reference registries; active routes are owned by shared `src/app/ClientApp.jsx`.

**Shared dependencies consumed:** `components/{Icon,Modal,Pagination,OperationalStates,ToastHost}`, `auth/AuthContext.tsx`, `adapters/{clientApi,tenantSession}.js`, `services/session.ts`, `styles/{legacy,spa}.css`. These were not edited in this review.

## Existing committed shared/backend differences from common-base

The branch has seven existing actor commits after common-base. They are preserved as-is. The following shared/backend files were already changed by those commits and require shared-owner review when integrating the branch:

```text
back-end/src/tenant/audit/tenant-audit.controller.ts
back-end/src/tenant/expenses/tenant-expenses-persistence.spec.ts
front-end/client-react/src/app/ClientApp.jsx
front-end/client-react/src/auth/AuthContext.tsx
front-end/client-react/src/features/shared/PublicPages.tsx
front-end/client-react/src/routes/paths.ts
```

`AuthContext` generalizes `ProtectedRoute` with an explicit allowed-role list while preserving Configuration Manager as the default. `ClientApp` registers both actor route trees. `PublicPages` adds their React login destinations. `paths.ts` maps actor legacy URLs. The audit controller broadens Compliance permissions compared with published base. The existing persistence spec instantiates the in-memory expense/transaction repositories and is not proof of PostgreSQL expense restart persistence; it was not rerun against an existing database.

## Verification results

- `npm test`: PASS, 17 frontend test files, zero failed/skipped.
- Direct actor test execution: PASS, 9 Finance cases + 10 Compliance cases + 3 payment-workflow cases (22 cases total).
- `npm run lint`: PASS. Separate ESLint check of actor JS tests and CJS browser harness: PASS.
- `npm run typecheck`: PASS. Repository `checkJs: false` means this does not type-check the JSX actor implementations; browser/build checks provide additional coverage.
- `npm run build -- --outDir /tmp/finstack-actor-readiness/final-build`: PASS. Original untracked bundle output preserved.
- Browser suite: PASS, 53 checks, zero runtime/DOM-nesting errors. Covers all 12 route loads/reloads, all actor legacy redirects, login/role gates, review decisions, Compliance-to-Finance routing, receipts, batch creation, process/fail/reconcile requests, both bank-evidence conflicts, notifications, audit filtering/export, error/retry/empty states, mobile layout/navigation, and 401 session clearing. Final result: `/tmp/finstack-actor-readiness/browser/results.json`; user also plans a manual review. **Mocked API browser acceptance does not establish live PostgreSQL persistence, tenant API isolation, bank evidence verification, or server restart durability.**
- `git diff --check`: PASS. All 12 original untracked bundles are byte-for-byte unchanged.
- Local evidence/logs: `/tmp/finstack-actor-readiness/`. No real credentials or activation tokens are included in this report or test fixtures.

## Remaining defects and integration work

1. **Blocking: obtain the team lead's unpublished backend source and updated contract.** The intended revision is `feat/tenant-expense-persistence` at `ddb25f283a2a7343adc783ea21827288b33ccf5f`, currently only on the team lead's laptop. Available common-base and this actor branch still expose the older in-memory expense/payment implementation. Once that revision is made available, recheck queue/workspace/result shapes, decimal representations, transaction request states, bank-evidence DTO/error contract, concurrency and lifecycle conflicts. Do not assume `origin/common-base` includes it.
2. **Blocking: resolve Compliance audit API ownership/access.** Current actor branch independently broadens permissions; published base does not. Backend owner must confirm an approved Compliance audit endpoint and persistent expense review events.
3. **Live acceptance pending:** verify both roles against the shared persistent backend on a fresh disposable environment, including tenant/role denial, review/rejection/return/flag, Compliance-to-Finance routing, saved requests/failures, repeat/conflicting actions, notifications/audit/receipt persistence, and restart/relogin. User is doing the manual UI check. No populated database was migrated or modified by these checks.
4. **Payment completion intentionally remains unavailable:** no authoritative bank-evidence projection exists in the available contract; statuses and request success never prove bank settlement. The UI handles the required conflict, but verified completion display needs the shared backend's evidence DTO.
5. **Actor preference saving unavailable:** controls are disabled, no false success shown. Requires an approved endpoint if this feature is expected for these roles.
6. **Currency presentation:** existing Compliance amounts/aggregate metrics assume INR, and Finance aggregate/batch totals use one currency. Multi-currency totals need grouping before enabling tenants with mixed expense currencies.
7. **Refresh/concurrency follow-up:** notification header badges refresh on navigation rather than immediately after read actions; several actor loaders lack abort/latest-response protection and list pagination may need clamping after records leave a later page. Review these under rapid concurrent navigation/actions.
8. **Hosting check pending:** Vite is covered, but other local/production hosts must serve the actor SPA deep links and legacy redirects. Existing generated bundles remain the originals and are not a deployment of these changes.

## Prepared commit scope

Proposed message: `fix(finance-compliance): prepare actor integration readiness`.

The staged commit contains only the focused actor frontend fixes, actor tests, this report, and `front-end/client-react/vite.config.js` (shared host routing). No backend, Submitter, Manager, Config Manager, Admin, schema, migration, lockfile, original bundle, or dev cache is included. Existing history remains untouched. The reviewed file list, staged patch, hashes, and scan results are retained under `/tmp/finstack-actor-readiness/local-commit-preservation/`. Commit has not been created; merge/push are not authorized.

## Compliance ownership and Jaiveer's integration review

This branch contains Finance and Compliance React implementations. A local preservation commit does not select this Compliance implementation over Jaiveer's independently developed work. Before team integration, compare both implementations, reconcile approved changes, and preserve each owner's accepted behavior and tests. Jaiveer's source has not been supplied for comparison, so ownership overlap is established but specific textual Git conflicts are not yet determined.

Jaiveer must review these Compliance-owned changes relative to this branch's current HEAD:

| File (under `front-end/client-react/`) | Change requiring owner review |
| --- | --- |
| `src/features/compliance/ComplianceAuditView.jsx` | Reset filter submission to page one without issuing a competing old-page request. |
| `src/features/compliance/ComplianceDashboard.jsx` | Allow the dashboard grid to fit a mobile viewport. |
| `src/features/compliance/ComplianceDecisionDialog.jsx` | Reset notes/errors per expense/action, expose errors accessibly, and lock the note during submission. |
| `src/features/compliance/ComplianceNotifications.jsx` | Refetch authoritative notifications after read actions; expose failures; add a keyboard-accessible individual read button. |
| `src/features/compliance/ComplianceReviewQueue.jsx` | Recognize the backend's manager-escalation projection; prioritize Finance source badges; distinguish filtered empty results from an empty queue. |
| `src/features/compliance/ComplianceSettings.jsx` | Disable unsupported preference saving, remove false success wording, and improve the mobile grid. |
| `src/features/compliance/PoliciesViolationsView.jsx` | Correct nested table headings and surface Compliance queue failures. |
| `src/features/compliance/compliance.css` | Scope generic badges to the Compliance root. |
| `src/features/compliance/complianceApi.js` | Clear sessions on receipt/export 401 responses and preserve receipt error codes. |
| `tests/compliance.test.js` | Cover receipt/export authentication expiry. |

Jaiveer and the shared frontend owner should also review joint `tests/financeCompliance.browser.cjs`, the Compliance URL handling in `vite.config.js`, and the already committed Compliance routes/layout/case modal plus shared router/auth/login changes listed above. This commit preserves local work; it does not approve replacing those parts of Jaiveer's implementation.

The Compliance audit permission difference remains a **backend-owner review item**: common-base authorizes Configuration Manager only, while this branch's existing committed controller additionally authorizes Compliance Officer. The preservation task does not modify that controller, permissions, authentication, or authorization, and does not bypass the endpoint's guards.

## Local preservation verification

Before staging, all 26 paths exactly matched the prior reviewed SHA-256 manifest and the index was empty. The 25 code/config/test files retain those tested bytes; only this report was updated with the backend location, ownership handoff, and staging context. Therefore the recorded frontend test/lint/typecheck/build results and 53 mocked browser checks apply to the staged implementation. No implementation or test was changed during preservation, and those suites were not unnecessarily rerun.

The starting 22 tracked modifications and 34 untracked files were backed up, with hashes and a binary patch, to `/tmp/finstack-actor-readiness/local-commit-preservation/` before staging. All original generated bundles and excluded files remain present and unchanged. Staging changes the Git index only; it does not create a commit. The final staged inventory and pattern-based staged-blob secret scan are recorded with the preservation evidence. Synthetic authentication fixtures are test-only placeholders, not real secrets.

## Exact files proposed for the local commit

The following 26 repository-relative paths are the complete commit candidate. All other files are excluded.

```text
front-end/client-react/FINANCE_COMPLIANCE_READINESS.md
front-end/client-react/src/features/compliance/ComplianceAuditView.jsx
front-end/client-react/src/features/compliance/ComplianceDashboard.jsx
front-end/client-react/src/features/compliance/ComplianceDecisionDialog.jsx
front-end/client-react/src/features/compliance/ComplianceNotifications.jsx
front-end/client-react/src/features/compliance/ComplianceReviewQueue.jsx
front-end/client-react/src/features/compliance/ComplianceSettings.jsx
front-end/client-react/src/features/compliance/PoliciesViolationsView.jsx
front-end/client-react/src/features/compliance/compliance.css
front-end/client-react/src/features/compliance/complianceApi.js
front-end/client-react/src/features/finance/ExpenseDetailModal.jsx
front-end/client-react/src/features/finance/FinanceDashboard.jsx
front-end/client-react/src/features/finance/FinanceDecisionDialog.jsx
front-end/client-react/src/features/finance/FinanceNotifications.jsx
front-end/client-react/src/features/finance/FinanceReviewQueue.jsx
front-end/client-react/src/features/finance/FinanceSettings.jsx
front-end/client-react/src/features/finance/PaymentReleaseView.jsx
front-end/client-react/src/features/finance/TransactionsView.jsx
front-end/client-react/src/features/finance/finance.css
front-end/client-react/src/features/finance/financeApi.js
front-end/client-react/src/features/finance/paymentWorkflow.js
front-end/client-react/tests/compliance.test.js
front-end/client-react/tests/finance.test.js
front-end/client-react/tests/financeCompliance.browser.cjs
front-end/client-react/tests/paymentWorkflow.test.js
front-end/client-react/vite.config.js
```

Approval is required by the user's explicit instruction to ask before committing.
