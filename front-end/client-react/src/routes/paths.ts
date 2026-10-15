export const workspacePages = [
  ["dashboard", "Dashboard", "home"],
  ["manage-users", "Manage Users", "users"],
  ["user-hierarchy", "User Hierarchy", "users"],
  ["roles-access", "Roles & Access", "shieldCheck"],
  ["expense-categories", "Expense Categories", "folder"],
  ["expense-policies", "Expense Policies", "file"],
  ["audit-logs", "Audit Logs", "file"],
  ["notifications", "Notifications", "bell"],
  ["organization-settings", "Organization Settings", "settings"],
  ["preferences", "Preferences", "settings"],
  ["profile-settings", "Profile Settings", "users"],
  ["subscription", "Subscription & Billing", "file"],
] as const;
export const legacyPaths: Record<string, string> = {
  "/index.html": "/",
  "/login.html": "/login",
  "/activate-account.html": "/activate-account",
  ...Object.fromEntries(
    [
      "login",
      "register",
      "account-request",
      "forgot-password",
      "reset-password",
      "help",
    ].map((name) => [
      `/views/shared/${name}.html`,
      name === "support" || name === "contact" ? "/help" : `/${name}`,
    ]),
  ),
  ...Object.fromEntries(
    workspacePages.map(([name]) => [
      `/views/config-manager/${name}.html`,
      `/configuration/${name}`,
    ]),
  ),
  ...Object.fromEntries(
    ['dashboard', 'submit', 'expenses', 'status', 'reports', 'notifications', 'profile-settings'].map(name => [
      `/views/submitter/${name}.html`, `/${name}`,
    ]),
  ),
  ...Object.fromEntries(Object.entries({
    dashboard: 'dashboard', 'expense-review': 'expenses', 'approval-history': 'history',
    'team-overview': 'dashboard', notifications: 'notifications', 'profile-settings': 'profile-settings',
  }).map(([old, page]) => [`/views/manager/${old}.html`, `/manager/${page}`])),
  ...Object.fromEntries(Object.entries({
    dashboard: 'dashboard', 'finance-review': 'queue', payments: 'payments',
    transactions: 'transactions', reconciliation: 'transactions', 'flagged-expenses': 'queue',
    reports: 'dashboard', 'profile-settings': 'settings', preferences: 'settings',
  }).map(([old, page]) => [`/views/finance/${old}.html`, `/finance/${page}`])),
  ...Object.fromEntries(Object.entries({
    dashboard: 'dashboard', 'escalated-expenses': 'queue', compliance: 'queue',
    policies: 'policies', audit: 'audit', communications: 'notifications', 'profile-settings': 'settings',
  }).map(([old, page]) => [`/views/compliance/${old}.html`, `/compliance/${page}`])),
};
