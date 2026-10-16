export function confirmationReducer(state, action) {
  if (action === "open") return true;
  if (action === "close" || action === "cancel" || action === "confirm") return false;
  return state;
}
