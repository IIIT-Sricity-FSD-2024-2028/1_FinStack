import test from "node:test";
import assert from "node:assert/strict";
import { createSubmitterStore, bindSubmitterSession } from "./helpers/submitterStore.js";
import { submitterIdentity } from "../src/features/submitter/store/submitterSession.js";
import { fetchExpenses, selectExpenses, selectExpenseState } from "../src/features/submitter/store/expensesSlice.js";
import { fetchCategories, selectCategories, selectCategoryState } from "../src/features/submitter/store/categoriesSlice.js";
import { fetchNotifications, selectNotifications, selectNotificationState, selectUnreadCount } from "../src/features/submitter/store/notificationsSlice.js";
import {
  refreshSubmitter, createExpense, updateExpense, deleteExpense,
  markNotificationRead, markNotificationUnread, markAllNotificationsRead, deleteNotification,
} from "../src/features/submitter/store/submitterActions.js";
import { buildExpenseTrend } from "../src/features/submitter/dashboardAnalytics.js";

const identity = (id = "employee-a", organizationId = "tenant-a") => submitterIdentity({
  id, organizationId, role: "EXPENSE_SUBMITTER",
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function fixture(overrides = {}, signedIn = true) {
  const calls = [];
  let expenses = [{ id: "expense-1", amount: "100", workflowStatus: "returned" }];
  let notifications = [{ id: "notice-1", unread: true, message: "Expense returned for correction." }];
  const api = {
    async getMyExpenses() { calls.push("expenses"); return structuredClone(expenses); },
    async getCategories() { calls.push("categories"); return [{ id: "travel", name: "Travel" }]; },
    async getNotifications() { calls.push("notifications"); return { items: structuredClone(notifications) }; },
    async createExpense(data, receipt) {
      calls.push(["create", data, receipt]);
      const result = { ...data, id: "expense-2", workflowStatus: "manager_review" };
      expenses.push(result);
      return result;
    },
    async updateExpense(id, updates) {
      calls.push(["update", id, updates]);
      expenses = expenses.map((item) => item.id === id ? { ...item, ...updates, workflowStatus: "manager_review" } : item);
      return { id };
    },
    async deleteExpense(id) { calls.push(["delete", id]); expenses = expenses.filter((item) => item.id !== id); },
    async markNotificationRead(id) { notifications = notifications.map((item) => item.id === id ? { ...item, unread: false } : item); },
    async markNotificationUnread(id) { notifications = notifications.map((item) => item.id === id ? { ...item, unread: true } : item); },
    async markAllNotificationsRead() { notifications = notifications.map((item) => ({ ...item, unread: false })); },
    async deleteNotification(id) { notifications = notifications.filter((item) => item.id !== id); },
    ...overrides,
  };
  const store = createSubmitterStore(api);
  if (signedIn) bindSubmitterSession(store, identity());
  return { store, api, calls };
}

test("Submitter store initializes with independent empty, idle resources and no secrets", () => {
  const { store } = fixture({}, false);
  assert.deepEqual(store.getState().submitter.session, { identity: null, generation: 0, pendingMutations: 0 });
  for (const resource of ["expenses", "categories", "notifications"]) {
    assert.deepEqual(store.getState().submitter[resource], { items: [], loading: false, error: "", requestId: null });
  }
});

test("identity includes employee and tenant and excludes other actor roles", () => {
  assert.notEqual(identity(), identity("employee-b"));
  assert.notEqual(identity(), identity("employee-a", "tenant-b"));
  assert.equal(submitterIdentity(null), null);
  assert.equal(submitterIdentity({ id: "x", organizationId: "y", role: "MANAGER" }), null);
});

test("expenses load with pending and success state through the real slice and selectors", async () => {
  const pending = deferred();
  const { store } = fixture({ getMyExpenses: () => pending.promise });
  const request = store.dispatch(fetchExpenses());
  assert.equal(selectExpenseState(store.getState()).loading, true);
  const data = [{ id: "real", workflowStatus: "approved_for_payment", amount: "500" }];
  pending.resolve(data);
  await request.unwrap();
  assert.deepEqual(selectExpenses(store.getState()), data);
  assert.equal(selectExpenseState(store.getState()).loading, false);
  assert.equal(selectExpenseState(store.getState()).error, "");
});

for (const [resource, fetchResource, selectState] of [
  ["expenses", fetchExpenses, selectExpenseState],
  ["categories", fetchCategories, selectCategoryState],
  ["notifications", fetchNotifications, selectNotificationState],
]) {
  test(`${resource} failure exposes an error and retry recovers without erasing other resources`, async () => {
    const { store, api } = fixture();
    await store.dispatch(refreshSubmitter());
    const before = store.getState();
    const method = { expenses: "getMyExpenses", categories: "getCategories", notifications: "getNotifications" }[resource];
    const original = api[method];
    api[method] = async () => { throw new Error(`${resource} unavailable`); };
    await store.dispatch(fetchResource());
    assert.equal(selectState(store.getState()).error, `${resource} unavailable`);
    assert.equal(selectState(store.getState()).loading, false);
    for (const other of ["expenses", "categories", "notifications"].filter((name) => name !== resource)) {
      assert.deepEqual(store.getState().submitter[other], before.submitter[other]);
    }
    api[method] = original;
    await store.dispatch(fetchResource()).unwrap();
    assert.equal(selectState(store.getState()).error, "");
  });
}

test("categories and notifications finish independently while expenses remain pending", async () => {
  const pending = deferred();
  const { store } = fixture({ getMyExpenses: () => pending.promise });
  const request = store.dispatch(fetchExpenses());
  await Promise.all([store.dispatch(fetchCategories()), store.dispatch(fetchNotifications())]);
  assert.equal(selectExpenseState(store.getState()).loading, true);
  assert.equal(selectCategories(store.getState())[0].name, "Travel");
  assert.equal(selectNotifications(store.getState())[0].message, "Expense returned for correction.");
  assert.equal(selectUnreadCount(store.getState()), 1);
  pending.resolve([]);
  await request;
});

test("creation passes the local receipt to the adapter and refreshes authoritative expenses and notifications once", async () => {
  const { store, calls } = fixture();
  const receipt = new File(["receipt"], "receipt.pdf", { type: "application/pdf" });
  const data = { amount: "250", categoryId: "travel" };
  await store.dispatch(createExpense(data, receipt));
  assert.equal(calls[0][2], receipt);
  assert.deepEqual(calls.slice(1), ["expenses", "notifications"]);
  assert.equal(selectExpenses(store.getState())[1].workflowStatus, "manager_review");
  assert.equal(JSON.stringify(store.getState()).includes("receipt.pdf"), false);
});

test("update and returned correction preserve backend workflow and send only supplied editable fields", async () => {
  const { store, calls } = fixture();
  await store.dispatch(fetchExpenses());
  assert.equal(selectExpenses(store.getState())[0].workflowStatus, "returned");
  const updates = { amount: 123, notes: "Corrected receipt details" };
  await store.dispatch(updateExpense("expense-1", updates));
  assert.deepEqual(calls[1], ["update", "expense-1", updates]);
  assert.equal(selectExpenses(store.getState())[0].workflowStatus, "manager_review");
  assert.equal(selectExpenses(store.getState())[0].amount, 123);
});

test("deletion refreshes the backend list", async () => {
  const { store, calls } = fixture();
  await store.dispatch(fetchExpenses());
  await store.dispatch(deleteExpense("expense-1"));
  assert.deepEqual(selectExpenses(store.getState()), []);
  assert.deepEqual(calls.slice(1), [["delete", "expense-1"], "expenses", "notifications"]);
});

test("failed mutation leaves persisted state intact and releases refresh suppression", async () => {
  const { store, calls } = fixture({ updateExpense: async () => { throw new Error("Validation failed"); } });
  await store.dispatch(fetchExpenses());
  const before = selectExpenses(store.getState());
  await assert.rejects(store.dispatch(updateExpense("expense-1", {})), /Validation failed/);
  assert.deepEqual(selectExpenses(store.getState()), before);
  assert.deepEqual(calls, ["expenses"]);
  assert.equal(store.getState().submitter.session.pendingMutations, 0);
});

test("confirmed creation with a failed refresh exposes retry without resubmitting the expense", async () => {
  const { store, calls } = fixture({ getMyExpenses: async () => { throw new Error("Read unavailable"); } });
  const result = await store.dispatch(createExpense({ amount: "200" }, null));
  assert.equal(result.id, "expense-2");
  assert.equal(selectExpenseState(store.getState()).error, "Read unavailable");
  assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === "create").length, 1);
});

test("notification read, unread, read-all and dismissal keep list and unread selector consistent", async () => {
  const { store } = fixture();
  await store.dispatch(fetchNotifications());
  await store.dispatch(markNotificationRead("notice-1"));
  assert.equal(selectUnreadCount(store.getState()), 0);
  await store.dispatch(markNotificationUnread("notice-1"));
  assert.equal(selectUnreadCount(store.getState()), 1);
  await store.dispatch(markAllNotificationsRead());
  assert.equal(selectUnreadCount(store.getState()), 0);
  await store.dispatch(deleteNotification("notice-1"));
  assert.deepEqual(selectNotifications(store.getState()), []);
});

test("logout clears data, errors and loading across every resource", async () => {
  const { store, api } = fixture();
  await store.dispatch(refreshSubmitter());
  api.getCategories = async () => { throw new Error("Offline"); };
  await store.dispatch(fetchCategories());
  bindSubmitterSession(store, null);
  for (const resource of ["expenses", "categories", "notifications"]) {
    assert.deepEqual(store.getState().submitter[resource], { items: [], loading: false, error: "", requestId: null });
  }
  assert.equal(selectUnreadCount(store.getState()), 0);
});

for (const [label, nextIdentity] of [
  ["logout", null],
  ["employee switch", identity("employee-b")],
  ["tenant switch", identity("employee-a", "tenant-b")],
  ["same employee signs in again", identity()],
]) {
  test(`${label} ignores all late resource responses and fetches only the new session`, async () => {
    const old = deferred();
    const { store, api } = fixture({
      getMyExpenses: () => old.promise,
      getCategories: () => old.promise,
      getNotifications: async () => ({ items: await old.promise }),
    });
    const request = store.dispatch(refreshSubmitter());
    bindSubmitterSession(store, nextIdentity);
    if (nextIdentity) {
      api.getMyExpenses = async () => [{ id: "new-user-expense" }];
      api.getCategories = async () => [{ id: "new-tenant-category" }];
      api.getNotifications = async () => ({ items: [{ id: "new-user-notice", unread: false }] });
      await store.dispatch(refreshSubmitter());
    }
    const before = store.getState();
    old.resolve([{ id: "previous-user-private-data", unread: true }]);
    await request;
    assert.deepEqual(store.getState(), before);
    assert.equal(JSON.stringify(store.getState()).includes("previous-user-private-data"), false);
  });
}

test("late rejection after logout cannot restore an error or loading indicator", async () => {
  const old = deferred();
  const { store } = fixture({ getMyExpenses: () => old.promise });
  const request = store.dispatch(fetchExpenses());
  bindSubmitterSession(store, null);
  old.reject(new Error("Previous tenant error"));
  await request;
  assert.equal(selectExpenseState(store.getState()).error, "");
  assert.equal(selectExpenseState(store.getState()).loading, false);
});

for (const nextIdentity of [null, identity("employee-b")]) {
  test(`late mutation after ${nextIdentity ? "user switch" : "logout"} cannot start another user's refresh`, async () => {
    const pending = deferred();
    const { store, calls } = fixture({ createExpense: () => pending.promise });
    const request = store.dispatch(createExpense({}, null));
    bindSubmitterSession(store, nextIdentity);
    pending.resolve({ id: "old-expense" });
    await assert.rejects(request, /session changed/);
    assert.deepEqual(calls, []);
    assert.equal(store.getState().submitter.session.pendingMutations, 0);
    assert.deepEqual(selectExpenses(store.getState()), []);
  });
}

test("unauthenticated fetches and mutations never reach the adapter", async () => {
  const { store, calls } = fixture({}, false);
  await store.dispatch(refreshSubmitter());
  await assert.rejects(store.dispatch(createExpense({}, null)), /session changed/);
  assert.deepEqual(calls, []);
});

test("overlapping initial fetch and live refresh make one request per resource", async () => {
  const pending = deferred();
  const { store, calls } = fixture({ getMyExpenses: () => { calls.push("expenses"); return pending.promise; } });
  const first = store.dispatch(refreshSubmitter());
  const second = store.dispatch(refreshSubmitter({ background: true }));
  assert.deepEqual(calls, ["expenses", "categories", "notifications"]);
  pending.resolve([]);
  await Promise.all([first, second]);
});

test("the transport mutation broadcast does not duplicate mutation-owned reads", async () => {
  const { store, api, calls } = fixture();
  const original = api.createExpense;
  api.createExpense = async (...args) => {
    const result = await original(...args);
    await store.dispatch(refreshSubmitter({ background: true }));
    return result;
  };
  await store.dispatch(createExpense({ amount: "200" }, null));
  assert.deepEqual(calls.slice(1), ["expenses", "notifications"]);
});

test("post-write refresh supersedes an older pre-write expense request", async () => {
  const old = deferred();
  const { store, api } = fixture();
  const original = api.getMyExpenses;
  api.getMyExpenses = () => old.promise;
  const request = store.dispatch(fetchExpenses());
  api.getMyExpenses = original;
  await store.dispatch(updateExpense("expense-1", { amount: "450" }));
  old.resolve([{ id: "expense-1", amount: "100", workflowStatus: "returned" }]);
  await request;
  assert.equal(selectExpenses(store.getState())[0].amount, "450");
  assert.equal(selectExpenses(store.getState())[0].workflowStatus, "manager_review");
});

test("background refresh retains the visible data when a poll fails", async () => {
  const { store, api } = fixture();
  await store.dispatch(fetchExpenses());
  const before = selectExpenses(store.getState());
  api.getMyExpenses = async () => { throw new Error("Offline poll"); };
  await store.dispatch(fetchExpenses({ background: true }));
  assert.deepEqual(selectExpenses(store.getState()), before);
  assert.equal(selectExpenseState(store.getState()).loading, false);
  assert.equal(selectExpenseState(store.getState()).error, "");
});

test("background workspace refresh reports failures to the existing live-refresh hook", async () => {
  const { store, api } = fixture();
  await store.dispatch(refreshSubmitter());
  const before = selectExpenses(store.getState());
  api.getMyExpenses = async () => { throw new Error("Offline poll"); };
  await assert.rejects(store.dispatch(refreshSubmitter({ background: true })), /Offline poll/);
  assert.deepEqual(selectExpenses(store.getState()), before);
  assert.equal(selectCategories(store.getState()).length, 1);
  assert.equal(selectNotifications(store.getState()).length, 1);
});

test("dashboard trends consume Redux expenses in date order with separate same-date entries", async () => {
  const { store } = fixture({ getMyExpenses: async () => [
    { id: "last", date: "2026-10-03", amount: "300" },
    { id: "first", date: "2026-10-01", amount: "100" },
    { id: "same-date", date: "2026-10-01", amount: "250" },
  ] });
  await store.dispatch(fetchExpenses());
  const trend = buildExpenseTrend(selectExpenses(store.getState()));
  assert.deepEqual(trend.map((point) => point.id), ["first", "same-date", "last"]);
  assert.deepEqual(trend.map((point) => point.value), [100, 250, 300]);
});
