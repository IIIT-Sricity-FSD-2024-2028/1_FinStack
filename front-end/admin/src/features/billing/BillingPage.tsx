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

  return (
    <section aria-labelledby="billing-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Commercial operations</p>
          <h1 id="billing-title">Billing & Revenue</h1>
          <p className="page-description">Currency-aware subscription revenue, invoice exposure, and payment operations.</p>
        </div>
      </div>

      <form className="filter-bar filter-bar-wide" onSubmit={submitSearch}>
        <input aria-label="Search billing records" placeholder="Search organization, invoice, or provider reference" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
        <select aria-label="Filter invoice status" value={invoiceStatus} onChange={(event) => { setInvoicePage(1); setInvoiceStatus(event.target.value); }}>
          <option value="">All invoice statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="VOID">Void</option>
        </select>
        <select aria-label="Filter payment status" value={paymentStatus} onChange={(event) => { setPaymentPage(1); setPaymentStatus(event.target.value); }}>
          <option value="">All payment statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <button className="button button-secondary" type="submit">Search</button>
      </form>

      {loading && <LoadingState label="Loading billing records..." />}
      {!loading && error && <ErrorState title="Billing unavailable" message={error} action={<button className="button button-secondary" onClick={() => void reload()}>Try again</button>} />}
      {!loading && !canViewRevenue && <div className="summary-banner"><div><strong>Billing records</strong><span>Revenue metrics are not included in your permissions.</span></div></div>}

      {!loading && canViewRevenue && overview && (
        <>
          <div className="status-grid" style={{ marginBottom: '32px' }}>
            <article className="status-card">
              <span className="muted-copy">Active Subscriptions</span>
              <div style={{ marginTop: '8px' }}>
                <strong className="premium-metric" style={{ fontSize: '32px' }}>{overview.activeSubscriptions}</strong>
              </div>
            </article>
            <article className="status-card">
              <span className="muted-copy">Trial Subscriptions</span>
              <div style={{ marginTop: '8px' }}>
                <strong className="premium-metric" style={{ fontSize: '32px' }}>{overview.trialSubscriptions}</strong>
              </div>
            </article>
            <article className="status-card">
              <span className="muted-copy">Failed Payments</span>
              <div style={{ marginTop: '8px' }}>
                <strong className="premium-error" style={{ fontSize: '32px' }}>{overview.failedPaymentCount}</strong>
              </div>
            </article>
          </div>

          <div className="status-grid form-panel" style={{ marginBottom: '32px' }}>
            <section className="status-card" aria-labelledby="revenue-heading">
              <div className="status-card-heading">
                <h2 id="revenue-heading">Successful Revenue</h2>
              </div>
              {overview.successfulRevenueByCurrency.length === 0 ? (
                <p className="muted-copy">No successful revenue in the selected range.</p>
              ) : (
                <div className="permission-list" style={{ marginTop: '16px' }}>
                  {overview.successfulRevenueByCurrency.map((item) => (
                    <div className="permission-row" key={item.currency} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <strong style={{ fontSize: '16px' }}>{item.currency}</strong>
                      <span className="premium-success" style={{ fontSize: '20px' }}>{formatMoney(item.amount, item.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="status-card" aria-labelledby="pending-heading">
              <div className="status-card-heading">
                <h2 id="pending-heading">Pending Invoice Value</h2>
              </div>
              {overview.pendingInvoiceValueByCurrency.length === 0 ? (
                <p className="muted-copy">No pending invoice value.</p>
              ) : (
                <div className="permission-list" style={{ marginTop: '16px' }}>
                  {overview.pendingInvoiceValueByCurrency.map((item) => (
                    <div className="permission-row" key={item.currency} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <strong style={{ fontSize: '16px' }}>{item.currency}</strong>
                      <span className="premium-metric" style={{ fontSize: '20px' }}>{formatMoney(item.amount, item.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="status-card form-panel section-panel" aria-labelledby="recent-success-heading" style={{ marginBottom: '32px' }}>
            <div className="section-heading">
              <div>
                <h2 id="recent-success-heading">Recent Successful Payments</h2>
                <p>Latest provider-confirmed successful payment records by currency.</p>
              </div>
            </div>
            {overview.recentSuccessfulPayments.length === 0 ? (
              <p className="empty-copy">No successful payments found.</p>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Provider Reference</th>
                      <th>Amount</th>
                      <th>Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentSuccessfulPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          <RelatedLink enabled={canViewOrganizations} to={`/organizations/${payment.organizationId}`}>
                            {payment.organization.name}
                          </RelatedLink>
                        </td>
                        <td><code>{payment.providerReference || 'Not provided'}</code></td>
                        <td><strong>{formatMoney(payment.amount, payment.currency)}</strong></td>
                        <td><span className="muted-copy">{formatAdminDate(payment.paidAt)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {!loading && (canViewInvoices || canViewPayments) && (
        <>
          <section className="status-card form-panel section-panel" aria-labelledby="invoices-heading" style={{ marginBottom: '32px' }}>
            <div className="section-heading">
              <div>
                <h2 id="invoices-heading">Invoices Ledger</h2>
                <p>Invoice status and authoritative totals from the billing ledger.</p>
              </div>
            </div>
            {!canViewInvoices ? (
              <p className="muted-copy">Invoice visibility is not included in your permissions.</p>
            ) : !invoices?.items.length ? (
              <p className="empty-copy">No invoices found.</p>
            ) : (
              <>
                <div className="data-table-wrap">
                  <table className="data-table compact-table">
                    <thead>
                      <tr>
                        <th>Invoice Number</th>
                        <th>Organization</th>
                        <th>Plan / Reason</th>
                        <th>Status</th>
                        <th>Total Amount</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.items.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>
                            <RelatedLink enabled={canViewSubscriptions} to={`/subscriptions/${invoice.subscriptionId}`}>
                              {invoice.invoiceNumber}
                            </RelatedLink>
                          </td>
                          <td>
                            <RelatedLink enabled={canViewOrganizations} to={`/organizations/${invoice.organizationId}`}>
                              {invoice.organization.name}
                            </RelatedLink>
                          </td>
                          <td>
                            <div>
                              <span>{statusLabel(invoice.billingReason)}</span>
                              <div style={{ marginTop: '4px' }}><code>{invoice.plan.key}</code></div>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill status-pill-${statusTone(invoice.status)}`}>
                              {statusLabel(invoice.status)}
                            </span>
                          </td>
                          <td><strong>{formatMoney(invoice.totalAmount, invoice.currency)}</strong></td>
                          <td><span className="muted-copy">{formatAdminDate(invoice.dueDate)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={invoices.meta.page} totalPages={invoices.meta.totalPages} total={invoices.meta.totalItems} onPageChange={setInvoicePage} />
              </>
            )}
          </section>

          <section className="status-card form-panel section-panel" aria-labelledby="payments-heading">
            <div className="section-heading">
              <div>
                <h2 id="payments-heading">Payments Ledger</h2>
                <p>Successful and failed subscription payment attempts.</p>
              </div>
            </div>
            {!canViewPayments ? (
              <p className="muted-copy">Payment visibility is not included in your permissions.</p>
            ) : !payments?.items.length ? (
              <p className="empty-copy">No payments found.</p>
            ) : (
              <>
                <div className="data-table-wrap">
                  <table className="data-table compact-table">
                    <thead>
                      <tr>
                        <th>Organization</th>
                        <th>Invoice</th>
                        <th>Provider</th>
                        <th>Status</th>
                        <th>Amount</th>
                        <th>Recorded Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.items.map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            <RelatedLink enabled={canViewOrganizations} to={`/organizations/${payment.organizationId}`}>
                              {payment.organization.name}
                            </RelatedLink>
                            <div className="muted-copy" style={{ fontSize: '12px', marginTop: '4px' }}>
                              {payment.organization.primaryEmail}
                            </div>
                          </td>
                          <td>
                            <RelatedLink enabled={canViewSubscriptions} to={`/subscriptions/${payment.subscriptionId}`}>
                              {payment.invoice.invoiceNumber}
                            </RelatedLink>
                          </td>
                          <td>{payment.provider}</td>
                          <td>
                            <span className={`status-pill status-pill-${payment.status === 'SUCCEEDED' ? 'available' : 'unavailable'}`}>
                              {statusLabel(payment.status)}
                            </span>
                          </td>
                          <td><strong>{formatMoney(payment.amount, payment.currency)}</strong></td>
                          <td><span className="muted-copy">{formatAdminDate(payment.paidAt || payment.failedAt || payment.createdAt)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={payments.meta.page} totalPages={payments.meta.totalPages} total={payments.meta.totalItems} onPageChange={setPaymentPage} />
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
