import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { useAuth } from '../../auth/useAuth';
import type {
  OrganizationSubscription,
  SubscriptionHistoryEntry,
  SubscriptionLifecycleAction,
  SubscriptionStatus,
} from '../../types/subscriptions';
import {
  LIFECYCLE_ACTION_CONFIRMATIONS,
  LIFECYCLE_ACTION_LABELS,
} from '../../types/subscriptions';
import { ConfirmDialog } from './ConfirmDialog';
import { PlanChangeDialog } from './PlanChangeDialog';
import { RenewalDialog } from './RenewalDialog';
import { formatDate, formatStatus } from './subscription-format';
import {
  SUBSCRIPTION_MANAGE,
  SUBSCRIPTION_VIEW,
} from './subscription-permissions';
import { StatusPill } from './SubscriptionListPage';
import { useSubscriptionMutations } from './useSubscriptionMutations';
import { useSubscription } from './useSubscriptions';
import './subscriptions.css';

/**
 * Lifecycle controls configuration.
 *
 * Each control maps a lifecycle action to a permission key and optionally
 * configures its visual variant and whether a reason should be collected.
 */
const lifecycleControls: Array<{
  action: SubscriptionLifecycleAction;
  permission: string;
  variant: 'primary' | 'danger';
  showReason: boolean;
  /** Statuses from which this action is valid. Null = show always. */
  allowedFrom: SubscriptionStatus[] | null;
}> = [
  {
    action: 'activate',
    permission: SUBSCRIPTION_MANAGE,
    variant: 'primary',
    showReason: false,
    allowedFrom: ['TRIAL'],
  },
  {
    action: 'suspend',
    permission: SUBSCRIPTION_MANAGE,
    variant: 'danger',
    showReason: true,
    allowedFrom: ['TRIAL', 'ACTIVE', 'EXPIRING', 'GRACE_PERIOD'],
  },
  {
    action: 'reactivate',
    permission: SUBSCRIPTION_MANAGE,
    variant: 'primary',
    showReason: false,
    allowedFrom: ['SUSPENDED', 'GRACE_PERIOD'],
  },
  {
    action: 'cancel',
    permission: SUBSCRIPTION_MANAGE,
    variant: 'danger',
    showReason: true,
    allowedFrom: ['TRIAL', 'ACTIVE', 'EXPIRING', 'GRACE_PERIOD', 'SUSPENDED'],
  },
  {
    action: 'upgrade',
    permission: SUBSCRIPTION_MANAGE,
    variant: 'primary',
    showReason: false,
    allowedFrom: ['TRIAL', 'ACTIVE'],
  },
  {
    action: 'downgrade',
    permission: SUBSCRIPTION_MANAGE,
    variant: 'danger',
    showReason: false,
    allowedFrom: ['TRIAL', 'ACTIVE'],
  },
  {
    action: 'renew',
    permission: SUBSCRIPTION_MANAGE,
    variant: 'primary',
    showReason: false,
    allowedFrom: ['ACTIVE', 'EXPIRING', 'GRACE_PERIOD'],
  },
];

export function SubscriptionDetailPage() {
  return (
    <PermissionGate
      permission={SUBSCRIPTION_VIEW}
      fallback={
        <div className="state-panel" role="alert">
          <div>
            <strong>Permission required</strong>
            <p>Your account cannot view platform subscription details.</p>
          </div>
        </div>
      }
    >
      <SubscriptionDetailContent />
    </PermissionGate>
  );
}

function SubscriptionDetailContent() {
  const { subscriptionId } = useParams();
  const { data, error, loading, notFound, reload } =
    useSubscription(subscriptionId);

  if (loading) {
    return (
      <section className="subscriptions-page" aria-labelledby="subscription-title">
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading subscription details...
        </div>
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="subscriptions-page" aria-labelledby="subscription-title">
        <Link className="button button-secondary button-link" to="/subscriptions">
          Back to subscriptions
        </Link>
        <div className="state-panel" role="alert">
          <div>
            <strong>Subscription not found</strong>
            <p>The requested subscription could not be found.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="subscriptions-page" aria-labelledby="subscription-title">
        <Link className="button button-secondary button-link" to="/subscriptions">
          Back to subscriptions
        </Link>
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Subscription unavailable</strong>
            <p>{error ?? 'Subscription details could not be loaded.'}</p>
          </div>
          <button className="button button-secondary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="subscriptions-page" aria-labelledby="subscription-title">
      <Link className="button button-secondary button-link" to="/subscriptions">
        Back to subscriptions
      </Link>

      <div className="page-header">
        <div>
          <p className="eyebrow">Subscription details</p>
          <h1 id="subscription-title">
            {data.organization?.name ?? 'Organization subscription'}
          </h1>
          <p className="page-description">
            Current plan, lifecycle status, billing period, and commercial
            history for this organization subscription.
          </p>
        </div>
        <StatusPill status={data.status} />
      </div>

      <div className="subscription-detail-grid">
        <div className="subscriptions-page">
          <SubscriptionOverview subscription={data} />
          <SubscriptionHistory history={data.history ?? []} />
        </div>
        <div className="subscriptions-page">
          <OrganizationPanel subscription={data} />
          <PlanPanel subscription={data} />
          <BillingPanel subscription={data} />
          <LifecyclePanel
            subscriptionId={data.id}
            subscriptionStatus={data.status}
            onLifecycleComplete={reload}
          />
        </div>
      </div>
    </section>
  );
}

function SubscriptionOverview({
  subscription,
}: {
  subscription: OrganizationSubscription;
}) {
  return (
    <article className="subscription-panel">
      <h2>Subscription</h2>
      <div className="subscription-facts">
        <Fact label="Subscription ID" value={subscription.id} />
        <Fact label="Status" value={formatStatus(subscription.status)} />
        <Fact
          label="Billing interval"
          value={formatStatus(subscription.billingInterval)}
        />
        <Fact
          label="Effective price"
          value={`${subscription.currency} ${subscription.priceAtSubscription}`}
        />
        <Fact
          label="Current period start"
          value={formatDate(subscription.currentPeriodStart)}
        />
        <Fact
          label="Current period end"
          value={formatDate(subscription.currentPeriodEnd)}
        />
        <Fact
          label="Trial start"
          value={formatDate(subscription.trialStartAt)}
        />
        <Fact label="Trial end" value={formatDate(subscription.trialEndAt)} />
        <Fact
          label="Cancel at period end"
          value={subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}
        />
        <Fact label="Created" value={formatDate(subscription.createdAt)} />
      </div>
    </article>
  );
}

function OrganizationPanel({
  subscription,
}: {
  subscription: OrganizationSubscription;
}) {
  const organization = subscription.organization;
  return (
    <article className="subscription-panel">
      <h2>Organization</h2>
      <div className="subscription-facts">
        <Fact label="Name" value={organization?.name ?? 'Not provided'} />
        <Fact
          label="Primary email"
          value={organization?.primaryEmail ?? 'Not provided'}
        />
        <Fact label="Status" value={organization?.status ?? 'Not provided'} />
        <Fact label="Country" value={organization?.country ?? 'Not provided'} />
        <Fact
          label="Currency"
          value={organization?.defaultCurrency ?? subscription.currency}
        />
        <Fact label="Timezone" value={organization?.timezone ?? 'Not provided'} />
      </div>
    </article>
  );
}

function PlanPanel({ subscription }: { subscription: OrganizationSubscription }) {
  const plan = subscription.plan;
  return (
    <article className="subscription-panel">
      <h2>Plan</h2>
      <div className="subscription-facts">
        <Fact label="Name" value={plan?.name ?? 'Not provided'} />
        <Fact label="Key" value={plan?.key ?? 'Not provided'} />
        <Fact label="Status" value={plan?.status ?? 'Not provided'} />
        <Fact
          label="Catalog price"
          value={
            plan?.basePrice && plan.currency
              ? `${plan.currency} ${plan.basePrice}`
              : 'Not provided'
          }
        />
      </div>
    </article>
  );
}

function BillingPanel({
  subscription,
}: {
  subscription: OrganizationSubscription;
}) {
  const billing = subscription.billing;
  return (
    <article className="subscription-panel">
      <h2>Billing</h2>
      <div className="subscription-facts">
        <Fact
          label="Open invoices"
          value={String(billing?.openInvoices ?? 'Not provided')}
        />
        <Fact
          label="Overdue invoices"
          value={String(billing?.overdueInvoices ?? 'Not provided')}
        />
        <Fact
          label="Failed payments"
          value={String(billing?.failedPayments ?? 'Not provided')}
        />
        <Fact label="Last payment" value={formatDate(billing?.lastPaymentAt)} />
        <Fact label="Next invoice" value={formatDate(billing?.nextInvoiceAt)} />
      </div>
    </article>
  );
}

function LifecyclePanel({
  subscriptionId,
  subscriptionStatus,
  onLifecycleComplete,
}: {
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  onLifecycleComplete: () => void;
}) {
  const { hasPermission } = useAuth();
  const mutations = useSubscriptionMutations(subscriptionId, onLifecycleComplete);

  // Filter controls based on permission AND current subscription status
  const availableControls = lifecycleControls.filter((control) => {
    if (!hasPermission(control.permission)) return false;
    if (control.allowedFrom && !control.allowedFrom.includes(subscriptionStatus)) {
      return false;
    }
    return true;
  });

  // Find the currently pending control for the dialog
  const pendingControl = mutations.pendingAction
    ? lifecycleControls.find((c) => c.action === mutations.pendingAction) ?? null
    : null;

  if (availableControls.length === 0 && !mutations.error && !mutations.success) {
    return null;
  }

  return (
    <article className="subscription-panel">
      <h2>Lifecycle actions</h2>

      {mutations.success && (
        <div className="subscription-feedback subscription-feedback-success" role="status">
          <span>{mutations.success}</span>
          <button type="button" onClick={mutations.dismissFeedback}>
            Dismiss
          </button>
        </div>
      )}

      {mutations.error && (
        <div className="subscription-feedback subscription-feedback-error" role="alert">
          <span>{mutations.error}</span>
          <button type="button" onClick={mutations.dismissFeedback}>
            Dismiss
          </button>
        </div>
      )}

      {availableControls.length > 0 && (
        <div className="subscription-actions">
          {availableControls.map((control) => (
            <button
              className={`button ${control.variant === 'danger' ? 'button-danger' : 'button-secondary'}`}
              disabled={mutations.executingAction !== null}
              key={control.action}
              type="button"
              onClick={() => mutations.requestAction(control.action)}
            >
              {mutations.executingAction === control.action && (
                <span className="loader loader-small" aria-hidden="true" />
              )}
              {LIFECYCLE_ACTION_LABELS[control.action]}
            </button>
          ))}
        </div>
      )}

      {pendingControl && (
        <>
          {(pendingControl.action === 'upgrade' || pendingControl.action === 'downgrade') ? (
            <PlanChangeDialog
              open={true}
              title={`${LIFECYCLE_ACTION_LABELS[pendingControl.action]} subscription`}
              loading={false}
              onConfirm={(data) => void mutations.confirmAction(JSON.stringify(data))}
              onCancel={mutations.cancelAction}
            />
          ) : pendingControl.action === 'renew' ? (
            <RenewalDialog
              open={true}
              loading={false}
              onConfirm={(data) => void mutations.confirmAction(data.reason)}
              onCancel={mutations.cancelAction}
            />
          ) : (
            <ConfirmDialog
              open={true}
              title={`${LIFECYCLE_ACTION_LABELS[pendingControl.action]} subscription`}
              message={LIFECYCLE_ACTION_CONFIRMATIONS[pendingControl.action]}
              confirmLabel={LIFECYCLE_ACTION_LABELS[pendingControl.action]}
              variant={pendingControl.variant}
              showReason={pendingControl.showReason}
              loading={false}
              onConfirm={(reason) => void mutations.confirmAction(reason)}
              onCancel={mutations.cancelAction}
            />
          )}
        </>
      )}
    </article>
  );
}

function SubscriptionHistory({
  history,
}: {
  history: SubscriptionHistoryEntry[];
}) {
  return (
    <article className="subscription-panel">
      <h2>History</h2>
      {history.length === 0 ? (
        <p className="subscription-muted">No lifecycle history was provided.</p>
      ) : (
        <ol className="subscription-history">
          {history.map((entry) => (
            <li key={entry.id}>
              <strong>{formatStatus(entry.eventType)}</strong>
              <p className="subscription-muted">
                {entry.previousStatus
                  ? `${formatStatus(entry.previousStatus)} to ${formatStatus(
                      entry.newStatus,
                    )}`
                  : formatStatus(entry.newStatus)}
              </p>
              <p className="subscription-muted">{formatDate(entry.createdAt)}</p>
              {entry.reason && (
                <p className="subscription-muted">Reason: {entry.reason}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="subscription-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
