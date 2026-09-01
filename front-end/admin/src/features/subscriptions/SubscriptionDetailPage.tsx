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

  return <section aria-labelledby="subscription-detail-title">
    <div className="page-header"><div><p className="eyebrow">Subscription detail</p><h1 id="subscription-detail-title">{data?.organization.name ?? 'Subscription'}</h1><p className="page-description">{data?.plan.name ?? 'Review plan terms, lifecycle history, and payment-gated changes.'}</p></div><Link className="button button-secondary button-link" to="/subscriptions">Back to subscriptions</Link></div>
    {loading && <LoadingState label="Loading subscription details..." />}
    {!loading && error && <ErrorState title="Subscription unavailable" message={error} action={<button className="button button-secondary" onClick={() => void reload()}>Try again</button>} />}
    {!loading && data && <>
      <div className="detail-grid"><div className="summary-banner organization-summary"><span className={`status-dot status-dot-${statusTone(data.status)}`} /><div><strong>{statusLabel(data.status)}</strong><span>{data.organization.primaryEmail}</span></div></div><article className="status-card detail-card"><span>Plan</span><strong>{data.plan.name}</strong><span><code>{data.plan.key}</code></span></article><article className="status-card detail-card"><span>Price</span><strong>{formatMoney(data.priceAtSubscription, data.currency)}</strong><span>{data.billingInterval.toLowerCase()}</span></article><article className="status-card detail-card"><span>Period end</span><strong>{formatAdminDate(data.currentPeriodEnd)}</strong></article></div>
      <div className="detail-links" aria-label="Related records"><PermissionGate permission="platform.organization.view"><Link className="button button-secondary button-compact button-link" to={`/organizations/${data.organization.id}`}>View organization</Link></PermissionGate><PermissionGate permission="subscription.plan.view"><Link className="button button-secondary button-compact button-link" to={`/plans/${data.plan.id}`}>View plan</Link></PermissionGate><PermissionGate permission="billing.invoice.view"><Link className="button button-secondary button-compact button-link" to="/billing">View billing records</Link></PermissionGate></div>
      <section className="status-card form-panel section-panel" aria-labelledby="price-heading"><div className="section-heading"><div><h2 id="price-heading">Recurring price</h2><p>Commercial components are stored on the canonical subscription snapshot.</p></div></div><div className="commercial-breakdown"><div><span>Base plan</span><strong>{formatMoney(data.plan.basePrice, data.currency)}</strong></div><div><span>Employee component</span><strong>{formatMoney(data.employeeAmount, data.currency)}</strong></div><div><span>Feature add-ons</span><strong>{formatMoney(data.featureAmount, data.currency)}</strong></div><div><span>Total recurring price</span><strong>{formatMoney(data.priceAtSubscription, data.currency)}</strong></div></div><p className="muted-copy">{data.employeeCount} purchased seats; {data.plan.includedEmployeeCount} included in the plan.</p></section>
      <div className="lifecycle-actions" aria-label="Subscription lifecycle actions"><PermissionGate permission="subscription.subscription.manage">{data.status !== 'CANCELLED' && <button className="button button-secondary" type="button" disabled={pendingAction !== null} onClick={() => setConfirmation('cancel')}>{pendingAction === 'cancel' ? 'Cancelling...' : 'Cancel subscription'}</button>}{(data.status === 'CANCELLED' || data.status === 'SUSPENDED') && <button className="button button-secondary" type="button" disabled={pendingAction !== null} onClick={() => setConfirmation('reactivate')}>{pendingAction === 'reactivate' ? 'Reactivating...' : 'Reactivate'}</button>}</PermissionGate></div>
      {actionError && <ErrorState title="Change not applied" message={actionError} />}
      <section className="status-card form-panel section-panel" aria-labelledby="terms-heading"><div className="section-heading"><div><h2 id="terms-heading">Plan change</h2><p>Plan changes create a pending invoice; activation is finalized only after trusted payment confirmation.</p></div></div><PermissionGate permission="subscription.subscription.manage" fallback={<p className="muted-copy">You do not have permission to request plan changes.</p>}><div className="inline-controls"><select aria-label="New plan" value={planId} disabled={pendingAction !== null} onChange={(event) => setPlanId(event.target.value)}><option value="">Select an active plan</option>{(plans ?? []).filter((plan) => plan.id !== data.plan.id).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {formatMoney(plan.basePrice, plan.currency)}</option>)}</select><button className="button" type="button" disabled={!planId || pendingAction !== null} onClick={() => void changePlan()}>{pendingAction === 'plan-change' ? 'Requesting...' : 'Request plan change'}</button></div><input aria-label="Plan change reason" placeholder="Reason (optional)" value={reason} disabled={pendingAction !== null} onChange={(event) => setReason(event.target.value)} /></PermissionGate></section>
      <section className="status-card form-panel section-panel" aria-labelledby="features-heading"><div className="section-heading"><div><h2 id="features-heading">Plan features</h2><p>Authoritative included entitlements and paid add-ons from the current plan.</p></div></div>{(data.plan.features ?? []).length === 0 ? <p className="empty-copy">No enabled features are configured for this plan.</p> : <div className="permission-list">{(data.plan.features ?? []).map((feature) => <div className="permission-row" key={feature.id}><div><code>{feature.key}</code><p className="muted-copy">{feature.name}</p></div><span className="muted-copy">{feature.isAddOn ? `Add-on: ${formatMoney(feature.addOnPrice, data.currency)}` : feature.value === null ? 'Included' : String(feature.value)}</span></div>)}</div>}</section>
      <section className="status-card form-panel section-panel" aria-labelledby="history-heading"><div className="section-heading"><div><h2 id="history-heading">Subscription history</h2><p>Recorded lifecycle and payment-gated changes.</p></div></div>{!history?.items.length ? <p className="empty-copy">No history recorded.</p> : <div className="data-table-wrap"><table className="data-table compact-table"><thead><tr><th>Action</th><th>Transition</th><th>Actor</th><th>Recorded</th></tr></thead><tbody>{history.items.map((entry) => <tr key={entry.id}><td><strong>{statusLabel(entry.action)}</strong><span>{entry.note || 'No note'}</span></td><td>{entry.previousStatus ? `${statusLabel(entry.previousStatus)} -> ${statusLabel(entry.newStatus || entry.previousStatus)}` : statusLabel(entry.newStatus || entry.action)}</td><td>{entry.actorStaff ? `${entry.actorStaff.firstName} ${entry.actorStaff.lastName}` : 'System'}</td><td>{formatAdminDate(entry.createdAt)}</td></tr>)}</tbody></table></div>}</section>
    </>}
    <ConfirmDialog open={confirmation !== null} title={confirmation === 'cancel' ? 'Cancel subscription' : 'Reactivate subscription'} message={confirmation === 'cancel' ? `Cancel the subscription for ${data?.organization.name ?? 'this organization'}?` : `Reactivate the subscription for ${data?.organization.name ?? 'this organization'}?`} confirmLabel={confirmation === 'cancel' ? 'Cancel subscription' : 'Reactivate'} destructive={confirmation === 'cancel'} pending={pendingAction !== null} onCancel={() => setConfirmation(null)} onConfirm={() => void confirmAction()} />
  </section>;
}
