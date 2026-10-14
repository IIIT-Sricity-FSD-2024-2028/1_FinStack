import { useEffect } from "react";

export function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(timer);
  }, [message, type, onClose]);

  if (!message) return null;
  return (
    <div
      className={`react-toast ${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <span className="toast-icon">
        {type === "success" ? "✓" : type === "warning" ? "!" : "×"}
      </span>
      <p>{message}</p>
      <button type="button" aria-label="Dismiss notification" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
