# Subscription Frontend Structure

This directory contains the Admin Subscription frontend slice for the FinStack
control plane. It is API-backed and does not include mocked runtime data.

## Routes

The routes are registered in `src/app/router.tsx`:

- `/subscriptions` renders all subscriptions.
- `/subscriptions/trials` renders subscriptions filtered to `TRIAL`.
- `/subscriptions/expiring` renders subscriptions filtered to `EXPIRING`.
- `/subscriptions/suspended` renders subscriptions filtered to `SUSPENDED`.
- `/subscriptions/:subscriptionId` renders the subscription detail page.

The sidebar has not been changed. Open these URLs directly unless navigation is
added later in `AdminLayout.tsx`.

## Files

- `SubscriptionListPage.tsx`
  - Shared list implementation for all list routes.
  - Handles search, status filtering, sorting, pagination, loading, empty, error,
    and success states.
  - Uses `platform.subscription.view` for page-level UX gating.
  - Links each row to `/subscriptions/:subscriptionId`.

- `SubscriptionDetailPage.tsx`
  - Detail screen for one organization subscription.
  - Shows subscription, organization, plan, billing, current status, and history
    when the API provides those fields.
  - Shows disabled lifecycle controls only for users with the corresponding
    permission.
  - Does not call lifecycle mutation APIs because the backend endpoint is not
    present in this branch.

- `useSubscriptions.ts`
  - Data hooks for list and detail requests.
  - Uses abort controllers and the existing `apiRequest` auth/refresh behavior.
  - Converts 404 detail responses into a not-found UI state.

- `subscription-format.ts`
  - Small formatting helpers for display dates and enum labels.

- `subscriptions.css`
  - Feature-local CSS only.
  - Uses existing global design tokens from `src/styles/tokens.css`.
  - Keeps subscription styling out of `globals.css`.

- `SubscriptionListPage.test.tsx`
  - Tests list rendering from API data.
  - Tests query parameters for search/filter/sort.
  - Tests fixed-status pages.
  - Tests API error rendering.

## Shared Files Touched

- `src/app/router.tsx`
  - Imports the subscription pages.
  - Registers the five subscription routes.

No backend files, Organization files, Product Catalog/Plan files, Client Portal
files, `AdminLayout.tsx`, or `globals.css` were modified.

## Types And API Service

Subscription types live in:

- `src/types/subscriptions.ts`

The centralized API service lives in:

- `src/services/api/platform-subscriptions.ts`

Expected backend endpoints:

- `GET /api/v1/platform/subscriptions?page=&limit=&search=&status=&sortBy=&order=`
- `GET /api/v1/platform/subscriptions/:id`

The service expects the existing platform API response wrapper:

```json
{
  "success": true,
  "data": {}
}
```

`apiRequest` unwraps `data`, so page code receives the typed payload directly.

## Permissions

Use the existing repository permission keys:

- `platform.subscription.view`
- `platform.subscription.create`
- `platform.subscription.update`
- `platform.subscription.activate`
- `platform.subscription.suspend`
- `platform.subscription.reactivate`
- `platform.subscription.cancel`

The docs mention `subscription.subscription.view/manage`, but the current backend
seed uses `platform.subscription.*`. The frontend follows the repository keys.

## Current Backend Gap

This branch currently does not contain the subscription backend Prisma models,
NestJS module, or `/api/v1/platform/subscriptions` routes. Until those land, the
frontend pages will route correctly but show API error states instead of data.

Lifecycle mutations are intentionally disabled in the UI until a real backend
endpoint exists.

## Checks

From `front-end/admin`:

```bash
npm run typecheck
npm run lint
npm run test -- src/features/subscriptions/SubscriptionListPage.test.tsx
npm run build
```

Known unrelated issue:

```text
npm run test
```

currently fails in `src/services/auth/session.test.ts` because that test expects
`localStorage.length`, but `localStorage` is undefined in the current test
environment.
