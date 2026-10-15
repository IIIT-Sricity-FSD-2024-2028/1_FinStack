import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createManagerApi } from "../src/features/manager/managerApiContract.js";
import { loadManagerWorkspace } from "../src/features/manager/managerWorkspaceLoader.js";

test("Manager API uses tenant JWT requests and the versioned Manager routes", async () => {
  const calls = [];
  const request = async (path, options = {}) => { calls.push({ path, options }); return []; };
  const requestBlob = async (path, options = {}) => { calls.push({ path, options, binary: true }); return new Blob(); };
  const managerApi = createManagerApi(request, requestBlob);
  const signal = new AbortController().signal;
  await managerApi.queue(signal);
  await managerApi.history(signal);
  await managerApi.financeOfficers(signal);
  await managerApi.approve("expense /1", { financeOfficerId: "fo-1", note: "Reviewed" });
  await managerApi.returnForCorrection("expense-2", "Attach itemized receipt");
  await managerApi.reject("expense-3", "Outside policy");
  await managerApi.escalate("expense-4", "Needs compliance review");
  await managerApi.notifications(signal);
  await managerApi.markNotificationRead("note-1");
  await managerApi.markAllNotificationsRead();
  await managerApi.dismissNotification("note-2");
  await managerApi.receipt("expense-5");

  assert.deepEqual(calls.map(({ path, options }) => [path, options.method || "GET"]), [
    ["/api/v1/tenant/expenses/manager/queue", "GET"],
    ["/api/v1/tenant/expenses/manager/history", "GET"],
    ["/api/v1/tenant/expenses/manager/finance-officers", "GET"],
    ["/api/v1/tenant/expenses/expense%20%2F1/manager/approve", "POST"],
    ["/api/v1/tenant/expenses/expense-2/manager/return", "POST"],
    ["/api/v1/tenant/expenses/expense-3/manager/reject", "POST"],
    ["/api/v1/tenant/expenses/expense-4/manager/escalate", "POST"],
    ["/api/v1/tenant/expenses/notifications", "GET"],
    ["/api/v1/tenant/expenses/notifications/note-1/read", "PATCH"],
    ["/api/v1/tenant/expenses/notifications/read-all", "POST"],
    ["/api/v1/tenant/expenses/notifications/note-2", "DELETE"],
    ["/api/v1/tenant/expenses/expense-5/receipt", "GET"],
  ]);
  assert.equal(calls[0].options.signal, signal);
  assert.deepEqual(calls[3].options.body, { financeOfficerId: "fo-1", note: "Reviewed" });
  assert.deepEqual(calls[4].options.body, { note: "Attach itemized receipt" });
  assert.deepEqual(calls[5].options.body, { note: "Outside policy" });
  assert.deepEqual(calls[6].options.body, { note: "Needs compliance review" });
  assert.equal(calls[11].binary, true);
});

test("workspace loader combines queue/history and optional approvers, normalizing malformed lists", async () => {
  const calls = [];
  const api = {
    queue: async (signal) => { calls.push(["queue", signal]); return [{ id: "e-1" }]; },
    history: async (signal) => { calls.push(["history", signal]); return null; },
    financeOfficers: async (signal) => { calls.push(["officers", signal]); return [{ id: "fo-1" }]; },
  };
  const signal = new AbortController().signal;
  assert.deepEqual(await loadManagerWorkspace(api, true, signal), {
    queue: [{ id: "e-1" }], history: [], officers: [{ id: "fo-1" }],
  });
  assert.deepEqual(calls.map(([name]) => name), ["queue", "history", "officers"]);
  assert.ok(calls.every(([, forwardedSignal]) => forwardedSignal === signal));
});

test("workspace loader discards results after its request is aborted", async () => {
  const controller = new AbortController();
  let release;
  const delayed = () => new Promise((resolve) => { release = resolve; });
  const pending = loadManagerWorkspace({ queue: delayed, history: async () => [] }, false, controller.signal);
  controller.abort();
  release([{ id: "stale" }]);
  assert.equal(await pending, null);
});

test("React router wires every Manager page under the Manager role guard", async () => {
  const router = await readFile(new URL("../src/app/router.jsx", import.meta.url), "utf8");
  assert.match(router, /<ProtectedRoute allowedRoles=\{\["MANAGER"\]\}/);
  for (const path of [
    'path="dashboard"',
    'path="expenses"',
    'path="expenses/:expenseId"',
    'path="history"',
    'path="notifications"',
    'path="profile-settings"',
  ]) assert.ok(router.includes(path), `Manager route missing ${path}`);
});
