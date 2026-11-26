import { useLayoutEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useAuth } from '../../../auth/AuthContext'
import { complianceIdentity } from './complianceStore.js'
import { sessionChanged } from './complianceSlice.js'

// Workspace lifecycle only; main.jsx owns the sole Redux Provider.
export function ComplianceProvider({ children }) {
  const { user, status } = useAuth()
  const dispatch = useDispatch()
  const identity = status === 'authenticated' ? complianceIdentity(user) : null
  useLayoutEffect(() => {
    dispatch(sessionChanged(identity))
    return () => { dispatch(sessionChanged(null)) }
  }, [dispatch, identity])
  return identity ? children : null
}
