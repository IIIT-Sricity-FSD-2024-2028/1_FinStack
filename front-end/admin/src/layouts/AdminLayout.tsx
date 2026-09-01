import { NavLink, Outlet } from 'react-router-dom';
import { PermissionGate } from '../auth/PermissionGate';
import { useAuth } from '../auth/useAuth';

export function AdminLayout() {
  const { auth, logout } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="FinStack Admin">
          <span className="brand-mark">F</span>
          <span>
            <strong>FinStack</strong>
            <small>Control plane</small>
          </span>
        </div>
        <nav aria-label="Admin navigation">
          <NavLink
            className={({ isActive }) =>
              `nav-item${isActive ? ' nav-item-active' : ''}`
            }
            to="/health"
          >
            <span className="nav-indicator" aria-hidden="true" />
            System health
          </NavLink>
          <PermissionGate permission="platform.organization.view">
            <NavLink
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item-active' : ''}`
              }
              to="/organizations"
            >
              <span className="nav-indicator" aria-hidden="true" />
              Organizations
            </NavLink>
          </PermissionGate>
          <PermissionGate permission="platform.staff.view">
            <NavLink
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item-active' : ''}`
              }
              to="/staff"
            >
              <span className="nav-indicator" aria-hidden="true" />
              Staff
            </NavLink>
          </PermissionGate>
          <PermissionGate permission="platform.role.view">
            <NavLink
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item-active' : ''}`
              }
              to="/roles"
            >
              <span className="nav-indicator" aria-hidden="true" />
              Roles
            </NavLink>
          </PermissionGate>
          <PermissionGate permission="platform.settings.view">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? 'nav-item nav-item-active' : 'nav-item'
              }
            >
              Platform Settings
            </NavLink>
          </PermissionGate>

          <p className="foundation-label" style={{ marginTop: '24px' }}>
            Products & Plans
          </p>
          <PermissionGate permission="subscription.plan.view">
            <NavLink
              to="/plans"
              className={({ isActive }) =>
                isActive ? 'nav-item nav-item-active' : 'nav-item'
              }
            >
              Plans
            </NavLink>
          </PermissionGate>
          <PermissionGate permission="subscription.feature.view">
            <NavLink
              to="/features"
              className={({ isActive }) =>
                isActive ? 'nav-item nav-item-active' : 'nav-item'
              }
            >
              Features
            </NavLink>
          </PermissionGate>
        </nav>
        <p className="foundation-label">Admin V1 foundation</p>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <span>
            {auth?.staff.firstName} {auth?.staff.lastName}
          </span>
          <button
            className="button button-secondary button-compact"
            type="button"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
