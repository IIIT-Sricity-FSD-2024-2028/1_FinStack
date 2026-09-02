import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { ErrorState, LoadingState, Pagination } from '../../components/OperationalStates';
import type { PlatformRoleListQuery } from '../../types/platform-role';
import { formatAdminDate } from '../access/access-ui';
import { usePlatformRoleList } from './usePlatformRoles';

export function RolesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<boolean | ''>('');
  const [isSystemPreset, setIsSystemPreset] = useState<boolean | ''>('');
  const [sortBy, setSortBy] = useState<NonNullable<PlatformRoleListQuery['sortBy']>>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const query = useMemo<PlatformRoleListQuery>(() => ({ page, limit: 10, search, isActive, isSystemPreset, sortBy, order }), [isActive, isSystemPreset, order, page, search, sortBy]);
  const { data, error, loading, reload } = usePlatformRoleList(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <section aria-labelledby="roles-title">
      <div className="page-header">
        <div><p className="eyebrow">Access model</p><h1 id="roles-title">Platform roles</h1><p className="page-description">Manage custom roles and inspect FinStack-managed system presets.</p></div>
        <PermissionGate permission="platform.role.manage"><Link className="button button-link" to="/roles/new">New custom role</Link></PermissionGate>
      </div>

      <form className="filter-bar filter-bar-wide" onSubmit={submitSearch}>
        <input aria-label="Search roles" placeholder="Search name or key" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
        <select aria-label="Filter role status" value={String(isActive)} onChange={(event) => { setPage(1); setIsActive(event.target.value === '' ? '' : event.target.value === 'true'); }}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select>
        <select aria-label="Filter role type" value={String(isSystemPreset)} onChange={(event) => { setPage(1); setIsSystemPreset(event.target.value === '' ? '' : event.target.value === 'true'); }}><option value="">All types</option><option value="true">System</option><option value="false">Custom</option></select>
        <select aria-label="Sort roles" value={sortBy} onChange={(event) => { setPage(1); setSortBy(event.target.value as typeof sortBy); }}><option value="createdAt">Created</option><option value="name">Name</option><option value="key">Key</option><option value="isActive">Status</option><option value="isSystemPreset">Type</option><option value="updatedAt">Updated</option></select>
        <button className="button button-secondary" type="button" onClick={() => setOrder((value) => value === 'asc' ? 'desc' : 'asc')}>{order === 'asc' ? 'Ascending' : 'Descending'}</button>
        <button className="button button-secondary" type="submit">Search</button>
      </form>

      {loading && <LoadingState label="Loading platform roles..." />}
      {!loading && error && <ErrorState title="Roles unavailable" message={error} action={<button className="button button-secondary" onClick={() => void reload()}>Try again</button>} />}
      {!loading && data?.items.length === 0 && <div className="state-panel"><div><strong>No roles found</strong><p>Adjust the filters or create a custom role.</p></div></div>}
      {!loading && data && data.items.length > 0 && <>
        <div className="data-table-wrap"><table className="data-table access-table"><thead><tr><th>Name</th><th>Key</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{data.items.map((role) => <tr key={role.id}><td><strong>{role.name}</strong>{role.isSystemPreset && <small className="managed-copy">Managed by FinStack</small>}</td><td><code>{role.key}</code></td><td>{role.isSystemPreset ? 'System' : 'Custom'}</td><td><span className={`status-pill status-pill-${role.isActive ? 'available' : 'unavailable'}`}>{role.isActive ? 'Active' : 'Inactive'}</span></td><td>{formatAdminDate(role.createdAt)}</td><td><button className="button button-secondary button-compact" type="button" onClick={() => navigate(`/roles/${role.id}`)}>View</button></td></tr>)}</tbody></table></div>
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
      </>}
    </section>
  );
}
