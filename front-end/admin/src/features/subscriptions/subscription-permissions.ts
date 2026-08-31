/**
 * Subscription permission key constants.
 *
 * Aligned with the backend seeded permissions (prisma/seed.ts):
 * - `subscription.subscription.view`  — view subscription list / detail
 * - `subscription.subscription.manage` — all lifecycle mutations
 *
 * The Product Catalog branch uses `subscription.plan.*` / `subscription.feature.*`
 * for plan/feature management which is separate from subscription lifecycle.
 */

/** View subscription list and detail pages. */
export const SUBSCRIPTION_VIEW = 'subscription.subscription.view';

/** All lifecycle mutations (activate, suspend, cancel, upgrade, etc.). */
export const SUBSCRIPTION_MANAGE = 'subscription.subscription.manage';
