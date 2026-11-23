import { configureStore } from "@reduxjs/toolkit";
import { managerApiSlice } from "../features/manager/managerApiSlice.js";
import managerFiltersReducer from "../features/manager/managerFiltersSlice.js";

export const store = configureStore({
  reducer: {
    [managerApiSlice.reducerPath]: managerApiSlice.reducer,
    managerFilters: managerFiltersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(managerApiSlice.middleware),
});
