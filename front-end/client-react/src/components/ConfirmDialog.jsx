import { Modal } from "./Modal";
import "./confirm-dialog.css";

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", busy = false, onCancel, onConfirm, danger = false }) {
  return <Modal open={open} onClose={busy ? undefined : onCancel} label={title} className="confirm-dialog-backdrop">
    <section className="confirm-dialog">
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </section>
  </Modal>;
}
