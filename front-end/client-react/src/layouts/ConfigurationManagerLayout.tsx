import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TenantAppShell } from "./TenantAppShell";
import { configurationNavigation } from "./tenantNavigation";
import { workspacePages } from "../routes/paths";
import { useWorkspacePreferences } from "../services/preferences";

export function ConfigurationManagerLayout() {
  useWorkspacePreferences();
  const { user, logout } = useAuth();
  const location = useLocation();
  const page = workspacePages.find(([key]) => location.pathname === `/configuration/${key}`);
  const title = page?.[1] || "Configuration";
  useEffect(() => { document.title = `${title} · FinStack`; }, [title]);

  const navItems = configurationNavigation(workspacePages, page?.[0]);

  return <TenantAppShell role="configuration-workspace" roleLabel="Configuration Manager" title={title} homePath="/configuration/dashboard" profilePath="/configuration/profile-settings" notificationPath="/configuration/notifications" navItems={navItems} user={user} logout={logout} contentClassName="configuration-content">
    <Outlet />
    <footer className="configuration-help-link"><Link to={`/configuration/help?from=${page?.[0] || "dashboard"}`}>Help &amp; contact</Link></footer>
  </TenantAppShell>;
}
