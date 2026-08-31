import type {
  OrganizationSubscription,
  PaginatedSubscriptionsResponse,
  SubscriptionCreateInput,
  SubscriptionLifecycleAction,
  SubscriptionLifecycleInput,
  SubscriptionListQuery,
} from '../../types/subscriptions';
import { LIFECYCLE_ACTION_PATHS } from '../../types/subscriptions';
import { apiRequest } from './client';

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined) return;
  const normalized = String(value).trim();
  if (normalized.length > 0) {
    params.set(key, normalized);
  }
}

export function getPlatformSubscriptions(
  query: SubscriptionListQuery = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  appendQuery(params, 'page', query.page);
  appendQuery(params, 'limit', query.limit);
  appendQuery(params, 'search', query.search);
  appendQuery(params, 'status', query.status);
  appendQuery(params, 'sortBy', query.sortBy);
  appendQuery(params, 'order', query.order);

  const queryString = params.toString();
  return apiRequest<PaginatedSubscriptionsResponse>(
    `/subscriptions${queryString ? `?${queryString}` : ''}`,
    { signal },
  );
}

export function getPlatformSubscription(
  subscriptionId: string,
  signal?: AbortSignal,
) {
  return apiRequest<OrganizationSubscription>(
    `/subscriptions/${subscriptionId}`,
    { signal },
  );
}

/**
 * Create a new subscription (assign a plan to an organization).
 */
export function createPlatformSubscription(
  input: SubscriptionCreateInput,
) {
  return apiRequest<OrganizationSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Execute a lifecycle action on a subscription.
 *
 * Maps to: POST /api/v1/platform/subscriptions/:id/<action-path>
 *
 * Actions: activate, suspend, reactivate, cancel, renew
 */
export function performSubscriptionLifecycleAction(
  subscriptionId: string,
  action: SubscriptionLifecycleAction,
  input?: SubscriptionLifecycleInput,
) {
  const path = LIFECYCLE_ACTION_PATHS[action];
  return apiRequest<OrganizationSubscription>(
    `/subscriptions/${subscriptionId}/${path}`,
    {
      method: 'POST',
      body: input ? JSON.stringify(input) : undefined,
    },
  );
}

/**
 * Update a subscription (plan change / upgrade / downgrade).
 */
export function updatePlatformSubscription(
  subscriptionId: string,
  data: { planId?: string; priceAtSubscription?: string; reason?: string },
) {
  return apiRequest<OrganizationSubscription>(
    `/subscriptions/${subscriptionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}
