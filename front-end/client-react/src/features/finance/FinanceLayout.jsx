import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TenantAppShell } from "../../layouts/TenantAppShell";
import { financeNavigation, titleForRoute, withNavigationBadge } from "../../layouts/tenantNavigation";
import { useLiveRefresh } from "../../hooks/useLiveRefresh.js";
import { financeApi } from "./financeApi";
import "./finance.css";

const titles = {
  "/finance/dashboard": "Finance Dashboard",
  "/finance/queue": "Expense Review Queue",
  "/finance/payments": "Internal Payment Release",
  "/finance/transactions": "Transactions & Reconciliation",
  "/finance/notifications": "Finance Notifications",
  "/finance/settings": "Profile & Settings",
};

export function FinanceLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const title = titleForRoute(titles, location.pathname, "Finance Officer Workspace");

  const refreshUnreadCount = async () => {
    const response = await financeApi.getUnreadNotificationCount();
    setUnreadCount(typeof response === "number" ? response : response?.count || 0);
  };
  const { refreshNow } = useLiveRefresh(refreshUnreadCount, { refreshImmediately: false });

  useEffect(() => {
    refreshNow()?.catch(() => {});
  }, [location.pathname, refreshNow]);
  useEffect(() => { document.title = `${title} · FinStack`; }, [title]);

  return <TenantAppShell role="finance-workspace" roleLabel="Finance Officer" title={title} homePath="/finance/dashboard" profilePath="/finance/settings" notificationPath="/finance/notifications" navItems={withNavigationBadge(financeNavigation, "/finance/notifications", unreadCount)} user={user} logout={logout} notificationCount={unreadCount} contentClassName="finance-content" footer={<footer className="spa-footer">FinStack · Finance Officer</footer>}>
    <Outlet />
  </TenantAppShell>;
}
