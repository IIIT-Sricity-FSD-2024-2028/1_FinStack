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

      /* Check FinStackStore availability */
      if (typeof window.FinStackStore === 'undefined') {
        showError('System is still loading. Please refresh and try again.');
        return;
      }

      /* Wait for FinStackStore to be ready, then authenticate */
      window.FinStackStore.ready
        .then(function () {
          var result = window.FinStackStore.authenticateUser(orgId, employeeId, password, role);

          if (!result.success) {
            showError(result.error);
            return;
          }

          /* Create session in sessionStorage */
          var session = {
            employeeId: result.user.employeeId,
            fullName: result.user.fullName,
            email: result.user.email,
            role: role,
            organizationId: orgId,
            loginAt: new Date().toISOString()
          };
          sessionStorage.setItem('finstackUserSession', JSON.stringify(session));
          localStorage.setItem('currentUser', JSON.stringify(session));

          /* Remember role user for persistence */
          if (typeof window.FinStackStore.rememberRoleUser === 'function') {
            window.FinStackStore.rememberRoleUser(role, result.user.employeeId, orgId);
          }

          /* Redirect to the role workspace */
          var route = roleRoutes[role];
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
          showError('Login failed: ' + (err.message || 'Unknown error. Please refresh and try again.'));
        });
    });
  }
});
