import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { platformBillingApi } from '../../services/api/platform-billing';
import type {
  Invoice,
  PaginatedCommercialResult,
  Payment,
  RevenueOverview,
} from '../../types/commercial';

interface BillingState {
  overview: RevenueOverview | null;
  invoices: PaginatedCommercialResult<Invoice> | null;
  payments: PaginatedCommercialResult<Payment> | null;
  error: string | null;
  loading: boolean;
}

export function useBilling(query: { invoicePage: number; paymentPage: number; search: string; invoiceStatus: string; paymentStatus: string }) {
  const { hasPermission } = useAuth();
  const canViewInvoices = hasPermission('billing.invoice.view');
  const canViewPayments = hasPermission('billing.payment.view');
  const [state, setState] = useState<BillingState>({ overview: null, invoices: null, payments: null, error: null, loading: true });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [overview, invoices, payments] = await Promise.all([
        platformBillingApi.overview(),
        canViewInvoices ? platformBillingApi.invoices({ page: query.invoicePage, pageSize: 10, search: query.search, status: query.invoiceStatus }) : Promise.resolve(null),
        canViewPayments ? platformBillingApi.payments({ page: query.paymentPage, pageSize: 10, search: query.search, status: query.paymentStatus }) : Promise.resolve(null),
      ]);
      setState({ overview, invoices, payments, error: null, loading: false });
    } catch (caught) {
      setState((current) => ({ ...current, error: caught instanceof Error ? caught.message : 'Billing data could not be loaded.', loading: false }));
    }
  }, [canViewInvoices, canViewPayments, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  return { ...state, reload, canViewInvoices, canViewPayments };
}
