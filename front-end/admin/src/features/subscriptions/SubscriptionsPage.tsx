import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { ErrorState, LoadingState, Pagination } from '../../components/OperationalStates';
import type { SubscriptionStatus } from '../../types/commercial';
import { formatAdminDate } from '../access/access-ui';
import { formatMoney, statusLabel, statusTone } from './subscription-ui';
import { useSubscriptions } from './useSubscriptions';

const statuses: SubscriptionStatus[] = ['PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'EXPIRING', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED'];

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const query = useMemo(() => ({ page, pageSize: 10, search, status, sortBy, order }), [page, search, sortBy, status, order]);
  const { data, error, loading, reload } = useSubscriptions(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <section aria-labelledby="subscriptions-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Commercial operations</p>
          <h1 id="subscriptions-title">Subscriptions</h1>
          <p className="page-description">Monitor organization plans, billing periods, and subscription lifecycle state.</p>
        </div>
        <PermissionGate permission="subscription.subscription.manage">
          <Link className="button button-link" to="/subscriptions/new">Assign subscription</Link>
        </PermissionGate>
      </div>

      <form className="filter-bar filter-bar-wide" onSubmit={submitSearch}>
        <input aria-label="Search subscriptions" placeholder="Search organization or plan" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
        <select aria-label="Filter subscription status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
        </select>
        <select aria-label="Sort subscriptions" value={sortBy} onChange={(event) => { setPage(1); setSortBy(event.target.value); }}>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
          <option value="currentPeriodEnd">Period end</option>
          <option value="status">Status</option>
        </select>
        <button className="button button-secondary" type="button" onClick={() => setOrder((value) => value === 'asc' ? 'desc' : 'asc')}>{order === 'asc' ? 'Ascending' : 'Descending'}</button>
        <button className="button button-secondary" type="submit">Search</button>
      </form>

      {loading && <LoadingState label="Loading subscriptions..." />}
      {!loading && error && <ErrorState title="Subscriptions unavailable" message={error} action={<button className="button button-secondary" onClick={() => void reload()}>Try again</button>} />}
      {!loading && data?.items.length === 0 && <div className="state-panel"><div><strong>No subscriptions found</strong><p>Adjust the filters or assign a subscription to an organization.</p></div></div>}
      {!loading && data && data.items.length > 0 && <>
        <div className="data-table-wrap">
          <table className="data-table compact-table">
            <thead><tr><th>Organization</th><th>Plan</th><th>Status</th><th>Price</th><th>Current period</th><th>Actions</th></tr></thead>
            <tbody>{data.items.map((subscription) => <tr key={subscription.id}>
              <td><strong>{subscription.organization.name}</strong><span>{subscription.organization.primaryEmail}</span></td>
              <td><strong>{subscription.plan.name}</strong><span><code>{subscription.plan.key}</code></span></td>
              <td><span className={`status-pill status-pill-${statusTone(subscription.status)}`}>{statusLabel(subscription.status)}</span></td>
              <td>{formatMoney(subscription.priceAtSubscription, subscription.currency)} / {subscription.billingInterval.toLowerCase()}</td>
              <td>{formatAdminDate(subscription.currentPeriodEnd)}</td>
              <td><button className="button button-secondary button-compact" type="button" onClick={() => navigate(`/subscriptions/${subscription.id}`)}>View</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.totalItems} onPageChange={setPage} />
      </>}
    </section>
  );
}
