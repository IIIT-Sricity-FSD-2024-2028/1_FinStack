import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TenantAppShell } from "../../layouts/TenantAppShell";
import { complianceNavigation, titleForRoute, withNavigationBadge } from "../../layouts/tenantNavigation";
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

  useEffect(() => {
    let active = true;
    complianceApi.getUnreadNotificationCount()
      .then((response) => { if (active) setUnreadCount(typeof response === "number" ? response : response?.count || 0); })
      .catch(() => {});
    complianceApi.getComplianceQueue()
      .then((response) => { if (active && Array.isArray(response)) setQueueCount(response.length); })
      .catch(() => {});
    return () => { active = false; };
  }, [location.pathname]);
  useEffect(() => { document.title = `${title} · FinStack`; }, [title]);

  const roleNav = withNavigationBadge(withNavigationBadge(complianceNavigation, "/compliance/queue", queueCount), "/compliance/notifications", unreadCount);
  return <TenantAppShell role="compliance-workspace" roleLabel="Compliance Officer" title={title} homePath="/compliance/dashboard" profilePath="/compliance/settings" notificationPath="/compliance/notifications" navItems={roleNav} user={user} logout={logout} notificationCount={unreadCount} contentClassName="compliance-content" footer={<footer className="spa-footer">FinStack · Compliance Officer</footer>}>
    <Outlet />
  </TenantAppShell>;
}
