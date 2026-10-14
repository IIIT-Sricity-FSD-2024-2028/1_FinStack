import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { submitterApi } from "../api/submitterApi";
import { useSubmitter } from "../SubmitterContext";
import { initials, timeAgo } from "../utils";
import { logoutSubmitter } from "../submitterNavigation";
import { Icon } from "./Icons";
import "../submitter.css";

const navItems = [
  ["dashboard", "dashboard", "Dashboard"],
  ["submit", "plus", "Submit Expense"],
  ["expenses", "receipt", "My Expenses"],
  ["status", "pulse", "Track Status"],
  ["reports", "chart", "AI Validation & Results"],
  ["notifications", "bell", "Notifications"],
  ["profile-settings", "user", "Profile & Settings"],
];

export default function SubmitterLayout() {
  const { user, notifications, notificationState, refreshNotifications } =
    useSubmitter();
  const { logout: endSession } = useAuth();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("finstack-sidebar-collapsed") === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const bellRef = useRef(null);
  const userRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(
    () => new URLSearchParams(location.search).get("search") || "",
  );
  const unread = notifications.filter((notification) => notification.unread);

  useEffect(() => {
    const closeOpenPopovers = (event) => {
      if (!bellRef.current?.contains(event.target)) setBellOpen(false);
      if (!userRef.current?.contains(event.target)) setUserOpen(false);
    };

    document.addEventListener("click", closeOpenPopovers);
    return () => document.removeEventListener("click", closeOpenPopovers);
  }, []);
  useEffect(() => {
    setBellOpen(false);
    setUserOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (location.pathname === "/expenses") {
      setSearchTerm(new URLSearchParams(location.search).get("search") || "");
    }
  }, [location.pathname, location.search]);

  const toggleSidebar = () =>
    setCollapsed((current) => {
      localStorage.setItem("finstack-sidebar-collapsed", String(!current));
      return !current;
    });
  const navigateFromPopover = (path) => {
    setBellOpen(false);
    setUserOpen(false);
    navigate(path);
  };
  const handleLogout = () => {
    logoutSubmitter(navigate, endSession);
  };
  const runNotificationAction = async (action) => {
    setActionError("");
    try {
      await action();
      await refreshNotifications();
    } catch (error) {
      setActionError(error.message || "Notification action failed.");
    }
  };
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(
      query ? `/expenses?search=${encodeURIComponent(query)}` : "/expenses",
    );
  };
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    if (!value && location.pathname === "/expenses" && location.search) {
      navigate("/expenses", { replace: true });
    }
  };

  return (
    <div
      className={`submitter-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
    >
      <button
        className="submitter-backdrop"
        type="button"
        aria-label="Close navigation"
        onClick={() => setMobileOpen(false)}
      />
      <aside className="submitter-sidebar">
        <div className="submitter-brand">
          <div className="submitter-brand-mark">F</div>
          <span>FinStack</span>
          <button
            type="button"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
          >
            <Icon name="back" size={18} />
          </button>
        </div>
        <nav aria-label="Submitter navigation">
          {navItems.map(([path, icon, label]) => (
            <NavLink
              key={path}
              to={`/${path}`}
              title={collapsed ? label : undefined}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {path === "notifications" && unread.length > 0 && (
                <b>{unread.length > 99 ? "99+" : unread.length}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          className="submitter-logout"
          type="button"
          title={collapsed ? "Logout" : undefined}
          aria-label="Logout"
          onClick={handleLogout}
        >
          <Icon name="logout" />
          <span>Logout</span>
        </button>
      </aside>
      <div className="submitter-shell">
        <header className="submitter-topbar">
          <button
            className="submitter-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>
          <div className="submitter-workspace-title">
            <strong>FinStack Workspace</strong>
            <small>Expense Submitter</small>
          </div>
          <form
            className="submitter-topbar-search"
            role="search"
            onSubmit={handleSearchSubmit}
          >
            <Icon name="search" size={17} />
            <input
              aria-label="Search expenses"
              placeholder="Search expenses…"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchTerm("");
                  if (location.pathname === "/expenses") {
                    navigate("/expenses", { replace: true });
                  }
                }}
              >
                ×
              </button>
            )}
          </form>
          <div className="submitter-top-actions">
            <div className="submitter-popover-anchor" ref={bellRef}>
              <button
                className="submitter-icon-button"
                type="button"
                aria-label="Notifications"
                onClick={() => {
                  setBellOpen((value) => !value);
                  setUserOpen(false);
                }}
              >
                <Icon name="bell" />
                {unread.length > 0 && (
                  <span>{unread.length > 9 ? "9+" : unread.length}</span>
                )}
              </button>
              {bellOpen && (
                <div className="submitter-popover submitter-notification-popover">
                  <header>
                    <div>
                      <strong>Notifications</strong>
                      <small>{unread.length} unread</small>
                    </div>
                    <button
                      type="button"
                      disabled={!unread.length}
                      onClick={() =>
                        runNotificationAction(() =>
                          submitterApi.markAllNotificationsRead(),
                        )
                      }
                    >
                      Mark all read
                    </button>
                  </header>
                  {actionError && (
                    <p className="submitter-inline-error">{actionError}</p>
                  )}
                  <div className="submitter-popover-list">
                    {notificationState.loading ? (
                      <p>Loading notifications…</p>
                    ) : notificationState.error ? (
                      <button type="button" onClick={refreshNotifications}>
                        Retry notifications
                      </button>
                    ) : (
                      notifications.slice(0, 5).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={item.unread ? "unread" : ""}
                          onClick={() =>
                            item.unread &&
                            runNotificationAction(() =>
                              submitterApi.markNotificationRead(item.id),
                            )
                          }
                        >
                          <strong>{item.title}</strong>
                          <span>{item.message}</span>
                          <small>{timeAgo(item.createdAt)}</small>
                        </button>
                      ))
                    )}
                    {!notificationState.loading &&
                      !notificationState.error &&
                      !notifications.length && <p>No notifications yet.</p>}
                  </div>
                  <footer>
                    <button
                      type="button"
                      onClick={() => navigateFromPopover("/notifications")}
                    >
                      View all notifications
                    </button>
                  </footer>
                </div>
              )}
            </div>
            <div className="submitter-popover-anchor" ref={userRef}>
              <button
                className="submitter-user-button"
                type="button"
                onClick={() => {
                  setUserOpen((value) => !value);
                  setBellOpen(false);
                }}
              >
                <span>{initials(user?.fullName)}</span>
                <div>
                  <strong>{user?.fullName || "Expense Submitter"}</strong>
                  <small>{user?.employeeId}</small>
                </div>
                <Icon name="chevron" size={16} />
              </button>
              {userOpen && (
                <div className="submitter-popover submitter-user-popover">
                  <button
                    type="button"
                    onClick={() => navigateFromPopover("/profile-settings")}
                  >
                    Profile &amp; Settings
                  </button>
                  <button type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="submitter-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
