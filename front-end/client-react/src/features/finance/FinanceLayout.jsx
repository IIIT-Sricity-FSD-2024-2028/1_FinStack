import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TenantAppShell } from "../../layouts/TenantAppShell";
import { financeNavigation, titleForRoute, withNavigationBadge } from "../../layouts/tenantNavigation";
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

  useEffect(() => {
    let active = true;
    financeApi.getUnreadNotificationCount()
      .then((response) => { if (active) setUnreadCount(typeof response === "number" ? response : response?.count || 0); })
      .catch(() => {});
    return () => { active = false; };
  }, [location.pathname]);
  useEffect(() => { document.title = `${title} · FinStack`; }, [title]);

  return <TenantAppShell role="finance-workspace" roleLabel="Finance Officer" title={title} homePath="/finance/dashboard" profilePath="/finance/settings" notificationPath="/finance/notifications" navItems={withNavigationBadge(financeNavigation, "/finance/notifications", unreadCount)} user={user} logout={logout} notificationCount={unreadCount} contentClassName="finance-content" footer={<footer className="spa-footer">FinStack · Finance Officer</footer>}>
    <Outlet />
  </TenantAppShell>;
}
