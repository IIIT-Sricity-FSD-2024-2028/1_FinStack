import { createSlice } from "@reduxjs/toolkit";

const sessionSlice = createSlice({
  name: "submitterSession",
  initialState: { identity: null, generation: 0, pendingMutations: 0 },
  reducers: {
    sessionChanged(state, action) {
      state.identity = action.payload;
      state.generation += 1;
      state.pendingMutations = 0;
    },
    mutationStarted(state, action) {
      if (state.generation === action.payload) state.pendingMutations += 1;
    },
    mutationFinished(state, action) {
      if (state.generation === action.payload) state.pendingMutations -= 1;
    },
  },
});

export const { sessionChanged, mutationStarted, mutationFinished } = sessionSlice.actions;
export default sessionSlice.reducer;

export function submitterIdentity(user) {
  if (!user?.id || !user?.organizationId || user.role !== "EXPENSE_SUBMITTER") return null;
  return JSON.stringify([user.organizationId, user.id]);
}

export function requireCurrentSession(getState, generation) {
  const session = getState().session;
  if (!session.identity || session.generation !== generation) {
    throw new Error("Your session changed. Please try again after signing in.");
  }
}
