import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { SubscriptionLifecycleInput } from '../../types/subscriptions';

interface RenewalDialogProps {
  open: boolean;
  loading: boolean;
  onConfirm: (data: SubscriptionLifecycleInput) => void;
  onCancel: () => void;
}

export function RenewalDialog({
  open,
  loading,
  onConfirm,
  onCancel,
}: RenewalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
      aria-labelledby="renewal-dialog-title"
    >
      <form className="confirm-dialog" onSubmit={handleSubmit}>
        <h3 id="renewal-dialog-title">Renew Subscription</h3>
        <p className="confirm-dialog-message">Manually trigger a renewal for another billing period.</p>

        <label className="confirm-dialog-field">
          Notes (Optional)
          <textarea
            className="confirm-dialog-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Manual renewal requested"
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
            Confirm Renewal
          </button>
        </div>
      </form>
    </dialog>
  );
}
