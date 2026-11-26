import test from "node:test";
import assert from "node:assert/strict";
import { submitterProfileDetails } from "../src/features/submitter/profileDetails.js";
import { notificationText } from "../src/features/submitter/notificationPresentation.js";
import { createSubmitterStore } from "../src/features/submitter/store/submitterStore.js";
import { sessionChanged } from "../src/features/submitter/store/submitterSession.js";
import { fetchExpenses } from "../src/features/submitter/store/expensesSlice.js";
import { fetchNotifications, selectNotifications, selectDisplayNotifications, selectUnreadCount } from "../src/features/submitter/store/notificationsSlice.js";
import { markNotificationRead, markNotificationUnread, markAllNotificationsRead, deleteNotification } from "../src/features/submitter/store/submitterActions.js";

const expenseId = "10000000-0000-4000-8000-000000000001";

test("Submitter profile displays real organization, department and assigned manager", () => {
  const fields = Object.fromEntries(submitterProfileDetails({
    fullName: "Alex Employee", organizationName: "Own Organization", department: "Engineering",
    manager: { firstName: "Morgan", lastName: "Reviewer", employeeId: "MGR-1" },
  }));
  assert.equal(fields.Organization, "Own Organization");
  assert.equal(fields.Department, "Engineering");
  assert.equal(fields.Manager, "Morgan Reviewer (MGR-1)");
});

test("Submitter profile distinguishes unassigned manager from an unavailable profile field", () => {
  assert.equal(Object.fromEntries(submitterProfileDetails({ manager: null })).Manager, "Not assigned");
  assert.equal(Object.fromEntries(submitterProfileDetails({})).Manager, "Unavailable in current profile");
});

test("profile mapping does not retain another account's information", () => {
  const first = Object.fromEntries(submitterProfileDetails({ organizationName: "Tenant A", manager: { firstName: "A" } }));
  const second = Object.fromEntries(submitterProfileDetails({ organizationName: "Tenant B", manager: null }));
  assert.equal(first.Organization, "Tenant A");
  assert.equal(second.Organization, "Tenant B");
  assert.equal(second.Manager, "Not assigned");
});

test("notification text uses an available merchant without exposing internal UUIDs", () => {
  assert.equal(notificationText(`${expenseId} is awaiting manager review.`, { merchant: "Railway" }), "Your expense at Railway is awaiting manager review.");
  assert.equal(notificationText(`Reviewer returned expense ${expenseId}.`, { merchant: "Railway" }), "Reviewer returned your expense at Railway.");
});

test("notification fallback remains meaningful for unavailable/deleted expenses and empty messages", () => {
  assert.equal(notificationText(`${expenseId} was returned for correction.`), "Your expense was returned for correction.");
  assert.equal(notificationText(""), "There is an update to your expense.");
  assert.equal(notificationText("Your account was updated."), "Your account was updated.");
  assert.equal(notificationText(`${expenseId} was approved.`, { merchant: expenseId }), "Your expense was approved.");
});

test("display selector preserves raw notifications, action IDs and unread behavior through mutations", async () => {
  const noticeId = "20000000-0000-4000-8000-000000000001";
  let items = [{ id: noticeId, relatedExpenseId: expenseId, title: `Expense ${expenseId}`, message: `${expenseId} was returned.`, unread: true }];
  const actionIds = [];
  const store = createSubmitterStore({
    getMyExpenses: async () => [{ id: expenseId, merchant: "Railway" }],
    getNotifications: async () => ({ items: structuredClone(items) }),
    markNotificationRead: async (id) => { actionIds.push(id); items[0].unread = false; },
    markNotificationUnread: async (id) => { actionIds.push(id); items[0].unread = true; },
    markAllNotificationsRead: async () => { items[0].unread = false; },
    deleteNotification: async (id) => { actionIds.push(id); items = []; },
  });
  store.dispatch(sessionChanged("tenant-a/employee-a"));
  await Promise.all([store.dispatch(fetchExpenses()), store.dispatch(fetchNotifications())]);
  const raw = selectNotifications(store.getState());
  const display = selectDisplayNotifications(store.getState())[0];
  assert.equal(raw[0].message, `${expenseId} was returned.`);
  assert.equal(display.message, "Your expense at Railway was returned.");
  assert.equal(display.title, "Your expense at Railway");
  assert.equal(display.id, noticeId);
  assert.equal(display.relatedExpenseId, expenseId);
  assert.equal(selectDisplayNotifications(store.getState()), selectDisplayNotifications(store.getState()));
  await store.dispatch(markNotificationRead(display.id));
  assert.equal(selectUnreadCount(store.getState()), 0);
  await store.dispatch(markNotificationUnread(display.id));
  assert.equal(selectUnreadCount(store.getState()), 1);
  await store.dispatch(markAllNotificationsRead());
  assert.equal(selectUnreadCount(store.getState()), 0);
  await store.dispatch(deleteNotification(display.id));
  assert.deepEqual(selectDisplayNotifications(store.getState()), []);
  assert.deepEqual(actionIds, [noticeId, noticeId, noticeId]);
  assert.equal(raw[0].unread, true);
});
