import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { BillingInterval, SubscriptionLifecycleInput } from '../../types/subscriptions';

interface PlanChangeDialogProps {
  open: boolean;
  title: string;
  loading: boolean;
  onConfirm: (data: SubscriptionLifecycleInput) => void;
  onCancel: () => void;
}

export function PlanChangeDialog({
  open,
  title,
  loading,
  onConfirm,
  onCancel,
}: PlanChangeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [planId, setPlanId] = useState('');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [reason, setReason] = useState('');

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
      planId,
      billingInterval,
      reason: reason || undefined,
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
      aria-labelledby="plan-change-title"
    >
      <form className="confirm-dialog" onSubmit={handleSubmit}>
        <h3 id="plan-change-title">{title}</h3>
        <p className="confirm-dialog-message">Select the new plan configuration for this subscription.</p>

        <label className="confirm-dialog-field">
          New Plan ID
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

        <label className="confirm-dialog-field">
          Reason (optional)
          <textarea
            className="confirm-dialog-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide a reason for this action..."
            rows={3}
            disabled={loading}
          />
        </label>

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
            Confirm Change
          </button>
        </div>
      </form>
    </dialog>
  );
}
