import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspacePreferences } from "../../services/preferences";
import { LogoutAction } from "../../components/LogoutAction";
import { Icon } from "../../components/Icon";
import "./manager.css";

export function ManagerLayout() {
  useWorkspacePreferences();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  const titles = { "/manager/dashboard": "Manager Dashboard", "/manager/expenses": "Review Expenses", "/manager/history": "Approval History", "/manager/notifications": "Notifications", "/manager/profile-settings": "Profile & Settings" };
  const title = titles[location.pathname] || "Manager Workspace";
  return (
    <div className={`manager-workspace${mobileOpen ? " nav-mobile-open" : ""}`}>
      <aside className="manager-sidebar" id="manager-navigation">
        <NavLink className="manager-brand" to="/manager/dashboard"><b>F</b> FinStack</NavLink>
        <nav aria-label="Manager navigation">
          <NavLink to="/manager/dashboard"><Icon name="home" size={19} />Dashboard</NavLink>
          <NavLink to="/manager/expenses"><Icon name="folder" size={19} />Review Expenses</NavLink>
          <NavLink to="/manager/history"><Icon name="audit" size={19} />Approval History</NavLink>
          <NavLink to="/manager/notifications"><Icon name="bell" size={19} />Notifications</NavLink>
          <NavLink to="/manager/profile-settings"><Icon name="settings" size={19} />Profile &amp; Settings</NavLink>
        </nav>
        <div className="manager-sidebar-footer">
          <span>{user?.firstName} {user?.lastName}</span>
          <LogoutAction onLogout={logout} className="manager-logout">Log out</LogoutAction>
        </div>
      </aside>
      <div className="manager-body">
        <header className="manager-topbar"><button className="manager-mobile-menu" type="button" aria-label="Toggle manager navigation" aria-controls="manager-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>☰</button><strong>{title}</strong><div className="manager-topbar-account"><NavLink to="/manager/notifications" aria-label="Notifications"><Icon name="bell" size={18} /></NavLink><span>{user?.firstName} {user?.lastName}</span><NavLink to="/manager/profile-settings" aria-label="Profile and settings"><Icon name="settings" size={18} /></NavLink></div></header>
        <main className="manager-main" id="manager-main" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
