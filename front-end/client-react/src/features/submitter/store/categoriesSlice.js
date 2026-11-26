import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { addResourceCases, canFetchResource, initialResourceState } from "./resourceState.js";

export const fetchCategories = createAsyncThunk(
  "categories/fetch",
  async (_options, { extra, getState, signal }) => extra.submitterSession.run(getState().submitter.session.generation, signal, () => extra.submitterApi.getCategories()),
  { condition: (options, { getState }) => canFetchResource("categories", getState(), options) },
);

const categoriesSlice = createSlice({
  name: "categories",
  initialState: initialResourceState(),
  reducers: {},
  extraReducers: (builder) => addResourceCases(builder, fetchCategories, "Unable to load categories."),
});

export const selectCategories = (state) => state.submitter.categories.items;
export const selectCategoryState = (state) => state.submitter.categories;
export default categoriesSlice.reducer;
