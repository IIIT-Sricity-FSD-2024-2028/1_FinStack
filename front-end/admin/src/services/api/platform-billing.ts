import { apiRequest } from './client';
import type {
  Invoice,
  PaginatedCommercialResult,
  Payment,
  RevenueOverview,
} from '../../types/commercial';

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const platformBillingApi = {
  invoices: (query: { page?: number; pageSize?: number; search?: string; status?: string } = {}) =>
    apiRequest<PaginatedCommercialResult<Invoice>>(`/billing/invoices${queryString(query)}`),
  payments: (query: { page?: number; pageSize?: number; search?: string; status?: string } = {}) =>
    apiRequest<PaginatedCommercialResult<Payment>>(`/billing/payments${queryString(query)}`),
  overview: () => apiRequest<RevenueOverview>('/billing/overview'),
};
