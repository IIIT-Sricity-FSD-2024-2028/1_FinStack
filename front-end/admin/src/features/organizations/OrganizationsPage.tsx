import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import type {
  OrganizationListQuery,
  OrganizationStatus,
} from '../../types/organization';
import {
  formatDate,
  organizationStatuses,
  statusLabel,
  statusTone,
} from './organization-ui';
import { useOrganizations } from './useOrganizations';

export function OrganizationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrganizationStatus | ''>('');
  const query = useMemo<OrganizationListQuery>(
    () => ({
      page,
      limit: 10,
      search,
      status,
      sortBy: 'createdAt',
      order: 'desc',
    }),
    [page, search, status],
  );
  const { data, error, loading, reload } = useOrganizations(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <section aria-labelledby="organizations-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Customer core</p>
          <h1 id="organizations-title">Organizations</h1>
          <p className="page-description">
            Manage the canonical customer records used by the Admin control plane
            and future Client V2.
          </p>
        </div>
        <PermissionGate permission="platform.organization.create">
          <Link className="button button-link" to="/organizations/new">
            New organization
          </Link>
        </PermissionGate>
      </div>

      <form className="filter-bar" onSubmit={submitSearch}>
        <input
          aria-label="Search organizations"
          placeholder="Search name, slug, or email"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as OrganizationStatus | '');
          }}
        >
          <option value="">All statuses</option>
          {organizationStatuses.map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>
        <button className="button button-secondary" type="submit">
          Search
        </button>
      </form>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading organizations...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Organizations unavailable</strong>
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
            <strong>No organizations found</strong>
            <p>Create a customer organization or adjust the current filters.</p>
          </div>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Primary email</th>
                  <th>Country</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((organization) => (
                  <tr
                    key={organization.id}
                    onClick={() => navigate(`/organizations/${organization.id}`)}
                  >
                    <td>
                      <strong>{organization.name}</strong>
                      <span>{organization.slug || 'No slug'}</span>
                    </td>
                    <td>
                      <span
                        className={`status-pill status-pill-${statusTone(
                          organization.status,
                        )}`}
                      >
                        {statusLabel(organization.status)}
                      </span>
                    </td>
                    <td>{organization.primaryEmail}</td>
                    <td>{organization.country || 'Not set'}</td>
                    <td>{formatDate(organization.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <span>
              Page {data.page} of {data.totalPages} - {data.total} total
            </span>
            <div>
              <button
                className="button button-secondary button-compact"
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-compact"
                disabled={data.page >= data.totalPages}
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
