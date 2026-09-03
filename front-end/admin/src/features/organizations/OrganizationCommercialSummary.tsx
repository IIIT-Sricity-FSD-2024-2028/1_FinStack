import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { platformBillingApi } from '../../services/api/platform-billing';
import { platformSubscriptionsApi } from '../../services/api/platform-subscriptions';
import type { Invoice, Payment, Subscription } from '../../types/commercial';
import { formatAdminDate } from '../access/access-ui';
import { formatMoney, statusLabel, statusTone } from '../subscriptions/subscription-ui';

interface CommercialState {
  subscription: Subscription | null;
  invoice: Invoice | null;
  payment: Payment | null;
  loading: boolean;
}

export function OrganizationCommercialSummary({ organizationId }: { organizationId: string }) {
  const { hasPermission } = useAuth();
  const canViewSubscriptions = hasPermission('subscription.subscription.view');
  const canViewInvoices = hasPermission('billing.invoice.view');
  const canViewPayments = hasPermission('billing.payment.view');
  const [state, setState] = useState<CommercialState>({ subscription: null, invoice: null, payment: null, loading: canViewSubscriptions });

  useEffect(() => {
    if (!canViewSubscriptions) return;
    let active = true;
    void Promise.all([
      platformSubscriptionsApi.list({ organizationId, page: 1, pageSize: 1, sortBy: 'updatedAt', order: 'desc' }),
      canViewInvoices ? platformBillingApi.invoices({ organizationId, page: 1, pageSize: 1 }) : Promise.resolve(null),
      canViewPayments ? platformBillingApi.payments({ organizationId, page: 1, pageSize: 1 }) : Promise.resolve(null),
    ]).then(([subscriptions, invoices, payments]) => {
      if (active) setState({ subscription: subscriptions.items[0] ?? null, invoice: invoices?.items[0] ?? null, payment: payments?.items[0] ?? null, loading: false });
    }).catch(() => {
      if (active) setState({ subscription: null, invoice: null, payment: null, loading: false });
    });
    return () => { active = false; };
  }, [canViewInvoices, canViewPayments, canViewSubscriptions, organizationId]);

  if (!canViewSubscriptions) return null;
  if (state.loading) return <section className="status-card form-panel section-panel" aria-label="Commercial summary"><p>Loading commercial summary...</p></section>;
  if (!state.subscription) return <section className="status-card form-panel section-panel" aria-labelledby="commercial-summary-heading"><div className="section-heading"><div><h2 id="commercial-summary-heading">Commercial summary</h2><p>No subscription is currently assigned to this organization.</p></div><Link className="button button-secondary button-compact button-link" to="/subscriptions">View subscriptions</Link></div></section>;

  const { subscription, invoice, payment } = state;
  return <section className="status-card form-panel section-panel" aria-labelledby="commercial-summary-heading"><div className="section-heading"><div><h2 id="commercial-summary-heading">Commercial summary</h2><p>Canonical subscription and billing information for this organization.</p></div><Link className="button button-secondary button-compact button-link" to={`/subscriptions/${subscription.id}`}>View subscription</Link></div>
    <div className="commercial-summary-grid"><div><span>Plan</span><strong>{subscription.plan.name}</strong><code>{subscription.plan.key}</code></div><div><span>Status</span><strong><span className={`status-pill status-pill-${statusTone(subscription.status)}`}>{statusLabel(subscription.status)}</span></strong><small>Period ends {formatAdminDate(subscription.currentPeriodEnd)}</small></div><div><span>Employee seats</span><strong>{subscription.employeeCount}</strong><small>{subscription.plan.includedEmployeeCount} included</small></div><div><span>Recurring total</span><strong>{formatMoney(subscription.priceAtSubscription, subscription.currency)}</strong><small>{subscription.billingInterval.toLowerCase()}</small></div></div>
    <div className="commercial-breakdown"><div><span>Base plan</span><strong>{formatMoney(subscription.plan.basePrice, subscription.currency)}</strong></div><div><span>Employee component</span><strong>{formatMoney(subscription.employeeAmount, subscription.currency)}</strong></div><div><span>Feature add-ons</span><strong>{formatMoney(subscription.featureAmount, subscription.currency)}</strong></div><div><span>Total recurring price</span><strong>{formatMoney(subscription.priceAtSubscription, subscription.currency)}</strong></div></div>
    {(invoice || payment) && <div className="commercial-summary-grid commercial-ledger"><div><span>Latest invoice</span><strong>{invoice ? invoice.invoiceNumber : 'Not available'}</strong><small>{invoice ? `${statusLabel(invoice.status)} - ${formatMoney(invoice.totalAmount, invoice.currency)}` : 'Invoice permission not granted'}</small></div><div><span>Latest payment</span><strong>{payment ? statusLabel(payment.status) : 'Not available'}</strong><small>{payment ? formatAdminDate(payment.paidAt || payment.failedAt || payment.createdAt) : 'Payment permission not granted'}</small></div></div>}
  </section>;
}
