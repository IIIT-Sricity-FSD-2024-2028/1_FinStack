import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../src/", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("every tenant actor layout uses the shared confirmed logout action", async () => {
  const paths = [
    "features/submitter/components/SubmitterLayout.jsx",
    "features/manager/ManagerLayout.jsx",
    "features/finance/FinanceLayout.jsx",
    "features/compliance/ComplianceLayout.jsx",
    "layouts/ConfigurationManagerLayout.tsx",
  ];
  const layouts = await Promise.all(paths.map(source));
  for (const layout of layouts) assert.match(layout, /LogoutAction/);
});

test("shared confirmation dialog is modal, labeled, cancellable and blocks repeat action while busy", async () => {
  const dialog = await source("components/ConfirmDialog.jsx");
  assert.match(dialog, /<Modal open=\{open\}/);
  assert.match(dialog, /label=\{title\}/);
  assert.match(dialog, /onCancel/);
  assert.match(dialog, /disabled=\{busy\}/);
  assert.match(dialog, /onConfirm/);
});

test("Manager decisions confirm before API mutation and retain role-specific routes", async () => {
  const details = await source("features/manager/ManagerExpenseDetails.jsx");
  const layout = await source("features/manager/ManagerLayout.jsx");
  assert.match(details, /<ConfirmDialog/);
  assert.match(details, /managerApi\.(approve|reject|escalate|returnForCorrection)/);
  assert.doesNotMatch(details, /window\.confirm|window\.alert/);
  for (const route of ["dashboard", "expenses", "history", "notifications", "profile-settings"])
    assert.ok(layout.includes(`/manager/${route}`), `missing manager ${route} navigation`);
});

test("Manager preference controls are disabled while supported profile and security actions remain", async () => {
  const settings = await source("features/manager/ManagerProfileSettings.jsx");
  assert.match(settings, /<fieldset disabled/);
  assert.match(settings, /Save preferences unavailable/);
  assert.match(settings, /profile`\s*,\s*\{ method: "PATCH"/);
  assert.match(settings, /password-changes/);
  assert.match(settings, /session-revocations/);
});
