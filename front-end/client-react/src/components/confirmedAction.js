export function createConfirmedAction() {
  let running = false;
  return async function run(action, { confirmed, busy = false } = {}) {
    if (!confirmed || busy || running) return false;
    running = true;
    try {
      await action();
      return true;
    } finally {
      running = false;
    }
  };
}
