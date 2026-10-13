// Existing pages own the visible Toast implementation. React features can use the
// same global API without introducing a second visual notification system.
export function notify(message, type = 'info') {
  const toast = window.Toast
  if (toast && typeof toast[type] === 'function') toast[type](message)
  else if (window.FinStackNotification && typeof window.FinStackNotification.show === 'function') window.FinStackNotification.show(message)
}

export function ToastHost() {
  return null
}
