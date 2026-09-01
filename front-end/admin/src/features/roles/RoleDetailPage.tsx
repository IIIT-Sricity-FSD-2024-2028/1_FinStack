import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../../components/OperationalStates';
import { useTransientSuccess } from '../../components/useTransientSuccess';
import {
  assignPlatformRolePermission,
  deactivatePlatformRole,
  reactivatePlatformRole,
  removePlatformRolePermission,
  updatePlatformRole,
} from '../../services/api/platform-roles';
import type { PlatformPermission } from '../../types/platform-role';
import {
  adminErrorMessage,
  formatAdminDate,
  permissionGroup,
} from '../access/access-ui';
import { RoleForm, type RoleFormValues } from './RoleForm';
import { PermissionSelector } from './PermissionSelector';
import { usePlatformRoleDetail } from './usePlatformRoles';

type RoleConfirmation =
  | { kind: 'deactivate' }
  | { kind: 'remove-permission'; permission: PlatformPermission };

export function RoleDetailPage() {
  const { id } = useParams();
  const { role, assignments, catalog, error, loading, reload } = usePlatformRoleDetail(id);
  const [selectedPermissionId, setSelectedPermissionId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    message: actionSuccess,
    showSuccess,
    clearSuccess,
  } = useTransientSuccess();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<RoleConfirmation | null>(null);

  const availablePermissions = useMemo(() => {
    const assignedIds = new Set(assignments.map((item) => item.permission.id));
    return catalog.filter((permission) => !assignedIds.has(permission.id));
  }, [assignments, catalog]);

  const groupedAssignments = useMemo(() => {
    const groups = new Map<string, typeof assignments>();
    assignments.forEach((assignment) => {
      const group = permissionGroup(assignment.permission.key);
      groups.set(group, [...(groups.get(group) ?? []), assignment]);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [assignments]);

  async function save(values: RoleFormValues) {
    if (!role) return;
    await runMutation('edit', 'Role metadata updated.', async () => {
      await updatePlatformRole(role.id, {
        name: values.name,
        description: values.description || null,
      });
    });
  }

  async function reactivate() {
    if (!role) return;
    await runMutation('reactivate', 'Role reactivated.', async () => {
      await reactivatePlatformRole(role.id);
    });
  }

  async function grantPermission() {
    if (!role || !selectedPermissionId) return;
    await runMutation('grant', 'Permission granted.', async () => {
      await assignPlatformRolePermission(role.id, selectedPermissionId);
      setSelectedPermissionId('');
    });
  }

  async function confirmDestructiveAction() {
    if (!role || !confirmation) return;
    if (confirmation.kind === 'deactivate') {
      await runMutation('deactivate', 'Role deactivated.', async () => {
        await deactivatePlatformRole(role.id);
      });
    } else {
      await runMutation(
        `remove-${confirmation.permission.id}`,
        'Permission removed.',
        async () => {
          await removePlatformRolePermission(role.id, confirmation.permission.id);
        },
      );
    }
    setConfirmation(null);
  }

  async function runMutation(key: string, successMessage: string, mutation: () => Promise<void>) {
    setActionError(null);
    clearSuccess();
    setPendingAction(key);
    try {
      await mutation();
      await reload();
      showSuccess(successMessage);
    } catch (caught) {
      setActionError(adminErrorMessage(caught, 'The requested role change failed.'));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section aria-labelledby="role-detail-title">
      <div className="page-header">
        <div><p className="eyebrow">Role detail</p><h1 id="role-detail-title">{role?.name ?? 'Platform role'}</h1><p className="page-description">Inspect role metadata and its exact effective permission set.</p></div>
        <Link className="button button-secondary button-link" to="/roles">Back to roles</Link>
      </div>

      {loading && <LoadingState label="Loading role details..." />}
      {!loading && error && <ErrorState title="Role unavailable" message={error} action={<button className="button button-secondary" onClick={() => void reload()}>Try again</button>} />}

      {!loading && role && <>
        <div className="status-card detail-summary">
          <div className="detail-primary">
            <span className={`status-pill status-pill-${role.isActive ? 'available' : 'unavailable'}`}>{role.isActive ? 'Active' : 'Inactive'}</span>
            <span className={role.isSystemPreset ? 'system-marker' : 'custom-marker'}>{role.isSystemPreset ? 'System - Managed by FinStack' : 'Custom role'}</span>
            <code>{role.key}</code>
          </div>
          <p className="detail-description">{role.description || 'No description provided.'}</p>
          <dl className="detail-metadata"><div><dt>Created</dt><dd>{formatAdminDate(role.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatAdminDate(role.updatedAt)}</dd></div></dl>
        </div>

        {role.isSystemPreset ? (
          <div className="state-panel managed-notice"><div><strong>FinStack-managed system role</strong><p>Metadata, lifecycle, and permissions are read-only.</p></div></div>
        ) : (
          <PermissionGate permission="platform.role.manage">
            <div className="lifecycle-actions" aria-label="Role lifecycle actions">
              {role.isActive ? <button className="button button-secondary" disabled={pendingAction !== null} onClick={() => setConfirmation({ kind: 'deactivate' })} type="button">{pendingAction === 'deactivate' ? 'Deactivating...' : 'Deactivate'}</button> : <button className="button button-secondary" disabled={pendingAction !== null} onClick={() => void reactivate()} type="button">{pendingAction === 'reactivate' ? 'Reactivating...' : 'Reactivate'}</button>}
            </div>
          </PermissionGate>
        )}

        {actionError && <ErrorState title="Change not applied" message={actionError} />}
        {actionSuccess && <div className="state-panel state-panel-success" role="status"><strong>{actionSuccess}</strong></div>}

        {!role.isSystemPreset && <section className="status-card form-panel section-panel" aria-labelledby="role-metadata-heading"><div className="section-heading"><div><h2 id="role-metadata-heading">Metadata</h2><p>The stable role key cannot be changed after creation.</p></div></div><PermissionGate permission="platform.role.manage" fallback={<p className="muted-copy">You do not have permission to edit this custom role.</p>}><RoleForm role={role} submitting={pendingAction === 'edit'} submitLabel="Save metadata" onSubmit={save} /></PermissionGate></section>}

        <section className="status-card form-panel section-panel" aria-labelledby="permissions-heading">
          <div className="section-heading"><div><h2 id="permissions-heading">Assigned permissions</h2><p>{assignments.length} exact permission{assignments.length === 1 ? '' : 's'} assigned.</p></div></div>
          {groupedAssignments.length === 0 ? <p className="empty-copy">No permissions are assigned to this role.</p> : <div className="permission-groups">{groupedAssignments.map(([group, items]) => <section className="permission-group" key={group}><h3>{group}</h3><div className="permission-list">{items.map((assignment) => <div className="permission-row" key={assignment.permission.id}><div><code>{assignment.permission.key}</code><p>{assignment.permission.description}</p></div>{!role.isSystemPreset && <PermissionGate permission="platform.role.manage"><button className="button button-secondary button-compact" disabled={pendingAction !== null} onClick={() => setConfirmation({ kind: 'remove-permission', permission: assignment.permission })} type="button">{pendingAction === `remove-${assignment.permission.id}` ? 'Removing...' : 'Remove'}</button></PermissionGate>}</div>)}</div></section>)}</div>}

          {!role.isSystemPreset && <PermissionGate permission="platform.role.manage"><div className="inline-management"><div><h3>Grant permission</h3><p className="muted-copy">The backend limits grants to permissions you currently hold.</p></div><div className="inline-controls"><PermissionSelector disabled={pendingAction !== null} onChange={setSelectedPermissionId} options={availablePermissions} value={selectedPermissionId} /><button className="button" disabled={!selectedPermissionId || pendingAction !== null} onClick={() => void grantPermission()} type="button">{pendingAction === 'grant' ? 'Granting...' : 'Grant permission'}</button></div></div></PermissionGate>}
        </section>
      </>}
      <ConfirmDialog
        confirmLabel={confirmation?.kind === 'deactivate' ? 'Deactivate role' : 'Remove permission'}
        destructive
        message={confirmation?.kind === 'deactivate'
          ? `Deactivate ${role?.name ?? 'this role'}? Existing staff assignments will remain.`
          : `Remove ${confirmation?.permission.key ?? 'this permission'} from ${role?.name ?? 'this role'}?`}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmDestructiveAction()}
        open={confirmation !== null}
        pending={pendingAction !== null}
        title={confirmation?.kind === 'deactivate' ? 'Deactivate custom role' : 'Remove assigned permission'}
      />
    </section>
  );
}
