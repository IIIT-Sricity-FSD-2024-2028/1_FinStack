import { Link, NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { currentSession } from "../services/session";
import { useAuth } from "../auth/AuthContext";
export function PublicLayout() {
  const auth = useAuth();
  const location = useLocation();
  useEffect(() => {
    document.body.classList.toggle(
      "client-login",
      location.pathname === "/login",
    );
    document.body.classList.toggle(
      "organization-registration",
      !["/", "/login"].includes(location.pathname),
    );
    document.title = "FinStack · Expense operations";
    document.getElementById("public-main")?.focus();
    return () =>
      document.body.classList.remove(
        "client-login",
        "organization-registration",
      );
  }, [location.pathname]);
  if (currentSession() && auth.status === "loading")
    return (
      <p role="status" className="standalone-state">
        Verifying your session...
      </p>
    );
  if (currentSession() && auth.status === "error")
    return (
      <div className="standalone-state" role="alert">
        <p>{auth.error}</p>
        <button className="btn btn-primary" onClick={auth.retry}>
          Retry verification
        </button>
      </div>
    );
  if (
    auth.user?.role === "CONFIGURATION_MANAGER" &&
    [
      "/help",
      "/contact",
      "/support",
      "/forgot-password",
      "/reset-password",
      "/account-request",
    ].includes(location.pathname)
  )
    return (
      <Navigate
        replace
        to={
          location.pathname === "/account-request"
            ? "/configuration/manage-users"
            : location.pathname.includes("password")
              ? "/configuration/password-assistance"
              : "/configuration/help"
        }
      />
    );
  if (["/", "/login"].includes(location.pathname)) return <Outlet />;
  if (
    [
      "/register",
      "/registration/receipt",
      "/help",
      "/account-request",
      "/forgot-password",
      "/reset-password",
    ].includes(location.pathname)
  )
    return (
      <main id="public-main" tabIndex={-1}>
        <Outlet />
      </main>
    );
  return (
    <div className="spa-public">
      <a className="skip-link" href="#public-main">
        Skip to content
      </a>
      <header className="public-header">
        <Link to="/" className="spa-brand">
          <b>F</b>FinStack
        </Link>
        <nav aria-label="Public navigation">
          <NavLink to="/help">Help & contact</NavLink>
          {auth.user?.role === "CONFIGURATION_MANAGER" ? (
            <Link to="/configuration/dashboard">Return to workspace</Link>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
          <Link to="/register" className="btn btn-primary">
            Register organization
          </Link>
        </nav>
      </header>
      <main id="public-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="spa-footer">
        <span>FinStack · Expense management</span>
        <Link to="/account-request">Request access</Link>
        <Link to="/help">Contact & support</Link>
      </footer>
    </div>
  );
}
