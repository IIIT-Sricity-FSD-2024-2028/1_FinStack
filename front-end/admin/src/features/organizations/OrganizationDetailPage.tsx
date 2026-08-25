import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import {
  archiveOrganization,
  cancelOrganization,
  reactivateOrganization,
  suspendOrganization,
  updateOrganization,
} from '../../services/api/platform-organizations';
import type {
  Organization,
  OrganizationPayload,
} from '../../types/organization';
import { OrganizationForm } from './OrganizationForm';
import { formatDate, statusLabel, statusTone } from './organization-ui';
import { useOrganization } from './useOrganization';

export function OrganizationDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useOrganization(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  async function save(payload: OrganizationPayload) {
    if (!data) return;
    setActionError(null);
    setSubmitting(true);
    try {
      await updateOrganization(data.id, payload);
      await reload();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Organization could not be updated.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function runLifecycle(
    label: string,
    permission: string,
    action: (id: string) => Promise<Organization>,
  ) {
    if (!data || !window.confirm(`${label} ${data.name}?`)) return;
    setActionError(null);
    setRunningAction(permission);
    try {
      await action(data.id);
      await reload();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : `${label} action failed.`,
      );
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <section aria-labelledby="organization-detail-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Organization detail</p>
          <h1 id="organization-detail-title">{data?.name ?? 'Organization'}</h1>
          <p className="page-description">
            View and manage the canonical customer metadata and lifecycle state.
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/organizations">
          Back to organizations
        </Link>
      </div>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading organization...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Organization unavailable</strong>
            <p>{error}</p>
          </div>
          <button className="button button-secondary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="detail-grid">
            <div className="summary-banner organization-summary">
              <span
                className={`status-dot status-dot-${statusTone(data.status)}`}
                aria-hidden="true"
              />
              <div>
                <strong>{statusLabel(data.status)}</strong>
                <span>Status changed {formatDate(data.statusChangedAt)}</span>
              </div>
            </div>
            <article className="status-card detail-card">
              <span>Primary email</span>
              <strong>{data.primaryEmail}</strong>
            </article>
            <article className="status-card detail-card">
              <span>Currency</span>
              <strong>{data.defaultCurrency}</strong>
            </article>
            <article className="status-card detail-card">
              <span>Created</span>
              <strong>{formatDate(data.createdAt)}</strong>
            </article>
          </div>

          <div className="lifecycle-actions">
            <PermissionGate permission="platform.organization.suspend">
              <button
                className="button button-secondary"
                disabled={runningAction !== null || data.status === 'SUSPENDED'}
                onClick={() =>
                  void runLifecycle(
                    'Suspend',
                    'platform.organization.suspend',
                    suspendOrganization,
                  )
                }
              >
                {runningAction === 'platform.organization.suspend'
                  ? 'Suspending...'
                  : 'Suspend'}
              </button>
            </PermissionGate>
            <PermissionGate permission="platform.organization.reactivate">
              <button
                className="button button-secondary"
                disabled={runningAction !== null || data.status !== 'SUSPENDED'}
                onClick={() =>
                  void runLifecycle(
                    'Reactivate',
                    'platform.organization.reactivate',
                    reactivateOrganization,
                  )
                }
              >
                {runningAction === 'platform.organization.reactivate'
                  ? 'Reactivating...'
                  : 'Reactivate'}
              </button>
            </PermissionGate>
            <PermissionGate permission="platform.organization.cancel">
              <button
                className="button button-secondary"
                disabled={
                  runningAction !== null ||
                  data.status === 'CANCELLED' ||
                  data.status === 'ARCHIVED'
                }
                onClick={() =>
                  void runLifecycle(
                    'Cancel',
                    'platform.organization.cancel',
                    cancelOrganization,
                  )
                }
              >
                {runningAction === 'platform.organization.cancel'
                  ? 'Cancelling...'
                  : 'Cancel'}
              </button>
            </PermissionGate>
            <PermissionGate permission="platform.organization.archive">
              <button
                className="button button-secondary"
                disabled={runningAction !== null || data.status !== 'CANCELLED'}
                onClick={() =>
                  void runLifecycle(
                    'Archive',
                    'platform.organization.archive',
                    archiveOrganization,
                  )
                }
              >
                {runningAction === 'platform.organization.archive'
                  ? 'Archiving...'
                  : 'Archive'}
              </button>
            </PermissionGate>
          </div>

          {actionError && (
            <div className="state-panel state-panel-error" role="alert">
              <strong>{actionError}</strong>
            </div>
          )}

          <div className="status-card form-panel">
            <h2>Metadata</h2>
            <PermissionGate
              permission="platform.organization.update"
              fallback={
                <p className="muted-copy">
                  You do not have permission to update organization metadata.
                </p>
              }
            >
              <OrganizationForm
                organization={data}
                submitting={submitting}
                submitLabel="Save metadata"
                onSubmit={save}
              />
            </PermissionGate>
          </div>
        </>
      )}
    </section>
  );
}
