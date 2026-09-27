import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { useAuth } from '../../auth/useAuth';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../../components/OperationalStates';
import { useTransientSuccess } from '../../components/useTransientSuccess';
import {
  assignPlatformStaffRole,
  deactivatePlatformStaff,
  reactivatePlatformStaff,
  removePlatformStaffRole,
  updatePlatformStaff,
} from '../../services/api/platform-staff';
import { getPlatformRoles } from '../../services/api/platform-roles';
import type { PlatformRole } from '../../types/platform-role';
import { adminErrorMessage, formatAdminDate } from '../access/access-ui';
import { StaffForm, type StaffFormValues } from './StaffForm';
import { StatusBadge } from './StaffPage';
import { usePlatformStaffDetail } from './usePlatformStaff';

type StaffConfirmation =
  | { kind: 'deactivate' }
  | { kind: 'remove-role'; roleId: string; roleName: string };

export function StaffDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const { staff, roles, error, loading, reload } = usePlatformStaffDetail(id);
  const [availableRoles, setAvailableRoles] = useState<PlatformRole[]>([]);
  const [roleCatalogError, setRoleCatalogError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    message: actionSuccess,
    showSuccess,
    clearSuccess,
  } = useTransientSuccess();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<StaffConfirmation | null>(null);

  useEffect(() => {
    if (
      !hasPermission('platform.staff.role.assign') ||
      !hasPermission('platform.role.view')
    ) {
      return;
    }
    const controller = new AbortController();
    void getPlatformRoles(
      {
        page: 1,
        limit: 100,
        isActive: true,
        sortBy: 'name',
        order: 'asc',
      },
      controller.signal,
    )
      .then((result) => setAvailableRoles(result.items))
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setRoleCatalogError(
            adminErrorMessage(caught, 'Available roles could not be loaded.'),
          );
        }
      });
    return () => controller.abort();
  }, [hasPermission]);

  const assignableRoles = useMemo(() => {
    const assignedIds = new Set(roles.map((assignment) => assignment.role.id));
    return availableRoles.filter((role) => !assignedIds.has(role.id));
  }, [availableRoles, roles]);

  async function save(values: StaffFormValues) {
    if (!staff) return;
    await runMutation('edit', 'Staff profile updated.', async () => {
      await updatePlatformStaff(staff.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
      });
    });
  }

  async function reactivate() {
    if (!staff) return;
    await runMutation('reactivate', 'Staff member reactivated.', async () => {
      await reactivatePlatformStaff(staff.id);
    });
  }

  async function assignRole() {
    if (!staff || !selectedRoleId) return;
    await runMutation('assign-role', 'Role assigned.', async () => {
      await assignPlatformStaffRole(staff.id, selectedRoleId);
      setSelectedRoleId('');
    });
  }

  async function confirmDestructiveAction() {
    if (!staff || !confirmation) return;
    if (confirmation.kind === 'deactivate') {
      await runMutation('deactivate', 'Staff member deactivated.', async () => {
        await deactivatePlatformStaff(staff.id);
      });
    } else {
      await runMutation(
        `remove-${confirmation.roleId}`,
        'Role removed.',
        async () => {
          await removePlatformStaffRole(staff.id, confirmation.roleId);
        },
      );
    }
    setConfirmation(null);
  }

  async function runMutation(
    key: string,
    successMessage: string,
    mutation: () => Promise<void>,
  ) {
    setActionError(null);
    clearSuccess();
    setPendingAction(key);
    try {
      await mutation();
      await reload();
      showSuccess(successMessage);
    } catch (caught) {
      setActionError(adminErrorMessage(caught, 'The requested staff change failed.'));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section aria-labelledby="staff-detail-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Staff detail</p>
          <h1 id="staff-detail-title">
            {staff ? `${staff.firstName} ${staff.lastName}` : 'Platform staff'}
          </h1>
          <p className="page-description">
            Maintain profile data, account lifecycle, and delegated roles.
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/staff">
          Back to staff
        </Link>
      </div>

      {loading && <LoadingState label="Loading staff details..." />}
      {!loading && error && (
        <ErrorState
          title="Staff member unavailable"
          message={error}
          action={
            <button className="button button-secondary" onClick={() => void reload()}>
              Try again
            </button>
          }
        />
      )}

      {!loading && staff && (
        <>
          <div className="status-card detail-summary">
            <div className="detail-primary">
              <StatusBadge status={staff.status} />
              <strong>{staff.email}</strong>
            </div>
            <dl className="detail-metadata">
              <div><dt>Last login</dt><dd>{formatAdminDate(staff.lastLoginAt)}</dd></div>
              <div><dt>Created</dt><dd>{formatAdminDate(staff.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{formatAdminDate(staff.updatedAt)}</dd></div>
            </dl>
          </div>

          <div className="lifecycle-actions" aria-label="Staff lifecycle actions">
            {staff.status === 'ACTIVE' && (
              <PermissionGate permission="platform.staff.disable">
                <button className="button button-secondary" disabled={pendingAction !== null} onClick={() => setConfirmation({ kind: 'deactivate' })} type="button">
                  {pendingAction === 'deactivate' ? 'Deactivating...' : 'Deactivate'}
                </button>
              </PermissionGate>
            )}
            {staff.status === 'INACTIVE' && (
              <PermissionGate permission="platform.staff.activate">
                <button className="button button-secondary" disabled={pendingAction !== null} onClick={() => void reactivate()} type="button">
                  {pendingAction === 'reactivate' ? 'Reactivating...' : 'Reactivate'}
                </button>
              </PermissionGate>
            )}
            {staff.status === 'SUSPENDED' && <span className="muted-copy">Suspended accounts have no standard lifecycle action.</span>}
          </div>

          {actionError && <ErrorState title="Change not applied" message={actionError} />}
          {actionSuccess && <div className="state-panel state-panel-success" role="status"><strong>{actionSuccess}</strong></div>}

          <section className="status-card form-panel section-panel" aria-labelledby="profile-heading">
            <div className="section-heading"><div><h2 id="profile-heading">Profile</h2><p>Name and work email only. Lifecycle and access are managed separately.</p></div></div>
            <PermissionGate permission="platform.staff.update" fallback={<p className="muted-copy">You do not have permission to edit this profile.</p>}>
              <StaffForm staff={staff} submitting={pendingAction === 'edit'} submitLabel="Save profile" onSubmit={save} />
            </PermissionGate>
          </section>

          <section className="status-card form-panel section-panel" aria-labelledby="roles-heading">
            <div className="section-heading"><div><h2 id="roles-heading">Assigned roles</h2><p>Effective access also depends on active staff and active role state.</p></div></div>
            {roles.length === 0 ? <p className="empty-copy">No roles are assigned to this staff member.</p> : (
              <div className="data-table-wrap">
                <table className="data-table compact-table">
                  <thead><tr><th>Role</th><th>Key</th><th>Type</th><th>Status</th><th>Assigned</th><th>Actions</th></tr></thead>
                  <tbody>{roles.map((assignment) => (
                    <tr key={assignment.role.id}>
                      <td><strong>{assignment.role.name}</strong></td>
                      <td><code>{assignment.role.key}</code></td>
                      <td>{assignment.role.isSystemPreset ? 'System' : 'Custom'}</td>
                      <td><span className={`status-pill status-pill-${assignment.role.isActive ? 'available' : 'unavailable'}`}>{assignment.role.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td>{formatAdminDate(assignment.assignedAt)}</td>
                      <td><PermissionGate permission="platform.staff.role.assign"><button className="button button-secondary button-compact" disabled={pendingAction !== null} onClick={() => setConfirmation({ kind: 'remove-role', roleId: assignment.role.id, roleName: assignment.role.name })} type="button">{pendingAction === `remove-${assignment.role.id}` ? 'Removing...' : 'Remove'}</button></PermissionGate></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            <PermissionGate permission="platform.staff.role.assign">
              <div className="inline-management">
                <div>
                  <h3>Assign role</h3>
                  {!hasPermission('platform.role.view') && <p className="muted-copy">Role catalog access is required to select a role. Existing assignments can still be removed.</p>}
                  {roleCatalogError && <p className="field-error" role="alert">{roleCatalogError}</p>}
                </div>
                <div className="inline-controls">
                  <select aria-label="Role to assign" disabled={!hasPermission('platform.role.view') || pendingAction !== null} value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
                    <option value="">Select an active role</option>
                    {assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.key})</option>)}
                  </select>
                  <button className="button" disabled={!selectedRoleId || pendingAction !== null} onClick={() => void assignRole()} type="button">{pendingAction === 'assign-role' ? 'Assigning...' : 'Assign role'}</button>
                </div>
              </div>
            </PermissionGate>
          </section>
        </>
      )}
      <ConfirmDialog
        confirmLabel={confirmation?.kind === 'deactivate' ? 'Deactivate staff' : 'Remove role'}
        destructive
        message={confirmation?.kind === 'deactivate'
          ? `Deactivate ${staff?.firstName ?? ''} ${staff?.lastName ?? ''}? Their active sessions will be revoked.`
          : `Remove ${confirmation?.roleName ?? 'this role'} from this staff member?`}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmDestructiveAction()}
        open={confirmation !== null}
        pending={pendingAction !== null}
        title={confirmation?.kind === 'deactivate' ? 'Deactivate staff member' : 'Remove assigned role'}
      />
    </section>
  );
}
