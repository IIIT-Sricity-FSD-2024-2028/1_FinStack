import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import { addResourceCases, canFetchResource, initialResourceState } from "./resourceState.js";
import { selectExpenses } from "./expensesSlice.js";
import { notificationText } from "../notificationPresentation.js";

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async (_options, { extra }) => (await extra.api.getNotifications()).items,
  { condition: (options, { getState }) => canFetchResource("notifications", getState(), options) },
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: initialResourceState(),
  reducers: {},
  extraReducers: (builder) => addResourceCases(builder, fetchNotifications, "Unable to load notifications."),
});

export const selectNotifications = (state) => state.notifications.items;
export const selectDisplayNotifications = createSelector(
  [selectNotifications, selectExpenses],
  (notifications, expenses) => {
    const expensesById = new Map(expenses.map((expense) => [expense.id, expense]));
    return notifications.map((notification) => {
      const expense = expensesById.get(notification.relatedExpenseId);
      return {
        ...notification,
        title: notificationText(notification.title, expense, "Expense update"),
        message: notificationText(notification.message, expense),
      };
    });
  },
);
export const selectNotificationState = (state) => state.notifications;
export const selectUnreadCount = createSelector(
  [selectNotifications],
  (notifications) => notifications.filter((item) => item.unread).length,
);
export default notificationsSlice.reducer;
