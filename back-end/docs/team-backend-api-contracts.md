# Tenant backend API contracts for actor integration

This is a source-based guide to the versioned tenant API currently in `src/tenant`. Paths below include the module prefix `/api/v1/tenant`. Use the DTO/controller source and tests named per section as the authority; the dirty generated `docs/swagger.json` also contains older APIs and must be reviewed separately.

## Wire/authentication conventions

Protected calls send `Authorization: Bearer <accessToken>`. Successful JSON handlers are wrapped by the global interceptor as `{ "success": true, "data": <handler-value> }`; streams such as CSV and receipt downloads are returned directly with content headers. Errors are `{ "success": false, "error": { "code": string, "message": string }, "message": string, "requestId"?: string }`. DTO validation is global: transform, strip is forbidden, and unknown properties are rejected (`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`). Do not send `organizationId`, roles, permission values, or role headers as authority. Tenant and user identity come from JWT plus a live database lookup.

`TenantAuthenticationGuard` verifies bearer token signature/type and reloads the user. It checks token subject and organization against the database, active status, credential setup, organization access status and `credentialVersion`. `TenantRoleGuard` checks the database-derived single role against endpoint metadata. Frontend checks only control navigation/UX. Current tenant role enum values are `CONFIGURATION_MANAGER`, `EXPENSE_SUBMITTER`, `MANAGER`, `FINANCE_OFFICER`, `COMPLIANCE_OFFICER`.

## Login and current session

| Method/path | Access | Request and response | Validation/limits |
|---|---|---|---|
| `POST /auth/login` | Public; 10/minute | Request `{ employeeId, password }`; response data `{ accessToken, expiresIn, user: { id, organizationId, employeeId, firstName, lastName, email, role, status }, organizationId, effectiveRoles, workspace: { key, path } }`. | ID trimmed; 1–80 chars matching alphanumeric start plus `._-`; password 1–200 chars. Existing password strength is not revalidated here. Unknown ID/wrong password/inactive or not-yet-activated employee return a generic credential error. Pending/rejected/suspended organization cannot authenticate. No refresh-token endpoint for tenant sessions. Default token TTL is configured to 8 hours. |
| `GET /auth/me` | Any active tenant JWT | Response data is current auth context `{ user, organizationId, effectiveRoles, workspace }`. | Revalidates database state on each call; clients must not treat cached user/role as authority. |

Password change and session revocation increment `credentialVersion`; all prior tenant JWTs are rejected on the next request. That field is a server-side revocation counter, not a frontend claim to edit.

## Provisioning and activation

| Method/path | Role | Contract |
|---|---|---|
| `GET /configuration/users` | Any authenticated tenant role in controller | Legacy complete user list response. Prefer the paginated endpoint for screens. |
| `GET /configuration/employees?page=1&pageSize=50&search=&department=&role=&status=` | Configuration Manager | Returns `{ items, page, pageSize, total, totalPages, hasPreviousPage, hasNextPage }`; each item is a safe user projection with employee ID, names, email, role/status, department and reporting-manager summary. Page size 1–100. Filters are validated. |
| `POST /configuration/users` | Configuration Manager | `{ employeeId, firstName, lastName, email, initialPassword, role, department?, managerId? }`. Returns safe employee DTO; no password hash. Names/ID/email are bounded and normalized, role is enum, optional manager must be active and same tenant. Direct provisioning creates a normal active account with the provided initial password; it is distinct from import activation. |
| `PATCH /configuration/users/:id` | Configuration Manager | Partial `{ firstName?, lastName?, email?, role?, department? }`; response is updated safe user DTO. Does not change the user ID/organization. Unique employee/email constraints and last-active-Configuration-Manager protection apply. |
| `PATCH /configuration/users/:id/status` | Configuration Manager | `{ status: "ACTIVE" | "INACTIVE" }`; updates audited. Cannot remove the last active Configuration Manager. |
| `PATCH /configuration/users/:id/reporting` | Configuration Manager | `{ managerId: UUID|null, expectedManagerId?: UUID|null }`; response updated relation. Uses optimistic expected-manager check and hierarchy lock/validation to prevent cross-tenant manager IDs and reporting cycles. |
| `GET /configuration/hierarchy?view=ROOTS|REPORTS|DEPARTMENT|SEARCH|CANDIDATES&managerId=&page=&pageSize=&search=&department=` | Configuration Manager | Paginated hierarchy result; specific views return root/reporting/candidate projections from the authenticated organization. See `ListHierarchyDto`; manager IDs are UUIDs. |
| `GET /configuration/hierarchy/branches?...` | Configuration Manager | Paginated branch/subtree result; same tenant and query validation. |
| `GET /configuration/hierarchy/employees/:id` | Configuration Manager | One tenant-scoped employee hierarchy detail or 404. |
| `GET /configuration/roles` | Any authenticated role | Data-driven current tenant role catalog/capability summaries and holder counts. It is not Platform RBAC and does not grant role-definition mutation. |

**CSV import:** all routes below require Configuration Manager JWT and are scoped to its organization. Upload is rate-limited to 20/minute, one CSV file up to 10 MiB and a UUID `Idempotency-Key`; template columns are available from `GET /configuration/employee-imports/template`. `POST /configuration/employee-imports` is multipart field `file`, and returns a job/preview summary. `GET /configuration/employee-imports` lists jobs; `GET /:id` returns status and counters; `GET /:id/rows?page=1` returns a bounded page of parsed rows/errors; `POST /:id/confirm` explicitly provisions only accepted rows; `GET /:id/errors` streams CSV; `POST /:id/activation-links` issues expiring single-use setup tokens for eligible imported users. Import jobs, rows, errors and activation issuance are tenant-scoped and audited. CSV is not an “activate all” shortcut.

`POST /employee-activation` is public and rate-limited to 10/minute. Body `{ employeeId, token, password }`; token is 64 lowercase hex characters, password 8–200 chars. The token is stored hashed, expires after 48 hours, activates one imported account once, and sets its credential. Activation-link responses contain secret tokens: never put a real response, URL or fixture into docs/issues/chat.

Relevant tests: `employee-import.e2e-spec.ts`, `employee-login.e2e-spec.ts`, `employee-pagination.e2e-spec.ts`, `tenant-hierarchy.e2e-spec.ts`, `tenant-configuration.service.spec.ts`, `tenant-user-validation.spec.ts`, `employee-import-validation.spec.ts`.

## Categories, policies and configuration templates

All paths below are under `/expenses` in the API prefix, so the full path begins `/api/v1/tenant/expenses`.

| Method/path | Role | Request/response and validation |
|---|---|---|
| `GET /categories`, `GET /policies` | All five tenant roles | Active tenant configuration for actor use. |
| `GET /configuration/categories`, `GET /configuration/policies` | Configuration Manager | Management projections including inactive items and lifecycle metadata. |
| `POST /configuration/categories` | Configuration Manager | `{ name, description?, limit?, currency?, status?, requiresReceipt?, color? }`; name ≤100 nonblank, description ≤1000, cap 0..9,999,999,999.99 with two decimals, currency 3 alpha chars, status Active/Inactive, color `#RRGGBB`. Returns saved category. |
| `PATCH /configuration/categories/:id`, `DELETE /configuration/categories/:id` | Configuration Manager | Partial editable DTO or delete. IDs UUID; foreign-tenant IDs are not addressable. Referenced categories cannot be destructively removed; deactivate when referenced. Responses are saved record or deletion result. |
| `POST /configuration/policies` | Configuration Manager | `{ name, categoryId, maxAmount, currency?, approval?, status?, description?, requiresApproval?, receiptRequired? }`; category UUID must be active/same tenant; max amount uses exact decimal validator (no exponent, no excess scale/range); currency/status bounded. |
| `PATCH /configuration/policies/:id`, `DELETE /configuration/policies/:id` | Configuration Manager | Partial update/delete under tenant and reference rules; result is saved policy or delete result. |
| `GET /configuration/templates` | Configuration Manager | Versioned template catalog; does not create records. |
| `POST /configuration/categories/activate-templates`, `POST /configuration/policies/activate-templates` | Configuration Manager | Explicit selected stable keys plus catalog version/selection fields validated by the DTO. Transactional activation preserves custom matching record IDs and user edits; category/policy changes are audited. |

Relevant tests: `configuration-persistence.e2e-spec.ts`, `configuration-templates.e2e-spec.ts`, `tenant-expenses.service.spec.ts`, `policy-amount.spec.ts`. These verify role denial, duplicate/invalid DTO handling, tenant isolation, CRUD persistence across app restart, Decimal policy caps, references, template transactions, and audit lifecycle.

## Expense submitter and receipt API

All paths use `/api/v1/tenant/expenses`.

| Method/path | Role | Request/response and key behavior |
|---|---|---|
| `POST /` | Expense Submitter | Multipart: `receipt` optional file plus body fields `amount`, `categoryId`, `merchant`, ISO `date`, optional currency/notes/payment method. Backend derives employee, org, manager, policy and status; clients must not select tenant/owner or send trusted risk fields. Response is saved expense projection. Service stores money as Prisma Decimal, but the current DTO coerces amount through JavaScript `number`; client should keep decimal input as text and this contract merits precision review before broad actor use. |
| `GET /mine` | Expense Submitter | Authenticated user's own expense list; response is expense projections with current status/category/approval data. |
| `PATCH /:id`, `DELETE /:id` | Expense Submitter | Own-expense draft/edit/delete only when lifecycle permits; body uses partial create fields. Service checks both organization and owner/status. |
| `GET /:id/receipt` | Submitter, Manager, Finance, Compliance, Configuration Manager | Tenant-authorized stream with stored MIME type and safe content disposition. No client-chosen storage path. |

Create DTO: `amount` numeric and ≥0.01, nonempty `categoryId`/merchant, ISO date; optional currency, notes, payment method and receipt filename. Backend verifies active category and applicable policy, ownership and manager assignment. Do not trust client `extractionConfidence`, `flag` or `riskScore` fields even though DTO compatibility contains them; server logic is authoritative.

## Manager review, Finance processing and Compliance

These endpoints exist in `TenantExpensesController`/`TenantExpensesService` and are protected by the named backend role plus same-tenant/same-assignment checks. Success responses are current expense/workspace projections, unless a listed action returns a result object. `note` is optional string for decision actions.

| Method/path suffix | Required role | Body/meaning |
|---|---|---|
| `GET /manager/queue`, `GET /manager/history`, `GET /manager/finance-officers` | Manager | Direct-report queue/history and eligible finance officer list, derived from tenant hierarchy. |
| `POST /:id/manager/approve` | Manager | `{ financeOfficerId, note? }`; only active same-tenant Finance Officer may be assigned. |
| `POST /:id/manager/return`, `/manager/reject`, `/manager/escalate` | Manager | `{ note? }`; writes state/history/audit and authorized notification where implemented. |
| `GET /finance/queue`, `GET /finance/workspace` | Finance Officer | Lists only authorized tenant work/assigned payments. |
| `POST /:id/finance/approve`, `/finance/reject`, `/finance/request-info`, `/finance/flag` | Finance Officer | `{ note? }`; backend enforces state and finance assignment. |
| `POST /finance/payment-releases` | Finance Officer | `{ expenseIds: string[] }`, nonempty; releases only eligible expenses assigned to the authenticated officer. Creates internal tenant payment/transaction records; it does **not** send a bank transfer. |
| `POST /finance/transactions/:id/process`, `/fail`, `/reconcile` | Finance Officer | No body; state transitions on tenant payment/reconciliation records. These are internal workflow actions, not evidence of live bank integration. |
| `GET /compliance/queue` | Compliance Officer | Tenant compliance queue. |
| `POST /:id/compliance/approve`, `/compliance/reject`, `/compliance/corrective-action` | Compliance Officer | `{ note? }`; updates review state/history and scoped audit/notification. |

**Integration status:** real backend endpoints, tenant scoping, role guards and service tests exist. This Config Manager branch does not provide a finished React Submitter/Manager/Finance/Compliance UI suite or complete browser acceptance for those roles. Actor React pages from older branches must be checked against these DTOs and lifecycle rules; do not copy their old JSON-store assumptions or claim a provider/bank action exists. Current tests include `tenant-expenses.service.spec.ts`, `receipt-upload.e2e-spec.ts`, `tenant-notifications.e2e-spec.ts`; the named suite coverage is not equivalent to every actor UI workflow.

## Notifications and audit

| Method/path | Role | Contract |
|---|---|---|
| `GET /expenses/notifications/page?page=1&pageSize=50&state=all|read|unread&type=info|success|warning|danger` | Any tenant role | `{ items, total, unreadCount, page, pageSize, totalPages }`; records belong to authenticated recipient and org. |
| `GET /expenses/notifications/unread-count` | Any tenant role | Current recipient unread count. |
| `PATCH /expenses/notifications/:id/read`, `PATCH /:id/unread`, `POST /read-all`, `DELETE /:id` | Tenant role; record recipient-checked | Mark/read, restore unread, mark all read or dismiss one notification. Dismissed items are not resurrected by read updates. |
| `GET /configuration/audit-logs?page=1&pageSize=25&search=&eventCode=&targetType=&actorUserId=&outcome=&from=&to=` | Configuration Manager | `{ items, total, page, pageSize, totalPages }`. Each list item contains safe actor/event/target/time/outcome summary. Filters are tenant-bound; page size ≤100 and page/window is bounded. |
| `GET /configuration/audit-logs/:id` | Configuration Manager | Full tenant-owned audit record including safe change details or 404. |
| `GET /configuration/audit-logs/export?...same filters` | Configuration Manager | CSV; maximum 10,000 rows/10 MiB; formula cells are neutralized. |

Audit events are appended with actor snapshots from request context in the same transaction as many important mutations. Notification producer events are persisted/deduplicated using tenant+recipient+event key and an organization/recipient composite FK. Event set is feature-specific, not a universal notification bus. Relevant tests: `tenant-audit.e2e-spec.ts`, `tenant-notifications.e2e-spec.ts`, `tenant-audit.spec.ts`.

## Organization settings, profile and SaaS billing

All settings and subscription routes require Configuration Manager. Organization ID is always from authenticated context.

| Method/path | Request/response |
|---|---|
| `GET /configuration/settings/organization` | Org summary plus `companySize`, `fiscalYearStart`, `defaultPaymentMethod`; registered name/email/address/currency/tax identity are returned as managed/read-only fields. |
| `PATCH /configuration/settings/organization` | `{ companySize, fiscalYearStart, defaultPaymentMethod }`; only those whitelisted fields are accepted and are stored in `Organization.metadata.tenantSettings`; audited. |
| `GET /configuration/settings/organization-export` | Tenant configuration/users/categories/policies/audit snapshot; each collection ≤10,000; audit CSV is separate. It does not export expense, subscription or billing records. |
| `GET /configuration/settings/profile`, `PATCH /configuration/settings/profile` | Own safe profile DTO; update body `{ fullName, department, phone?, location?, avatarColor? }`. ID, org, employee ID, email and role are not writable. Successful update is audited. |
| `POST /configuration/settings/password-changes` | `{ currentPassword, newPassword, confirmPassword }`; strong 12–128 chars (upper/lower/digit/symbol), current password verified, different/matching new values, five attempts/minute; Argon2id hash and all-session revocation. Response `{ signInRequired: true }`. |
| `POST /configuration/settings/session-revocations` | Empty body; increments credential version, audit, response `{ signInRequired: true }`. |
| `GET /subscription`, `/subscription/invoices`, `/subscription/payments` | Tenant Configuration Manager; returns authoritative subscription/invoice/payment projections. |
| `POST /subscription/plan-changes` | Existing `ChangeSubscriptionPlanDto`; guarded server-side lifecycle/payment rules. Plan changes are not client-selected status edits. |
| `POST /subscription/cancellations` | Existing `CancelSubscriptionDto`; explicit cancellation lifecycle validation/audit. Do not call on shared QA records. |
| `POST /billing/invoices/:invoiceId/payment-orders`, `POST /billing/razorpay/verify` | Razorpay-backed order/verification contracts are present. Only test against provider sandbox configuration; no live order/charge is implied by local UI. |

Relevant tests: `tenant-settings.e2e-spec.ts` (nine cases: authorization, tenant isolation, whitelist, audit, password/session revocation and throttling), `commercial-foundation.e2e-spec.ts`, `tenant-auth.service.spec.ts`.

## Onboarding and registration, for client entry pages

Public endpoints under `/api/v1/tenant`: `GET /onboarding/environment`, `GET /onboarding/plans`, `POST /onboarding/quotes` (`{planId, employeeCount, featureIds?}`), and `POST /registrations/organizations` (validated registration DTO, five/minute). Registration is a request/review lifecycle, not immediate accepted legal verification; public `.test` email support is only opt-in local manual QA. Do not claim email/domain/government verification is configured. Admin review is a distinct Control Plane action.

## Legacy endpoint warning

`src/modules/{users,expenses,categories,policies,audit,notifications,transactions}` also exposes older root routes such as `/users`, `/expenses`, `/categories`, `/policies`, `/audit`, `/notifications`, `/transactions`. Their middleware/guard contract accepts legacy role context/header and is not the versioned tenant bearer contract above; they coexist to preserve Client V1 compatibility. Do not use a frontend-supplied `role` header as authorization, do not infer tenant isolation from those old routes, and do not port old mock/JSON-store assumptions into the versioned actor pages. Confirm a legacy route’s backend protection before using it; prefer the explicit `/api/v1/tenant/*` route where one exists.
