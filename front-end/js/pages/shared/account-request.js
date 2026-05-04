/* ===== FINSTACK ACCOUNT REQUEST PAGE LOGIC ===== */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('account-request-form');
  var orgIdInput = document.getElementById('req-org-id');
  var employeeIdInput = document.getElementById('req-employee-id');
  var fullNameInput = document.getElementById('req-full-name');
  var emailInput = document.getElementById('req-email');
  var roleSelect = document.getElementById('req-role');
  var passwordInput = document.getElementById('req-password');
  var confirmPasswordInput = document.getElementById('req-confirm-password');
  var orgStatus = document.getElementById('org-status');
  var errorBox = document.getElementById('request-error');
  var errorText = document.getElementById('request-error-text');
  var formView = document.getElementById('request-form-view');
  var successView = document.getElementById('request-success-view');

  function showError(msg) {
    if (errorBox && errorText) {
      errorText.textContent = msg;
      errorBox.style.display = 'block';
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function hideError() {
    if (errorBox) errorBox.style.display = 'none';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(pw) {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least 1 uppercase letter.';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return 'Password must contain at least 1 special character.';
    return null;
  }

  /* Live org ID validation */
  if (orgIdInput) {
    var debounceTimer;
    orgIdInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var orgId = orgIdInput.value.trim();
        if (!orgId) {
          orgStatus.textContent = '';
          orgStatus.style.color = 'var(--text-secondary)';
          return;
        }
        if (typeof window.FinStackStore === 'undefined') return;
        window.FinStackStore.ready.then(function () {
          var org = window.FinStackStore.getOrganizationById(orgId);
          if (org) {
            orgStatus.textContent = '✓ Organization found: ' + org.name;
            orgStatus.style.color = '#10B981';

            // Update available roles in dropdown
            if (roleSelect && org.enabledRoles) {
              var options = roleSelect.querySelectorAll('option');
              options.forEach(function(opt) {
                if (opt.value && opt.value !== '') {
                  opt.disabled = org.enabledRoles.indexOf(opt.value) === -1;
                  if (opt.value === 'configuration_manager') opt.disabled = true;
                }
              });
            }
          } else {
            orgStatus.textContent = '✗ Organization not found.';
            orgStatus.style.color = '#f87171';
          }
        });
      }, 400);
    });
  }

  /* Form Submit */
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideError();

      var orgId = orgIdInput ? orgIdInput.value.trim() : '';
      var employeeId = employeeIdInput ? employeeIdInput.value.trim() : '';
      var fullName = fullNameInput ? fullNameInput.value.trim() : '';
      var email = emailInput ? emailInput.value.trim() : '';
      var role = roleSelect ? roleSelect.value : '';
      var password = passwordInput ? passwordInput.value : '';
      var confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

      /* Validation */
      if (!orgId) { showError('Organization ID is required.'); orgIdInput && orgIdInput.focus(); return; }
      if (!employeeId) { showError('Employee ID is required.'); employeeIdInput && employeeIdInput.focus(); return; }
      if (employeeId.length < 2) { showError('Employee ID must be at least 2 characters.'); return; }
      if (!fullName) { showError('Full name is required.'); fullNameInput && fullNameInput.focus(); return; }
      if (fullName.length < 2) { showError('Full name must be at least 2 characters.'); return; }
      if (!email) { showError('Email is required.'); emailInput && emailInput.focus(); return; }
      if (!validateEmail(email)) { showError('Please enter a valid email address.'); emailInput && emailInput.focus(); return; }
      if (!role) { showError('Please select a role.'); roleSelect && roleSelect.focus(); return; }
      if (!password) { showError('Password is required.'); passwordInput && passwordInput.focus(); return; }
      var pwError = validatePassword(password);
      if (pwError) { showError(pwError); passwordInput && passwordInput.focus(); return; }
      if (password !== confirmPassword) { showError('Passwords do not match.'); confirmPasswordInput && confirmPasswordInput.focus(); return; }

      /* Submit via FinStackStore */
      if (typeof window.FinStackStore === 'undefined') {
        showError('System is loading. Please wait and try again.');
        return;
      }

      window.FinStackStore.ready.then(function () {
        var result = window.FinStackStore.submitAccountRequest({
          organizationId: orgId,
          employeeId: employeeId,
          fullName: fullName,
          email: email,
          requestedRole: role,
          password: password
        });

        if (!result.success) {
          showError(result.error);
          return;
        }

        /* Show success view */
        if (formView) formView.style.display = 'none';
        if (successView) {
          successView.style.display = 'block';
          var orgIdEl = document.getElementById('success-org-id');
          var empIdEl = document.getElementById('success-emp-id');
          if (orgIdEl) orgIdEl.textContent = orgId;
          if (empIdEl) empIdEl.textContent = employeeId;
        }
      });
    });
  }
});
