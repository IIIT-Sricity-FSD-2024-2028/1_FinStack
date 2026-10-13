import { useEffect, useRef } from "react";

export function Modal({
  open,
  children,
  className = "modal-overlay",
  onClose,
  label,
}) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  const restoreFocus = useRef(null);
  close.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    restoreFocus.current = document.activeElement;
    const root = dialog.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => !element.hasAttribute("hidden"));
    const first = focusable()[0];
    (first || root)?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (close.current) {
          event.preventDefault();
          close.current();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        root?.focus();
        return;
      }
      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          !root?.contains(document.activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastElement ||
          !root?.contains(document.activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const previous = restoreFocus.current;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={dialog}
      className={`${className} active`}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-label={label}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {children}
    </div>
  );
}
