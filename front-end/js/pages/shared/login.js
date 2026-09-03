/* ===== FINSTACK LOGIN PAGE LOGIC ===== */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('login-form');
  var roleSelect = document.getElementById('user-role');
  var orgIdInput = document.getElementById('org-id');
  var employeeIdInput = document.getElementById('employee-id');
  var passwordInput = document.getElementById('password-input');
  var helperText = document.getElementById('role-helper-text');
  var errorBox = document.getElementById('login-error');
  var errorText = document.getElementById('login-error-text');
  var successBox = document.getElementById('login-success');
  var successText = document.getElementById('login-success-text');

  var roleDescriptions = {
    configuration_manager: 'Configuration Manager is the Super User workspace with full platform access.',
    expense_submitter: 'Expense Submitter workspace – submit and track your expense claims.',
    manager: 'Manager workspace – approve, reject, or return team expenses.',
    finance_officer: 'Finance Officer workspace – review, reconcile, and approve payments.',
    compliance_officer: 'Compliance Officer workspace – investigate flagged expenses and policy violations.'
  };

  var rootPrefix = window.location.pathname.toLowerCase().indexOf('/views/shared/') !== -1 ? '../../' : '';
  var roleRoutes = {
    configuration_manager: rootPrefix + 'views/config-manager/dashboard.html',
    expense_submitter: rootPrefix + 'views/submitter/dashboard.html',
    manager: rootPrefix + 'views/manager/dashboard.html',
    finance_officer: rootPrefix + 'views/finance/dashboard.html',
    compliance_officer: rootPrefix + 'views/compliance/dashboard.html'
  };

  /* Show error from query params (sent by auth-guard redirects) */
  var params = new URLSearchParams(window.location.search);
  var errorParam = params.get('error');
  if (errorParam) {
    showError(decodeURIComponent(errorParam));
  }

  /* Pre-select role from query param */
  var roleParam = params.get('role');
  if (roleParam && roleSelect) {
    roleSelect.value = roleParam;
    updateHelper();
  }

  /* Role helper text update */
  if (roleSelect) {
    roleSelect.addEventListener('change', updateHelper);
  }

  function updateHelper() {
    if (helperText && roleSelect) {
      helperText.textContent = roleDescriptions[roleSelect.value] || '';
    }
  }

  function showError(msg) {
    if (errorBox && errorText) {
      errorText.textContent = msg;
      errorBox.style.display = 'block';
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (successBox) successBox.style.display = 'none';
  }

  function showSuccess(msg) {
    if (successBox && successText) {
      successText.textContent = msg;
      successBox.style.display = 'block';
    }
    if (errorBox) errorBox.style.display = 'none';
  }

  function hideMessages() {
    if (errorBox) errorBox.style.display = 'none';
    if (successBox) successBox.style.display = 'none';
  }

  function tenantLogin(identifier, organizationId, password) {
    var body = { organizationId: organizationId, password: password };
    if (identifier.indexOf('@') !== -1) body.email = identifier;
    else body.employeeId = identifier;
    return fetch(getApiBaseUrl() + '/api/v1/tenant/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (response) {
      return response.text().then(function (text) { var payload = text ? JSON.parse(text) : null; if (!response.ok) throw new Error(getErrorMessage(payload, 'Invalid tenant credentials.')); return payload && payload.data ? payload.data : payload; });
    });
  }

  function getApiBaseUrl() {
    return window.FinStackApi && window.FinStackApi.baseUrl
      ? window.FinStackApi.baseUrl
      : 'http://localhost:3000';
  }

  function getErrorMessage(payload, fallback) {
    if (!payload) return fallback;
    var message = payload.message || payload.error;
    if (Array.isArray(message)) return message.join(', ');
    return message || fallback;
  }

  function workspaceRoleName(role) {
    var labels = {
      configuration_manager: 'Configuration Manager',
      expense_submitter: 'Expense Submitter',
      manager: 'Manager',
      finance_officer: 'Finance Officer',
      compliance_officer: 'Compliance Officer'
    };
    return labels[role] || 'another workspace role';
  }

  /* Toggle password visibility */
  window.togglePassword = function () {
    if (!passwordInput) return;
    var eyeIcon = document.getElementById('eye-icon');
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      passwordInput.type = 'password';
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  /* Role shortcut buttons */
  document.querySelectorAll('.role-shortcut').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var role = btn.dataset.role;
      if (roleSelect) roleSelect.value = role;
      updateHelper();
      if (orgIdInput) orgIdInput.focus();
    });
  });

  /* Form Submit */
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideMessages();

      var role = roleSelect ? roleSelect.value : '';
      var orgId = orgIdInput ? orgIdInput.value.trim() : '';
      var employeeId = employeeIdInput ? employeeIdInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value : '';

      /* Client-side validation */
      if (!role) { showError('Please select a role.'); return; }
      if (!orgId) { showError('Organization slug is required.'); return; }
      if (!employeeId) { showError('Email or employee ID is required.'); return; }
      if (!password) { showError('Password is required.'); return; }
      if (password.length < 8) { showError('Password must be at least 8 characters.'); return; }

      tenantLogin(employeeId, orgId, password)
        .then(function (result) {
          if (!window.FinStackTenantSession) {
            throw new Error('Tenant session handling is unavailable. Please perform a Hard Refresh (Ctrl+F5 or Cmd+Shift+R) and try again.');
          }
          var canonicalRole = window.FinStackTenantSession.workspaceRoleForTenantRole(
            result && result.user && result.user.role,
          );
          if (!canonicalRole) {
            throw new Error('This account does not have access to a FinStack workspace.');
          }
          if (canonicalRole !== role) {
            showError('This account is assigned to ' + workspaceRoleName(canonicalRole) + '.');
            return;
          }
          window.FinStackTenantSession.setTenantSession(result);
          var route = roleRoutes[canonicalRole];
          if (!route) {
            throw new Error('No workspace is configured for this account.');
          }
          showSuccess('Login successful! Redirecting...');
          setTimeout(function () { window.location.href = route; }, 300);
        })
        .catch(function (error) {
          showError(error.message || 'Login failed.');
        });
    });
  }
});
