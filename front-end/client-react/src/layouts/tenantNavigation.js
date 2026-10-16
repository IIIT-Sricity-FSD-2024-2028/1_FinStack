export const submitterNavigation = [
  { to: "/dashboard", icon: "home", label: "Dashboard", end: true },
  { to: "/submit", icon: "plus", label: "Submit Expense", end: true },
  { to: "/expenses", icon: "receipt", label: "My Expenses" },
  { to: "/status", icon: "audit", label: "Track Status" },
  { to: "/reports", icon: "calculator", label: "AI Validation & Results" },
  { to: "/notifications", icon: "bell", label: "Notifications" },
  { to: "/profile-settings", icon: "userCheck", label: "Profile & Settings" },
];

export const managerNavigation = [
  { to: "/manager/dashboard", icon: "home", label: "Dashboard", end: true },
  { to: "/manager/expenses", icon: "folder", label: "Review Expenses" },
  { to: "/manager/history", icon: "audit", label: "Approval History" },
  { to: "/manager/notifications", icon: "bell", label: "Notifications" },
  { to: "/manager/profile-settings", icon: "settings", label: "Profile & Settings" },
];

export const financeNavigation = [
  { to: "/finance/dashboard", icon: "home", label: "Dashboard", section: "Finance Oversight", end: true },
  { to: "/finance/queue", icon: "folder", label: "Review Queue" },
  { to: "/finance/payments", icon: "receipt", label: "Payment Release" },
  { to: "/finance/transactions", icon: "calculator", label: "Transactions & Reconciliation" },
  { to: "/finance/notifications", icon: "bell", label: "Notifications" },
  { to: "/finance/settings", icon: "settings", label: "Profile & Settings", section: "Account" },
];

export const complianceNavigation = [
  { to: "/compliance/dashboard", icon: "home", label: "Dashboard", section: "Compliance Oversight", end: true },
  { to: "/compliance/queue", icon: "folder", label: "Review Queue" },
  { to: "/compliance/policies", icon: "shieldCheck", label: "Policies & Rules" },
  { to: "/compliance/audit", icon: "audit", label: "Audit Trail" },
  { to: "/compliance/notifications", icon: "bell", label: "Notifications" },
  { to: "/compliance/settings", icon: "settings", label: "Profile & Settings", section: "Account" },
];

export function configurationNavigation(pages, currentPage) {
  const sections = ["Overview", "User Management", "User Management", "User Management", "Expense Configuration", "Expense Configuration", "Expense Configuration", "System", "System", "System", "System", "System"];
  const navItems = pages.map((entry, index) => ({
    to: `/configuration/${entry[0]}`,
    label: ({ "expense-categories": "Categories", "expense-policies": "Policies", "organization-settings": "Organization", "profile-settings": "Profile & Settings" })[entry[0]] || entry[1],
    icon: entry[2],
    section: sections[index],
    end: true,
  }));
  navItems.push({ to: `/configuration/help?from=${currentPage || "dashboard"}`, label: "Help & contact", icon: "audit", section: "System", end: true });
  return navItems;
}

export function withNavigationBadge(items, route, count) {
  return items.map((item) => item.to === route ? { ...item, badge: count } : item);
}

export function titleForRoute(titles, pathname, fallback) {
  const matchedRoute = Object.keys(titles)
    .sort((left, right) => right.length - left.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));
  return (matchedRoute && titles[matchedRoute]) || fallback;
}
