import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { addResourceCases, canFetchResource, initialResourceState } from "./resourceState.js";

export const fetchExpenses = createAsyncThunk(
  "expenses/fetch",
  async (_options, { extra }) => extra.api.getMyExpenses(),
  { condition: (options, { getState }) => canFetchResource("expenses", getState(), options) },
);

const expensesSlice = createSlice({
  name: "expenses",
  initialState: initialResourceState(),
  reducers: {},
  extraReducers: (builder) => addResourceCases(builder, fetchExpenses, "Unable to load expenses."),
});

export const selectExpenses = (state) => state.expenses.items;
export const selectExpenseState = (state) => state.expenses;
export default expensesSlice.reducer;
