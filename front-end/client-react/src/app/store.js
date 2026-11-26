import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { financeApiSlice } from '../features/finance/financeApiSlice.js'
import { financeSlice, resetFinance } from '../features/finance/financeSlice.js'
import { LIVE_REFRESH_EVENT } from '../hooks/liveRefreshController.js'

export function createClientStore() {
  return configureStore({
    reducer: {
      finance: financeSlice.reducer,
      [financeApiSlice.reducerPath]: financeApiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(financeApiSlice.middleware),
  })
}

export function installStoreRuntime(store, target = window) {
  const stopListeners = setupListeners(store.dispatch)
  const reset = () => {
    // Abort before clearing the cache so late responses from an old login are ignored.
    for (const request of store.dispatch(financeApiSlice.util.getRunningQueriesThunk())) request.abort()
    for (const request of store.dispatch(financeApiSlice.util.getRunningMutationsThunk())) request.abort()
    store.dispatch(financeApiSlice.util.resetApiState())
    store.dispatch(resetFinance())
  }
  const refresh = () => store.dispatch(financeApiSlice.util.invalidateTags([
    'FinanceWorkspace', 'FinanceQueue', 'FinanceNotifications', 'FinanceCategories', 'FinancePolicies',
  ]))
  target.addEventListener('finstack:session', reset)
  target.addEventListener(LIVE_REFRESH_EVENT, refresh)
  return () => {
    stopListeners()
    target.removeEventListener('finstack:session', reset)
    target.removeEventListener(LIVE_REFRESH_EVENT, refresh)
    reset()
  }
}
