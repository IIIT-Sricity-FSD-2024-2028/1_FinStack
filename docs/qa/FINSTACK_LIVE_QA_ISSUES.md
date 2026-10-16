# FinStack — Live QA Issues & UI Consistency Tracker

**Tracking status:** Active — screenshot review added; collect findings first, then fix in reviewed batches  
**Date opened:** 2026-10-16  
**Project:** `1_FinStack` — integrated React tenant client + Platform Admin + NestJS/PostgreSQL  
**Integration branch:** `feat/full-workflow-integration`  
**Last verified integration commit at time of this report:** `25e2cf294e8286e61878578384122f6d43117c44`  
**Local test origins:** Client `http://127.0.0.1:5582` · Backend `http://127.0.0.1:3402` · Platform Admin `http://127.0.0.1:5175`  
**Testing:** Disposable integration database only. Never use the original `finstack` DB or retained QA environment for issue reproduction.  
**Privacy:** Never attach passwords, JWTs, private fixture JSON, real identity data, or unsanitized auth/network captures.

## Purpose and conventions

This is the **single source of truth for discoveries, planned changes, verification, and sign-off**. Add an entry as soon as a bug or change request is noticed. Do not start broad UI changes until expected designs and ownership have been reviewed. The integration is functional enough for actor logins, but not yet accepted as end-to-end verified.

- **Observation** = manually reported/observed; may require reproducible evidence.
- **Proposal** = recommended change, not a confirmed defect or approved implementation.
- **Unverified** = must be checked against source, UI and/or real database.
- **Priority:** P0 = data loss/security/blocker; P1 = broken critical path/severe UX regression; P2 = inconsistent UX or reliability; P3 = polish.
- **Status:** Open → Reproduced → Scoped → In progress → Ready for retest → Verified → Closed; also Blocked/Deferred.

> **Scope reminder:** An on-screen checklist showing “6 of 6 checked” is a progress marker, not proof that every role, alternate status transition, data refresh and registration-to-payment scenario was fully verified. Track concrete cases separately below.

## A. Issues and improvement requests

| ID | Type | Priority | Area / owner to consult | Finding | Status |
|---|---|---|---|---|---|
| UI-001 | Observation / design | P1 | All tenant role UIs | Styles, page structure, navigation and interaction patterns are inconsistent across the five actors. The user has explicitly chosen **Expense Submitter UI as the baseline design system** for all five tenant actors: controls, placements, navigation patterns, spacing, typography, feedback and layout. Compare Aditya’s original Manager implementation because it may already match; retain all role-specific behavior and permissions. | Open |
| UI-002 | Observation / regression | P1 | Manager / **Aditya** | Integrated Manager pages look different from the pages Aditya originally built; visual fidelity and missing elements must be compared against Aditya's branch, screenshots or original design. Functionality reportedly still works. | Open |
| UI-003 | Observation / navigation | P1 | Manager | Manager **does have a left sidebar**, but the expected shared **top navigation/header bar** is missing. Compare intended Manager navigation with Aditya’s original frontend before restoring or redesigning it. | Open |
| UI-004 | Screenshot-confirmed / interactions | P2 | Manager → Review Expenses | **Approve** displays native browser `confirm()` (“Are you sure you want to approve this expense?”). Tester reports similar browser dialogs for Escalate, Reject and Return (not separately screenshot-confirmed). Replace with consistent accessible in-app confirmation; use toasts for post-action results. | Open |
| UI-005 | Observation / cross-role freshness | P1 | Submitter → Manager → Finance → Compliance | New expense or workflow status is not visible in another actor's already-open queue until the page is refreshed. Reported across actors. | Open |
| UI-006 | Proposal / shared components | P2 | Shared React app | Unify reusable notification UI, logout, profile and settings experiences, role-aware nav/header, empty/loading/error states and feedback messaging without erasing role-specific workflows. | Proposed |
| QA-001 | Coverage gap | P1 | Platform Admin → Configuration Manager → all roles | Full registration-to-end lifecycle has not yet been independently verified as one reproducible walkthrough. Need new-org registration, approval, CM activation, employee provisioning, role logins, expense states, internal payment processing and audit verification. | Open |
| QA-002 | Risk to check | P1 | Browser auth/session | Five actor tabs may share localStorage/cookie state within one browser profile; verify sessions do not switch identity or cross-contaminate. Use separate Chrome profiles/isolated contexts to obtain reliable multi-actor results. **Not a confirmed defect.** | Unverified |
| UI-007 | Requested enhancement | P2 | All five tenant actors; Platform Admin to inspect separately | **Logout currently navigates away without asking.** Require a common in-app confirmation dialog before revoking session/navigating; Cancel leaves actor signed in on same page. | Open |
| UI-008 | Screenshot-confirmed / misleading affordance | P1 | Manager → Profile & Settings | **Save preferences** is clickable despite the action reporting “Saving preferences is unavailable for this role.” Disabled/unsupported settings must not pretend to be saveable; keep supported profile/security actions functional. | Open |
| UI-009 | Proposal / cross-role shell | P1 | All five tenant actors | Introduce a shared responsive top header + sidebar/navigation model, selected-link styling, content widths and account controls, with role-specific menu contents and permitted routes. Scope after inspecting existing Submitter UI and Aditya’s original Manager UI. | Proposed |
| UI-010 | Screenshot-confirmed / polish | P3 | Manager lists, notifications and browser tabs | Long raw expense UUIDs dominate list/notification copy; five role tabs may all show generic “FinStack Client”. Prefer concise IDs + copy control/details as applicable, contextual notification text and role-aware page titles, without removing full IDs from audit/details. | Open |
| UI-011 | Unverified visual/data consistency | P2 | Manager dashboard → review detail | Dashboard labels one item as `0/100` risk while a review detail screenshot shows `—` for risk score; may be different expense or default semantics. Verify same-item risk representation and avoid implying a calculated score where absent. | Unverified |
| QA-003 | Test procedure issue | P1 | Five concurrent role tabs | Tester has five actors open in Chrome tabs; check whether tabs share the same auth storage/cookies and could overwrite role identity. Re-run cross-role freshness tests in **isolated browser profiles/contexts**, not same-profile tabs or same Incognito session. | Unverified |
| SEC-001 | Dependency follow-up | P2 | Platform Admin npm dependencies | `npm ci` previously reported 6 vulnerabilities (1 moderate, 3 high, 2 critical). Determine affected production/development packages and exploitability before any public deployment; no automatic major upgrades. | Open |

| UI-012 | Screenshot-confirmed / registration polish | P2 | Public `/register` | Organization registration is visually very minimal relative to the Submitter design baseline: long uninterrupted form, inconsistent perceived polish, large gaps, and no visible multi-step progression. Audit responsive states, inline validation and final confirmation before implementing a stepper. Preserve all actual required legal/contact/plan fields. | Open |
| UI-013 | Screenshot-confirmed / environment messaging | P2 | Public `/register` | Orange local-QA banner exposes engineering terminology: “LOCAL MANUAL QA · isolated database. Fictional .test mailboxes are accepted. No legal identity or domain ownership is verified.” This is a valid test-safety disclosure, **not** a registration error; improve visual style/wording for QA while preserving the truth that legal identity, domain ownership and delivery are NOT verified. Never conceal the limitation in a production deployment. | Open |
| UI-014 | Requested design baseline / all controls | P1 | All five tenant actors + public registration | Explicit requirement: match Expense Submitter UI for shared button size/placement, navigation/header/sidebar, page widths, typography, forms, tables, cards, colors, dialogs, notifications, profile/settings and logout confirmation. Each role retains its own menu items, permissions and business functions; Platform Admin remains an independent app but may reuse design tokens. | Open |

### 2026-10-16 — Public organization registration screenshots

**Observed route:** `http://127.0.0.1:5582/register`. Two supplied screenshots show a dark two-column form with sections “Organization legal identity”, “Authorized contact”, “Login credentials”, and “Plan & seats”. Fields visible: legal organization name, country, government registration identifier or justification why none applies, official organization email; contact name/title/email; password and confirmation; employee count and plan.

**User assessment:** Page is too basic/minimal. Adopt the Expense Submitter look and feel while keeping a clean unauthenticated public registration layout. Consider a progressive stepper, better form grouping, accessible error states and inline help after auditing the actual source. These are design requests, **not proof that registration submission fails**.

**QA-safety interpretation:** The orange QA notice means this is local isolated test mode, fictitious `.test` email addresses are acceptable, and the application does not verify legal identity, email delivery or domain ownership. The notice is intentional and must remain truthful. Organization APPROVED/ACTIVE means reviewed/activated under local workflow, **not identity verified**.

**Manual test plan:** Register one NEW unique fictional organization in the APPROVED integration environment, with `.test` organization/contact email on the same domain; use non-personal fictitious details, explicitly explain missing government ID instead of fabricating a real one; choose an existing active test/trial plan and enough seats for Configuration Manager, Manager, Submitter, Finance and Compliance; create password privately. Check whether the form validates or displays unexpected billing or external email side effects. Submit only once; record confirmation and organization state before proceeding to Platform Admin.

### UI-002 / UI-003 — Manager original-design regression

**Reported actual:** Manager's Review Expenses and other pages have changed substantially from Aditya's implementation; the screenshots show a **left sidebar**, but **no top application header/nav bar**. Reviewer prefers the earlier Manager page design even though the integrated workflow reportedly functions.

**Expected:** Restore the intended Manager visual hierarchy, navigation, page structure and interaction style as closely as possible to Aditya's work, while preserving integrated backend connectivity, current authorization, real receipt workflow and shared app shell standards. Do not blindly cherry-pick older backend or Prisma changes.

**Reproduction / evidence to collect:**
1. Capture sanitized screenshots of current Manager dashboard, sidebar/header, Review Expenses list, detail page and decision modals.
2. Compare them to the **Manager frontend only** from `feat/manager-react-workspace` (Aditya's published commit `a45fe395d162d3cbac402c9233da6021fb24c378`) and any prior screenshots.
3. Record exact component/route differences; ask Aditya to confirm which screens and navigation are intentional.
4. Assess what the integrated manager pages changed and why, before editing.

**Acceptance:** All intended Manager navigation is available; approved design matches the original where possible; actions still work with live APIs; no role/tenant security regression.

### UI-004 — Browser alerts on Manager expense decisions

**Steps:** Login as Manager → Review Expenses → choose an eligible test expense → Approve, Escalate, Reject or Return for Correction (use a *different test expense* for each terminal/branch action).

**Actual:** Approve is screenshot-confirmed to display a browser-native `confirm()` (“Are you sure you want to approve this expense?”). For Escalate / Reject / Return the user also reports browser dialogs, but we still need to capture exact behavior and field validation for each distinct action.

**Expected:** Shared **in-app `ConfirmDialog`** for consequential decisions, distinct from **non-blocking `Toast`** for success/failure. Keep proper comment/reason validation, assignment prerequisites, accessibility and protection from double submissions. Cancel must perform no mutation. Navigation, state and queue update correctly after decision.

**Acceptance:** No browser-native `window.confirm`/`window.alert` in Manager decisions; Confirm makes exactly one authorized request, Cancel makes none; no hidden backend errors; status and notifications show meaningful feedback.

### UI-005 — Data refresh across actor tabs

**Steps:** With isolated actor sessions, open Submitter and Manager queues → Submitter creates one fictional expense → focus existing Manager tab **without manually reloading**; repeat Manager→Finance and escalation→Compliance, and for notifications.

**Actual:** Other actor's page remains stale until browser refresh.

**Expected:** Recently changed data appears automatically. Suggested incremental strategy: refetch on window/tab focus + after successful mutations; invalidate related lists/details/counts; optionally add periodic revalidation while visible. Decide an explicit freshness target (e.g., within 5–15 seconds on an active tab) before implementation. Real-time push/SSE/WebSocket is **optional**, not a requirement until evidence justifies complexity.

**Acceptance:** No manual hard refresh needed in standard workflow; no stale count/status/notification display; no duplicate approval after concurrent changes; no excessive polling; works across isolated sessions.

### UI-001 / UI-006 — Consistent UI without flattening roles

**Design proposal to review:**
- Define typography, spacing, color tokens, button/inputs/cards/tables, responsive layout, loading/empty/error states and feedback conventions using Expense Submitter as the governing visual baseline, incorporating compatible elements from Aditya’s original Manager frontend.
- Shared *presentation* components: `AppShell`, role-aware header/nav, `NotificationBell`/panel, `AccountMenu`, `LogoutAction`, `PageHeader`, `StatusBadge`, `ConfirmDialog`, `Toast`, `EmptyState`, `LoadingState`, `ErrorState`.
- Reuse existing authenticated API/auth hooks and permission checks where safe. Do **not** assume every role has the same backend endpoints for profile/settings/notifications.
- Keep Manager review workflow, Finance queues/releases, Compliance audits and Configuration Manager tooling role-specific.
- Inventory existing profile/settings APIs first. Previously noted that Submitter self-profile capability may be unavailable; **do not show a working Save button if the backend cannot persist it**.
- Scope implementation as **reviewable batches**: (1) Manager parity/nav/alerts, (2) cross-tab freshness, (3) shared shell/components, (4) role-by-role polishing. Preserve teammate authorship and attribution.

**Definition of done:** Visual consistency across five tenant actor pages at desktop and mobile sizes, keyboard-accessible actions, consistent feedback and status naming, all prior real backend workflows passing.

### UI-007 — Unified logout confirmation for every role

**Requested behavior:** Pressing **Log out** from any of the five tenant workspaces should show a themed, keyboard-accessible confirmation dialog **before** ending the session. Example text: “Log out of FinStack? You will need to sign in again.” Controls: **Cancel** and **Log out**. Cancel closes the dialog with no redirect/session mutation; Confirm performs the existing safe logout, clears the appropriate session, then navigates to the correct login screen. Do not let a shared component bypass role-specific auth/logout safeguards. Assess Platform Admin’s separate application independently rather than silently mixing its authentication implementation into the client app.

**Acceptance:** Every actor follows the same pattern; no immediate navigation on first click; no unhandled logout failures; multiple tabs of the same identity behave safely; dialogs accessible with focus management and Escape-to-cancel unless unsafe; tests confirm backend/logout/session behavior is unchanged.

### UI-008 — Manager settings claim an unsupported action

**Screenshot evidence:** Manager `.../manager/profile-settings` shows toggles for interface animations, desktop notifications, automatically refresh workspace, email alerts and weekly digest, plus **Save preferences**. A visible toast reports: **“Saving preferences is unavailable for this role.”**

**Expected:** Inspect supported Manager `/me/settings` backend contract. If preference persistence is unsupported, disable the editable-looking controls and save button (or label the panel “Not available yet”); do **not** silently persist in browser local storage while implying backend persistence. Separate this from **supported** Manager profile, password-change and session-revocation operations. Avoid advertising email alerts / desktop notifications unless implemented and permission-safe.

**Acceptance:** No clickable controls that knowingly fail with “unavailable”; truthful capabilities per role; supported profile and security controls still work; no new backend API without explicit design/review.

### UI-009 — Shared component architecture and visual contract (proposal, not implemented)

| Shared across five tenant actors | Standard behavior | Must remain role-specific |
|---|---|---|
| `AppShell`, `TopBar`, `Sidebar`, `PageHeader`, navigation item styles | Same placement/spacing/responsive patterns; selected route and role-aware page title | Nav links/permissions and individual workspace routes |
| `AccountMenu`, `LogoutConfirmDialog` | Account identity, profile link where supported, deliberate logout confirmation | Backend session rules; admin is separate application |
| `NotificationBell`, `NotificationList`, `NotificationCard`, `UnreadBadge` | Consistent filters, read/dismiss states, timestamp format, refetch behavior | Notification endpoint permissions and allowed actions |
| `ProfileSection`, `SecuritySection`, `SettingsSection` | Common labels, fields, save indicators, validation styles | Only render editable fields backed by implemented APIs |
| `ConfirmDialog`, `Toast`, `ErrorBanner`, `EmptyState`, `LoadingSkeleton` | Common confirmation/feedback/loading/error semantics | Decision inputs and role-specific validation |
| `ExpenseTable`, `ExpenseDetails`, `ReceiptViewer`, `StatusBadge`, `CurrencyAmount` | Consistent amounts, statuses, dates, receipt access, row actions and responsive layout | Available actions, queues, restrictions, audit visibility |

**Reference designs:** Use Expense Submitter presentation as the user-selected design baseline **and** compare the complete Manager UI with Aditya's published frontend to recover its intended features. Define one set of tokens (typography, spacing, colors, radii, contrast) before role-by-role implementation. Prefer reusable presentational components over forcibly merging all five workflows into one giant page or API hook. Do not expose restricted data to all roles merely to reuse a component.

**Implementation order (after a source audit and agreed design direction):**
1. Inventory **every route and major component** in the integrated React source for Submitter, Manager, Finance, Compliance, Configuration Manager; list page title/layout/nav/notifications/profile/actions/endpoints. Also audit separate Platform Admin for compatible visual conventions, but preserve its auth boundary.
2. Compare Manager frontend with Aditya's original published branch **read-only**. Note exactly what was dropped/changed; make a restoration/parity plan that retains integration's backend contracts.
3. Implement shared tokens and shell/feedback components in **small batches**; do not change backend/Prisma schemas simply for visual consistency.
4. Restore Manager design and action dialogs, add logout confirmation, correct unavailable settings affordances, then expand across remaining roles.
5. Add data refetch-on-focus, mutation invalidation, and only then consider measured polling/SSE for active queues.
6. Re-run React unit/browser checks **plus live PostgreSQL** workflows, role separation, receipts, notifications and registration lifecycle before calling fixes verified.

### Screenshot review (2026-10-16)

Evidence is **seven browser screenshots shared in chat**, not screenshots from every actor; source-code audit is necessary to cover those other pages. Current screenshots show:

| Route / screen | Directly visible | Finding |
|---|---|---|
| `/manager/dashboard` | Dark left sidebar, summary cards, pending requests, recent decisions; **no top app bar** | Topbar/layout design review; common summary/card tokens; manual Refresh button present |
| `/manager/expenses` | Search/filters, single pending row, full UUID displayed over two lines | Standard tables/filters and compact ID presentation; queue freshness needs verification |
| `/manager/history` | Search, status filter, Approved and Escalated rows | Consistent status badges, spacing and view action; confirm labels reflect current backend state |
| Manager expense detail | Receipt button; Finance Officer selector; decision input; Approve/Return/Reject/Escalate actions | Standard form/action layout, guards and accessible decision dialog; do not remove finance assignment or reason requirements |
| Manager approval confirmation | Browser-native “Are you sure you want to approve this expense?” | Confirmed native `confirm()` replaces needed in-app modal |
| `/manager/notifications` | Four notifications with read/dismiss, raw full expense UUIDs | Reusable cards, readable titles, unread badge, normalized timestamps and cross-tab refresh |
| `/manager/profile-settings` | Settings toggles; Save preferences; “Saving preferences is unavailable for this role” toast; password fields | Misleading editable controls and save affordance; preserve supported password/security features |

**Privacy note:** A receipt screenshot shows a personally identifying document filename, not clearly a fictional receipt. For future test uploads, use synthetic receipt images/documents only. Do not paste personal documents into project QA or commits; any cleanup must be limited to explicitly approved integration test data and must not touch retained QA.

### Recorded screenshot-based conclusions and limitations

- **Confirmed from screenshots:** Manager left sidebar exists; no shared top header is shown, Approve uses native browser confirmation, Manager preference-save reports unavailable, long UUIDs clutter some views.
- **User reported (not yet independently repeated here):** Similar action popups on Return/Reject/Escalate, inconsistent visual design across the other four actors, logout happens immediately on click, cross-role data stays stale until refresh, Manager differs from Aditya's design.
- **Not yet established:** Whether the underlying API workflows are correct end-to-end; precise source component causing regression; whether any `risk score` data display is inconsistent for the **same** expense; whether the five Chrome tabs had genuinely independent authenticated sessions.

## B. End-to-end manual test checklist

Record each test independently as **Not run / Pass / Fail / Blocked** and attach a sanitized screenshot, relevant path/status (no tokens), test expense ID and date. All writes occur in the new integration runtime schema. Use fictional data only; no external bank settlement.

| ID | Scenario | Primary actors | Result | Evidence / issue |
|---|---|---|---|---|
| E2E-01 | Register a **new** fictional organization (unique `.test` domain); inspect trial/invoice behavior and absence of external billing/email | Organization applicant | In progress — form opened | Registration screenshots reviewed; no submission confirmed |
| E2E-02 | Platform Admin login, review and approve registration; check organization becomes APPROVED/ACTIVE | Platform Admin | Not run | |
| E2E-03 | Configuration Manager credential setup and login; create Manager, Submitter, Finance and Compliance actors and assign Submitter's actual manager | Config Manager | Not run | |
| E2E-04 | Configure active receipt-required category and manual-review policy; verify policies aren't falsely described as automatic enforcement | Config Manager | Not run | |
| E2E-05 | Submitter creates one small INR expense, attaches a real PNG receipt and submits once | Submitter | Not run | |
| E2E-06 | Manager queue shows expense automatically; open details and receipt; approve and assign Finance Officer | Manager | Not run | UI-005 |
| E2E-07 | Finance queue updates; Finance approves and creates **internal** payment-processing request. UI must **not** claim bank settlement | Finance | Not run | |
| E2E-08 | Separate expense: Manager returns for correction; Submitter edits/resubmits; verify history and Manager queue | Manager, Submitter | Not run | |
| E2E-09 | Separate expense: Manager rejects; verify terminal state/history/notification | Manager, Submitter | Not run | |
| E2E-10 | Separate expense: Manager escalates; Compliance can review and approve/reject/corrective action as supported, with Finance handoff where relevant | Manager, Compliance, Finance | Not run | |
| E2E-11 | Verify recipient notifications, badges and unread state update across actor sessions without refresh | All relevant roles | Not run | UI-005 |
| E2E-12 | Reload each page and re-login; status, receipt access, history, totals, notifications persist and agree | All tenant roles | Not run | |
| E2E-13 | Inspect Compliance audit list/export and verify sensitive fields / detailed audit restrictions | Compliance, Config Manager | Not run | |
| E2E-14 | Verify role-restricted frontend pages AND backend APIs reject unauthorized access, without erroneous logout on 403 | All roles | Not run | |
| E2E-15 | Check separation between two fictional tenants after a second tenant is provisioned and approved; deny cross-tenant IDs/files | All roles | Not run | Requires separately approved test tenant |
| E2E-16 | Verify data still persists after **controlled restart of only the integration backend**, with supervised service control | All roles | Not run | Schedule after initial workflows |
| E2E-17 | Review UI parity/accessibility/responsive layouts across all five tenant actor pages | All tenant roles | Not run | UI-001 through UI-011 |
| E2E-18 | Verify Platform Admin UI and core functions independently of tenant client React | Platform Admin | Not run | |
| E2E-19 | For each tenant role, click Log out → Cancel (stay signed in) and Log out → Confirm (end session + redirect) | All five tenant roles | Not run | UI-007 |
| E2E-20 | Verify Manager preference controls are not misleading and that supported password/profile/security actions still work | Manager | Not run | UI-008 |
| E2E-21 | Audit all React routes and shared components from **source**; compare original Manager frontend and integrated Manager frontend without backend cherry-picks | All tenant roles | Not run | UI-001, UI-002, UI-009 |
| E2E-22 | Confirm dialog Cancel never invokes approval, native alert is absent; Confirm invokes one mutation with correct reasons/Finance assignment | Manager | Not run | UI-004 |

**Previously reported (not equivalent to the test-case results above):** Five tenant actors were logged in through UI; high-level sections for Submitter, Manager, Finance, Compliance, Configuration Manager and cross-role checks were marked 'checked' by the tester. The reported issues are real observations; granular transitions have not been evidenced here.

### Suggested test-case record

Copy for each run:

```text
Case ID:
Date/time:
Actor and browser profile (not credentials):
Test organization alias:
Expense ID (fictional):
Steps performed:
Expected:
Actual:
UI screenshot reference (redacted):
HTTP path + status (if relevant, no secrets):
Result: Not run / Pass / Fail / Blocked
Linked issue ID:
Notes:
```

## C. New-issue template

Copy below each time another fault/change request appears:

```markdown
### [ISSUE-ID] — Short title
- **Date:** YYYY-MM-DD
- **Type:** Bug / UI regression / Enhancement / Test gap
- **Priority:** P0 / P1 / P2 / P3
- **Actor and page:**
- **Observed behavior:**
- **Expected behavior:**
- **Reproduction steps:**
- **Evidence:** Sanitized screenshot, relevant route, HTTP status, test record ID
- **Affected component/API (if known):** Unknown until inspected
- **Status:** Open
- **Owner to review:**
- **Acceptance / retest:**
```

## D. Execution rules before fixes

1. First gather screenshots/steps and confirm intended original Manager design with Aditya. Do not assume an integrated UI change is intentional.
2. Preserve existing functionality, role permissions and shared expense persistence. Never transplant older frontend **together with** teammate backend/Prisma migrations.
3. Edit only the isolated integration worktree and branch after a deliberate reviewed change plan; leave the original worktree, retained QA environment and database unchanged.
4. Keep all test credentials ignored/private, don't share screenshots of private fixture contents.
5. For every fix: reproduce → isolate frontend/backend cause → implement small change → lint/test/build → real browser retest → update issue status. Preserve authorship in commits.
6. Do not treat `payment_processing` as bank-paid status; external settlement is outside current live QA.
7. Track the Admin dependency audit separately before exposure to a non-local network.

## E. Change log

| Date | Change | By |
|---|---|---|
| 2026-10-16 | Initial tracker created from tester observations; no code changed | QA planning |
| 2026-10-16 | Registration screenshots reviewed; user explicitly fixed Expense Submitter UI as design baseline, documented QA banner meaning and registration polish issues UI-012 to UI-014; E2E-01 form opened only. No app code changed. | QA planning |
| 2026-10-16 | Seven Manager screenshots reviewed: clarified sidebar vs missing top nav, native confirm, preferences save failure, raw IDs; added shared-shell/logout architecture, source audit plan and tests. No application code changed. | QA planning |

### 2026-10-16 — Registration submitted: receipt page and next workflow checkpoint

**Observed route:** `http://127.0.0.1:5582/registration/receipt`.

- **UI-015 — Public registration receipt layout (P2, Open):** User screenshot shows a wide confirmation card anchored high on the page, with substantial unused space below. Improve the visual hierarchy and center the confirmation panel prominently in the available viewport (including responsive/mobile handling) using the Submitter-inspired design tokens. Make the confirmation status, employee ID, download action and next step easy to scan. Do not imply organization approval until Platform Admin explicitly approves it.
- **Workflow checkpoint REG-01 — Completed by tester:** Registration form submitted and UI displayed **“Submitted for organization review”**, with Configuration Manager employee ID `CFG-027943F5`. This is evidence of submission/receipt only, **not** Platform Admin approval or account activation.
- **Next manual checkpoint REG-02 — Pending:** Download/save employee ID receipt privately; open the separate Platform Admin application at `http://127.0.0.1:5175`, sign in with the isolated fictional Platform Super Admin, locate the new pending organization and manually approve it after verifying it is the intended new fictional test tenant. Capture result/status and any defects. Do not create duplicate registration, attempt real billing, or expose credentials.
- **REG-03 — Pending:** After approval, log into Client React as `CFG-027943F5` with the password selected at registration, then inventory/test all Configuration Manager pages and functions, collecting screenshots/defects for each category.

### 2026-10-16 — Platform Admin approval confirmation and Configuration Manager testing

- **ADMIN-UI-001 — Native confirmation in organization review (P2, Reproduced):** Screenshot of Platform Admin at `/organizations/:id` shows Chrome browser-native confirmation after clicking **Save review decision**, asking to approve access. Replace with an accessible, styled FinStack confirmation dialog using the common design system. Cancel must not submit; confirmation must submit once; preserve accurate statement that approval is manual and not legal/domain verification.
- **ADMIN-UI-002 — Review reason wording and evidence (P2, Open):** Screenshot shows entered text “Yes it has verified and done.” for a fictional test organization, although no identity/domain verification was performed. Use truthful reasons such as “Approved for isolated QA; legal identity and domain ownership not independently verified.” Do not silently change stored review records; add helper text if appropriate.
- **REG-02 — Tester reports approved organization and successful new Configuration Manager login:** Treat as user-reported functional success; verify status and employee ownership in the Manager dashboard and subsequent steps. Newly issued Configuration Manager ID: `CFG-027943F5`. No password recorded.
- **QA-CM-01 — Full Configuration Manager feature audit (In progress):** Inventory actual visible sections and test each against this fresh fictional tenant: dashboard/organization data; employee and role provisioning; teams/departments/reporting hierarchy; expense categories/receipt requirement; manual policies; available notification/profile/settings actions; save/reload persistence; permission boundaries. Don't presume a feature exists based on the checklist. Record URL, expected/actual, screenshot, API status and whether the change persists.

### 2026-10-16 — Configuration Manager bulk import: four-role negative validation

- **QA-CM-BULK-01 — Role restriction confirmed (Expected limitation / product decision):** At `/configuration/manage-users`, the bulk import UI explicitly states: **“Bulk roles are limited to Expense Submitter. Use authorized individual provisioning for privileged roles.”** This was verified by the tester screenshot, not inferred from the CSV headers.
- **Test evidence:** The test file `finstack_four_actors_from_uploaded_template.csv` contained one Manager, one Expense Submitter, one Finance Officer and one Compliance Officer. UI import history: **READY — 4 rows, 0 created, 0 failed, 4 invalid**; detail: 4 rows, 0 validated, 4 invalid, 0 processed, 0 successful, 0 failed. **No employee accounts were created by this test.** The per-row error export has not been reviewed, so do not attribute each error specifically to unsupported roles; the Submitter row may also have been invalid because its manager was not yet an existing active Manager.
- **What to verify next:** Download **row errors** and record exact validation messages without secrets. Do not press import/process on the invalid four-role job. Provision Manager, Finance and Compliance through supported individual user creation; create Manager first. For a successful bulk import test, prepare a **Submitter-only** CSV with `managerEmployeeId` pointing to the newly created, active Manager **in this same test organization**; validate first, then process once. Verify import-history counts, pending activation behavior and employee records.
- **Enhancement discussion (not a confirmed bug):** User wants one CSV to create all four actors. Evaluate whether secure privileged-role batch provisioning is a desired feature, subject to audit/RBAC and verification. Do not weaken current role restrictions merely to make a test CSV succeed.
- **Status:** Role restriction observed; four-role negative test completed, positive Submitter import not yet run.

### 2026-10-16 — Three-Submitter bulk import succeeds; activation workflow pending

- **QA-CM-BULK-02 — Positive CSV import (Passed, screenshot-confirmed):** In new test organization `FinStack Workflow Demo 2026`, Manager **Arav Nair**, employee ID **`FWD26-MGR01`**, is `MANAGER` and `Active`. After an earlier validation-only CSV using `FWD-2026-SUB01` as the manager (three invalid; no accounts created), the corrected Submitter-only CSV passed: **COMPLETED — 3 rows / 3 validated / 0 invalid / 3 processed / 3 successful / 0 failed / 3 created**. Manage Users displays **Riya Mehta (`FWD-2026-SUB02`)**, **Kiran Rao (`FWD-2026-SUB03`)**, and **Neha Iyer (`FWD-2026-SUB04`)** as `EXPENSE_SUBMITTER`, **Inactive — Activation required**, with Manager **Arav Nair**. This is expected account lifecycle behavior, not a provisioning failure.
- **UI-016 — Native browser confirmation for activation-link export (P2, Reproduced):** Clicking **Download activation links** shows Chrome native `confirm()` rather than the shared FinStack in-app confirmation modal. Adopt Expense Submitter-based visual and interaction design. Confirmation text must explain sensitive one-user activation URLs; cancel must not download or invalidate links; confirm must not issue multiple batches. Provide consistent non-secret success feedback.
- **QA-CM-ACT-01 — Employee activation end-to-end (Pending):** The UI explicitly states no invitation email is sent; the CSV contains individual sensitive activation links, valid for 48 hours; generating/downloading a replacement set invalidates outstanding links. Privately open one employee's own activation URL in an isolated browser profile, set password, verify only that employee becomes Active and can log in with their employee ID, and verify other two remain Inactive until separately activated. Continue with other two employees. NEVER put activation-link CSV/URLs/tokens/passwords into issues, screenshots, chat or Git.
- **PRODUCT-SEC-01 — Bulk activation delivery usability/security review (P2 enhancement):** Exporting bearer activation URLs to a single CSV can be workable for controlled local QA, but is operationally awkward and sensitive for a production organization, especially at the UI's advertised 10,000-user import limit. Consider authenticated employee invitations using a verified delivery channel, one-time expiring token with rate limits, issuance/reissuance audit trail, per-user reissue controls and secure identity-verification/recovery process. Keep support for explicitly documented secure manual distribution where required; do not claim email or domain verification already exists. Confirm actual backend single-use enforcement, token storage hashing, rate limiting and revocation separately before declaring this secure.
- **Follow-up QA:** After activation, check User Hierarchy, successful employee login and Manager queue visibility, and confirm activation download/refresh do not duplicate accounts; later complete Manager/Finance/Compliance individual user creation and wider CM feature audit. No frontend/backend source changes in this documentation update.

### 2026-10-16 — HIGH PRIORITY: Tenant-aware employee identity and login audit

- **SEC-TENANT-001 — Manually assigned Employee IDs and tenant identity ambiguity (P1 security audit / NOT a confirmed vulnerability):** Configuration Manager can enter human-readable employee IDs when individually creating users and importing Submitters. Tester correctly questions what happens when two separate organizations use the same employee ID and potentially the same password. Current evidence does **not** establish whether global employee ID uniqueness is enforced, whether login uses another tenant discriminator, or whether a cross-tenant access bug exists. Do not claim a breach based on UI alone.
- **Required source audit:** Trace employee create/import validation; database unique indexes/constraints (global vs `(tenantId, employeeId)`); lookup in login/authentication service; credential verification and error behavior for ambiguity; JWT issuance (`sub`, tenant/org identity, role); refresh/session handling; authenticated guards; tenant scoping for all data access, mutations, exports, notifications, files/receipts and admin endpoints. Verify tenant ID comes from server-authenticated context and cannot be overridden by a supplied request field. Confirm IDs are immutable or that changes preserve referential integrity.
- **Acceptable model A:** Login Employee ID uniquely identifies a single account **globally** and server rejects duplicates across organizations (enforced in DB and service), while internal UUID and tenant-scoped authorization are used for access.
- **Acceptable model B:** Employee ID uniqueness is **per tenant**, and login requires an unambiguous validated tenant identifier (organization code or domain plus employee ID), or a distinct globally unique login identifier. No employee ID-only ambiguous lookup is permitted.
- **Test plan (approved integration database only, separate isolated browser contexts):** Confirm two fictional tenants and their own users; attempt same employee ID in both with non-secret fictional test data; record whether duplicate is rejected or correctly resolved with tenant-specific login; independently verify account identity via `/me`, then tenant scoping of lists, details, receipts, notification access, roles and update endpoints. Include same-password test only for disposable fictional accounts and no secrets in logs. Expected: no accidental cross-login or cross-tenant reads/writes, regardless of overlapping human IDs. Test direct API access to another tenant's known fixture record, not real users' data. Use server logs/DB read-only verification for authoritative outcomes.
- **Severity handling:** Audit before external deployment or approval as security-ready. Escalate to **P0/blocker** and stop sensitive workflow testing if cross-tenant unauthorized access is demonstrated; treat duplicate-ID rejection or tenant-disambiguated login as potentially correct behavior, and unclear login error/UX as a separate fix.
- **Status:** Open — security design question reported by tester; source/runtime verification pending. No code changes.

### 2026-10-16 — IMPLEMENTATION DECISION: Secure account identity first, then common UI

**Decision (requested, not implemented):** SEC-TENANT-001 is the first engineering work item. The user wants all new users to receive automatically generated, organization-distinct, collision-resistant login IDs instead of Configuration Managers manually choosing an authentication identifier. Preserve the separately meaningful internal database UUID and organization's own HR/employee reference where necessary. Organization name alone (or a short slug) is **not unique enough** and must never be a security boundary.

**Preferred target model, subject to the source audit:**

1. One immutable, server-generated, **globally unique login identifier** for every tenant user (including Configuration Manager created at registration). Example display pattern `FWD-7K2Q-8DJ4M9`, where `FWD` is an optional sanitized organization-name hint, `7K2Q` is an immutable unique organization code, and `8DJ4M9` is a cryptographically random employee suffix. Choose adequate entropy and collision detection/retry according to actual scale. Do not derive identifiers predictably from sequential record counts alone. The final exact format depends on existing schema lengths and source contracts; avoid a pattern that would break valid records or fail at larger scale.
2. Enforce the **global uniqueness in PostgreSQL** with a database unique constraint and a service-level retry on a genuinely random collision; the frontend must never be the authority for generated IDs.
3. If organizational/payroll `employeeId` must be retained as organization-specific freeform information, **split it from global login ID** and apply tenant-local uniqueness to the payroll identifier. Otherwise migrate existing login IDs carefully without invalidating existing users. Keep UUID as canonical authentication principal and account/tenant ID attached to tokens and sessions.
4. Auth must resolve exactly one globally unique principal, verify its password, then derive tenant ID from the stored authenticated account, not user-supplied identifiers. No fallback such as `findFirst` by an ambiguous employee ID, no fallback to a default tenant, and no credential match across tenants. Never trust organization-prefix parsing to authorize data access.
5. Backward compatibility for existing user accounts, including `CFG-027943F5`, `FWD26-MGR01` and the already imported Submitters, is mandatory. Before schema modifications, inspect actual uniqueness and collision inventory. If a legacy login alias is retained, allow it only where **globally unambiguous**, make collisions fail closed with no cross-account login, and plan transition to primary generated IDs without rewriting unrelated audit/history references.
6. Cover registration-generated Config Manager ID, single-user provisioning, bulk import CSV header and preview, activation CSV, authentication and login help, employee detail/search, user hierarchy, notification/event references and docs. Existing bulk import accepts Submitters only; do not silently broaden privileged roles. For new imports, document whether `employeeId` input is dropped, optional, or becomes an HR reference, with clear validation and a downloadable updated template.
7. Maintain tenant-isolation checks for receipt downloads, notifications, expense approvals, user enumeration, settings, policies, audit/CSV exports and all direct object-reference lookups, not just login. Second fictional tenant should be exercised with overlapping HR IDs and identical disposable passwords, but distinct global login IDs. Cross-tenant reads/writes must return non-disclosing 403/404 and never return another tenant's records.
8. Check existing integration database schema, working test accounts, and local supervisor before changing anything. Migration must be additive and versioned, applied **only** to the approved disposable integration runtime schema after a reversible backup, verified database identity, and a staged test. No reset/dev/db-push, no migration on original `finstack`, no global PG role changes, no migration of empty dedicated e2e schemas without separate approval. No hidden password/JWT/activation-link leaks in logs.

**Order of subsequent work (keep separate reviewed commits):** SEC-TENANT-001 → UI-001/009/014 shared tenant shell and Submitter design tokens with Aditya Manager parity comparison → UI-004/UI-007/UI-016/ADMIN-UI-001 accessible shared confirmation dialogs and logout → UI-005 cross-role stale-data refresh → UI-006/008 shared notifications/profile/settings, with unsupported actions hidden or genuinely disabled → UI-012/013/015 registration and receipt polish → remaining QA and security/privileged dependency checks. Preserve all five actor workflows, role permissions, receipts, and current DB contracts in each batch.

**Acceptance criteria:** Two tenant users can share an organization-local employee reference and even the same disposable test password without identity ambiguity; new server-generated global login IDs are unique; existing test accounts still log in; post-login `/me` and JWT/session reference the correct UUID and tenant; cross-tenant direct object access fails; bulk import and activation succeed; full integration tests pass; source changes are attributed and committed only after review.

**Implementation status:** Planned, no code edited by this tracker update. The local integration worktree is on the user's Windows machine and was not provided in this conversation, so implementing the changes requires access to that worktree (e.g. local Codex or a sanitized source archive uploaded for patching). Do not present planning as completed engineering work.
