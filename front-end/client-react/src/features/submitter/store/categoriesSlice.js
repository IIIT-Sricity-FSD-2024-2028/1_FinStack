import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { addResourceCases, canFetchResource, initialResourceState } from "./resourceState.js";

export const fetchCategories = createAsyncThunk(
  "categories/fetch",
  async (_options, { extra }) => extra.api.getCategories(),
  { condition: (options, { getState }) => canFetchResource("categories", getState(), options) },
);

const categoriesSlice = createSlice({
  name: "categories",
  initialState: initialResourceState(),
  reducers: {},
  extraReducers: (builder) => addResourceCases(builder, fetchCategories, "Unable to load categories."),
});

export const selectCategories = (state) => state.categories.items;
export const selectCategoryState = (state) => state.categories;
export default categoriesSlice.reducer;
