import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { tenantApi, tenantTagTypes } from './api.js'
import { sessionChanged, sessionReducer } from './sessionSlice.js'
import { createSessionGuard } from './sessionGuard.js'
import { currentSession, request } from '../services/session.ts'
import { tenantSession } from '../adapters/tenantSession.js'
import { LIVE_REFRESH_EVENT } from '../hooks/liveRefreshController.js'
import { submitterApi } from '../features/submitter/api/submitterApi.js'
import { submitterReducer } from '../features/submitter/store/submitterStore.js'
import { submitterIdentity, sessionChanged as submitterSessionChanged } from '../features/submitter/store/submitterSession.js'
import { complianceApi } from '../features/compliance/complianceApi.js'
import complianceReducer, { sessionChanged as complianceSessionChanged } from '../features/compliance/store/complianceSlice.js'
import { complianceIdentity } from '../features/compliance/store/complianceStore.js'
import { financeApi } from '../features/finance/financeApi.js'
import { financeSlice, resetFinance } from '../features/finance/financeSlice.js'
import managerFilters, { resetQueueFilters, resetHistoryFilters } from '../features/manager/managerFiltersSlice.js'
import '../features/config-manager/configManagerApi.js'
import '../features/finance/financeApiSlice.js'
import '../features/manager/managerApiSlice.js'

const browserSession = () => typeof window === 'undefined' ? null
  : window.FinStackTenantSession ? tenantSession.current() : currentSession()

// Every production actor uses this factory's single exported instance. Tests can
// inject independent adapters without changing the transport used by another actor.
export function createClientStore(dependencies = {}) {
  const getSession = dependencies.getSession || browserSession
  let appStore
  const submitterSession = createSessionGuard({ getSession,
    getFeatureSession: () => appStore.getState().submitter.session, identityOf: submitterIdentity })
  const complianceSession = createSessionGuard({ getSession,
    getFeatureSession: () => appStore.getState().compliance.session, identityOf: complianceIdentity })
  const extraArgument = { getSession, submitterSession, complianceSession, request,
    financeApi: dependencies.financeApi || financeApi,
    submitterApi: dependencies.submitterApi || submitterApi,
    complianceApi: dependencies.complianceApi || complianceApi }
  appStore = configureStore({
    reducer: { [tenantApi.reducerPath]: tenantApi.reducer, sessionBoundary: sessionReducer,
      submitter: submitterReducer, compliance: complianceReducer,
      finance: financeSlice.reducer, managerFilters },
    middleware: getDefaultMiddleware => getDefaultMiddleware({ thunk: { extraArgument } }).concat(tenantApi.middleware),
  })
  const endSession = () => {
    submitterSession.end()
    complianceSession.end()
    appStore.dispatch(sessionChanged())
    appStore.dispatch(submitterSessionChanged(null))
    appStore.dispatch(complianceSessionChanged(null))
    for (const operation of [...appStore.dispatch(tenantApi.util.getRunningQueriesThunk()),
      ...appStore.dispatch(tenantApi.util.getRunningMutationsThunk())]) operation.abort()
    appStore.dispatch(tenantApi.util.resetApiState())
    appStore.dispatch(resetFinance())
    appStore.dispatch(resetQueueFilters())
    appStore.dispatch(resetHistoryFilters())
  }
  const startSession = ({ reset = true } = {}) => {
    if (reset) endSession()
    submitterSession.bind()
    complianceSession.bind()
    const current = getSession()
    const submitter = submitterIdentity(current?.user)
    const compliance = complianceIdentity(current?.user, current?.organizationId)
    if (submitter) appStore.dispatch(submitterSessionChanged(submitter))
    if (compliance) appStore.dispatch(complianceSessionChanged(compliance))
  }
  return Object.assign(appStore, { startSession, endSession })
}
export const createTenantStore = createClientStore
export const store = createClientStore()

export function installReduxRuntime(target = window, appStore = store) {
  // Do not add actor-level session listeners. Every event (including replacement
  // of a token for the same user) revokes all pending work and sensitive caches.
  appStore.startSession({ reset: false })
  const changed = () => appStore.startSession()
  const refresh = event => {
    // Local writes already refresh via mutation tags or the actor's thunk.
    // Cross-tab changes still invalidate all relevant endpoint tags.
    const state = appStore.getState()
    if (event.detail?.source === 'local' &&
      (appStore.dispatch(tenantApi.util.getRunningMutationsThunk()).length ||
        state.submitter.session.pendingMutations || state.compliance.deciding || state.compliance.markingRead)) return
    appStore.dispatch(tenantApi.util.invalidateTags(tenantTagTypes))
  }
  const stopListeners = setupListeners(appStore.dispatch, (dispatch, { onFocus, onFocusLost, onOnline, onOffline }) => {
    const focus = () => dispatch(onFocus())
    const blur = () => dispatch(onFocusLost())
    const online = () => dispatch(onOnline())
    const offline = () => dispatch(onOffline())
    const visibility = () => target.document?.visibilityState === 'hidden' ? blur() : focus()
    for (const [type, listener] of [['focus', focus], ['blur', blur], ['online', online], ['offline', offline], ['visibilitychange', visibility]]) target.addEventListener(type, listener)
    return () => {
      for (const [type, listener] of [['focus', focus], ['blur', blur], ['online', online], ['offline', offline], ['visibilitychange', visibility]]) target.removeEventListener(type, listener)
    }
  })
  target.addEventListener('finstack:session', changed)
  target.addEventListener(LIVE_REFRESH_EVENT, refresh)
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    stopListeners()
    target.removeEventListener('finstack:session', changed)
    target.removeEventListener(LIVE_REFRESH_EVENT, refresh)
    appStore.endSession()
  }
}
export const installStoreRuntime = (appStore, target) => installReduxRuntime(target, appStore)
