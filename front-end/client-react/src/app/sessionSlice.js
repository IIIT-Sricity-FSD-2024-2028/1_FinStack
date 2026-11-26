import { createSlice } from '@reduxjs/toolkit'

// An opaque cache generation, never a token or a second authentication model.
const sessionSlice = createSlice({
  name: 'sessionBoundary',
  initialState: { scope: 0 },
  reducers: {
    sessionChanged(state) { state.scope += 1 },
  },
})
export const { sessionChanged } = sessionSlice.actions
export const sessionReducer = sessionSlice.reducer
export const selectSessionScope = state => state.sessionBoundary.scope
