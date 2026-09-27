const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('a tenant 403 preserves the existing session', async () => {
  const sessionStorage = storage();
  const localStorage = storage();
  const window = {
    location: { pathname: '/login.html', replace() {} },
    sessionStorage,
    localStorage,
  };
  const context = {
    window,
    sessionStorage,
    localStorage,
    document: {
      querySelectorAll: () => [],
      dispatchEvent() {},
    },
    CustomEvent: function CustomEvent() {},
    fetch: async () => ({
      status: 403,
      ok: false,
      text: async () => JSON.stringify({ message: 'Forbidden' }),
    }),
    console,
    Promise,
    Error,
    JSON,
    Array,
  };
  vm.runInNewContext(
    fs.readFileSync('front-end/js/auth.js', 'utf8'),
    context,
    { filename: 'auth.js' },
  );

  const login = {
    accessToken: 'valid-token',
    organizationId: 'org-id',
    user: {
      id: 'user-id',
      organizationId: 'org-id',
      employeeId: 'EMP-1',
      firstName: 'Tenant',
      lastName: 'User',
      email: 'tenant@example.test',
      role: 'EXPENSE_SUBMITTER',
      status: 'ACTIVE',
    },
  };
  window.FinStackTenantSession.setTenantSession(login);
  window.location.pathname = '/views/submitter/dashboard.html';

  await assert.rejects(
    window.FinStackTenantSession.request('/api/v1/tenant/expenses/mine'),
    (error) => error.code === 'TENANT_ACCESS_FORBIDDEN',
  );
  assert.equal(sessionStorage.getItem('finstackTenantAccessToken'), 'valid-token');
  assert.equal(
    JSON.parse(sessionStorage.getItem('finstackTenantUser')).id,
    'user-id',
  );
});
