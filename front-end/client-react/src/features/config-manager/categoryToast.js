import {
  createElement,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

export function createCategoryToast(
  schedule = setTimeout,
  cancel = clearTimeout,
) {
  let current = null;
  let generation = 0;
  let active = true;
  const timers = new Set();
  const listeners = new Set();
  const publish = (value) => {
    current = value;
    listeners.forEach((listener) => listener());
  };
  function clear() {
    generation += 1;
    timers.forEach(cancel);
    timers.clear();
  }
  function later(callback, delay) {
    const timer = schedule(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }
  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      active = true;
    },
    dispose() {
      active = false;
      clear();
    },
    show(message, duration = 2000) {
      if (!active) return;
      clear();
      const id = generation;
      publish({ id, message, leaving: false });
      // Fade during the last 150ms so the toast is gone at the promised duration.
      later(() => {
        if (active && id === generation)
          publish({ id, message, leaving: true });
      }, duration - 150);
      later(() => {
        if (active && id === generation) publish(null);
      }, duration);
    },
  };
}

export function useCategoryToast() {
  const [controller] = useState(() => createCategoryToast());
  const notice = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);
  return { notice, showSuccess: controller.show };
}

export function CategorySuccessToast({ notice }) {
  // Keep the polite live region mounted so changes are announced without focus.
  return createElement(
    "div",
    {
      className: "category-success-toast-host",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    },
    notice &&
      createElement(
        "div",
        {
          key: notice.id,
          className: `category-success-toast${notice.leaving ? " is-leaving" : ""}`,
        },
        notice.message,
      ),
  );
}
