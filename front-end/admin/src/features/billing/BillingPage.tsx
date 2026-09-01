import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../auth/useAuth';
import { formatAdminDate } from '../access/access-ui';
import { ErrorState, LoadingState, Pagination } from '../../components/OperationalStates';
import { formatMoney, statusLabel, statusTone } from '../subscriptions/subscription-ui';
import { useBilling } from './useBilling';

function RelatedLink({ enabled, to, children }: { enabled: boolean; to: string; children: ReactNode }) {
  return enabled ? <Link className="table-link" to={to}>{children}</Link> : <strong>{children}</strong>;
}

export function BillingPage() {
  const { hasPermission } = useAuth();
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const query = useMemo(
    () => ({ invoicePage, paymentPage, search, invoiceStatus, paymentStatus }),
    [invoicePage, paymentPage, search, invoiceStatus, paymentStatus],
  );
  const {
    overview,
    invoices,
    payments,
    error,
    loading,
    reload,
    canViewRevenue,
    canViewInvoices,
    canViewPayments,
  } = useBilling(query);
  const canViewOrganizations = hasPermission('platform.organization.view');
  const canViewSubscriptions = hasPermission('subscription.subscription.view');

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvoicePage(1);
    setPaymentPage(1);
    setSearch(searchDraft.trim());
  }

  return <section aria-labelledby="billing-title">
    <div className="page-header"><div><p className="eyebrow">Commercial operations</p><h1 id="billing-title">Billing & revenue</h1><p className="page-description">Currency-aware subscription revenue, invoice exposure, and payment operations.</p></div></div>
    <form className="filter-bar filter-bar-wide" onSubmit={submitSearch}>
      <input aria-label="Search billing records" placeholder="Search organization, invoice, or provider reference" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
      <select aria-label="Filter invoice status" value={invoiceStatus} onChange={(event) => { setInvoicePage(1); setInvoiceStatus(event.target.value); }}><option value="">All invoice statuses</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="OVERDUE">Overdue</option><option value="VOID">Void</option></select>
      <select aria-label="Filter payment status" value={paymentStatus} onChange={(event) => { setPaymentPage(1); setPaymentStatus(event.target.value); }}><option value="">All payment statuses</option><option value="PENDING">Pending</option><option value="SUCCEEDED">Succeeded</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select>
      <button className="button button-secondary" type="submit">Search</button>
    </form>
    {loading && <LoadingState label="Loading billing records..." />}
    {!loading && error && <ErrorState title="Billing unavailable" message={error} action={<button className="button button-secondary" onClick={() => void reload()}>Try again</button>} />}
    {!loading && !canViewRevenue && <div className="summary-banner"><div><strong>Billing records</strong><span>Revenue metrics are not included in your permissions.</span></div></div>}
    {!loading && canViewRevenue && overview && <>
      <div className="status-grid"><article className="status-card"><div className="status-card-heading"><span className="status-dot status-dot-available" /><span className="status-pill status-pill-available">Active</span></div><h2>Active subscriptions</h2><p>{overview.activeSubscriptions}</p></article><article className="status-card"><div className="status-card-heading"><span className="status-dot status-dot-available" /><span className="status-pill status-pill-available">Trial</span></div><h2>Trial subscriptions</h2><p>{overview.trialSubscriptions}</p></article><article className="status-card"><div className="status-card-heading"><span className="status-dot status-dot-unavailable" /><span className="status-pill status-pill-unavailable">Failed</span></div><h2>Failed payments</h2><p>{overview.failedPaymentCount}</p></article></div>
      <div className="status-grid form-panel"><section className="status-card" aria-labelledby="revenue-heading"><h2 id="revenue-heading">Successful revenue</h2>{overview.successfulRevenueByCurrency.length === 0 ? <p>No successful revenue in the selected range.</p> : <div className="permission-list">{overview.successfulRevenueByCurrency.map((item) => <div className="permission-row" key={item.currency}><strong>{item.currency}</strong><span>{formatMoney(item.amount, item.currency)}</span></div>)}</div>}</section><section className="status-card" aria-labelledby="pending-heading"><h2 id="pending-heading">Pending invoice value</h2>{overview.pendingInvoiceValueByCurrency.length === 0 ? <p>No pending invoice value.</p> : <div className="permission-list">{overview.pendingInvoiceValueByCurrency.map((item) => <div className="permission-row" key={item.currency}><strong>{item.currency}</strong><span>{formatMoney(item.amount, item.currency)}</span></div>)}</div>}</section></div>
      <section className="status-card form-panel section-panel" aria-labelledby="recent-success-heading"><div className="section-heading"><div><h2 id="recent-success-heading">Recent successful payments</h2><p>Latest provider-confirmed successful payment records by currency.</p></div></div>{overview.recentSuccessfulPayments.length === 0 ? <p className="empty-copy">No successful payments found.</p> : <div className="data-table-wrap"><table className="data-table compact-table"><thead><tr><th>Organization</th><th>Provider reference</th><th>Amount</th><th>Paid</th></tr></thead><tbody>{overview.recentSuccessfulPayments.map((payment) => <tr key={payment.id}><td><RelatedLink enabled={canViewOrganizations} to={`/organizations/${payment.organizationId}`}>{payment.organization.name}</RelatedLink></td><td><code>{payment.providerReference || 'Not provided'}</code></td><td>{formatMoney(payment.amount, payment.currency)}</td><td>{formatAdminDate(payment.paidAt)}</td></tr>)}</tbody></table></div>}</section>
    </>}
    {!loading && (canViewInvoices || canViewPayments) && <>
      <section className="status-card form-panel section-panel" aria-labelledby="invoices-heading"><div className="section-heading"><div><h2 id="invoices-heading">Invoices</h2><p>Invoice status and authoritative totals from the billing ledger.</p></div></div>{!canViewInvoices ? <p className="muted-copy">Invoice visibility is not included in your permissions.</p> : !invoices?.items.length ? <p className="empty-copy">No invoices found.</p> : <><div className="data-table-wrap"><table className="data-table compact-table"><thead><tr><th>Invoice</th><th>Organization</th><th>Reason</th><th>Status</th><th>Total</th><th>Due</th></tr></thead><tbody>{invoices.items.map((invoice) => <tr key={invoice.id}><td><RelatedLink enabled={canViewSubscriptions} to={`/subscriptions/${invoice.subscriptionId}`}>{invoice.invoiceNumber}</RelatedLink><span><code>{invoice.plan.key}</code></span></td><td><RelatedLink enabled={canViewOrganizations} to={`/organizations/${invoice.organizationId}`}>{invoice.organization.name}</RelatedLink></td><td>{statusLabel(invoice.billingReason)}</td><td><span className={`status-pill status-pill-${statusTone(invoice.status)}`}>{statusLabel(invoice.status)}</span></td><td>{formatMoney(invoice.totalAmount, invoice.currency)}</td><td>{formatAdminDate(invoice.dueDate)}</td></tr>)}</tbody></table></div><Pagination page={invoices.meta.page} totalPages={invoices.meta.totalPages} total={invoices.meta.totalItems} onPageChange={setInvoicePage} /></>}</section>
      <section className="status-card form-panel section-panel" aria-labelledby="payments-heading"><div className="section-heading"><div><h2 id="payments-heading">Payments</h2><p>Successful and failed subscription payment attempts. Checkout is provider-owned.</p></div></div>{!canViewPayments ? <p className="muted-copy">Payment visibility is not included in your permissions.</p> : !payments?.items.length ? <p className="empty-copy">No payments found.</p> : <><div className="data-table-wrap"><table className="data-table compact-table"><thead><tr><th>Organization</th><th>Invoice</th><th>Provider</th><th>Status</th><th>Amount</th><th>Recorded</th></tr></thead><tbody>{payments.items.map((payment) => <tr key={payment.id}><td><RelatedLink enabled={canViewOrganizations} to={`/organizations/${payment.organizationId}`}>{payment.organization.name}</RelatedLink><span>{payment.organization.primaryEmail}</span></td><td><RelatedLink enabled={canViewSubscriptions} to={`/subscriptions/${payment.subscriptionId}`}>{payment.invoice.invoiceNumber}</RelatedLink></td><td>{payment.provider}</td><td><span className={`status-pill status-pill-${payment.status === 'SUCCEEDED' ? 'available' : 'unavailable'}`}>{statusLabel(payment.status)}</span></td><td>{formatMoney(payment.amount, payment.currency)}</td><td>{formatAdminDate(payment.paidAt || payment.failedAt || payment.createdAt)}</td></tr>)}</tbody></table></div><Pagination page={payments.meta.page} totalPages={payments.meta.totalPages} total={payments.meta.totalItems} onPageChange={setPaymentPage} /></>}</section>
    </>}
  </section>;
}
