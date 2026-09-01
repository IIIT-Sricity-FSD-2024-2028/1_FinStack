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

  function unwrapUsersResponse(payload) {
    if (payload && payload.success === false) {
      throw new Error(getErrorMessage(payload, 'Unable to validate login.'));
    }
    return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
  }

  function fetchLatestUsers() {
    return fetch(getApiBaseUrl() + '/users', {
      method: 'GET',
      headers: {
        role: 'superuser',
        'Content-Type': 'application/json'
      }
    }).then(function (response) {
      return response.text().then(function (text) {
        var payload = text ? JSON.parse(text) : null;
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, 'Unable to validate login.'));
        }
        var users = unwrapUsersResponse(payload);
        return Array.isArray(users) ? users : [];
      });
    });
  }

  function findMatchingUser(users, credentials) {
    return users.find(function (user) {
      return String(user.employeeId || '') === credentials.employeeId &&
        String(user.organizationId || '') === credentials.organizationId &&
        String(user.password || '') === credentials.password;
    }) || null;
  }

  function resolveRole(user, selectedRole) {
    var roles = user.roles || [];
    if (!Array.isArray(roles)) roles = [roles];

    if (roles.indexOf(selectedRole) !== -1) return selectedRole;
    return user.role || roles[0] || selectedRole;
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
      if (!orgId) { showError('Organization ID is required.'); return; }
      if (!employeeId) { showError('Employee ID is required.'); return; }
      if (!password) { showError('Password is required.'); return; }
      if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }

      if (role === 'configuration_manager') {
        tenantLogin(employeeId, orgId, password).then(function (result) {
          sessionStorage.setItem('finstackTenantAccessToken', result.accessToken);
          sessionStorage.setItem('finstackTenantUser', JSON.stringify(result.user));
          var tenantSession = { id: result.user.id, employeeId: result.user.employeeId, fullName: result.user.firstName + ' ' + result.user.lastName, email: result.user.email, role: 'configuration_manager', roles: ['configuration_manager'], organizationId: result.organizationId, loginAt: new Date().toISOString() };
          sessionStorage.setItem('finstackUserSession', JSON.stringify(tenantSession));
          localStorage.setItem('currentUser', JSON.stringify(tenantSession));
          showSuccess('Login successful! Redirecting...');
          setTimeout(function () { window.location.href = roleRoutes.configuration_manager; }, 300);
        }).catch(function (error) { showError(error.message || 'Login failed.'); });
        return;
      }

      var credentials = {
        employeeId: employeeId,
        organizationId: orgId,
        password: password
      };

      fetchLatestUsers()
        .then(function (users) {
          var user = findMatchingUser(users, credentials);
          if (!user) {
            showError('Invalid employee ID, organization ID, or password.');
            return;
          }

          var resolvedRole = resolveRole(user, role);

          var session = {
            id: user.id || '',
            employeeId: user.employeeId || employeeId,
            fullName: user.fullName || user.name || '',
            email: user.email || '',
            role: resolvedRole,
            roles: Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : [resolvedRole]),
            organizationId: user.organizationId || orgId,
            loginAt: new Date().toISOString()
          };

          sessionStorage.setItem('finstackUserSession', JSON.stringify(session));
          localStorage.setItem('currentUser', JSON.stringify(session));
          window.FinStackCurrentUser = user;

          if (window.FinStackStore && typeof window.FinStackStore.rememberRoleUser === 'function') {
            window.FinStackStore.rememberRoleUser(resolvedRole, session.employeeId, session.organizationId);
          }

          var route = roleRoutes[resolvedRole];
          if (route) {
            showSuccess('Login successful! Redirecting...');
            setTimeout(function () {
              window.location.href = route;
            }, 300);
          } else {
            showError('No workspace configured for the selected role.');
          }
        })
        .catch(function (err) {
          console.error('[LOGIN] Error:', err);
          showError(err.message || 'Login failed. Please try again.');
        });
    });
  }
});
