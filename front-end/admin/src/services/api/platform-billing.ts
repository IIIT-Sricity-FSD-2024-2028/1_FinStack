import type {
  BillingListQuery,
  PaginatedInvoices,
  PaginatedPayments,
  RevenueSummary,
} from '../../types/billing';
import { apiRequest } from './client';

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined) return;
  const normalized = String(value).trim();
  if (normalized.length > 0) params.set(key, normalized);
}

function toQueryString(query: BillingListQuery = {}) {
  const params = new URLSearchParams();
  appendQuery(params, 'page', query.page);
  appendQuery(params, 'limit', query.limit);
  appendQuery(params, 'search', query.search);
  appendQuery(params, 'status', query.status);
  appendQuery(params, 'provider', query.provider);
  appendQuery(params, 'organizationId', query.organizationId);
  appendQuery(params, 'from', query.from);
  appendQuery(params, 'to', query.to);
  appendQuery(params, 'sortBy', query.sortBy);
  appendQuery(params, 'order', query.order);
  return params.toString();
}

export function getBillingOverview(signal?: AbortSignal) {
  return apiRequest<RevenueSummary>('/billing/overview', { signal });
}

export function getBillingInvoices(
  query: BillingListQuery = {},
  signal?: AbortSignal,
) {
  const queryString = toQueryString(query);
  return apiRequest<PaginatedInvoices>(
    `/billing/invoices${queryString ? `?${queryString}` : ''}`,
    { signal },
  );
}

export function getBillingPayments(
  query: BillingListQuery = {},
  signal?: AbortSignal,
) {
  const queryString = toQueryString(query);
  return apiRequest<PaginatedPayments>(
    `/billing/payments${queryString ? `?${queryString}` : ''}`,
    { signal },
  );
}

export function getFailedBillingPayments(
  query: BillingListQuery = {},
  signal?: AbortSignal,
) {
  const queryString = toQueryString(query);
  return apiRequest<PaginatedPayments>(
    `/billing/payments/failed${queryString ? `?${queryString}` : ''}`,
    { signal },
  );
}
