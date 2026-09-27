import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import {
  ErrorState,
  LoadingState,
  Pagination,
} from '../../components/OperationalStates';
import type {
  PlatformStaffListQuery,
  PlatformStaffStatus,
} from '../../types/platform-staff';
import { formatAdminDate } from '../access/access-ui';
import { usePlatformStaffList } from './usePlatformStaff';

const statuses: PlatformStaffStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export function StaffPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PlatformStaffStatus | ''>('');
  const [sortBy, setSortBy] =
    useState<NonNullable<PlatformStaffListQuery['sortBy']>>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const query = useMemo<PlatformStaffListQuery>(
    () => ({ page, limit: 10, search, status, sortBy, order }),
    [order, page, search, sortBy, status],
  );
  const { data, error, loading, reload } = usePlatformStaffList(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <section aria-labelledby="staff-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Access operations</p>
          <h1 id="staff-title">Platform staff</h1>
          <p className="page-description">
            Manage internal identities, lifecycle state, and delegated roles.
          </p>
        </div>
        <PermissionGate permission="platform.staff.create">
          <Link className="button button-link" to="/staff/new">
            New staff member
          </Link>
        </PermissionGate>
      </div>

      <form className="filter-bar filter-bar-wide" onSubmit={submitSearch}>
        <input
          aria-label="Search staff"
          placeholder="Search name or email"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
        <select
          aria-label="Filter staff status"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as PlatformStaffStatus | '');
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item.charAt(0) + item.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort staff"
          value={sortBy}
          onChange={(event) => {
            setPage(1);
            setSortBy(event.target.value as typeof sortBy);
          }}
        >
          <option value="createdAt">Created</option>
          <option value="firstName">First name</option>
          <option value="lastName">Last name</option>
          <option value="email">Email</option>
          <option value="status">Status</option>
          <option value="updatedAt">Updated</option>
        </select>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => setOrder((value) => (value === 'asc' ? 'desc' : 'asc'))}
        >
          {order === 'asc' ? 'Ascending' : 'Descending'}
        </button>
        <button className="button button-secondary" type="submit">
          Search
        </button>
      </form>

      {loading && <LoadingState label="Loading platform staff..." />}
      {!loading && error && (
        <ErrorState
          title="Staff unavailable"
          message={error}
          action={
            <button
              className="button button-secondary"
              onClick={() => void reload()}
            >
              Try again
            </button>
          }
        />
      )}
      {!loading && data?.items.length === 0 && (
        <div className="state-panel">
          <div>
            <strong>No staff found</strong>
            <p>Adjust the filters or create a platform staff account.</p>
          </div>
        </div>
      )}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="data-table-wrap">
            <table className="data-table access-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((staff) => (
                  <tr key={staff.id}>
                    <td>
                      <strong>{staff.firstName} {staff.lastName}</strong>
                    </td>
                    <td>{staff.email}</td>
                    <td><StatusBadge status={staff.status} /></td>
                    <td>{formatAdminDate(staff.lastLoginAt)}</td>
                    <td>{formatAdminDate(staff.createdAt)}</td>
                    <td>
                      <button
                        className="button button-secondary button-compact"
                        type="button"
                        onClick={() => navigate(`/staff/${staff.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}

export function StatusBadge({ status }: { status: PlatformStaffStatus }) {
  return (
    <span
      className={`status-pill status-pill-${status === 'ACTIVE' ? 'available' : 'unavailable'}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
