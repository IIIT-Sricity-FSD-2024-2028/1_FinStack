# React actor integration guide

This guide describes the current SPA and a safe path for adding existing actor pages. It does not replace or rewrite any actor implementation. The shared Config Manager feature folder and its maintainer-owned route/forms must remain intact.

## Current application structure

- HTML entry: `front-end/index.html` contains `#finstack-client-root` and loads the built React bundle under `/js/react/client/`.
- React bootstrap: `front-end/client-react/src/main.jsx` installs the tenant session compatibility runtime, imports CSS and mounts `ClientApp`.
- Router: `front-end/client-react/src/app/ClientApp.jsx` owns `BrowserRouter`, public routes, legacy URL redirects and protected route registration.
- Auth: `front-end/client-react/src/auth/AuthContext.tsx` checks the access token with `/api/v1/tenant/auth/me`, exposes `useAuth()`, login/logout and verification/error state.
- Protected route: the current `ProtectedRoute` is Configuration Manager only (`CONFIGURATION_MANAGER`). It redirects non-CM users to `/forbidden`. It is UX protection only; backend role guards remain authoritative.
- Shared shell: `ConfigurationManagerLayout.tsx` currently owns CM sidebar/header/mobile drawer, settings nav, profile menu, help and sign-out. `WorkspaceShell.jsx` exists as an incremental legacy-shell bridge. There is not yet a generic multi-actor workspace shell or role-aware common sidebar contract.
- Feature areas: actor pages live in `front-end/client-react/src/features/<actor>/` with actor-owned APIs/adapters/hooks/components/styles. Config Manager stays in `features/config-manager/`; shared entry/help flows are in `features/shared/`.

## Adding an actor page without overwriting shared work

1. Keep the existing actor page and flow; adapt its data boundary first. Place the ported page in its actor-owned feature folder and build a narrow adapter around the versioned API paths in `team-backend-api-contracts.md`.
2. Use `useAuth()` for the authenticated server-loaded user/session. Do not parse role headers or accept `organizationId` from query/form/local storage as authority. Backend derives tenant identity from the JWT.
3. Add the actor route through a focused shared-router change reviewed by the SPA owner. Current `ProtectedRoute` is hard-coded for Config Manager; do not make a speculative edit to it or remove its existing CM gate. An actor PR must propose an explicit allowed-role route wrapper/prop and tests before registration. Until that shared change is approved, keep actor route experiments in the actor branch.
4. Keep sidebar/navigation changes in an agreed shared-shell PR. Do not replace `ConfigurationManagerLayout`, `workspacePages`, or Settings submenu to make another actor fit. Decide whether to reuse a generic workspace shell, supply an actor-owned shell beneath a shared auth boundary, or keep the route outside the SPA during a transitional PR.
5. Keep route-specific code/data in actor folders; do not import Config Manager pages into actor pages or edit its API adapters to suit old actor shapes. Agree cross-actor contracts first when a shared endpoint/type changes.
6. Add loading, empty, error/retry and permission-denied states to every API-backed route. Verify direct URL, refresh, back/forward, login return target, logout and role denial in a real browser.

Example proposal for a future route PR (the `ManagerRoute` wrapper is illustrative and does not exist yet):

```tsx
// actor-owned route wrapper proposal; register only after the SPA owner approves
<Route element={<ManagerRoute />}>
  <Route path="manager/expenses" element={<ManagerExpensePage />} />
</Route>
```

`ManagerRoute` must read `useAuth()` and the server-verified `user.role`, show loading/error states, redirect unauthorized users, and render `<Outlet />`. It cannot replace backend authorization. The reviewer should check that the change preserves current CM routes and never writes a frontend role/tenant header.

## AuthContext/API conventions

`useAuth()` provides `{ user, status, error, retry, login, logout }`. The login takes employee ID/password and calls the public `/api/v1/tenant/auth/login`, then stores only server-issued session information. On boot/focus it requests `/api/v1/tenant/auth/me`. `session.ts` exports `request(path, options)`; it sends `Authorization: Bearer ...`, unwraps `data`, throws `ApiError(status, code)`, clears session on authenticated 401, and preserves session on 403. Do not catch 403 by signing the user out. Avoid role headers; use AbortSignal for superseded/unmounted requests.

Existing Config Manager adapters use `clientApi`/`tenantSession`, which delegate to the same installed runtime and preserve old in-scope adapters. New actor APIs should use a clear typed service/adapter, not scattered raw `fetch` calls. JSON request body is `options.body`; use exact string amounts for Decimal-valued fields where supported. The standard backend response is `{success,data}`; file downloads and other `StreamableFile` responses are binary and should be handled as such.

## Reusable UI and CSS ownership

Search before adding components. Available shared UI:

| Need | Existing component |
|---|---|
| Dialogs/confirmations | `components/Modal.jsx`, `components/CrudPrimitives.jsx` (`CrudModal`, `ConfirmDialog`) |
| Status/toggle | `StatusBadge`, `ToggleSwitch` |
| Loading/empty/error | `components/OperationalStates.jsx` |
| Table/paging | `components/Table.jsx`, `components/Pagination.jsx` |
| Icons/toasts | `components/Icon.jsx`, `components/ToastHost.jsx` (`notify`) |
| Render failure containment | `components/ErrorBoundary.tsx` |

There is no separate shared button/input primitive library with every native control wrapped; extend a common component only when a cross-actor requirement is agreed. Do not create actor duplicates solely to change color/size.

CSS loads legacy `css/base.css`, `components.css`, `layout.css` via `styles/legacy.css`. `styles/spa.css` is client-SPA scoped; page-specific CM and employee CSS is maintained near its feature. Actor CSS should use a feature root class (for example `.finance-workspace`) and avoid unscoped `body`, `:root`, element rules or overrides of the Config Manager shell. Discuss design-token/global CSS changes with the shared owner. Do not copy the old actor stylesheet wholesale into this root without checking selector collisions and mobile states.

## API/data lifecycle rules

- Backend role/tenant checks are the security boundary. Sidebar hiding is not authorization.
- Use explicit page loading, empty and error/retry states. Do not substitute in-memory/JSON mocks for a PostgreSQL-backed API.
- Preserve current API DTO/field bounds; unknown fields are rejected. Keep source-of-truth transformations in adapters, not across arbitrary views.
- On errors distinguish unauthenticated 401 from unauthorized 403. A 401 clears auth; a 403 should show a permission explanation and keep the current identity.
- Sensitive transitions require a confirmation UI and backend audit where implemented. Never replay subscription cancellation, expense payment release, or irreversible action against shared QA just to test navigation.

## Shared file ownership proposal

| Path/group | Owner |
|---|---|
| `features/config-manager/**`, its API adapters/tests, CM settings/sidebar flows | Configuration Manager owner |
| `features/<submitter|manager|finance|compliance>/**` | Corresponding actor maintainer |
| `ClientApp.jsx`, `AuthContext.tsx`, `services/session.ts`, route role-wrapper, package/build config | Shared SPA maintainer; actor PRs propose reviewed changes |
| Common shell/header/sidebar and common `components/**` | Shared UI owner with impacted actor reviewers |
| `styles/legacy.css`, global legacy `css/base.css`, `components.css`, `layout.css` | Shared CSS owner; actor styles remain scoped |
| `src/tenant/**`, Prisma schema/migrations, API DTOs | Backend/domain owner plus impacted API consumer reviews |

Only React integration documentation was changed for this handoff. No actor React page was added or rewritten.
