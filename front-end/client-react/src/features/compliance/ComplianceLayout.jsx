import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TenantAppShell } from "../../layouts/TenantAppShell";
import { complianceNavigation, titleForRoute, withNavigationBadge } from "../../layouts/tenantNavigation";
import { useLiveRefresh } from "../../hooks/useLiveRefresh.js";
import { complianceApi } from "./complianceApi";
import "./compliance.css";

const titles = {
  "/compliance/dashboard": "Compliance Dashboard",
  "/compliance/queue": "Compliance Review Queue",
  "/compliance/policies": "Policy & Violation Monitoring",
  "/compliance/audit": "Compliance Audit Trail",
  "/compliance/notifications": "Compliance Notifications",
  "/compliance/settings": "Profile & Settings",
};

export function ComplianceLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const title = titleForRoute(titles, location.pathname, "Compliance Officer Workspace");

  const refreshWorkspaceBadges = async () => {
    const [unreadResult, queueResult] = await Promise.allSettled([
      complianceApi.getUnreadNotificationCount(),
      complianceApi.getComplianceQueue(),
    ]);
    if (unreadResult.status === "fulfilled") {
      const unread = unreadResult.value;
      setUnreadCount(typeof unread === "number" ? unread : unread?.count || 0);
    }
    if (queueResult.status === "fulfilled" && Array.isArray(queueResult.value)) {
      setQueueCount(queueResult.value.length);
    }
  };
  const { refreshNow } = useLiveRefresh(refreshWorkspaceBadges, { refreshImmediately: false });

  useEffect(() => {
    refreshNow()?.catch(() => {});
  }, [location.pathname, refreshNow]);
  useEffect(() => { document.title = `${title} · FinStack`; }, [title]);

  const navItems = withNavigationBadge(
    withNavigationBadge(complianceNavigation, "/compliance/queue", queueCount),
    "/compliance/notifications",
    unreadCount,
  );

  return <TenantAppShell role="compliance-workspace" roleLabel="Compliance Officer" title={title} homePath="/compliance/dashboard" profilePath="/compliance/settings" notificationPath="/compliance/notifications" navItems={navItems} user={user} logout={logout} notificationCount={unreadCount} contentClassName="compliance-content" footer={<footer className="spa-footer">FinStack · Compliance Officer</footer>}>
    <Outlet />
  </TenantAppShell>;
}
