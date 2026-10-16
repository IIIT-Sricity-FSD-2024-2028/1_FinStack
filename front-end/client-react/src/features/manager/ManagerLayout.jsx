import { useEffect, useState } from "react";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TenantAppShell } from "../../layouts/TenantAppShell";
import { managerNavigation as navItems, titleForRoute } from "../../layouts/tenantNavigation";
import { useWorkspacePreferences } from "../../services/preferences";
import { managerApi } from "./managerApi";
import "./manager.css";

const titles = {
  "/manager/dashboard": "Manager Dashboard",
  "/manager/expenses": "Review Expenses",
  "/manager/history": "Approval History",
  "/manager/notifications": "Notifications",
  "/manager/profile-settings": "Profile & Settings",
};

export function ManagerLayout() {
  useWorkspacePreferences();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notificationCount, setNotificationCount] = useState(0);
  const title = titleForRoute(titles, location.pathname, "Manager Workspace");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = () => managerApi.notifications(controller.signal).then((items) => {
      if (active && Array.isArray(items)) setNotificationCount(items.filter((item) => item.unread).length);
    }).catch(() => {});
    refresh();
    window.addEventListener("finstack:manager-notifications-refresh", refresh);
    return () => { active = false; controller.abort(); window.removeEventListener("finstack:manager-notifications-refresh", refresh); };
  }, [location.pathname]);
  useLiveRefresh(async () => {
    const items = await managerApi.notifications();
    if (Array.isArray(items))
      setNotificationCount(items.filter((item) => item.unread).length);
  }, { refreshImmediately: false });
  const roleNav = navItems.map((item) => item.to === "/manager/notifications" ? { ...item, badge: notificationCount } : item);
  return <TenantAppShell role="manager-workspace" roleLabel="Manager" title={title} homePath="/manager/dashboard" profilePath="/manager/profile-settings" notificationPath="/manager/notifications" navItems={roleNav} user={user} logout={logout} notificationCount={notificationCount} contentClassName="manager-main">
    <Outlet />
  </TenantAppShell>;
}
