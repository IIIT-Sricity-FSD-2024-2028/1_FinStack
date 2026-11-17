# FIN-81 — Finance Officer Redux Toolkit migration

## Scope and source audit

The tenant application is `front-end/client-react`; Platform Admin is a separate application. Finance URLs, including retired HTML URLs, enter the tenant React router. The finance backend exposes an officer-scoped workspace containing assigned expenses across lifecycle states and their internal payment transactions. There is no separate reimbursement or finance expense-detail endpoint: reimbursement uses payment release and transaction actions; details resolve from the workspace records.

Reviewed the finance React screens, legacy finance routing/adapters, shared JWT/session transport, live refresh and cross-tab bridge, shared application shell, finance backend controller/service contracts, payment validation, and existing unit/browser coverage. The migration preserves the backend contracts and financial workflow states.

## Story coverage

| Item | Implementation |
| --- | --- |
| 3.1 Dashboard queries | `financeWorkspace` and `financeCategories` RTK Query endpoints supply dashboard metrics from the existing server records. |
| 3.2 Listing, filtering, details | Dashboard, review queue, payments and transactions share the workspace cache. Redux stores review search, stage, category, sort and page; filter changes reset pagination. Details resolve the current expense from that cache, including while a modal is open. |
| 3.3 Verification and financial review | Approve, reject, request information and compliance flag use RTK Query mutations with `.unwrap()`, existing confirmation/note validation, pending state and server error handling. |
| 3.4 Reimbursements and financial data | Payment release, processing, failure and reconciliation use RTK Query mutations. Decimal amounts, currency grouping, the 100-claim batch limit and bank-evidence conflicts retain their existing behavior. Payment selection is revalidated against current eligibility. |
| 3.5 Cache invalidation | Successful financial writes invalidate workspace, queue and notifications. Read mutations invalidate notification pages and the shared unread badge. Cross-actor update signals invalidate finance data; focus, reconnect, navigation and visible-tab polling revalidate it. |
| 3.6 Testing | Real Redux store/API middleware tests exercise deduplication, all mutations, filtered notification keys, failures, refresh recovery, session cleanup and late responses. Browser tests exercise the actual screens using intercepted fictional APIs. |

## State ownership

- `src/app/store.js` configures Redux, installs RTK Query middleware/listeners, bridges existing live-update events, and aborts pending requests and resets all finance state on `finstack:session`.
- `src/features/finance/financeApiSlice.js` owns server data and mutation state. Its custom base query reuses `financeApi.js`, keeping the existing bearer transport, response unwrapping, API base URL, 401 handling and cross-tab announcements. JSON requests receive RTK Query's abort signal. Error objects retain status, message and the bank-evidence code without storing Error instances.
- `src/features/finance/financeSlice.js` owns serializable view filters and pagination. Credentials and binary receipts are not stored in Redux or persisted to browser storage.
- `useFinanceWorkspace.js` supplies the shared query state. Initial failures show Retry; background failures retain the last data and mounted dialogs. Open expense details reuse that workspace cache without starting another workspace request.
- Receipt Blobs and object URLs remain local to the detail modal and are revoked on cleanup. The existing authenticated receipt adapter remains responsible for binary retrieval. Profile/settings continue to use the existing authentication context and supported capabilities.

## Verification

Verified: 161 unit tests passed; lint, TypeScript checking and the production build passed. The complete Finance/Compliance browser suite passed 59 checks against the production preview, including the new Redux regression scenarios.

Additional local QA smoke checks verified real database authentication and dashboard routing for all five tenant roles, plus Finance workspace, category and notification reads. The requester subsequently reported manual workflow checks complete. The Finance sidebar label is shortened to `Transactions`; the page heading remains `Transactions & Reconciliation`, and the label fits expanded, collapsed and mobile navigation.

From `front-end/client-react`:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Start the development server on port 5583, then run the browser harness with the local Playwright module and Chromium paths if they are not installed at their defaults:

```sh
npm run dev -- --port 5583
FINSTACK_PLAYWRIGHT_MODULE=/path/to/playwright \
FINSTACK_CHROMIUM_PATH=/path/to/chromium \
node tests/financeCompliance.browser.cjs
```

The browser fixture covers deep links/reloads, legacy redirects, role boundaries, confirmation and note validation, decisions, receipts, release limits and currency totals, transaction conflicts, notifications, retries and mobile layouts. Additional Redux regression cases cover filter/page state across navigation, open details updating after external changes, preserving dialogs during refresh errors, removing newly ineligible payment selections, and notification pagination/badge invalidation.

Set `FINSTACK_FINANCE_REDUX_ONLY=1` to run only the new Redux browser scenarios. To verify built assets, use `npm run preview -- --port 5583` instead of the development server.

The automated browser suite uses fictional intercepted responses and does not establish live financial mutation persistence or bank settlement. The real database smoke checks above cover login, routing and reads. Local QA configuration, credentials, account setup and database backups are excluded from the source change; no backend contracts or database migration files are changed by FIN-81.
