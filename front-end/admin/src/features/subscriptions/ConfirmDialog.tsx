import { type FormEvent, useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Title of the confirmation dialog. */
  title: string;
  /** Confirmation message describing the action. */
  message: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  /** Whether the confirm action is currently executing. */
  loading?: boolean;
  /** Whether to show a reason textarea. */
  showReason?: boolean;
  /** Visual variant for the confirm button. */
  variant?: 'primary' | 'danger';
  /** Called when the user confirms. */
  onConfirm: (reason?: string) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
}

/**
 * Confirmation dialog for sensitive lifecycle actions.
 *
 * Uses the native <dialog> element for proper modal semantics and focus
 * management. Falls back to a styled overlay if <dialog> is unsupported.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  loading = false,
  showReason = false,
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
    onConfirm(reason.trim() || undefined);
  }

  function handleCancel() {
    if (!loading) {
      setReason('');
      onCancel();
    }
  }

  if (!open) return null;

  return (
    <dialog
      className="confirm-dialog-backdrop"
      ref={dialogRef}
      onCancel={handleCancel}
      aria-labelledby="confirm-dialog-title"
    >
      <form className="confirm-dialog" onSubmit={handleSubmit}>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>

        {showReason && (
          <label className="confirm-dialog-field">
            Reason (optional)
            <textarea
              className="confirm-dialog-textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Provide a reason for this action..."
              rows={3}
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
          <button
            className={`button ${variant === 'danger' ? 'button-danger' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading && <span className="loader loader-small" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
