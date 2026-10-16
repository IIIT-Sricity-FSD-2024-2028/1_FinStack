import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createConfirmedAction } from "../src/components/confirmedAction.js";
import { confirmationReducer } from "../src/components/confirmationState.js";
import { complianceNavigation, configurationNavigation, financeNavigation, managerNavigation, submitterNavigation, titleForRoute, withNavigationBadge } from "../src/layouts/tenantNavigation.js";

const root = new URL("../src/", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("all five tenant layouts use the shared application shell and logout action", async () => {
  const paths = [
    "features/submitter/components/SubmitterLayout.jsx",
    "features/manager/ManagerLayout.jsx",
    "features/finance/FinanceLayout.jsx",
    "features/compliance/ComplianceLayout.jsx",
    "layouts/ConfigurationManagerLayout.tsx",
  ];
  const layouts = await Promise.all(paths.map(source));
  for (const layout of layouts) assert.match(layout, /TenantAppShell/);
  const shell = await source("layouts/TenantAppShell.jsx");
  assert.match(shell, /LogoutAction/);
  assert.match(shell, /submitter-topbar/);
  assert.match(shell, /submitter-sidebar/);
});

test("logout cancellation leaves the session callback untouched and confirmation invokes it once", async () => {
  let logoutCalls = 0;
  const runLogout = createConfirmedAction();
  assert.equal(await runLogout(() => { logoutCalls += 1; }, { confirmed: false }), false);
  assert.equal(logoutCalls, 0);
  assert.equal(await runLogout(() => { logoutCalls += 1; }, { confirmed: true }), true);
  assert.equal(logoutCalls, 1);
});

test("logout interaction opens on request and Cancel or Escape closes without confirming", () => {
  assert.equal(confirmationReducer(false, "open"), true);
  assert.equal(confirmationReducer(true, "cancel"), false);
  assert.equal(confirmationReducer(true, "open"), true);
  assert.equal(confirmationReducer(true, "close"), false);
  assert.equal(confirmationReducer(true, "confirm"), false);
});

test("confirmed actions reject duplicate in-flight work and busy confirmation", async () => {
  const run = createConfirmedAction();
  let calls = 0;
  let release;
  const pending = run(() => new Promise((resolve) => { calls += 1; release = resolve; }), { confirmed: true });
  assert.equal(await run(() => { calls += 1; }, { confirmed: true }), false);
  assert.equal(await run(() => { calls += 1; }, { confirmed: true, busy: true }), false);
  assert.equal(calls, 1);
  release();
  assert.equal(await pending, true);
});

test("shared role navigation preserves each actor route and notification badges", () => {
  const allItems = [...submitterNavigation, ...managerNavigation, ...financeNavigation, ...complianceNavigation];
  for (const route of ["/dashboard", "/submit", "/expenses", "/manager/expenses", "/finance/payments", "/compliance/audit"])
    assert.ok(allItems.some((item) => item.to === route), `missing route ${route}`);
  const config = configurationNavigation([["dashboard", "Dashboard", "home"], ["manage-users", "Manage Users", "users"]], "manage-users");
  assert.equal(config[0].to, "/configuration/dashboard");
  assert.equal(config[1].section, "User Management");
  assert.equal(config.at(-1).to, "/configuration/help?from=manage-users");
  const finance = withNavigationBadge(financeNavigation, "/finance/notifications", 3);
  assert.equal(finance.find((item) => item.to === "/finance/notifications").badge, 3);
  assert.equal(titleForRoute({ "/manager/expenses": "Review Expenses" }, "/manager/expenses/expense-id", "Workspace"), "Review Expenses");
});

test("shared confirmation dialog is modal, labeled, cancellable and blocks repeat action while busy", async () => {
  const dialog = await source("components/ConfirmDialog.jsx");
  assert.match(dialog, /<Modal open=\{open\}/);
  assert.match(dialog, /label=\{title\}/);
  assert.match(dialog, /onCancel/);
  assert.match(dialog, /disabled=\{busy\}/);
  assert.match(dialog, /onConfirm/);
  const modal = await source("components/Modal.jsx");
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /previous\.focus\(\)/);
  assert.match(modal, /aria-modal="true"/);
});

test("shared shell includes responsive drawer, keyboard controls, and common visual tokens", async () => {
  const shell = await source("layouts/TenantAppShell.jsx");
  const styles = await source("layouts/tenant-app-shell.css");
  assert.match(shell, /aria-expanded=\{mobileOpen\}/);
  assert.match(shell, /aria-controls="workspace-navigation"/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(styles, /max-width: 900px/);
  assert.match(styles, /is-mobile-open \.tenant-sidebar/);
  assert.match(styles, /--submitter-primary/);
  assert.match(styles, /data-theme="light"/);
});

test("collapsed mobile shell opens a full drawer and keeps content full width through tablet breakpoint", async () => {
  const styles = await source("layouts/tenant-app-shell.css");
  const submitterStyles = await source("features/submitter/submitter.css");
  assert.match(submitterStyles, /\.submitter-app\.is-collapsed \.submitter-shell/);
  assert.match(styles, /\.tenant-app-shell\.is-collapsed\.is-mobile-open \.tenant-sidebar\s*\{\s*width:\s*min\(290px,\s*86vw\)/);
  assert.match(styles, /\.tenant-app-shell\.is-collapsed \.tenant-shell-content\s*\{\s*width:\s*100%;\s*margin-left:\s*0/);
  assert.match(styles, /\.tenant-app-shell\.is-collapsed \.tenant-main\s*\{\s*width:\s*100%;\s*min-width:\s*0/);
  assert.match(styles, /max-width:\s*900px/);
  assert.match(styles, /max-width:\s*560px/);
});

test("shared shell covers drawer dismissal, long employee IDs, modal stacking, and both themes", async () => {
  const shell = await source("layouts/TenantAppShell.jsx");
  const styles = await source("layouts/tenant-app-shell.css");
  const submitterStyles = await source("features/submitter/submitter.css");
  const modalStyles = await source("components/confirm-dialog.css");
  assert.match(shell, /onClick=\{closeMobile\}/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /document\.body\.style\.overflow = "hidden"/);
  assert.match(styles, /\.tenant-user-button small \{ overflow-wrap: anywhere; \}/);
  assert.match(styles, /data-theme="light"/);
  assert.match(modalStyles, /z-index:\s*1100/);
  assert.match(submitterStyles, /--submitter-bg: #090d17/);
});

test("Manager decisions confirm before API mutation and retain role-specific routes", async () => {
  const details = await source("features/manager/ManagerExpenseDetails.jsx");
  assert.match(details, /<ConfirmDialog/);
  assert.match(details, /managerApi\.(approve|reject|escalate|returnForCorrection)/);
  assert.doesNotMatch(details, /window\.confirm|window\.alert/);
  for (const route of ["dashboard", "expenses", "history", "notifications", "profile-settings"])
    assert.ok(managerNavigation.some((item) => item.to === `/manager/${route}`), `missing manager ${route} navigation`);
});

test("Manager preference controls are disabled while supported profile and security actions remain", async () => {
  const settings = await source("features/manager/ManagerProfileSettings.jsx");
  assert.match(settings, /<fieldset disabled/);
  assert.match(settings, /Save preferences unavailable/);
  assert.match(settings, /profile`\s*,\s*\{ method: "PATCH"/);
  assert.match(settings, /password-changes/);
  assert.match(settings, /session-revocations/);
});
