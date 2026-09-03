import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../../components/OperationalStates';
import { platformCatalogApi } from '../../services/api/platform-catalog';
import { platformSubscriptionsApi } from '../../services/api/platform-subscriptions';
import type { Plan } from '../../types/catalog';
import { adminErrorMessage, formatAdminDate } from '../access/access-ui';
import { formatMoney, statusLabel, statusTone } from './subscription-ui';
import { useSubscription } from './useSubscriptions';

export function SubscriptionDetailPage() {
  const { id } = useParams();
  const { data, history, error, loading, reload, pendingAction, runAction } = useSubscription(id);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'cancel' | 'reactivate' | null>(null);

  useEffect(() => {
    void platformCatalogApi.listPlans({ page: 1, limit: 100, status: 'ACTIVE', sortBy: 'name', order: 'asc' }).then((result) => setPlans(result.items)).catch(() => undefined);
  }, []);

  async function changePlan() {
    if (!id || !planId) return;
    setActionError(null);
    try { await runAction('plan-change', () => platformSubscriptionsApi.changePlan(id, planId, reason)); setPlanId(''); setReason(''); }
    catch (caught) { setActionError(adminErrorMessage(caught, 'Plan change could not be requested.')); }
  }

  async function confirmAction() {
    if (!id || !confirmation) return;
    setActionError(null);
    try {
      if (confirmation === 'cancel') await runAction('cancel', () => platformSubscriptionsApi.cancel(id, reason));
      else await runAction('reactivate', () => platformSubscriptionsApi.reactivate(id));
      setConfirmation(null); setReason('');
    } catch (caught) { setActionError(adminErrorMessage(caught, 'Subscription lifecycle change failed.')); }
  }

  return (
    <section aria-labelledby="subscription-detail-title">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link to="/subscriptions" style={{ color: 'inherit', textDecoration: 'none' }}>Commercial</Link>
            <span>/</span>
            <Link to="/subscriptions" style={{ color: 'inherit', textDecoration: 'none' }}>Subscriptions</Link>
            <span>/</span>
            <span>{data?.organization.name ?? '...'}</span>
          </p>
          <h1 id="subscription-detail-title" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
            {data?.organization.name ?? 'Subscription'}
            {data && (
              <span className={`status-pill status-pill-${statusTone(data.status)}`} style={{ fontSize: '13px' }}>
                {statusLabel(data.status)}
              </span>
            )}
          </h1>
          {data && (
            <p className="page-description">
              {data.plan.name} plan &bull; {data.organization.primaryEmail}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="button button-secondary button-link" to="/subscriptions">
            Back to subscriptions
          </Link>
          <PermissionGate permission="subscription.subscription.manage">
            {data?.status !== 'CANCELLED' && (
              <button
                className="button button-destructive"
                type="button"
                disabled={pendingAction !== null}
                onClick={() => setConfirmation('cancel')}
              >
                {pendingAction === 'cancel' ? 'Cancelling...' : 'Cancel subscription'}
              </button>
            )}
            {(data?.status === 'CANCELLED' || data?.status === 'SUSPENDED') && (
              <button
                className="button"
                type="button"
                disabled={pendingAction !== null}
                onClick={() => setConfirmation('reactivate')}
              >
                {pendingAction === 'reactivate' ? 'Reactivating...' : 'Reactivate'}
              </button>
            )}
          </PermissionGate>
        </div>
      </div>

      {loading && <LoadingState label="Loading subscription details..." />}
      {!loading && error && (
        <ErrorState
          title="Subscription unavailable"
          message={error}
          action={<button className="button button-secondary" onClick={() => void reload()}>Try again</button>}
        />
      )}

      {!loading && data && (
        <>
          <div className="status-grid" style={{ marginBottom: '32px' }}>
            <article className="status-card">
              <span className="muted-copy">Current Plan</span>
              <div style={{ marginTop: '8px' }}>
                <strong className="premium-metric" style={{ fontSize: '24px' }}>{data.plan.name}</strong>
              </div>
            </article>
            <article className="status-card">
              <span className="muted-copy">Recurring Price ({data.billingInterval.toLowerCase()})</span>
              <div style={{ marginTop: '8px' }}>
                <strong className="premium-metric" style={{ fontSize: '24px' }}>{formatMoney(data.priceAtSubscription, data.currency)}</strong>
              </div>
            </article>
            <article className="status-card">
              <span className="muted-copy">Total Seats</span>
              <div style={{ marginTop: '8px' }}>
                <strong className="premium-metric" style={{ fontSize: '24px' }}>{data.employeeCount}</strong>
              </div>
            </article>
            <article className="status-card">
              <span className="muted-copy">Period End</span>
              <div style={{ marginTop: '8px' }}>
                <strong className="premium-metric" style={{ fontSize: '24px' }}>{formatAdminDate(data.currentPeriodEnd)}</strong>
              </div>
            </article>
          </div>

          <div className="two-column-layout">
            <div className="support-main-column">
              <section className="status-card form-panel section-panel" aria-labelledby="price-heading" style={{ marginBottom: '24px' }}>
                <div className="section-heading">
                  <div>
                    <h2 id="price-heading">Financial Summary</h2>
                    <p>Commercial components stored on the canonical subscription snapshot.</p>
                  </div>
                </div>
                <div className="commercial-breakdown">
                  <div>
                    <span>Base plan</span>
                    <strong>{formatMoney(data.plan.basePrice, data.currency)}</strong>
                  </div>
                  <div>
                    <span>Employee component</span>
                    <strong>{formatMoney(data.employeeAmount, data.currency)}</strong>
                  </div>
                  <div>
                    <span>Feature add-ons</span>
                    <strong>{formatMoney(data.featureAmount, data.currency)}</strong>
                  </div>
                  <div>
                    <span>Total recurring price</span>
                    <strong>{formatMoney(data.priceAtSubscription, data.currency)}</strong>
                  </div>
                </div>
                <p className="muted-copy" style={{ marginTop: '12px' }}>
                  {data.employeeCount} purchased seats; {data.plan.includedEmployeeCount} included in the base plan.
                </p>
              </section>

              <section className="status-card form-panel section-panel" aria-labelledby="features-heading" style={{ marginBottom: '24px' }}>
                <div className="section-heading">
                  <div>
                    <h2 id="features-heading">Plan features</h2>
                    <p>Authoritative included entitlements and paid add-ons from the current plan.</p>
                  </div>
                </div>
                {(data.plan.features ?? []).length === 0 ? (
                  <p className="empty-copy">No enabled features are configured for this plan.</p>
                ) : (
                  <div className="permission-list">
                    {(data.plan.features ?? []).map((feature) => (
                      <div className="permission-row" key={feature.id}>
                        <div>
                          <code>{feature.key}</code>
                          <p className="muted-copy">{feature.name}</p>
                        </div>
                        <span className="muted-copy">
                          {feature.isAddOn ? `Add-on: ${formatMoney(feature.addOnPrice, data.currency)}` : feature.value === null ? 'Included' : String(feature.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="status-card form-panel section-panel" aria-labelledby="terms-heading">
                <div className="section-heading">
                  <div>
                    <h2 id="terms-heading">Change Plan</h2>
                    <p>Plan changes create a pending invoice; activation is finalized after payment confirmation.</p>
                  </div>
                </div>
                {actionError && <div className="state-panel state-panel-error" style={{ marginBottom: '16px' }} role="alert"><strong>{actionError}</strong></div>}
                <PermissionGate permission="subscription.subscription.manage" fallback={<p className="muted-copy">You do not have permission to request plan changes.</p>}>
                  <div className="inline-controls" style={{ marginBottom: '12px' }}>
                    <select aria-label="New plan" value={planId} disabled={pendingAction !== null} onChange={(event) => setPlanId(event.target.value)}>
                      <option value="">Select an active plan</option>
                      {(plans ?? []).filter((plan) => plan.id !== data.plan.id).map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name} - {formatMoney(plan.basePrice, plan.currency)}</option>
                      ))}
                    </select>
                    <button className="button" type="button" disabled={!planId || pendingAction !== null} onClick={() => void changePlan()}>
                      {pendingAction === 'plan-change' ? 'Requesting...' : 'Request plan change'}
                    </button>
                  </div>
                  <input aria-label="Plan change reason" placeholder="Reason for change (optional)" value={reason} disabled={pendingAction !== null} onChange={(event) => setReason(event.target.value)} style={{ width: '100%' }} />
                </PermissionGate>
              </section>
            </div>

            <aside className="support-side-column">
              <article className="status-card support-panel" style={{ marginBottom: '24px' }}>
                <h2>Related Records</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                  <PermissionGate permission="platform.organization.view">
                    <Link className="button button-secondary button-link" style={{ justifyContent: 'center' }} to={`/organizations/${data.organization.id}`}>View organization profile</Link>
                  </PermissionGate>
                  <PermissionGate permission="subscription.plan.view">
                    <Link className="button button-secondary button-link" style={{ justifyContent: 'center' }} to={`/plans/${data.plan.id}`}>View plan configuration</Link>
                  </PermissionGate>
                  <PermissionGate permission="billing.invoice.view">
                    <Link className="button button-secondary button-link" style={{ justifyContent: 'center' }} to="/billing">View billing & invoices</Link>
                  </PermissionGate>
                </div>
              </article>

              <article className="status-card support-panel">
                <div className="status-card-heading">
                  <h2>Subscription History</h2>
                  <span className="muted-copy">{history?.items.length ?? 0} records</span>
                </div>
                <div style={{ marginTop: '16px' }}>
                  {!history?.items.length ? (
                    <p className="muted-copy">No history recorded.</p>
                  ) : (
                    history.items.map((entry) => (
                      <div className="timeline-item" key={entry.id}>
                        <div className="timeline-header">
                          <strong>{statusLabel(entry.action)}</strong>
                          <span className="timeline-meta">{formatAdminDate(entry.createdAt)}</span>
                        </div>
                        <div className="timeline-meta">
                          {entry.previousStatus ? `${statusLabel(entry.previousStatus)} ➔ ${statusLabel(entry.newStatus || entry.previousStatus)}` : statusLabel(entry.newStatus || entry.action)}
                          {' '}&bull; {entry.actorStaff ? `${entry.actorStaff.firstName} ${entry.actorStaff.lastName}` : 'System'}
                        </div>
                        {entry.note && <div className="timeline-note">{entry.note}</div>}
                      </div>
                    ))
                  )}
                </div>
              </article>
            </aside>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation === 'cancel' ? 'Cancel subscription' : 'Reactivate subscription'}
        message={confirmation === 'cancel' ? `Cancel the subscription for ${data?.organization.name ?? 'this organization'}?` : `Reactivate the subscription for ${data?.organization.name ?? 'this organization'}?`}
        confirmLabel={confirmation === 'cancel' ? 'Cancel subscription' : 'Reactivate'}
        destructive={confirmation === 'cancel'}
        pending={pendingAction !== null}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmAction()}
      />
    </section>
  );
}
