import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { configureStore } from "@reduxjs/toolkit";
import { managerApiSlice } from "../src/features/manager/managerApiSlice.js";
import managerFiltersReducer, {
  resetHistoryFilters,
  resetQueueFilters,
  setHistorySearch,
  setHistoryStatus,
  setQueueFlag,
  setQueueRisk,
  setQueueSearch,
} from "../src/features/manager/managerFiltersSlice.js";
import {
  decisionStatus,
  selectFilteredManagerHistory,
  selectFilteredManagerQueue,
  selectHighRiskManagerExpenses,
  selectPendingManagerCount,
  selectPendingManagerExpenses,
  selectTopPendingManagerExpenses,
} from "../src/features/manager/managerSelectors.js";
import { installManagerSessionReset } from "../src/store/index.js";
import { clearSession, saveSession, SESSION_EVENT, request } from "../src/services/session.ts";
import { LIVE_REFRESH_EVENT } from "../src/hooks/liveRefreshController.js";

const original = {
  window: globalThis.window,
  sessionStorage: globalThis.sessionStorage,
  localStorage: globalThis.localStorage,
  fetch: globalThis.fetch,
};

function memoryStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

function makeStore() {
  return configureStore({
    reducer: {
      [managerApiSlice.reducerPath]: managerApiSlice.reducer,
      managerFilters: managerFiltersReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(managerApiSlice.middleware),
  });
}

function setBrowserMocks(fetchImpl = async () => jsonResponse({ data: [] })) {
  const events = [];
  const listeners = new Map();
  globalThis.sessionStorage = memoryStorage({
    finstackTenantAccessToken: "test-token",
    finstackTenantUser: JSON.stringify({
      id: "manager-1",
      organizationId: "tenant-1",
      status: "ACTIVE",
    }),
  });
  globalThis.localStorage = memoryStorage();
  globalThis.window = {
    FINSTACK_API_BASE_URL: "https://api.test",
    dispatchEvent: (event) => {
      events.push(event.type);
      for (const listener of listeners.get(event.type) || []) listener(event);
      return true;
    },
    addEventListener: (type, listener) => {
      const typeListeners = listeners.get(type) || new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
  };
  globalThis.fetch = fetchImpl;
  return events;
}

beforeEach(() => setBrowserMocks());
afterEach(() => {
  globalThis.window = original.window;
  globalThis.sessionStorage = original.sessionStorage;
  globalThis.localStorage = original.localStorage;
  globalThis.fetch = original.fetch;
});

test("Manager filter reducers initialize, update, and reset queue and history filters", () => {
  let state = managerFiltersReducer(undefined, { type: "init" });
  assert.deepEqual(state, {
    queue: { search: "", flag: "all", risk: "all" },
    history: { search: "", status: "all" },
  });

  state = managerFiltersReducer(state, setQueueSearch("taxi"));
  state = managerFiltersReducer(state, setQueueFlag("flagged"));
  state = managerFiltersReducer(state, setQueueRisk("high"));
  state = managerFiltersReducer(state, setHistorySearch("alice"));
  state = managerFiltersReducer(state, setHistoryStatus("Returned"));
  assert.deepEqual(state, {
    queue: { search: "taxi", flag: "flagged", risk: "high" },
    history: { search: "alice", status: "Returned" },
  });

  state = managerFiltersReducer(state, resetQueueFilters());
  state = managerFiltersReducer(state, resetHistoryFilters());
  assert.deepEqual(state, {
    queue: { search: "", flag: "all", risk: "all" },
    history: { search: "", status: "all" },
  });
});

test("Manager selectors derive pending queue, counts, risk order, and filtered queue/history", async () => {
  const queue = [
    { id: "e1", merchant: "Cafe", employee: { fullName: "Alice" }, riskScore: 92, flag: "duplicate" },
    { id: "e2", merchant: "Taxi", employee: { fullName: "Bob" }, riskScore: 55 },
    { id: "e3", merchant: "Hotel", employee: { fullName: "Alice" }, riskScore: 18 },
    { id: "e4", merchant: "Flight", employee: { fullName: "Cara" }, riskScore: 76 },
    { id: "e5", merchant: "Train", employee: { fullName: "Dan" }, riskScore: 41 },
    { id: "e6", merchant: "Meal", employee: { fullName: "Eli" }, riskScore: 12 },
  ];
  const history = [
    { id: "h1", merchant: "Alice hotel", employee: { fullName: "Alice" }, managerDecision: "Approved" },
    { id: "h2", merchant: "Taxi", employee: { fullName: "Alice" }, managerDecision: "Returned for correction" },
    { id: "h3", merchant: "Flight", employee: { fullName: "Bob" }, workflowStatus: "compliance_review" },
  ];
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/manager/queue")) return jsonResponse({ data: queue });
    if (path.endsWith("/manager/history")) return jsonResponse({ data: history });
    return jsonResponse({ data: [] });
  };
  const store = makeStore();
  const queueRequest = store.dispatch(managerApiSlice.endpoints.getManagerQueue.initiate());
  const historyRequest = store.dispatch(managerApiSlice.endpoints.getManagerHistory.initiate());
  await Promise.all([queueRequest.unwrap(), historyRequest.unwrap()]);

  assert.equal(selectPendingManagerCount(store.getState()), 6);
  assert.deepEqual(selectPendingManagerExpenses(store.getState()).map(({ id }) => id), queue.map(({ id }) => id));
  assert.deepEqual(selectTopPendingManagerExpenses(store.getState()).map(({ id }) => id), ["e1", "e4", "e2", "e5", "e3"]);
  assert.deepEqual(selectHighRiskManagerExpenses(store.getState()).map(({ id }) => id), ["e1", "e4"]);

  store.dispatch(setQueueSearch("taxi"));
  store.dispatch(setQueueFlag("unflagged"));
  store.dispatch(setQueueRisk("medium"));
  assert.deepEqual(selectFilteredManagerQueue(store.getState()).map(({ id }) => id), ["e2"]);

  store.dispatch(setHistorySearch("alice"));
  store.dispatch(setHistoryStatus("Returned"));
  assert.deepEqual(selectFilteredManagerHistory(store.getState()).map(({ id }) => id), ["h2"]);

  assert.equal(decisionStatus({ managerDecision: "Escalated to Compliance" }), "Escalated");
  assert.equal(decisionStatus({ managerDecision: "Returned" }), "Returned");
  assert.equal(decisionStatus({ managerDecision: "Rejected" }), "Rejected");
  assert.equal(decisionStatus({ managerDecision: "Approved" }), "Approved");
  assert.equal(decisionStatus({ workflowStatus: "compliance_review" }), "Escalated");
  assert.equal(decisionStatus({}), "Processed");

  queueRequest.unsubscribe();
  historyRequest.unsubscribe();
  store.dispatch(managerApiSlice.util.resetApiState());
});

test("Manager query endpoints use expected routes and normalize non-array responses", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ path: new URL(url).pathname, method: init.method });
    return jsonResponse({ data: { items: [] } });
  };
  const store = makeStore();
  const queue = await store.dispatch(managerApiSlice.endpoints.getManagerQueue.initiate()).unwrap();
  const history = await store.dispatch(managerApiSlice.endpoints.getManagerHistory.initiate()).unwrap();
  const officers = await store.dispatch(managerApiSlice.endpoints.getFinanceOfficers.initiate()).unwrap();
  assert.deepEqual([queue, history, officers], [[], [], []]);
  assert.deepEqual(calls, [
    { path: "/api/v1/tenant/expenses/manager/queue", method: "GET" },
    { path: "/api/v1/tenant/expenses/manager/history", method: "GET" },
    { path: "/api/v1/tenant/expenses/manager/finance-officers", method: "GET" },
  ]);
  store.dispatch(managerApiSlice.util.resetApiState());
});

test("Manager decision mutations use contract routes/bodies, surface failures, and suppress only same-tab refresh", async () => {
  const events = setBrowserMocks();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const call = { path: new URL(url).pathname, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    return call.path.endsWith("/manager/reject")
      ? jsonResponse({ error: { message: "Decision was rejected." } }, 422)
      : jsonResponse({ data: { saved: true } });
  };
  const store = makeStore();
  const expenseId = "expense /1";
  await store.dispatch(managerApiSlice.endpoints.approveExpense.initiate({
    id: expenseId,
    body: { financeOfficerId: "fo-1", note: "Reviewed" },
  })).unwrap();
  await assert.rejects(
    store.dispatch(managerApiSlice.endpoints.rejectExpense.initiate({ id: expenseId, note: "No" })).unwrap(),
    (error) => error.status === 422 && error.data.message === "Decision was rejected.",
  );
  await store.dispatch(managerApiSlice.endpoints.returnExpense.initiate({ id: expenseId, note: "Fix receipt" })).unwrap();
  await store.dispatch(managerApiSlice.endpoints.escalateExpense.initiate({ id: expenseId, note: "Review risk" })).unwrap();

  assert.deepEqual(calls, [
    { path: "/api/v1/tenant/expenses/expense%20%2F1/manager/approve", method: "POST", body: { financeOfficerId: "fo-1", note: "Reviewed" } },
    { path: "/api/v1/tenant/expenses/expense%20%2F1/manager/reject", method: "POST", body: { note: "No" } },
    { path: "/api/v1/tenant/expenses/expense%20%2F1/manager/return", method: "POST", body: { note: "Fix receipt" } },
    { path: "/api/v1/tenant/expenses/expense%20%2F1/manager/escalate", method: "POST", body: { note: "Review risk" } },
  ]);
  assert.deepEqual(events, [], "Manager mutations should rely on RTK tags for same-tab updates");

  await request("/api/v1/tenant/other-role/write", { method: "POST", body: {} });
  assert.deepEqual(events, [LIVE_REFRESH_EVENT], "standard requests retain the default same-tab refresh");
  store.dispatch(managerApiSlice.util.resetApiState());
});

test("successful Manager decisions refetch queue/history; failed decisions leave cached lists intact", async () => {
  const events = setBrowserMocks();
  const expense = { id: "expense-1", workflowStatus: "manager_review" };
  let decided = false;
  const counts = { queue: 0, history: 0 };
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/manager/queue")) {
      counts.queue += 1;
      return jsonResponse({ data: decided ? [] : [expense] });
    }
    if (path.endsWith("/manager/history")) {
      counts.history += 1;
      return jsonResponse({ data: decided ? [{ ...expense, managerDecision: "Approved" }] : [] });
    }
    if (path.endsWith("/manager/approve")) {
      decided = true;
      return jsonResponse({ data: { saved: true } });
    }
    return jsonResponse({ error: { message: "Could not save decision." } }, 422);
  };
  const store = makeStore();
  const queueRequest = store.dispatch(managerApiSlice.endpoints.getManagerQueue.initiate());
  const historyRequest = store.dispatch(managerApiSlice.endpoints.getManagerHistory.initiate());
  await Promise.all([queueRequest.unwrap(), historyRequest.unwrap()]);

  await store.dispatch(managerApiSlice.endpoints.approveExpense.initiate({ id: expense.id, body: { financeOfficerId: "fo-1" } })).unwrap();
  await waitFor(() => {
    const queueResult = managerApiSlice.endpoints.getManagerQueue.select()(store.getState());
    const historyResult = managerApiSlice.endpoints.getManagerHistory.select()(store.getState());
    return counts.queue > 1 && counts.history > 1 &&
      queueResult.status === "fulfilled" && historyResult.status === "fulfilled" &&
      queueResult.data.length === 0 && historyResult.data[0]?.id === expense.id;
  });
  assert.deepEqual(managerApiSlice.endpoints.getManagerQueue.select()(store.getState()).data, []);
  assert.equal(managerApiSlice.endpoints.getManagerHistory.select()(store.getState()).data[0].id, expense.id);

  const callsBeforeFailure = { ...counts };
  await assert.rejects(
    store.dispatch(managerApiSlice.endpoints.rejectExpense.initiate({ id: expense.id, note: "No" })).unwrap(),
    (error) => error.status === 422 && error.data.message === "Could not save decision.",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(counts, callsBeforeFailure, "failed mutations must not invalidate either list");
  assert.deepEqual(events, []);

  queueRequest.unsubscribe();
  historyRequest.unsubscribe();
  store.dispatch(managerApiSlice.util.resetApiState());
});

test("same-user session events preserve Manager state; user changes and logout reset it", async () => {
  const events = setBrowserMocks();
  const store = makeStore();
  globalThis.fetch = async (url) => new URL(url).pathname.endsWith("/manager/queue")
    ? jsonResponse({ data: [{ id: "cached-expense" }] })
    : jsonResponse({ data: [] });
  const query = store.dispatch(managerApiSlice.endpoints.getManagerQueue.initiate());
  await query.unwrap();
  store.dispatch(setQueueSearch("cached"));
  store.dispatch(setHistoryStatus("Approved"));

  const uninstall = installManagerSessionReset(globalThis.window, store);
  const sessionFor = (id, organizationId, accessToken, firstName) => ({
    accessToken,
    organizationId,
    user: {
      id,
      organizationId,
      employeeId: `${id}-employee`,
      firstName,
      lastName: "Manager",
      email: `${id}@example.test`,
      role: "MANAGER",
      status: "ACTIVE",
    },
  });

  saveSession(sessionFor("manager-1", "tenant-1", "refreshed-token", "Updated"));
  assert.equal(managerApiSlice.endpoints.getManagerQueue.select()(store.getState()).data[0].id, "cached-expense");
  assert.equal(store.getState().managerFilters.queue.search, "cached");
  assert.equal(store.getState().managerFilters.history.status, "Approved");

  saveSession(sessionFor("manager-1", "tenant-2", "moved-tenant-token", "Updated"));
  assert.deepEqual(store.getState().managerApi.queries, {});
  assert.deepEqual(store.getState().managerFilters, {
    queue: { search: "", flag: "all", risk: "all" },
    history: { search: "", status: "all" },
  });

  const secondQuery = store.dispatch(managerApiSlice.endpoints.getManagerQueue.initiate());
  await secondQuery.unwrap();
  store.dispatch(setQueueSearch("user-switch-check"));
  store.dispatch(setHistoryStatus("Approved"));
  saveSession(sessionFor("manager-2", "tenant-2", "other-user-token", "Other"));
  assert.deepEqual(store.getState().managerApi.queries, {});
  assert.deepEqual(store.getState().managerFilters, {
    queue: { search: "", flag: "all", risk: "all" },
    history: { search: "", status: "all" },
  });

  const thirdQuery = store.dispatch(managerApiSlice.endpoints.getManagerQueue.initiate());
  await thirdQuery.unwrap();
  store.dispatch(setQueueSearch("logout-check"));
  store.dispatch(setHistoryStatus("Rejected"));
  clearSession();

  assert.ok(events.includes(SESSION_EVENT));
  assert.deepEqual(store.getState().managerApi.queries, {});
  assert.deepEqual(store.getState().managerFilters, {
    queue: { search: "", flag: "all", risk: "all" },
    history: { search: "", status: "all" },
  });
  uninstall();
  query.unsubscribe();
  secondQuery.unsubscribe();
  thirdQuery.unsubscribe();
  store.dispatch(managerApiSlice.util.resetApiState());
});

async function waitFor(predicate, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("Timed out waiting for RTK Query cache synchronization.");
}
