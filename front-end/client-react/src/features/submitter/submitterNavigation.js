export function logoutSubmitter(navigate, endSession) {
  navigate("/login", { replace: true, state: null });
  endSession();
}
