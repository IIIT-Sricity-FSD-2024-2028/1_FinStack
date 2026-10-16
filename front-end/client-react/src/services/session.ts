import { announceLiveRefresh, installCrossTabLiveRefresh } from "../hooks/liveRefreshController.js";

export interface TenantUser {
  id: string;
  organizationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
}
export interface Session {
  accessToken: string;
  user: TenantUser;
  organizationId: string;
}
export interface LoginResult extends Session {
  workspace: { path: string; key: string };
  expiresIn: number;
}
declare global {
  interface Window {
    FINSTACK_API_BASE_URL?: string;
    FinStackApi?: { baseUrl: string };
    FinStackTenantSession?: typeof runtime;
  }
}
export const apiBase = () =>
  (
    window.FINSTACK_API_BASE_URL ||
    window.FinStackApi?.baseUrl ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
const SESSION_EVENT = "finstack:session";
export function currentSession(): Session | null {
  try {
    const accessToken = sessionStorage.getItem("finstackTenantAccessToken");
    const user = JSON.parse(
      sessionStorage.getItem("finstackTenantUser") || "null",
    );
    return accessToken &&
      user?.id &&
      user?.organizationId &&
      user.status === "ACTIVE"
      ? { accessToken, user, organizationId: user.organizationId }
      : null;
  } catch {
    return null;
  }
}
export function saveSession(session: Session) {
  if (
    !session.accessToken ||
    session.user.status !== "ACTIVE" ||
    session.organizationId !== session.user.organizationId
  )
    throw Error("Invalid authentication response.");
  sessionStorage.setItem("finstackTenantAccessToken", session.accessToken);
  sessionStorage.setItem("finstackTenantUser", JSON.stringify(session.user));
  const compatibility = {
    ...session.user,
    fullName: `${session.user.firstName} ${session.user.lastName}`,
    role: session.user.role.toLowerCase(),
    roles: [session.user.role.toLowerCase()],
    loginAt: new Date().toISOString(),
  };
  sessionStorage.setItem("finstackUserSession", JSON.stringify(compatibility));
  localStorage.setItem("currentUser", JSON.stringify(compatibility));
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export function clearSession() {
  [
    "finstackTenantAccessToken",
    "finstackTenantUser",
    "finstackUserSession",
  ].forEach((key) => sessionStorage.removeItem(key));
  localStorage.removeItem("currentUser");
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function request<T = any>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    authenticated?: boolean;
  } = {},
): Promise<T> {
  const multipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = multipart ? {} : { "Content-Type": "application/json" };
  if (options.authenticated !== false) {
    const session = currentSession();
    if (!session) {
      clearSession();
      throw new ApiError("Sign in again to continue.", 401);
    }
    headers.Authorization = `Bearer ${session.accessToken}`;
  }
  const response = await fetch(apiBase() + path, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && options.authenticated !== false)
      clearSession();
    const message = payload?.error?.message || payload?.message;
    throw new ApiError(
      response.status >= 500
        ? "The service is temporarily unavailable. Please retry."
        : typeof message === "string"
          ? message
          : response.status === 403
            ? "You do not have permission to perform this action."
            : "Check the submitted values and try again.",
      response.status,
      payload?.error?.code,
    );
  }
  // Notify other actor tabs only after a successful authenticated tenant write.
  // No expense details, credentials or API response content are broadcast.
  const method = (options.method || "GET").toUpperCase();
  if (options.authenticated !== false && path.startsWith("/api/v1/tenant/") &&
      !["GET", "HEAD", "OPTIONS"].includes(method)) {
    announceLiveRefresh();
  }
  return payload?.data ?? payload;
}

// Manager receipts use the same bearer identity as JSON requests. Never render
// server HTML/error bodies or follow a receipt redirect with private credentials.
export async function requestBlob(path: string, options: { signal?: AbortSignal } = {}): Promise<Blob> {
  if (!path.startsWith("/api/") || /[\\\r\n]/.test(path))
    throw new ApiError("The requested file address is invalid.", 400);
  const session = currentSession();
  if (!session) {
    clearSession();
    throw new ApiError("Sign in again to continue.", 401);
  }
  const response = await fetch(apiBase() + path, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: options.signal,
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new ApiError(
      response.status === 401 ? "Sign in again to continue."
        : response.status === 403 ? "You do not have permission to view this file."
          : response.status === 404 ? "The requested file is unavailable."
            : "The file could not be loaded. Please retry.",
      response.status,
    );
  }
  const mimeType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!["application/pdf", "image/jpeg", "image/png"].includes(mimeType))
    throw new ApiError("The file format cannot be displayed safely.", 415);
  const blob = await response.blob();
  return blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
}
// Existing feature adapters keep their contracts, using this JWT-only transport.
const runtime = {
  getTenantSession: currentSession,
  setTenantSession: saveSession,
  clearTenantSession: clearSession,
  isTenantAuthenticated: () => Boolean(currentSession()),
  request,
  handleUnauthorized: clearSession,
};
export function installSessionRuntime() {
  window.FinStackApi = { baseUrl: apiBase() };
  window.FinStackTenantSession = runtime;
  installCrossTabLiveRefresh(() => currentSession()?.organizationId);
}
export { SESSION_EVENT };
