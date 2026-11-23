import { configureStore } from '@reduxjs/toolkit'
import { tenantSession } from '../../../adapters/tenantSession.js'
import { complianceApi } from '../complianceApi.js'
import complianceReducer, { sessionChanged } from './complianceSlice.js'

export function complianceIdentity(user, organizationId = user?.organizationId) {
  return user?.id && organizationId && user.role === 'COMPLIANCE_OFFICER' && user.status === 'ACTIVE'
    ? JSON.stringify([organizationId, user.id, user.role]) : null
}

export function createComplianceStore({ api = complianceApi, getSession = () => tenantSession.current() } = {}) {
  let boundSession = null
  let generation = 0
  const controllers = new Set()
  const session = {
    isCurrent(expectedGeneration) {
      const current = getSession()
      return Boolean(boundSession && expectedGeneration === generation &&
        current?.accessToken === boundSession.accessToken &&
        complianceIdentity(current?.user, current?.organizationId) === boundSession.identity)
    },
    async run(expectedGeneration, signal, operation) {
      const assertCurrent = () => {
        if (!session.isCurrent(expectedGeneration)) throw new Error('Your session changed. Sign in again to continue.')
      }
      assertCurrent()
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      controllers.add(controller)
      try {
        const result = await operation(controller.signal)
        assertCurrent()
        return result
      } finally {
        controllers.delete(controller)
        signal.removeEventListener('abort', abort)
      }
    },
  }
  const store = configureStore({
    reducer: { compliance: complianceReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: { extraArgument: { api, session } } }),
  })
  const endSession = () => {
    boundSession = null
    generation++
    for (const controller of controllers) controller.abort()
    controllers.clear()
    store.dispatch(sessionChanged(null))
  }
  const startSession = () => {
    endSession()
    const current = getSession()
    const identity = complianceIdentity(current?.user, current?.organizationId)
    if (!identity || !current?.accessToken) return
    // Credentials live only in this private lifetime guard, never in Redux,
    // thunk arguments, persisted state, diagnostics, or React keys.
    boundSession = { identity, accessToken: current.accessToken }
    generation++
    store.dispatch(sessionChanged(identity))
  }
  return Object.assign(store, { startSession, endSession })
}
