import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  queue: { search: "", flag: "all", risk: "all" },
  history: { search: "", status: "all" },
};

const managerFiltersSlice = createSlice({
  name: "managerFilters",
  initialState,
  reducers: {
    setQueueSearch: (state, action) => { state.queue.search = action.payload; },
    setQueueFlag: (state, action) => { state.queue.flag = action.payload; },
    setQueueRisk: (state, action) => { state.queue.risk = action.payload; },
    resetQueueSearch: (state) => { state.queue.search = initialState.queue.search; },
    resetQueueFlag: (state) => { state.queue.flag = initialState.queue.flag; },
    resetQueueRisk: (state) => { state.queue.risk = initialState.queue.risk; },
    resetQueueFilters: (state) => { state.queue = { ...initialState.queue }; },
    setHistorySearch: (state, action) => { state.history.search = action.payload; },
    setHistoryStatus: (state, action) => { state.history.status = action.payload; },
    resetHistorySearch: (state) => { state.history.search = initialState.history.search; },
    resetHistoryStatus: (state) => { state.history.status = initialState.history.status; },
    resetHistoryFilters: (state) => { state.history = { ...initialState.history }; },
  },
});

export const {
  setQueueSearch,
  setQueueFlag,
  setQueueRisk,
  resetQueueSearch,
  resetQueueFlag,
  resetQueueRisk,
  resetQueueFilters,
  setHistorySearch,
  setHistoryStatus,
  resetHistorySearch,
  resetHistoryStatus,
  resetHistoryFilters,
} = managerFiltersSlice.actions;

export default managerFiltersSlice.reducer;
