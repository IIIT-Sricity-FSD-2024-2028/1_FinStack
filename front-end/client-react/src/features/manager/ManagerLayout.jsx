import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspacePreferences } from "../../services/preferences";
import "./manager.css";

export function ManagerLayout() {
  useWorkspacePreferences();
  const { user, logout } = useAuth();
  return (
    <div className="manager-workspace">
      <aside className="manager-sidebar">
        <NavLink className="manager-brand" to="/manager/dashboard">FinStack</NavLink>
        <nav aria-label="Manager navigation">
          <NavLink to="/manager/dashboard">Dashboard</NavLink>
          <NavLink to="/manager/expenses">Review Expenses</NavLink>
          <NavLink to="/manager/history">Approval History</NavLink>
          <NavLink to="/manager/notifications">Notifications</NavLink>
          <NavLink to="/manager/profile-settings">Profile &amp; Settings</NavLink>
        </nav>
        <div className="manager-sidebar-footer">
          <span>{user?.firstName} {user?.lastName}</span>
          <button type="button" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="manager-main" id="manager-main" tabIndex={-1}><Outlet /></main>
    </div>
  );
}
