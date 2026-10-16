import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
const src = (path) => readFile(new URL('../src/' + path, import.meta.url), 'utf8');
test('login keeps its form and registration link but omits retired links and helper copy', async () => {
  const file = await src('features/shared/PublicPages.tsx');
  const login = file.slice(file.indexOf('export function LoginPage()'), file.indexOf('export function HomePage()'));
  assert.match(login, /id="login-form"/);
  assert.match(login, /id="employee-id"/);
  assert.match(login, /to="\/register"/);
  assert.doesNotMatch(login, /Sign in with your employee ID\.|to="\/(forgot-password|account-request)"/);
});
test('home hides retired contact section and links without hiding pricing', async () => {
  const file = await src('features/shared/BaselineHome.jsx');
  assert.match(file, /node\.attrs\.id === "contact"/);
  assert.match(file, /node\.attrs\.href === "#contact"/);
  assert.match(file, /node\.attrs\.id === "pricing"/);
});
test('configuration workspace does not offer retired help routes', async () => {
  const app = await src('app/ClientApp.jsx');
  const layout = await src('layouts/ConfigurationManagerLayout.tsx');
  const nav = await src('layouts/tenantNavigation.js');
  const settings = await src('features/config-manager/SettingsPages.tsx');
  assert.doesNotMatch(app, /WorkspaceHelpPage/);
  assert.doesNotMatch(layout, /configuration-help-link/);
  assert.doesNotMatch(nav, /\/configuration\/help/);
  assert.doesNotMatch(settings, /export function WorkspaceHelpPage/);
  assert.doesNotMatch(settings, /to="\/configuration\/(help|password-assistance)/);
});
