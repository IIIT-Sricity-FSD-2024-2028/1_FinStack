import { type FormEvent, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import type {
  OrganizationSubscription,
  SortOrder,
  SubscriptionCreateInput,
  SubscriptionSortField,
  SubscriptionStatus,
} from '../../types/subscriptions';
import { AssignSubscriptionDialog } from './AssignSubscriptionDialog';
import { formatDate, formatStatus } from './subscription-format';
import { SUBSCRIPTION_VIEW } from './subscription-permissions';
import { useSubscriptions } from './useSubscriptions';
import { createPlatformSubscription } from '../../services/api/platform-subscriptions';
import './subscriptions.css';

const PAGE_SIZE = 10;

const statusOptions: SubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'EXPIRING',
  'GRACE_PERIOD',
  'SUSPENDED',
  'CANCELLED',
];

const sortOptions: Array<{
  label: string;
  sortBy: SubscriptionSortField;
  order: SortOrder;
}> = [
  { label: 'Period ending soon', sortBy: 'currentPeriodEnd', order: 'asc' },
  { label: 'Newest subscriptions', sortBy: 'createdAt', order: 'desc' },
  { label: 'Recently updated', sortBy: 'updatedAt', order: 'desc' },
  { label: 'Organization A-Z', sortBy: 'organizationName', order: 'asc' },
  { label: 'Plan A-Z', sortBy: 'planName', order: 'asc' },
];

interface SubscriptionListPageProps {
  fixedStatus?: SubscriptionStatus;
  title?: string;
  description?: string;
}

export function SubscriptionListPage({
  fixedStatus,
  title = 'Subscriptions',
  description = 'Review organization subscriptions across active, trial, suspended, and renewal states.',
}: SubscriptionListPageProps) {
  return (
    <PermissionGate
      permission={SUBSCRIPTION_VIEW}
      fallback={
        <div className="state-panel" role="alert">
          <div>
            <strong>Permission required</strong>
            <p>Your account cannot view platform subscriptions.</p>
          </div>
        </div>
      }
    >
      <SubscriptionListContent
        fixedStatus={fixedStatus}
        title={title}
        description={description}
      />
    </PermissionGate>
  );
}

function SubscriptionListContent({
  fixedStatus,
  title,
  description,
}: Required<Pick<SubscriptionListPageProps, 'title' | 'description'>> &
  Pick<SubscriptionListPageProps, 'fixedStatus'>) {
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus | ''>(
    fixedStatus ?? '',
  );
  const [sortValue, setSortValue] = useState('currentPeriodEnd:asc');

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const selectedSort = useMemo(() => {
    const [sortBy, order] = sortValue.split(':') as [
      SubscriptionSortField,
      SortOrder,
    ];
    return { sortBy, order };
  }, [sortValue]);

  const effectiveStatus = fixedStatus ?? (status || undefined);
  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search,
      status: effectiveStatus,
      sortBy: selectedSort.sortBy,
      order: selectedSort.order,
    }),
    [effectiveStatus, page, search, selectedSort],
  );

  const { data, error, loading, reload } = useSubscriptions(query);

  const handleAssign = async (input: SubscriptionCreateInput) => {
    setAssigning(true);
    setAssignError(null);
    try {
      await createPlatformSubscription(input);
      setShowAssignDialog(false);
      reload();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign subscription');
    } finally {
      setAssigning(false);
    }
  };

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  function updateStatus(value: string) {
    setPage(1);
    setStatus(value as SubscriptionStatus | '');
  }

  function updateSort(value: string) {
    setPage(1);
    setSortValue(value);
  }

  const totalPages = data?.meta.totalPages ?? 1;
  const totalItems = data?.meta.total ?? 0;

  return (
    <section className="subscriptions-page" aria-labelledby="subscriptions-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">SaaS commercial</p>
          <h1 id="subscriptions-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="button button-primary" type="button" onClick={() => setShowAssignDialog(true)}>
            Assign Subscription
          </button>
          <button className="button" type="button" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
      </div>

      {assignError && (
        <div className="subscription-feedback subscription-feedback-error" role="alert" style={{ marginBottom: '16px' }}>
          <span>{assignError}</span>
          <button type="button" onClick={() => setAssignError(null)}>Dismiss</button>
        </div>
      )}

      <AssignSubscriptionDialog
        open={showAssignDialog}
        loading={assigning}
        onConfirm={handleAssign}
        onCancel={() => setShowAssignDialog(false)}
      />

      <nav className="subscription-tabs" aria-label="Subscription views">
        <NavLink
          className={({ isActive }) =>
            `subscription-tab${isActive ? ' subscription-tab-active' : ''}`
          }
          end
          to="/subscriptions"
        >
          All
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `subscription-tab${isActive ? ' subscription-tab-active' : ''}`
          }
          to="/subscriptions/trials"
        >
          Trials
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `subscription-tab${isActive ? ' subscription-tab-active' : ''}`
          }
          to="/subscriptions/expiring"
        >
          Expiring
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `subscription-tab${isActive ? ' subscription-tab-active' : ''}`
          }
          to="/subscriptions/suspended"
        >
          Suspended
        </NavLink>
      </nav>

      <form className="subscription-toolbar" onSubmit={submitSearch}>
        <label className="subscription-field">
          Search
          <input
            className="subscription-input"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Organization, plan, or subscription ID"
          />
        </label>
        <label className="subscription-field">
          Status
          <select
            className="subscription-select"
            disabled={Boolean(fixedStatus)}
            value={fixedStatus ?? status}
            onChange={(event) => updateStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="subscription-field">
          Sort
          <select
            className="subscription-select"
            value={sortValue}
            onChange={(event) => updateSort(event.target.value)}
          >
            {sortOptions.map((option) => (
              <option
                key={`${option.sortBy}:${option.order}`}
                value={`${option.sortBy}:${option.order}`}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Apply
        </button>
      </form>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading subscriptions...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Subscriptions unavailable</strong>
            <p>{error}</p>
          </div>
          <button className="button button-secondary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="state-panel">
          <div>
            <strong>No subscriptions found</strong>
            <p>Adjust the search, filter, or sorting criteria.</p>
          </div>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <div className="subscription-table-wrap">
            <table className="subscription-table">
              <thead>
                <tr>
                  <th scope="col">Organization</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Period</th>
                  <th scope="col">Billing</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((subscription) => (
                  <SubscriptionRow
                    key={subscription.id}
                    subscription={subscription}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="subscription-pagination">
            <span>
              Showing page {data.meta.page} of {totalPages} for {totalItems}{' '}
              subscriptions
            </span>
            <div className="subscription-pagination-actions">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={page >= totalPages}
                type="button"
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SubscriptionRow({
  subscription,
}: {
  subscription: OrganizationSubscription;
}) {
  const organizationName = subscription.organization?.name ?? 'Unknown organization';
  const planName = subscription.plan?.name ?? 'Unassigned plan';

  return (
    <tr>
      <td>
        <Link
          className="subscription-row-link"
          to={`/subscriptions/${subscription.id}`}
        >
          {organizationName}
        </Link>
        <div className="subscription-muted">{subscription.organization?.primaryEmail}</div>
      </td>
      <td>
        <strong>{planName}</strong>
        <div className="subscription-muted">{subscription.plan?.key}</div>
      </td>
      <td>
        <StatusPill status={subscription.status} />
      </td>
      <td>
        <strong>{formatDate(subscription.currentPeriodEnd)}</strong>
        <div className="subscription-muted">
          Starts {formatDate(subscription.currentPeriodStart)}
        </div>
      </td>
      <td>
        <strong>
          {subscription.currency} {subscription.priceAtSubscription}
        </strong>
        <div className="subscription-muted">
          {formatStatus(subscription.billingInterval)}
        </div>
      </td>
      <td>{formatDate(subscription.updatedAt)}</td>
    </tr>
  );
}

export function StatusPill({ status }: { status: SubscriptionStatus }) {
  return (
    <span
      className={`subscription-pill subscription-pill-${status
        .toLowerCase()
        .replaceAll('_', '-')}`}
    >
      {formatStatus(status)}
    </span>
  );
}
