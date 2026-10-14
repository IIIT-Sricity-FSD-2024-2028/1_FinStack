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
  "/views/manager/dashboard.html": "/manager/dashboard",
  "/views/manager/expense-review.html": "/manager/expenses",
  "/views/manager/approval-history.html": "/manager/history",
  "/views/manager/notifications.html": "/manager/notifications",
  "/views/manager/team-overview.html": "/manager/dashboard",
};
