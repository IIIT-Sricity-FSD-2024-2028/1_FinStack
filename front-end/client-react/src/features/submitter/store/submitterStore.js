import { configureStore } from "@reduxjs/toolkit";
import expenses from "./expensesSlice.js";
import categories from "./categoriesSlice.js";
import notifications from "./notificationsSlice.js";
import session from "./submitterSession.js";

// One store per mounted workspace. The injected adapter is the existing JWT
// transport; tests can supply an in-memory API without touching a database.
export function createSubmitterStore(api) {
  return configureStore({
    reducer: { session, expenses, categories, notifications },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: { extraArgument: { api } } }),
  });
}
