import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { Icon } from "../../../components/Icon";
import { TenantAppShell } from "../../../layouts/TenantAppShell";
import { useDispatch, useSelector } from "react-redux";
import { selectDisplayNotifications, selectNotificationState, selectUnreadCount, fetchNotifications } from "../store/notificationsSlice.js";
import { markNotificationRead, markAllNotificationsRead } from "../store/submitterActions.js";
import { timeAgo } from "../utils";
import { logoutSubmitter } from "../submitterNavigation";
import { submitterNavigation as navItems } from "../../../layouts/tenantNavigation";

export default function SubmitterLayout() {
  const dispatch = useDispatch();
  const notifications = useSelector(selectDisplayNotifications);
  const notificationState = useSelector(selectNotificationState);
  const unreadCount = useSelector(selectUnreadCount);
  const refreshNotifications = () => dispatch(fetchNotifications());
  const { user: authenticatedUser, logout: endSession } = useAuth();
  const user = authenticatedUser ? {
    ...authenticatedUser,
    fullName: `${authenticatedUser.firstName || ""} ${authenticatedUser.lastName || ""}`.trim(),
  } : null;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(location.search).get("search") || "");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (location.pathname === "/expenses") setSearchTerm(new URLSearchParams(location.search).get("search") || "");
  }, [location.pathname, location.search]);

  const handleLogout = () => logoutSubmitter(navigate, endSession);
  const navigateFromPanel = (path) => navigate(path);
  const runNotificationAction = async (action) => {
    setActionError("");
    try { await action(); }
    catch (error) { setActionError(error.message || "Notification action failed."); }
  };
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(query ? `/expenses?search=${encodeURIComponent(query)}` : "/expenses");
  };
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    if (!value && location.pathname === "/expenses" && location.search) navigate("/expenses", { replace: true });
  };

  const searchSlot = <form className="submitter-topbar-search tenant-topbar-search" role="search" onSubmit={handleSearchSubmit}>
    <Icon name="search" size={17} />
    <input aria-label="Search expenses" placeholder="Search expenses…" value={searchTerm} onChange={handleSearchChange} />
    {searchTerm && <button type="button" aria-label="Clear search" onClick={() => { setSearchTerm(""); if (location.pathname === "/expenses") navigate("/expenses", { replace: true }); }}>×</button>}
  </form>;

  const notificationPanel = <>
    <header><div><strong>Notifications</strong><small>{unreadCount} unread</small></div><button type="button" disabled={!unreadCount} onClick={() => runNotificationAction(() => dispatch(markAllNotificationsRead()))}>Mark all read</button></header>
    {actionError && <p className="submitter-inline-error">{actionError}</p>}
    <div className="submitter-popover-list">
      {notificationState.loading ? <p>Loading notifications…</p> : notificationState.error ? <button type="button" onClick={refreshNotifications}>Retry notifications</button> : notifications.slice(0, 5).map((item) => <button type="button" key={item.id} className={item.unread ? "unread" : ""} onClick={() => item.unread && runNotificationAction(() => dispatch(markNotificationRead(item.id)))}><strong>{item.title}</strong><span>{item.message}</span><small>{timeAgo(item.createdAt)}</small></button>)}
      {!notificationState.loading && !notificationState.error && !notifications.length && <p>No notifications yet.</p>}
    </div>
    <footer><button type="button" onClick={() => navigateFromPanel("/notifications")}>View all notifications</button></footer>
  </>;

  return <TenantAppShell role="submitter-workspace" roleLabel="Expense Submitter" title="FinStack Workspace" homePath="/dashboard" profilePath="/profile-settings" notificationPath="/notifications" navItems={navItems} user={user} logout={handleLogout} notificationCount={unreadCount} notificationPanel={notificationPanel} searchSlot={searchSlot}>
    <Outlet />
  </TenantAppShell>;
}
