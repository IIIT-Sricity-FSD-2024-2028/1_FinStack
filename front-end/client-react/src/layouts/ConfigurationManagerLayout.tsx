import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { workspacePages } from "../routes/paths";
import { Icon } from "../components/Icon";
import { useWorkspacePreferences } from "../services/preferences";
import { LogoutAction } from "../components/LogoutAction";
export function ConfigurationManagerLayout() {
  useWorkspacePreferences();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [users, setUsers] = useState(true),
    [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    setMobile(false);
    setMenu(false);
    document.getElementById("workspace-main")?.focus();
  }, [location.pathname]);
  useEffect(() => {
    if (!menu && !mobile) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false);
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [menu, mobile]);
  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable(),
        first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trap);
      if (sidebar.current?.contains(document.activeElement))
        menuButton.current?.focus();
    };
  }, [mobile]);
  const page = workspacePages.find(
    ([key]) => location.pathname === `/configuration/${key}`,
  );
  useEffect(() => {
    document.title = `${page?.[1] || "Configuration"} · FinStack`;
  }, [page]);
  const nav = (entry: (typeof workspacePages)[number]) => (
    <NavLink
      key={entry[0]}
      to={`/configuration/${entry[0]}`}
      title={collapsed ? entry[1] : undefined}
      aria-label={entry[1]}
    >
      <Icon name={entry[2]} size={19} />
      <span>
        {(
          {
            "expense-categories": "Categories",
            "expense-policies": "Policies",
            "organization-settings": "Organization",
            "profile-settings": "Profile",
          } as Record<string, string>
        )[entry[0]] || entry[1]}
      </span>
    </NavLink>
  );
  return (
    <div
      className={`spa-workspace ${collapsed ? "nav-collapsed" : ""} ${mobile ? "nav-mobile-open" : ""}`}
    >
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside ref={sidebar} className="spa-sidebar" id="workspace-navigation">
        <div className="restored-sidebar-heading">
          <Link to="/configuration/dashboard" className="spa-brand">
            <b>F</b>
            <span>FinStack</span>
          </Link>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={20} />
          </button>
        </div>
        <nav aria-label="Configuration navigation">
          <p className="nav-section">Overview</p>
          {nav(workspacePages[0])}
          <p className="nav-section">User Management</p>
          <button
            className="nav-group"
            aria-expanded={users || collapsed}
            aria-controls="users-navigation"
            onClick={() => {
              if (collapsed) {
                setCollapsed(false);
                setUsers(true);
              } else setUsers((v) => !v);
            }}
          >
            <Icon name="users" size={19} />
            <span>Users</span>
            <span aria-hidden="true">{users ? "−" : "+"}</span>
          </button>
          {(users || collapsed) && (
            <div id="users-navigation" className="nav-children">
              {workspacePages.slice(1, 3).map(nav)}
            </div>
          )}
          {nav(workspacePages[3])}
          <p className="nav-section">Expense Config</p>
          {workspacePages.slice(4, 6).map(nav)}
          <p className="nav-section">System</p>
          {workspacePages.slice(6, 8).map(nav)}
          <button
            className="nav-group"
            aria-expanded={settingsOpen || collapsed}
            aria-controls="settings-navigation"
            onClick={() => {
              if (collapsed) {
                setCollapsed(false);
                setSettingsOpen(true);
              } else setSettingsOpen((v) => !v);
            }}
          >
            <Icon name="settings" size={19} />
            <span>Settings</span>
            <span aria-hidden="true">{settingsOpen ? "-" : "+"}</span>
          </button>
          {(settingsOpen || collapsed) && (
            <div id="settings-navigation" className="nav-children">
              {[workspacePages[8], workspacePages[10], workspacePages[9]].map(
                nav,
              )}
            </div>
          )}
          {nav(workspacePages[11])}
        </nav>
        <div className="sidebar-bottom">
          <Link to={`/configuration/help?from=${page?.[0] || "dashboard"}`}>
            Help & contact
          </Link>
          <LogoutAction className="sidebar-logout-btn" onLogout={logout}>Logout</LogoutAction>
        </div>
      </aside>
      <div className="spa-workspace-body">
        <header className="spa-header">
          <button
            ref={menuButton}
            className="btn btn-secondary mobile-menu"
            aria-expanded={mobile}
            aria-controls="workspace-navigation"
            onClick={() => setMobile((v) => !v)}
          >
            Menu
          </button>
          <span className="header-breadcrumb">FinStack Workspace</span>
          <div className="header-actions">
            <Link to="/configuration/notifications" aria-label="Notifications">
              <Icon name="bell" size={20} />
            </Link>
            <div className="profile-menu">
              <button
                className="btn btn-secondary"
                aria-expanded={menu}
                aria-controls="account-menu"
                onClick={() => setMenu((v) => !v)}
              >
                {user?.firstName} {user?.lastName} ▾
              </button>
              {menu && (
                <div id="account-menu">
                  <p>{user?.employeeId}</p>
                  <Link to="/configuration/profile-settings">Profile</Link>
                  <Link to="/configuration/preferences">Preferences</Link>
                  <Link to="/configuration/subscription">
                    Subscription &amp; Billing
                  </Link>
                  <Link
                    to={`/configuration/help?from=${page?.[0] || "dashboard"}`}
                  >
                    Help
                  </Link>
                  <LogoutAction className="" onLogout={logout}>Sign out</LogoutAction>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1} inert={mobile}>
          <Outlet />
        </main>
        <footer className="spa-footer">
          FinStack · Configuration Manager{" "}
          <Link to={`/configuration/help?from=${page?.[0] || "dashboard"}`}>
            Help & contact
          </Link>
        </footer>
      </div>
    </div>
  );
}
