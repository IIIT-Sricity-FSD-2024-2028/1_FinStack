import { apiRequest } from './client';
import type {
  Invoice,
  PaginatedCommercialResult,
  Subscription,
  SubscriptionHistory,
} from '../../types/commercial';

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const platformSubscriptionsApi = {
  list: (query: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    organizationId?: string;
    planId?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  } = {}) =>
    apiRequest<PaginatedCommercialResult<Subscription>>(
      `/subscriptions${queryString(query)}`,
    ),

  get: (id: string) => apiRequest<Subscription>(`/subscriptions/${id}`),

  history: (id: string, query: { page?: number; pageSize?: number } = {}) =>
    apiRequest<PaginatedCommercialResult<SubscriptionHistory>>(
      `/subscriptions/${id}/history${queryString(query)}`,
    ),

  assign: (organizationId: string, planId: string) =>
    apiRequest<{ subscription: Subscription; invoice: Invoice }>(
      '/subscriptions',
      { method: 'POST', body: JSON.stringify({ organizationId, planId }) },
    ),

  changePlan: (id: string, planId: string, reason?: string) =>
    apiRequest<{ invoice: Invoice }>(
      `/subscriptions/${id}/plan-changes`,
      { method: 'POST', body: JSON.stringify({ planId, reason: reason || undefined }) },
    ),

  cancel: (id: string, reason?: string) =>
    apiRequest<Subscription>(`/subscriptions/${id}/cancellations`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || undefined }),
    }),

  reactivate: (id: string) =>
    apiRequest<Subscription>(`/subscriptions/${id}/reactivations`, { method: 'POST' }),
};
