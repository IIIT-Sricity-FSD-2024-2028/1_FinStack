import { fetchExpenses } from "./expensesSlice.js";
import { fetchCategories } from "./categoriesSlice.js";
import { fetchNotifications } from "./notificationsSlice.js";
import { mutationStarted, mutationFinished, requireCurrentSession } from "./submitterSession.js";

export const refreshSubmitter = (options) => async (dispatch, getState) => {
  // The authenticated transport broadcasts writes synchronously. Mutations below
  // own their refresh, so that broadcast must not start a duplicate request.
  if (getState().submitter.session.pendingMutations) return [];
  const results = await Promise.all([
    dispatch(fetchExpenses(options)),
    dispatch(fetchCategories(options)),
    dispatch(fetchNotifications(options)),
  ]);
  if (options?.background) {
    const failure = results.find((action) => action.meta.requestStatus === "rejected" && !action.meta.condition);
    if (failure) throw new Error(failure.error.message);
  }
  return results;
};

async function runMutation(dispatch, getState, submitterSession, write, resources) {
  const generation = getState().submitter.session.generation;
  requireCurrentSession(getState, generation);
  dispatch(mutationStarted(generation));
  try {
    const result = await submitterSession.run(generation, undefined, write);
    requireCurrentSession(getState, generation);
    // Force a new post-write read even if an older poll is still in flight.
    // Resource errors remain visible with retry; a confirmed write is not retried.
    await Promise.all(resources.map((fetchResource) => dispatch(fetchResource({ force: true }))));
    requireCurrentSession(getState, generation);
    return result;
  } finally {
    dispatch(mutationFinished(generation));
  }
}

// A plain thunk keeps the File in this closure, outside Redux state and actions.
export const createExpense = (data, receipt) => (dispatch, getState, { submitterApi: api, submitterSession }) =>
  runMutation(dispatch, getState, submitterSession, () => api.createExpense(data, receipt), [fetchExpenses, fetchNotifications]);

export const updateExpense = (id, updates) => (dispatch, getState, { submitterApi: api, submitterSession }) =>
  runMutation(dispatch, getState, submitterSession, () => api.updateExpense(id, updates), [fetchExpenses, fetchNotifications]);

export const deleteExpense = (id) => (dispatch, getState, { submitterApi: api, submitterSession }) =>
  runMutation(dispatch, getState, submitterSession, () => api.deleteExpense(id), [fetchExpenses, fetchNotifications]);

export const markNotificationRead = (id) => (dispatch, getState, { submitterApi: api, submitterSession }) =>
  runMutation(dispatch, getState, submitterSession, () => api.markNotificationRead(id), [fetchNotifications]);

export const markNotificationUnread = (id) => (dispatch, getState, { submitterApi: api, submitterSession }) =>
  runMutation(dispatch, getState, submitterSession, () => api.markNotificationUnread(id), [fetchNotifications]);

export const markAllNotificationsRead = () => (dispatch, getState, { submitterApi: api, submitterSession }) =>
  runMutation(dispatch, getState, submitterSession, () => api.markAllNotificationsRead(), [fetchNotifications]);

export const deleteNotification = (id) => (dispatch, getState, { submitterApi: api, submitterSession }) =>
  runMutation(dispatch, getState, submitterSession, () => api.deleteNotification(id), [fetchNotifications]);
