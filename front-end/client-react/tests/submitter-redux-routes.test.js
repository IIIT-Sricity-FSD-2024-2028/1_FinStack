import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createServer } from "vite";
import { createSubmitterStore, bindSubmitterSession } from "./helpers/submitterStore.js";
import { refreshSubmitter } from "../src/features/submitter/store/submitterActions.js";

test("all Submitter routes render Redux data inside the shared layout without the old Context", async (t) => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else delete globalThis.localStorage;
  });
  // Vite already transforms the app's JSX/TSX. Reuse it for actual component
  // rendering rather than adding a DOM framework or asserting source strings.
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { middlewareMode: true, watch: null },
    esbuild: { jsx: "automatic" },
    appType: "custom",
  });
  t.after(() => server.close());
  const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
  const { default: Layout } = await server.ssrLoadModule("/src/features/submitter/components/SubmitterLayout.jsx");
  const store = createSubmitterStore({
    getMyExpenses: async () => [
      { id: "expense-one", date: "2026-10-01", merchant: "Redux Merchant", category: "Travel", categoryId: "travel", amount: "250", workflowStatus: "manager_review", history: [] },
      { id: "expense-two", date: "2026-10-01", merchant: "Second Merchant", category: "Travel", categoryId: "travel", amount: "100", workflowStatus: "paid", history: [] },
    ],
    getCategories: async () => [{ id: "travel", name: "Travel" }],
    getNotifications: async () => ({ items: [{ id: "notice", title: "Review update", message: "Your travel expense was reviewed.", unread: true }] }),
  });
  bindSubmitterSession(store, JSON.stringify(["tenant-test", "employee-test"]));
  await store.dispatch(refreshSubmitter());

  for (const [path, file, expected] of [
    ["/dashboard", "DashboardPage", "Redux Merchant"],
    ["/submit", "SubmitExpensePage", "Travel"],
    ["/expenses", "ExpensesPage", "Redux Merchant"],
    ["/status", "StatusPage", "Redux Merchant"],
    ["/reports", "ReportsPage", "Validation"],
    ["/notifications", "NotificationsPage", "Your travel expense was reviewed."],
    ["/profile-settings", "ProfileSettingsPage", "Account information"],
  ]) {
    await t.test(`${path} mounts with Redux Provider and shared Submitter layout`, async () => {
      const { default: Page } = await server.ssrLoadModule(`/src/features/submitter/pages/${file}.jsx`);
      const markup = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
        createElement(AuthProvider, null,
          createElement(Provider, { store },
            createElement(Routes, null,
              createElement(Route, { element: createElement(Layout) },
                createElement(Route, { path, element: createElement(Page) }),
              ),
            ),
          ),
        ),
      ));
      assert.ok(markup.includes(expected), `${path} should display its Redux-backed content`);
      assert.match(markup, /aria-label="Notifications"[^]*?<span>1<\/span>/, "layout uses the Redux unread count");
      if (path === "/dashboard") {
        const trend = markup.match(/<svg[^>]*aria-label="Expense submission trend"[^]*?<\/svg>/)?.[0] || "";
        assert.equal((trend.match(/<circle /g) || []).length, 2, "same-date expenses remain separate chart points");
        assert.ok(markup.includes("350.00"), "total uses both Redux expenses");
      }
    });
  }
});

test("the single Submitter workspace Provider change preserves all other actor routes", () => {
  const app = readFileSync(new URL("../src/app/ClientApp.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("<SubmitterReduxProvider><SubmitterLayout /></SubmitterReduxProvider>"));
  assert.equal(app.includes("SubmitterContext"), false);
  for (const [role, layout] of [["MANAGER", "ManagerLayout"], ["FINANCE_OFFICER", "FinanceLayout"], ["COMPLIANCE_OFFICER", "ComplianceLayout"]]) {
    assert.ok(app.includes(`allowedRoles={["${role}"]}`));
    assert.ok(app.includes(`element={<${layout} />}`));
  }
  assert.ok(app.includes("element={<ConfigurationManagerLayout />}"));
});
