import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { isClientSpaPath } = require("../../client-routing.cjs");

test("client hosting serves direct Manager URLs and unknown React routes through the SPA", () => {
  for (const path of [
    "/manager",
    "/manager/dashboard",
    "/manager/expenses",
    "/manager/expenses/expense-123",
    "/manager/history",
    "/manager/notifications",
    "/manager/profile-settings",
    "/manager/unknown-page",
    "/configuration",
    "/unknown-page",
  ]) assert.equal(isClientSpaPath(path), true, path);
});

test("client hosting does not rewrite API or static asset requests", () => {
  for (const path of [
    "/api/v1/tenant/expenses/manager/queue",
    "/api",
    "/client-react.js",
    "/views/manager/dashboard.html",
    "/assets/logo.svg",
  ]) assert.equal(isClientSpaPath(path), false, path);
});

test("all client actors support deep links while Admin, assets and private paths remain separate", () => {
  for (const path of ['/dashboard', '/submit', '/expenses', '/status', '/reports', '/notifications', '/profile-settings', '/finance/queue', '/finance/payments', '/compliance/audit', '/configuration/manage-users'])
    assert.equal(isClientSpaPath(path), true, path);
  for (const path of ['/admin', '/admin/login', '/admin/index.html', '/api/v1/tenant/auth/me', '/.env', '/client-react/src/main.jsx', '/assets/missing', '/%2eenv', '/%zz', '//foreign.test', '/api%2fv1', '/@vite/client', '/@react-refresh', '/@id/virtual-module', '/@fs/C:/assets'])
    assert.equal(isClientSpaPath(path), false, path);
});
