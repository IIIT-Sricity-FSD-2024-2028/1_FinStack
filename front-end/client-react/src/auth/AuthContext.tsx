import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  ApiError,
  clearSession,
  currentSession,
  request,
  saveSession,
  SESSION_EVENT,
  type LoginResult,
  type TenantUser,
} from "../services/session";

type Auth = {
  user: TenantUser | null;
  status: "loading" | "authenticated" | "anonymous" | "error";
  error: string;
  retry: () => void;
  login: (employeeId: string, password: string) => Promise<LoginResult>;
  logout: () => void;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TenantUser | null>(null);
  const [status, setStatus] = useState<Auth["status"]>("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((v) => v + 1);
    window.addEventListener(SESSION_EVENT, changed);
    return () => window.removeEventListener(SESSION_EVENT, changed);
  }, []);
  useEffect(() => {
    const session = currentSession();
    if (!session) {
      setUser(null);
      setStatus("anonymous");
      return;
    }
    const controller = new AbortController();
    setStatus((current) => (current === "authenticated" ? current : "loading"));
    setError("");
    request<{ user: TenantUser; organizationId: string }>(
      "/api/v1/tenant/auth/me",
      { signal: controller.signal },
    )
      .then((context) => {
        if (controller.signal.aborted) return;
        if (
          context.user.id !== session.user.id ||
          context.organizationId !== session.organizationId ||
          context.user.status !== "ACTIVE"
        ) {
          clearSession();
          return;
        }
        // Identity is revalidated on boot, login, and tab focus; cached roles never grant access.
        sessionStorage.setItem(
          "finstackTenantUser",
          JSON.stringify(context.user),
        );
        setUser(context.user);
        setStatus("authenticated");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setUser(null);
        if (caught instanceof ApiError && caught.status === 401)
          setStatus("anonymous");
        else {
          setError(
            "Your session could not be verified. Retry when the backend is available.",
          );
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const focus = () => {
      if (currentSession()) setRevision((v) => v + 1);
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  useEffect(() => {
    const session = currentSession();
    if (!session || status !== "authenticated") return;
    try {
      const claims = JSON.parse(
        atob(
          session.accessToken
            .split(".")[1]
            .replaceAll("-", "+")
            .replaceAll("_", "/"),
        ),
      );
      if (!Number.isFinite(claims.exp)) return;
      const timer = setTimeout(
        clearSession,
        Math.max(0, Math.min(claims.exp * 1000 - Date.now(), 2147483647)),
      );
      return () => clearTimeout(timer);
    } catch {
      /* Backend verification remains authoritative. */
    }
  }, [status, revision]);
  async function login(employeeId: string, password: string) {
    const result = await request<LoginResult>("/api/v1/tenant/auth/login", {
      method: "POST",
      body: { employeeId, password },
      authenticated: false,
    });
    saveSession(result);
    return result;
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        error,
        login,
        logout: clearSession,
        retry: () => setRevision((v) => v + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw Error("AuthProvider is required.");
  return value;
}
export function ProtectedRoute({
  allowedRoles = ["CONFIGURATION_MANAGER"],
}: {
  allowedRoles?: string[];
} = {}) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === "loading")
    return (
      <p role="status" className="standalone-state">
        Verifying your session…
      </p>
    );
  if (auth.status === "error")
    return (
      <div className="standalone-state" role="alert">
        <p>{auth.error}</p>
        <button className="btn btn-primary" onClick={auth.retry}>
          Retry verification
        </button>
      </div>
    );
  if (!auth.user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!allowedRoles.includes(auth.user.role))
    return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
