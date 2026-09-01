import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';

function NavigationItem({
  to,
  children,
}: {
  to: string;
  children: string;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        `nav-item${isActive ? ' nav-item-active' : ''}`
      }
      to={to}
    >
      <span className="nav-indicator" aria-hidden="true" />
      {children}
    </NavLink>
  );
}

function NavigationGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="nav-group">
      <p className="nav-group-label">{label}</p>
      {children}
    </div>
  );
}

export function AdminLayout() {
  const { auth, hasPermission, logout } = useAuth();

  const canViewOrganizations = hasPermission('platform.organization.view');
  const canViewStaff = hasPermission('platform.staff.view');
  const canViewRoles = hasPermission('platform.role.view');
  const canViewPlans = hasPermission('subscription.plan.view');
  const canViewFeatures = hasPermission('subscription.feature.view');
  const canViewSubscriptions = hasPermission(
    'subscription.subscription.view',
  );
  const canViewBilling =
    hasPermission('billing.revenue.view') ||
    hasPermission('billing.invoice.view') ||
    hasPermission('billing.payment.view');
  const canViewSupport = hasPermission('support.ticket.view');

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
          <NavigationGroup label="Overview">
            <NavigationItem to="/">Dashboard</NavigationItem>
            <NavigationItem to="/health">System health</NavigationItem>
          </NavigationGroup>

          {canViewOrganizations && (
            <NavigationGroup label="Organizations">
              <NavigationItem to="/organizations">
                Organizations
              </NavigationItem>
            </NavigationGroup>
          )}

          {(canViewStaff || canViewRoles) && (
            <NavigationGroup label="People & access">
              {canViewStaff && (
                <NavigationItem to="/staff">Staff</NavigationItem>
              )}
              {canViewRoles && (
                <NavigationItem to="/roles">Roles</NavigationItem>
              )}
            </NavigationGroup>
          )}

          {(canViewPlans || canViewFeatures) && (
            <NavigationGroup label="Product & pricing">
              {canViewPlans && (
                <NavigationItem to="/plans">Plans</NavigationItem>
              )}
              {canViewFeatures && (
                <NavigationItem to="/features">Features</NavigationItem>
              )}
            </NavigationGroup>
          )}

          {(canViewSubscriptions || canViewBilling) && (
            <NavigationGroup label="Commercial">
              {canViewSubscriptions && (
                <NavigationItem to="/subscriptions">
                  Subscriptions
                </NavigationItem>
              )}
              {canViewBilling && (
                <NavigationItem to="/billing">
                  Billing & revenue
                </NavigationItem>
              )}
            </NavigationGroup>
          )}

          {canViewSupport && (
            <NavigationGroup label="Support">
              <NavigationItem to="/support/tickets">
                Support tickets
              </NavigationItem>
            </NavigationGroup>
          )}
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