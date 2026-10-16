# FinStack — implementation order (2026-10-16)

## First: SEC-TENANT-001 — identity and tenant isolation

**Goal:** Organization-associated, server-generated and database-enforced globally unique tenant login IDs; keep immutable internal UUIDs, and allow organization-local HR identifiers separately where needed. Protect existing accounts and sessions.

**Proposed format, not final until source inspection:** `<ORG-HINT>-<UNIQUE-ORG-CODE>-<CRYPTO-RANDOM-USER-CODE>`, e.g. `FWD-7K2Q-8DJ4M9`. The organization name hint does not grant access. Global uniqueness is enforced in PostgreSQL with collision retry.

**Required source audit:** Prisma User/Tenant models and unique constraints, public organization registration, tenant bootstrap, Configuration Manager individual provisioning, bulk CSV parsing/validation/creation, activation-token issuance and redemption, auth login lookup, refresh JWT/session, `/me`, tenant guards/service scoping, employee detail/receipt notifications; identify all clients parsing/storing employee IDs.

**Implementation principles:** No unaudited findFirst-by-employeeId, no tenant guess from client input, no manual login ID edits, no merging accounts due to same names/passwords; retain old IDs through an explicit backwards-compatible transition. The legacy user IDs from the current test organization must still work, or a reviewed transition must be supplied.

**Testing:** Two fictional tenants; identical HR employee reference and identical disposable password in each; two distinct generated login IDs; correct `/me`, sessions, tenant filtering, direct-record access denial; registration + individual create + bulk import + activation end-to-end. Never use real credentials or original `finstack` DB.

**Safety:** Work only in `feat/full-workflow-integration` worktree, current clean HEAD verified, source-only changes first. No database mutation or Prisma migration until scope/review and isolated snapshot. Preserve 3401/5581/5174 original QA services and original worktree. No reset/dev/db-push, no merge/push/squash, no secrets in commits.

## Then: UI work in reviewable batches

1. Extract a shared tenant shell and design tokens matching **Expense Submitter**, while comparing Aditya's original Manager UI and retaining role-specific pages/actions.
2. Replace native confirmation alerts in Manager, Platform Admin, and bulk activation export; common logout confirmation across actors; accessible buttons/toasts.
3. Fix cross-actor stale queues with refetch on tab focus/navigation and appropriate stale polling, rather than WebSockets by default.
4. Harmonize notifications, profile/settings, lists/tables, and handle unsupported preference saving honestly.
5. Polish public registration form and center receipt screen; retain truthful local-QA verification disclosure.
6. Re-run full registration → Admin approval → Configuration Manager → Submitter → Manager → Finance/Compliance → internal payment_processing, with per-role session isolation and database persistence. **Never present internal payment-processing as bank settlement.**

See `FINSTACK_LIVE_QA_ISSUES.md` for full issue details and screenshots/test history.
