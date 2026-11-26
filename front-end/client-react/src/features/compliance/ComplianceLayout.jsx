import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TenantAppShell } from "../../layouts/TenantAppShell";
import { complianceNavigation, titleForRoute, withNavigationBadge } from "../../layouts/tenantNavigation";
import { useLiveRefresh } from "../../hooks/useLiveRefresh.js";
import { ComplianceProvider } from "./store/ComplianceProvider";
import { refreshResources, refreshWorkspace, selectQueue, selectUnreadCount } from "./store/complianceSlice.js";
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
  return <ComplianceProvider><ComplianceWorkspace /></ComplianceProvider>;
}

function ComplianceWorkspace() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const dispatch = useDispatch();
  const unreadCount = useSelector(selectUnreadCount);
  const queueCount = useSelector(selectQueue).length;
  const generation = useSelector((state) => state.compliance.session.generation);
  const title = titleForRoute(titles, location.pathname, "Compliance Officer Workspace");

  const refreshWorkspaceBadges = () => dispatch(refreshWorkspace(location.pathname === "/compliance/notifications"));
  const { refreshNow } = useLiveRefresh(refreshWorkspaceBadges, { refreshImmediately: false });
  useLiveRefresh(() => {
    const resources = location.pathname === "/compliance/audit" ? ["audit"]
      : ["/compliance/dashboard", "/compliance/policies"].includes(location.pathname) ? ["policies", "categories"]
        : location.pathname === "/compliance/queue" ? ["categories"] : [];
    return dispatch(refreshResources(resources));
  }, { pollIntervalMs: 30_000, refreshImmediately: false });

  useEffect(() => {
    refreshNow()?.catch(() => {});
  }, [location.pathname, refreshNow, generation]);
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
