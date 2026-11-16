import { sessionChanged } from "./submitterSession.js";

export function initialResourceState() {
  return { items: [], loading: false, error: "", requestId: null };
}

// Each resource accepts only its latest request. Resetting clears that request ID,
// so responses from an ended session cannot restore any data or errors.
export function addResourceCases(builder, fetchResource, fallbackMessage) {
  builder
    .addCase(sessionChanged, (_state, action) => ({
      ...initialResourceState(),
      loading: Boolean(action.payload),
    }))
    .addCase(fetchResource.pending, (state, action) => {
      state.requestId = action.meta.requestId;
      if (!action.meta.arg?.background) {
        state.loading = true;
        state.error = "";
      }
    })
    .addCase(fetchResource.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.items = action.payload;
      state.loading = false;
      state.error = "";
      state.requestId = null;
    })
    .addCase(fetchResource.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.requestId = null;
      // Background failures keep the existing screen visible, as before.
      if (action.meta.arg?.background && !state.loading) return;
      state.loading = false;
      state.error = action.error.message || fallbackMessage;
    });
}

export function canFetchResource(resource, state, options) {
  return Boolean(state.session.identity) && (!state[resource].requestId || Boolean(options?.force));
}
