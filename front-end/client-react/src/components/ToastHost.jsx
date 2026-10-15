import { useEffect, useState } from 'react'
import './toast.css'

const listeners = new Set()
let nextId = 0

export function notify(message, type = 'info') {
  if (listeners.size) {
    const item = { id: ++nextId, message: String(message), type }
    listeners.forEach(listener => listener(item))
    return
  }
  const toast = window.Toast
  if (toast && typeof toast[type] === 'function') toast[type](message)
  else window.FinStackNotification?.show?.(message)
}

function Toast({ item, dismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), 6000)
    return () => clearTimeout(timer)
  }, [item.id, dismiss])
  return <div className={`client-toast is-${item.type}`} role={item.type === 'error' ? 'alert' : 'status'}>
    <span>{item.message}</span>
    <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(item.id)}>×</button>
  </div>
}

export function ToastHost() {
  const [items, setItems] = useState([])
  const [dismiss] = useState(() => id => setItems(current => current.filter(item => item.id !== id)))
  useEffect(() => {
    const receive = item => setItems(current => [...current.slice(-3), item])
    const clear = () => setItems([])
    listeners.add(receive)
    window.addEventListener('finstack:session', clear)
    return () => {
      listeners.delete(receive)
      window.removeEventListener('finstack:session', clear)
    }
  }, [])
  return <div className="client-toast-host" aria-label="Notifications">
    {items.map(item => <Toast key={item.id} item={item} dismiss={dismiss} />)}
  </div>
}
