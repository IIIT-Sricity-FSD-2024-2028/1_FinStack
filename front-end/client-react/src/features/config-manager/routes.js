import { ConfigManagerDashboard } from './ConfigManagerDashboard'
import { ConfigManagerAuditLogs } from './ConfigManagerAuditLogs'
import { ConfigManagerExpenseCategories } from './ConfigManagerExpenseCategories'
import { ConfigManagerExpensePolicies } from './ConfigManagerExpensePolicies'
import { ConfigManagerRolesAccess } from './ConfigManagerRolesAccess'
import { ConfigManagerManageUsers } from './ConfigManagerManageUsers'
import { ConfigManagerUserHierarchy } from './ConfigManagerUserHierarchy'

// Feature-owned routes keep actor pages out of the shared bootstrap and app shell.
export const configManagerRoutes = [
  {
    id: 'config-manager-dashboard',
    workspace: 'configuration_manager',
    breadcrumb: 'Dashboard',
    path: '/views/config-manager/dashboard.html',
    mountId: 'config-manager-dashboard-root',
    component: ConfigManagerDashboard,
  },
  {
    id: 'config-manager-audit-logs',
    workspace: 'configuration_manager',
    breadcrumb: 'Audit Logs',
    initializeLegacyShell: true,
    path: '/views/config-manager/audit-logs.html',
    mountId: 'config-manager-audit-logs-root',
    component: ConfigManagerAuditLogs,
  },
  {
    id: 'config-manager-expense-categories', workspace: 'configuration_manager', breadcrumb: 'Expense Categories', initializeLegacyShell: true,
    path: '/views/config-manager/expense-categories.html', mountId: 'config-manager-expense-categories-root', component: ConfigManagerExpenseCategories,
  },
  {
    id: 'config-manager-expense-policies', workspace: 'configuration_manager', breadcrumb: 'Expense Policies', initializeLegacyShell: true,
    path: '/views/config-manager/expense-policies.html', mountId: 'config-manager-expense-policies-root', component: ConfigManagerExpensePolicies,
  },
  {
    id: 'config-manager-roles-access', workspace: 'configuration_manager', breadcrumb: 'Roles & Access', initializeLegacyShell: true,
    path: '/views/config-manager/roles-access.html', mountId: 'config-manager-roles-access-root', component: ConfigManagerRolesAccess,
  },
  {
    id: 'config-manager-manage-users', workspace: 'configuration_manager', breadcrumb: 'Manage Users', initializeLegacyShell: true,
    path: '/views/config-manager/manage-users.html', mountId: 'config-manager-manage-users-root', component: ConfigManagerManageUsers,
  },
  {
    id: 'config-manager-user-hierarchy', workspace: 'configuration_manager', breadcrumb: 'User Hierarchy', initializeLegacyShell: true,
    path: '/views/config-manager/user-hierarchy.html', mountId: 'config-manager-user-hierarchy-root', component: ConfigManagerUserHierarchy,
  },
]
