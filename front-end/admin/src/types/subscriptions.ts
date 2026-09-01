export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';

export type BillingInterval = 'MONTHLY' | 'YEARLY';

export type SubscriptionSortField =
  | 'createdAt'
  | 'updatedAt'
  | 'currentPeriodEnd'
  | 'status'
  | 'organizationName'
  | 'planName';

export type SortOrder = 'asc' | 'desc';

export interface SubscriptionOrganizationSummary {
  id: string;
  name: string;
  slug?: string | null;
  primaryEmail?: string | null;
  status?: string | null;
  country?: string | null;
  defaultCurrency?: string | null;
  timezone?: string | null;
}

export interface SubscriptionPlanSummary {
  id: string;
  key: string;
  name: string;
  status?: string | null;
  billingInterval?: BillingInterval | null;
  basePrice?: string | null;
  currency?: string | null;
}

export interface SubscriptionBillingSummary {
  openInvoices?: number;
  overdueInvoices?: number;
  failedPayments?: number;
  lastPaymentAt?: string | null;
  nextInvoiceAt?: string | null;
}

export interface SubscriptionHistoryEntry {
  id: string;
  previousStatus?: SubscriptionStatus | null;
  newStatus: SubscriptionStatus;
  eventType: string;
  reason?: string | null;
  fromPlan?: SubscriptionPlanSummary | null;
  toPlan?: SubscriptionPlanSummary | null;
  changedBy?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  createdAt: string;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currency: string;
  priceAtSubscription: string;
  trialStartAt?: string | null;
  trialEndAt?: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string | null;
  suspendedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: SubscriptionOrganizationSummary | null;
  plan?: SubscriptionPlanSummary | null;
  billing?: SubscriptionBillingSummary | null;
  history?: SubscriptionHistoryEntry[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedSubscriptionsResponse {
  items: OrganizationSubscription[];
  meta: PaginationMeta;
}

export interface SubscriptionListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: SubscriptionStatus;
  sortBy?: SubscriptionSortField;
  order?: SortOrder;
}

/**
 * Lifecycle actions that can be performed on a subscription.
 * Each maps to a POST endpoint: `/subscriptions/:id/<action-path>`
 */
export type SubscriptionLifecycleAction =
  | 'activate'
  | 'suspend'
  | 'reactivate'
  | 'cancel'
  | 'renew'
  | 'upgrade'
  | 'downgrade';

/** Input for lifecycle actions that accept an optional reason, or plan details. */
export interface SubscriptionLifecycleInput {
  reason?: string;
  planId?: string;
  billingInterval?: BillingInterval;
}

/** Input for creating a new subscription. */
export interface SubscriptionCreateInput {
  organizationId: string;
  planId: string;
  billingInterval: BillingInterval;
  currency?: string;
  priceAtSubscription?: string;
  startTrial?: boolean;
  trialDays?: number;
}

/** Maps lifecycle actions to their API route segments. */
export const LIFECYCLE_ACTION_PATHS: Record<SubscriptionLifecycleAction, string> = {
  activate: 'activations',
  suspend: 'suspensions',
  reactivate: 'reactivations',
  cancel: 'cancellations',
  renew: 'renewals',
  upgrade: 'upgrades',
  downgrade: 'downgrades',
};

/** Human-readable labels for lifecycle actions. */
export const LIFECYCLE_ACTION_LABELS: Record<SubscriptionLifecycleAction, string> = {
  activate: 'Activate',
  suspend: 'Suspend',
  reactivate: 'Reactivate',
  cancel: 'Cancel',
  renew: 'Renew',
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
};

/** Confirmation messages for sensitive lifecycle actions. */
export const LIFECYCLE_ACTION_CONFIRMATIONS: Record<SubscriptionLifecycleAction, string> = {
  activate: 'Activate this subscription? The organization will gain access to their subscribed plan features.',
  suspend: 'Suspend this subscription? The organization will lose access to plan features until reactivated.',
  reactivate: 'Reactivate this subscription? The organization will regain access to their plan features.',
  cancel: 'Cancel this subscription? This action is permanent and cannot be undone.',
  renew: 'Renew this subscription for another billing period?',
  upgrade: 'Upgrade this subscription? The new plan limits and pricing will take effect.',
  downgrade: 'Downgrade this subscription? The organization may lose access to premium features.',
};

/**
 * Subscription history event types.
 * These match the backend SubscriptionHistory.eventType values.
 */
export type SubscriptionEventType =
  | 'TRIAL_STARTED'
  | 'ACTIVATED'
  | 'UPGRADED'
  | 'DOWNGRADED'
  | 'RENEWED'
  | 'MARKED_EXPIRING'
  | 'GRACE_PERIOD_ENTERED'
  | 'SUSPENDED'
  | 'REACTIVATED'
  | 'CANCELLED';
