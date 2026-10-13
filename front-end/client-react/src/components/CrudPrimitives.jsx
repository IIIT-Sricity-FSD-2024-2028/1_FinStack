import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function StatusBadge({ status }) {
  const active = status === "Active";
  const color = active ? "#10B981" : "#EF4444";
  return (
    <span
      className="badge"
      style={{ background: `${color}20`, color, borderColor: `${color}40` }}
    >
      {status}
    </span>
  );
}

export function ToggleSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      className={`toggle-switch${checked ? " active" : ""}${disabled ? " disabled" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function CrudModal({
  open,
  title,
  onClose,
  onSubmit,
  submitting,
  submitLabel,
  submitDisabled = false,
  children,
  maxWidth = 500,
}) {
  return (
    <Modal open={open} onClose={submitting ? undefined : onClose} label={title}>
      <div className="modal-content" style={{ maxWidth }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="btn-icon"
            aria-label={`Close ${title}`}
            disabled={submitting}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div
            className="modal-body"
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {children}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || submitDisabled}
            >
              {submitting ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  title = "Confirm Delete",
  description,
  onCancel,
  onConfirm,
  submitting,
  confirmLabel = "Delete",
  confirmingLabel = "Deleting…",
  tone = "danger",
}) {
  const danger = tone === "danger";
  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onCancel}
      label={title}
    >
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 style={{ color: danger ? "#EF4444" : "var(--text-primary)" }}>
            {title}
          </h2>
          <button
            type="button"
            className="btn-icon"
            aria-label="Close confirmation"
            disabled={submitting}
            onClick={onCancel}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: danger ? "#EF4444" : "#7C3AED",
              color: "#fff",
            }}
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
