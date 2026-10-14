# Expense persistence preservation and team integration

2026-10-14. Preservation only: no workflow rewrite, actor source changes, commit, push, merge, branch switch, common-base update or retained-database migration. Full implementation evidence/contracts: [shared-expense-workflow-persistence.md](shared-expense-workflow-persistence.md).

## Baseline and compatibility comparison

Current branch: `feat/client-react-config-manager`. HEAD and the local published tracking ref `origin/common-base` both resolve to `16959d5d882ed379d722eb7370c7aa57361fc30f`. The local `common-base` branch is older (`7caf588...`); do not use it as this publication baseline. No fetch was performed; this comparison is to the locally available published ref and its source, not a claim about subsequent remote changes.

Compared `origin/common-base:back-end/docs/team-backend-api-contracts.md` and `team-react-integration-guide.md` with the published controller/service/DTO source and the persistent worktree. Auth, envelopes, existing route names, lowercase stages, Manager `financeOfficerId` approval input, role restrictions and approval sequence remain compatible. Relevant differences:

| Difference | Common-base source / guide | Persistent backend |
| --- | --- | --- |
| Expense/decision persistence | Source uses in-memory repositories, despite guide claiming Decimal persistence | Actual PostgreSQL expense/history/receipt/payment-request persistence |
| Receipt required | Guide says optional; source already requires multipart receipt | Required for direct creation/draft submission; this is a guide correction, not a new restriction on direct creation |
| Policy enforcement | Guide claims applicable-policy resolution/enforcement; source does not implement it | No invented policy rule; remains unsupported pending team decisions |
| Amount/currency/text validation | Source accepts numeric amount without a scale cap and largely unbounded strings | Two decimal places; amount <=999999999999.99; normalized three-letter currency; merchant <=500, payment method <=100, receipt filename <=500; nonblank merchant |
| Expense response | Existing fields and array list shape | Additive `amountExact`; date input text preserved; new `draft` stage only for new draft endpoint |
| Drafts / idempotency | No server draft routes or durable submission key | Additive `POST /drafts`, `POST /:id/submit`, optional idempotency-key on direct multipart POST |
| Receipt authorization | Source checks tenant membership only | Also checks own expense / stored Manager assignment / assigned Finance / current or prior Compliance review; Configuration Manager retains same-tenant access |
| Foreign-resource errors | Some actions reveal foreign existence with 403 | Tenant-scoped DB lookups return 404 for foreign/unavailable resources; unrelated same-tenant actors still receive 403 |
| Deletion | Removes in-memory expense | Same `{id,deleted:true}` response, durable soft deletion |
| Manager history | Non-manager_review assigned expenses | Also excludes new unsubmitted drafts; stored historical assignment remains the scope |
| Payment releases | Nonempty string[]; in-memory internal sandbox transactions | UUID v4 expense IDs, max 100; durable atomic requests with duplicate protection; no transfer/settlement implied |
| Bank process/reconcile | Internal simulated transitions could lead to paid | Same paths, owned request returns 409 `TENANT_BANK_EVIDENCE_REQUIRED`; unsupported without verified bank contract |
| Notifications/audit | Existing notification API; mutations not uniformly atomic with expense | Existing read APIs preserved; workflow writes/history/audit/notifications share DB transaction; processing-request wording replaces sandbox transfer claims |

Do not update published common-base docs or generated Swagger in this preservation pass. Use this delta when preparing the reviewed backend publication.

## Actor-specific handoff

All paths below are relative to `/api/v1/tenant/expenses`. Continue using existing JWT auth/API adapters and router. No frontend owner/organization/status/role overrides; no legacy store fallback.

| Actor | Contracts and exact UI adjustments | Actual unsupported features |
| --- | --- | --- |
| Submitter | Existing multipart `POST /` still submits directly to Manager and requires `receipt`. Enforce amount scale/range in the form; display amountExact when available. Optional server drafts use JSON `POST /drafts` (same required fields and active manager/category), existing PATCH for draft editing, then multipart `POST /:id/submit` with receipt. `GET /mine` includes draft/tracking/history; DELETE is archival. Keep one optional idempotency-key for a single direct submission across retries and generate a new key for a different operation; do not reuse with changed data. Download receipt as authenticated binary; show 403/404. Returned PATCH automatically resubmits through Manager, as before. | Verified OCR/AI decisions, automatic policy selection/limits/exemptions, receipt replacement by changing filename, automatic paid outcome, server drafts with incomplete required fields. Draft/idempotency UI is optional adoption, not required for existing direct-submit clients. |
| Manager | Existing queue/history/finance-officers GETs and approve/return/reject/escalate POSTs remain. Approval sends selected active Finance Officer **UUID** as financeOfficerId, not employeeId. Refresh queue/history after decisions; handle 400 stale stage without assuming success. History excludes drafts; decision projections may have employee:null/categoryId fallback, so retain loaded display context or reload history. Receipt is fetched with bearer JWT as binary; handle 403/404 without clearing valid auth. Backend stored assignment is the receipt rule, while current direct-report membership is additionally required for queue/actions. | Automatic rerouting after hierarchy reassignment, multilevel-manager fallback, mandatory policy-driven escalation, finished review of Aditya's external receipt patch. |
| Finance | Existing assigned queue/workspace and approve/reject/request-info/flag inputs remain `{note?}`. Submit payment releases as 1–100 UUIDs, deduplicated in UI; display result as a **pending internal processing request**. Refresh authoritative workspace after uncertain/repeated release; reused request UUID is not a new payment. Disable simulated success/reconcile buttons or display 409 bank-evidence explanation; keep auth on 409/403. `.../transactions/:id/fail` records an authorized operator failure and is idempotent; show failed transaction/notification even though expense stays payment_processing. Returned information still goes through Manager on owner PATCH. | Actual bank transfer, verified bank success, paid settlement, operational reconciliation, retry attempt creation after failure, provider callbacks. Do not replace 409 with frontend-only paid state. |
| Compliance | Existing organization queue and approve/reject/corrective-action POSTs remain `{note?}`. Approval returns to Finance (existing eligible assignment or earliest-created active fallback); show no-active-finance 400. Corrective action remains compliance_review; identical note replay is idempotent, not case closure. Receipt access works for current compliance review or a prior compliance decision; show 403/404 where unavailable. Refresh the authoritative queue after mutations. | Individually assigned investigation queue, policy-driven mandatory entry, advanced corrective-action task lifecycle, agreed alternative finance routing. |

Keep loading/empty/error states and confirmations from actor-owned UI. 401 means reauthenticate; 400/403/404/409 should preserve the current valid identity and show the specific resource/state error. Existing lists remain arrays, not new paginated envelopes. Existing release `expenses` retain internal ExpenseRecord names; do not silently assume ExpenseDto names for batch results.

## Manager conflict risk: pending external commit access

User-provided report metadata (not independently inspected source):

- Aditya's laptop repository: `C:\Users\Aditya\SEM5\FDFED\1_FinStack-manager`.
- Branch: `feat/manager-react-workspace`.
- Local unpublished commit: `a45fe395d162d3cbac402c9233da6021fb24c378`, based on `16959d5d882ed379d722eb7370c7aa57361fc30f`.
- Report states 34 files: 14 Manager-owned and 20 shared integration files; existing Manager contracts include financeOfficerId.
- No confirmed local report file or accessible commit exists here. The older local `feat/client-react-manager` ref is not this implementation. It must not be merged as a substitute.

Manager-owned files are under `front-end/client-react/src/features/manager/`, including dashboard, queue, details, history, layout, notifications, profile/settings, API/contract/loader/hook files and manager.css. None were edited here.

The specifically reported backend overlap is `back-end/src/tenant/expenses/tenant-expenses.service.ts` receipt authorization. Current persistent behavior: same tenant plus owner/stored Manager assignment/assigned Finance/current-or-prior Compliance decision; Configuration Manager can read same-tenant receipts. **Pending comparison:** does Aditya require current direct-report membership for Manager receipts, allow historical receipt access after reassignment, or apply different error/status behavior? These differences cannot be asserted without his patch. Agree queue/actions/history/receipt semantics together; a former manager may retain stored historical receipt access here while losing current review authority.

When the commit becomes accessible, review its complete shared-file inventory for API adapters, auth/router/shell/package/DTO/service changes. Reconcile receipt rules inside the persistent service with PostgreSQL and authorized tenant ownership intact; never accept an entire old in-memory service as a conflict resolution. Preserve durable writes, transaction context, private Receipt lookup, metadata bounds, notification/audit atomicity and evidence-gated settlement. Shared React changes require shared-maintainer and impacted actor review. Manager source integration follows this backend review.

## Exact preservation staging inventory

Only these 17 paths belong to the proposed local commit:

```text
back-end/prisma/schema.prisma
back-end/prisma/migrations/20261014120000_shared_expense_workflow/migration.sql
back-end/src/data/store.ts
back-end/src/tenant/expenses/persistent-expenses.repository.ts
back-end/src/tenant/expenses/expense-workflow-context.ts
back-end/src/tenant/expenses/tenant-expenses.controller.ts
back-end/src/tenant/expenses/tenant-expenses.service.ts
back-end/src/tenant/expenses/tenant-expenses.module.ts
back-end/src/tenant/expenses/dto/create-tenant-expense.dto.ts
back-end/src/tenant/expenses/dto/release-tenant-payment.dto.ts
back-end/src/tenant/expenses/tenant-expenses.service.spec.ts
back-end/test/shared-expense-workflow.e2e-spec.ts
back-end/test/tenant-notifications.e2e-spec.ts
back-end/test/expense-process-harness.cjs
back-end/scripts/verify-expense-persistence.cjs
back-end/docs/shared-expense-workflow-persistence.md
back-end/docs/shared-expense-team-integration.md
```

Shared-file necessity: Prisma inverse relations/composite ownership, additive draft/amountExact TypeScript types, tenant-service dependency/transaction wiring and durable category reference checks; notification test fixture cleanup now respects expense FKs. No Configuration Manager/Admin implementation beyond these existing shared expense dependencies is staged. No auth/router/shared React files are staged. Unrelated modified Swagger, QA docs/screenshots, React artifacts, .env, DB dumps/backups, node_modules, dist, temporary schemas and test uploads are excluded. Database schemas are server state, not source files.

## Publication sequence proposed for approval

1. Review the exact staged tree, whitespace/secret scan and relevant test evidence. **Stop before commit.** Suggested commit: `feat(expense): persist shared tenant expense workflows`.
2. After explicit approval, preserve the staged work on a dedicated reviewed backend branch/ref such as `feat/tenant-expense-persistence`, based on exact published commit `16959d5...`. Do not create a commit on an actor branch or use the stale local common-base tip. The current HEAD matches that base, so a new branch can carry only this staged delta while unrelated working-tree changes remain unstaged. No branch change was performed in this task.
3. Review migration and actor deltas, then request separate publication approval for a backend-only branch/PR. Do not push or update common-base automatically. Before eventual publication verify that the remote base has not advanced and resolve dependencies through team review.
4. Owners validate the shared backend ref in isolated schemas first. Only after migration approval/backup/environment selection deploy the additive migration and matching backend together to retained environments. No db push/reset or unrelated historical FK/index repairs.
5. Obtain Aditya's exact commit/patch through an agreed handoff, review the 20 shared changes and reconcile receipt authorization; then integrate Manager-owned source. Integrate other actor branches in reviewed steps with shared auth/router maintained. No automatic merge/rebase or whole-service overwrite.

Required team decisions: verified bank evidence and settlement/reconciliation contract; failed-request retries; policy selection/versioning and enforcement; pending-expense manager reassignment; history versus current-report receipt access; fallback Finance/Compliance availability; deployment receipt storage/retention and migration approval. Draft endpoints do not change the established Manager → Finance sequence.

## Preservation verification

Preservation pass results (2026-10-14):

| Check | Result |
| --- | --- |
| Reviewed staged inventory | Exactly the 17 allowlisted paths above; index matches tested working files after Git line-ending normalization |
| `git diff --cached --check` | Passed |
| Staged secret scan | No candidate private keys, literal JWTs, credentialed database URLs, provider/GitHub tokens or added hardcoded secret assignments found; no environment, uploads, backups or generated files staged |
| Full configured unit tests | 28 suites / 196 tests passed |
| Real PostgreSQL e2e | 5 suites / 48 tests passed, including separate backend process restarts |
| Backend build / typecheck / Prisma validation | Passed |

Fresh preservation verification schema: `finstack_config_verify_expense_423ccf3bf97f43e18de7f141e509f36e`; all 22 migrations deployed there successfully. The reviewed new migration is still not deployed to retained QA/public databases. This pass added only this integration document; it did not change the verified persistence implementation. Prior legacy transaction verification remains 10 passed; repository-wide lint has known unrelated failures and was not repaired. Final staged checks must be repeated if the index changes before the approved commit.
