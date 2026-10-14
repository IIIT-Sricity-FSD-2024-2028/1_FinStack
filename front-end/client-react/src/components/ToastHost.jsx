import { useEffect, useState } from "react";

const listeners = new Set();
let nextId = 0;

export function notify(message, type = 'info') {
  if (listeners.size) {
    window.dispatchEvent(new CustomEvent("finstack:toast", {
      detail: { id: ++nextId, message: String(message), type },
    }));
    return;
  }
  const toast = window.Toast;
  if (toast && typeof toast[type] === "function") toast[type](message);
  else if (window.FinStackNotification && typeof window.FinStackNotification.show === "function") window.FinStackNotification.show(message);
}

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const receive = (event) => setItems((current) => [...current, event.detail]);
    listeners.add(receive);
    window.addEventListener("finstack:toast", receive);
    return () => {
      listeners.delete(receive);
      window.removeEventListener("finstack:toast", receive);
    };
  }, []);
  useEffect(() => {
    if (!items.length) return undefined;
    const timers = items.map((item) => window.setTimeout(
      () => setItems((current) => current.filter((entry) => entry.id !== item.id)),
      6000,
    ));
    return () => timers.forEach(window.clearTimeout);
  }, [items]);
  return <div className="react-toast-host" aria-live="polite" aria-relevant="additions text">
    {items.map((item) => <div className={`react-toast is-${item.type}`} role={item.type === "error" ? "alert" : "status"} key={item.id}>
      <span>{item.message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>×</button>
    </div>)}
  </div>;
}
