import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { PermissionGate } from '../../auth/PermissionGate';
import {
  getBillingInvoices,
  getBillingOverview,
  getBillingPayments,
  getFailedBillingPayments,
} from '../../services/api/platform-billing';
import type {
  BillingListQuery,
  Invoice,
  PaginatedInvoices,
  PaginatedPayments,
  RevenueSummary,
  SubscriptionPayment,
} from '../../types/billing';
import { formatDate, formatMoney, formatStatus } from './billing-format';
import './billing.css';

type BillingView = 'overview' | 'invoices' | 'payments' | 'failed';

interface BillingPageProps {
  view?: BillingView;
}

const PAGE_SIZE = 10;

export function BillingPage({ view = 'overview' }: BillingPageProps) {
  const permission =
    view === 'invoices'
      ? 'billing.invoice.view'
      : view === 'overview'
        ? 'billing.billing.view'
        : 'billing.payment.view';

  return (
    <PermissionGate
      permission={permission}
      fallback={
        <div className="state-panel" role="alert">
          <div>
            <strong>Permission required</strong>
            <p>Your account cannot view platform billing.</p>
          </div>
        </div>
      }
    >
      <BillingContent view={view} />
    </PermissionGate>
  );
}

function BillingContent({ view }: { view: BillingView }) {
  const [overview, setOverview] = useState<RevenueSummary | null>(null);
  const [invoices, setInvoices] = useState<PaginatedInvoices | null>(null);
  const [payments, setPayments] = useState<PaginatedPayments | null>(null);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo<BillingListQuery>(
    () => ({
      page,
      limit: PAGE_SIZE,
      search,
      status: status || undefined,
      sortBy: view === 'invoices' ? 'createdAt' : 'createdAt',
      order: 'desc',
    }),
    [page, search, status, view],
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line
    setLoading(true);
    // eslint-disable-next-line
    setError(null);

    const request =
      view === 'overview'
        ? Promise.all([
            getBillingOverview(controller.signal),
            getBillingInvoices({ page: 1, limit: 5 }, controller.signal),
            getFailedBillingPayments({ page: 1, limit: 5 }, controller.signal),
          ]).then(([summary, recentInvoices, failed]) => {
            setOverview(summary);
            setInvoices(recentInvoices);
            setPayments(failed);
          })
        : view === 'invoices'
          ? getBillingInvoices(query, controller.signal).then((data) => {
              setInvoices(data);
              setPayments(null);
            })
          : view === 'failed'
            ? getFailedBillingPayments(query, controller.signal).then((data) => {
                setPayments(data);
                setInvoices(null);
              })
            : getBillingPayments(query, controller.signal).then((data) => {
                setPayments(data);
                setInvoices(null);
              });

    request
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Billing data failed to load.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, view]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <section className="billing-page" aria-labelledby="billing-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">SaaS billing</p>
          <h1 id="billing-title">{titleForView(view)}</h1>
          <p className="page-description">
            Invoices, subscription payments, failed payment visibility, and revenue derived from paid billing records.
          </p>
        </div>
        <button className="button" type="button" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>

      {view === 'overview' && overview && <Overview summary={overview} />}

      {view !== 'overview' && (
        <form className="filter-bar" onSubmit={submitSearch}>
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search organization, invoice, or provider ref"
          />
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            {(view === 'invoices'
              ? ['DRAFT', 'ISSUED', 'PENDING', 'PAID', 'OVERDUE', 'VOID']
              : ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']
            ).map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>
          <button className="button" type="submit">
            Apply
          </button>
        </form>
      )}

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading billing data...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Billing unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && view === 'overview' && (
        <OverviewTables invoices={invoices?.items ?? []} failed={payments?.items ?? []} />
      )}

      {!loading && !error && view === 'invoices' && (
        <InvoiceTable data={invoices} page={page} setPage={setPage} />
      )}

      {!loading && !error && (view === 'payments' || view === 'failed') && (
        <PaymentTable data={payments} page={page} setPage={setPage} />
      )}
    </section>
  );
}

function Overview({ summary }: { summary: RevenueSummary }) {
  return (
    <>
      <div className="detail-grid billing-metrics">
        <Metric label="Collected revenue" value={formatMoney('INR', summary.totalCollectedRevenue)} />
        <Metric label="MRR" value={formatMoney('INR', summary.mrr)} />
        <Metric label="ARR" value={formatMoney('INR', summary.arr)} />
        <Metric label="Failed payments" value={String(summary.failedPayments)} />
      </div>
      <div className="state-panel billing-rule">
        <div>
          <strong>Revenue rule</strong>
          <p>{summary.rule}</p>
        </div>
      </div>
    </>
  );
}

function OverviewTables({
  invoices,
  failed,
}: {
  invoices: Invoice[];
  failed: SubscriptionPayment[];
}) {
  return (
    <div className="billing-overview-grid">
      <section>
        <h2>Recent invoices</h2>
        <InvoiceRows invoices={invoices} />
      </section>
      <section>
        <h2>Failed payments</h2>
        <PaymentRows payments={failed} />
      </section>
    </div>
  );
}

function InvoiceTable({
  data,
  page,
  setPage,
}: {
  data: PaginatedInvoices | null;
  page: number;
  setPage: (page: number) => void;
}) {
  if (!data || data.items.length === 0) {
    return <EmptyBillingState message="No invoices match these filters." />;
  }
  return (
    <>
      <InvoiceRows invoices={data.items} />
      <Pagination meta={data.meta} page={page} setPage={setPage} />
    </>
  );
}

function PaymentTable({
  data,
  page,
  setPage,
}: {
  data: PaginatedPayments | null;
  page: number;
  setPage: (page: number) => void;
}) {
  if (!data || data.items.length === 0) {
    return <EmptyBillingState message="No payments match these filters." />;
  }
  return (
    <>
      <PaymentRows payments={data.items} />
      <Pagination meta={data.meta} page={page} setPage={setPage} />
    </>
  );
}

function InvoiceRows({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return <EmptyBillingState message="No invoices yet." />;
  }
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Organization</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <strong>{invoice.invoiceNumber}</strong>
                <span>{formatDate(invoice.issueDate)}</span>
              </td>
              <td>
                <strong>{invoice.organization?.name ?? 'Unknown organization'}</strong>
                <span>{invoice.plan?.name ?? invoice.subscription?.plan?.name ?? 'No plan'}</span>
              </td>
              <td>{formatMoney(invoice.currency, invoice.totalAmount)}</td>
              <td>
                <span className={`billing-pill billing-pill-${invoice.status.toLowerCase()}`}>
                  {formatStatus(invoice.status)}
                </span>
              </td>
              <td>{formatDate(invoice.dueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentRows({ payments }: { payments: SubscriptionPayment[] }) {
  if (payments.length === 0) {
    return <EmptyBillingState message="No payments yet." />;
  }
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Organization</th>
            <th>Invoice</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>
                <strong>{payment.providerReference ?? payment.providerOrderId ?? payment.id}</strong>
                <span>{payment.provider ?? 'Manual'}</span>
              </td>
              <td>{payment.organization?.name ?? 'Unknown organization'}</td>
              <td>{payment.invoice?.invoiceNumber ?? 'No invoice'}</td>
              <td>{formatMoney(payment.currency, payment.amount)}</td>
              <td>
                <span className={`billing-pill billing-pill-${payment.status.toLowerCase()}`}>
                  {formatStatus(payment.status)}
                </span>
                {payment.failureReason && <span>{payment.failureReason}</span>}
              </td>
              <td>{formatDate(payment.paidAt ?? payment.failedAt ?? payment.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  meta,
  page,
  setPage,
}: {
  meta: { total: number; totalPages: number; page: number };
  page: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="pagination-bar">
      <span>
        Page {meta.page} of {meta.totalPages} for {meta.total} records
      </span>
      <div>
        <button
          className="button button-secondary"
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          Previous
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={page >= meta.totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="detail-card status-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyBillingState({ message }: { message: string }) {
  return (
    <div className="state-panel">
      <div>
        <strong>No billing records</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function titleForView(view: BillingView) {
  if (view === 'invoices') return 'Billing invoices';
  if (view === 'payments') return 'Subscription payments';
  if (view === 'failed') return 'Failed payments';
  return 'Billing overview';
}
