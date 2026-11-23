import { useLayoutEffect, useState } from 'react'
import { Provider } from 'react-redux'
import { useAuth } from '../../../auth/AuthContext'
import { SESSION_EVENT } from '../../../services/session'
import { complianceIdentity, createComplianceStore } from './complianceStore.js'

function SessionProvider({ children }) {
  const [store] = useState(() => createComplianceStore())
  useLayoutEffect(() => {
    store.startSession()
    window.addEventListener(SESSION_EVENT, store.endSession)
    return () => {
      window.removeEventListener(SESSION_EVENT, store.endSession)
      store.endSession()
    }
  }, [store])
  return <Provider store={store}>{children}</Provider>
}

export function ComplianceProvider({ children }) {
  const { user, status } = useAuth()
  const identity = complianceIdentity(user)
  if (status !== 'authenticated' || !identity) return null
  return <SessionProvider key={identity}>{children}</SessionProvider>
}
