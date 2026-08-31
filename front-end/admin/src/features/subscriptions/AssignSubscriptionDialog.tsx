import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { BillingInterval, SubscriptionCreateInput } from '../../types/subscriptions';

interface AssignSubscriptionDialogProps {
  open: boolean;
  loading: boolean;
  onConfirm: (data: SubscriptionCreateInput) => void;
  onCancel: () => void;
}

export function AssignSubscriptionDialog({
  open,
  loading,
  onConfirm,
  onCancel,
}: AssignSubscriptionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [planId, setPlanId] = useState('');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [startTrial, setStartTrial] = useState(false);
  const [trialDays, setTrialDays] = useState('14');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm({
      organizationId,
      planId,
      billingInterval,
      startTrial,
      trialDays: startTrial ? parseInt(trialDays, 10) : undefined,
    });
  }

  function handleCancel() {
    if (!loading) {
      onCancel();
    }
  }

  if (!open) return null;

  return (
    <dialog
      className="confirm-dialog-backdrop"
      ref={dialogRef}
      onCancel={handleCancel}
      aria-labelledby="assign-dialog-title"
    >
      <form className="confirm-dialog" onSubmit={handleSubmit}>
        <h3 id="assign-dialog-title">Assign Subscription</h3>
        <p className="confirm-dialog-message">Start a trial or assign a new plan to an organization.</p>

        <label className="confirm-dialog-field">
          Organization ID
          <input
            type="text"
            required
            className="subscription-input"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="org_..."
            disabled={loading}
          />
        </label>

        <label className="confirm-dialog-field">
          Plan ID
          <input
            type="text"
            required
            className="subscription-input"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            placeholder="plan_..."
            disabled={loading}
          />
        </label>

        <label className="confirm-dialog-field">
          Billing Interval
          <select
            className="subscription-select"
            value={billingInterval}
            onChange={(e) => setBillingInterval(e.target.value as BillingInterval)}
            disabled={loading}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>

        <label className="confirm-dialog-field" style={{ flexDirection: 'row', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={startTrial}
            onChange={(e) => setStartTrial(e.target.checked)}
            disabled={loading}
          />
          Start Trial
        </label>

        {startTrial && (
          <label className="confirm-dialog-field">
            Trial Days
            <input
              type="number"
              min="1"
              required
              className="subscription-input"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              disabled={loading}
            />
          </label>
        )}

        <div className="confirm-dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={loading}>
            {loading && <span className="loader loader-small" aria-hidden="true" />}
            {startTrial ? 'Start Trial' : 'Activate Immediately'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
