import { configureStore } from "@reduxjs/toolkit";
import { managerApiSlice } from "../features/manager/managerApiSlice.js";
import managerFiltersReducer, {
  resetHistoryFilters,
  resetQueueFilters,
} from "../features/manager/managerFiltersSlice.js";
import { currentSession, SESSION_EVENT } from "../services/session.ts";

export const store = configureStore({
  reducer: {
    [managerApiSlice.reducerPath]: managerApiSlice.reducer,
    managerFilters: managerFiltersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(managerApiSlice.middleware),
});

export function installManagerSessionReset(target = globalThis.window, targetStore = store) {
  const getIdentity = () => {
    const session = currentSession();
    return session
      ? JSON.stringify([session.user.id, session.organizationId])
      : null;
  };
  let identity = getIdentity();
  const resetManagerState = () => {
    const nextIdentity = getIdentity();
    if (nextIdentity === identity) return;
    identity = nextIdentity;
    targetStore.dispatch(managerApiSlice.util.resetApiState());
    targetStore.dispatch(resetQueueFilters());
    targetStore.dispatch(resetHistoryFilters());
  };
  target?.addEventListener?.(SESSION_EVENT, resetManagerState);
  return () => target?.removeEventListener?.(SESSION_EVENT, resetManagerState);
}

if (typeof window !== "undefined") installManagerSessionReset(window);
