import { Link } from 'react-router-dom';
import { LoadingState } from '../../components/OperationalStates';
import { formatAdminDate } from '../access/access-ui';
import { formatMoney, statusLabel, statusTone } from '../subscriptions/subscription-ui';
import { usePlatformDashboard } from './usePlatformDashboard';

function Metric({ label, value, detail, to }: { label: string; value: string | number; detail: string; to?: string }) {
  const content = <><span>{label}</span><strong>{value}</strong><small>{detail}</small></>;
  return to ? <Link className="dashboard-metric" to={to}>{content}</Link> : <article className="dashboard-metric">{content}</article>;
}

export function PlatformDashboardPage() {
  const {
    health,
    organizations,
    staff,
    subscriptions,
    revenue,
    loading,
    reload,
    canViewOrganizations,
    canViewStaff,
    canViewSubscriptions,
    canViewRevenue,
  } = usePlatformDashboard();
  const quickLinks = [
    canViewOrganizations && { label: 'Organizations', to: '/organizations' },
    canViewStaff && { label: 'Staff', to: '/staff' },
    canViewSubscriptions && { label: 'Subscriptions', to: '/subscriptions' },
    canViewRevenue && { label: 'Billing & revenue', to: '/billing' },
  ].filter((item): item is { label: string; to: string } => Boolean(item));

  return <section aria-labelledby="dashboard-title">
    <div className="page-header"><div><p className="eyebrow">Platform overview</p><h1 id="dashboard-title">Dashboard</h1><p className="page-description">A permission-aware view of FinStack operations, commercial activity, and platform availability.</p></div><button className="button button-secondary" type="button" onClick={() => void reload()}>Refresh</button></div>
    {loading && <LoadingState label="Loading your platform overview..." />}
    {!loading && <>
      {quickLinks.length > 0 && <nav className="dashboard-links" aria-label="Dashboard quick links">{quickLinks.map((item) => <Link key={item.to} className="button button-secondary button-compact button-link" to={item.to}>{item.label}</Link>)}</nav>}
      {(canViewOrganizations || canViewStaff || canViewSubscriptions || canViewRevenue) && <section className="dashboard-section" aria-labelledby="overview-heading"><div className="section-heading"><div><h2 id="overview-heading">Platform overview</h2><p>Only data available to your current permissions is shown.</p></div></div><div className="dashboard-metrics">
        {organizations && <Metric label="Organizations" value={organizations.total} detail="Canonical customer organizations" to="/organizations" />}
        {staff && <Metric label="Platform staff" value={staff.total} detail="Internal control-plane staff" to="/staff" />}
        {subscriptions && <Metric label="Subscriptions" value={subscriptions.meta.totalItems} detail="Current organization subscriptions" to="/subscriptions" />}
        {revenue && <Metric label="Active subscriptions" value={revenue.activeSubscriptions} detail="Live paid subscription records" to="/subscriptions" />}
      </div></section>}
      {revenue && <section className="dashboard-section" aria-labelledby="commercial-heading"><div className="section-heading"><div><h2 id="commercial-heading">Commercial</h2><p>Revenue is grouped by currency and only reflects provider-confirmed successful payments.</p></div><Link className="button button-secondary button-compact button-link" to="/billing">View billing</Link></div><div className="dashboard-metrics">
        <Metric label="Trial subscriptions" value={revenue.trialSubscriptions} detail="Subscriptions currently in trial" to="/subscriptions" />
        <Metric label="Failed payments" value={revenue.failedPaymentCount} detail="Payment attempts requiring review" to="/billing" />
        <article className="dashboard-metric"><span>Successful revenue</span>{revenue.successfulRevenueByCurrency.length ? revenue.successfulRevenueByCurrency.map((item) => <strong key={item.currency}>{formatMoney(item.amount, item.currency)}</strong>) : <strong>None</strong>}<small>Verified payments by currency</small></article>
        <article className="dashboard-metric"><span>Pending invoices</span>{revenue.pendingInvoiceValueByCurrency.length ? revenue.pendingInvoiceValueByCurrency.map((item) => <strong key={item.currency}>{formatMoney(item.amount, item.currency)}</strong>) : <strong>None</strong>}<small>Outstanding value by currency</small></article>
      </div>
      <div className="dashboard-activity"><section className="status-card dashboard-list"><h2>Recent successful payments</h2>{revenue.recentSuccessfulPayments.length === 0 ? <p>No successful payments recorded.</p> : <div className="permission-list">{revenue.recentSuccessfulPayments.map((payment) => <div className="permission-row" key={payment.id}><div>{canViewOrganizations ? <Link className="table-link" to={`/organizations/${payment.organizationId}`}>{payment.organization.name}</Link> : <strong>{payment.organization.name}</strong>}<p className="muted-copy">{payment.providerReference || payment.provider}</p></div><span>{formatMoney(payment.amount, payment.currency)}</span></div>)}</div>}</section></div>
      </section>}
      {organizations && <section className="dashboard-section" aria-labelledby="organizations-heading"><div className="section-heading"><div><h2 id="organizations-heading">Recent organizations</h2><p>Newest canonical customer organizations.</p></div><Link className="button button-secondary button-compact button-link" to="/organizations">View organizations</Link></div>{organizations.items.length === 0 ? <p className="empty-copy">No organizations found.</p> : <div className="data-table-wrap"><table className="data-table compact-table"><thead><tr><th>Organization</th><th>Status</th><th>Created</th></tr></thead><tbody>{organizations.items.map((organization) => <tr key={organization.id}><td><Link className="table-link" to={`/organizations/${organization.id}`}>{organization.name}</Link><span>{organization.primaryEmail}</span></td><td><span className={`status-pill status-pill-${statusTone(organization.status)}`}>{statusLabel(organization.status)}</span></td><td>{formatAdminDate(organization.createdAt)}</td></tr>)}</tbody></table></div>}</section>}
      <section className="dashboard-section" aria-labelledby="system-heading"><div className="section-heading"><div><h2 id="system-heading">System health</h2><p>Live availability for the Admin API and PostgreSQL connection.</p></div><Link className="button button-secondary button-compact button-link" to="/health">System health</Link></div>{health ? <><div className="summary-banner dashboard-health-summary"><div><strong>Platform status: {health.status === 'healthy' ? 'Healthy' : 'Degraded'}</strong><span>Last checked {formatAdminDate(health.checkedAt)}</span></div></div><div className="dashboard-metrics"><Metric label="Platform API" value={health.api.status === 'available' ? 'Available' : 'Unavailable'} detail="Versioned control-plane endpoint" /><Metric label="PostgreSQL" value={health.database.status === 'available' ? 'Available' : 'Unavailable'} detail="Live database probe" /></div></> : <p className="empty-copy">System health is temporarily unavailable.</p>}</section>
    </>}
  </section>;
}
