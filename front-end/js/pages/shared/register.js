/* ===== FINSTACK REGISTER PAGE LOGIC ===== */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('reg-form');
  var formView = document.getElementById('form-view');
  var registrationCard = document.getElementById('registration-card');
  var successCard = document.getElementById('success-card');
  var errorBox = document.getElementById('reg-error');
  var errorText = document.getElementById('reg-error-text');
  var orgIdInput = document.getElementById('org-id-input');
  var orgIdStatus = document.getElementById('org-id-status');

  /* Form field references */
  var orgNameInput = document.getElementById('reg-org-name');
  var orgEmailInput = document.getElementById('reg-org-email');
  var orgSizeSelect = document.getElementById('reg-org-size');
  var adminNameInput = document.getElementById('reg-admin-name');
  var adminEmployeeIdInput = document.getElementById('reg-admin-employee-id');
  var adminEmailInput = document.getElementById('reg-admin-email');
  var passwordInput = document.getElementById('reg-password');
  var confirmPasswordInput = document.getElementById('reg-confirm-password');

  /* Role checkboxes — rows 3, 4, 5 in .space-y-4 (Manager, Finance, Compliance) */
  var roleContainer = document.querySelector('.space-y-4');
  var roleCheckboxes = roleContainer ? roleContainer.querySelectorAll('input[type="checkbox"]:not([disabled])') : [];
  var roleMap = ['manager', 'finance_officer', 'compliance_officer'];

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

  /* Password toggle */
  window.toggleRegPw = function (inputId, iconId) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  /* Live org ID uniqueness check */
  if (orgIdInput) {
    var debounceTimer;
    orgIdInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var orgId = orgIdInput.value.trim();
        if (!orgId || !orgIdStatus) return;
        if (typeof window.FinStackStore === 'undefined') return;
        window.FinStackStore.ready.then(function () {
          var existing = window.FinStackStore.getOrganizationById(orgId);
          if (existing) {
            orgIdStatus.textContent = '✗ This Organization ID is already taken.';
            orgIdStatus.style.color = '#f87171';
          } else {
            orgIdStatus.textContent = '✓ Organization ID is available.';
            orgIdStatus.style.color = '#10B981';
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

      var orgName = orgNameInput ? orgNameInput.value.trim() : '';
      var orgEmail = orgEmailInput ? orgEmailInput.value.trim() : '';
      var orgSize = orgSizeSelect ? orgSizeSelect.value : '';
      var orgId = orgIdInput ? orgIdInput.value.trim() : '';
      var adminName = adminNameInput ? adminNameInput.value.trim() : '';
      var adminEmployeeId = adminEmployeeIdInput ? adminEmployeeIdInput.value.trim() : '';
      var adminEmail = adminEmailInput ? adminEmailInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value : '';
      var confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

      /* Validation */
      if (!orgName) { showError('Organization name is required.'); return; }
      if (orgName.length < 2) { showError('Organization name must be at least 2 characters.'); return; }
      if (!orgEmail) { showError('Organization email is required.'); return; }
      if (!validateEmail(orgEmail)) { showError('Please enter a valid organization email.'); return; }
      if (!orgSize) { showError('Please select a company size.'); return; }
      if (!orgId) { showError('Organization ID is required.'); return; }
      if (orgId.length < 3) { showError('Organization ID must be at least 3 characters.'); return; }
      if (!/^[a-zA-Z0-9\-_]+$/.test(orgId)) { showError('Organization ID can only contain letters, numbers, hyphens, and underscores.'); return; }
      if (!adminName) { showError('Admin name is required.'); return; }
      if (adminName.length < 2) { showError('Admin name must be at least 2 characters.'); return; }
      if (!adminEmployeeId) { showError('Employee ID is required.'); return; }
      if (adminEmployeeId.length < 2) { showError('Employee ID must be at least 2 characters.'); return; }
      if (!/^[a-zA-Z0-9\-_]+$/.test(adminEmployeeId)) { showError('Employee ID can only contain letters, numbers, hyphens, and underscores.'); return; }
      if (!adminEmail) { showError('Admin email is required.'); return; }
      if (!validateEmail(adminEmail)) { showError('Please enter a valid admin email.'); return; }
      if (!password) { showError('Password is required.'); return; }
      var pwError = validatePassword(password);
      if (pwError) { showError(pwError); return; }
      if (password !== confirmPassword) { showError('Passwords do not match.'); return; }

      /* Build enabled roles */
      var enabledRoles = ['expense_submitter', 'configuration_manager']; // required
      roleCheckboxes.forEach(function (cb, idx) {
        if (cb.checked && roleMap[idx]) {
          enabledRoles.push(roleMap[idx]);
        }
      });

      /* Create organization via FinStackStore */
      if (typeof window.FinStackStore === 'undefined') {
        showError('System is loading. Please wait and try again.');
        return;
      }

      window.FinStackStore.ready.then(function () {
        var result = window.FinStackStore.createOrganization({
          organizationId: orgId,
          name: orgName,
          email: orgEmail,
          size: orgSize,
          enabledRoles: enabledRoles,
          adminName: adminName,
          adminEmployeeId: adminEmployeeId,
          adminEmail: adminEmail,
          adminPassword: password
        });

        if (!result.success) {
          showError(result.error);
          return;
        }

        /* Show success card */
        if (formView) formView.style.display = 'none';
        if (registrationCard) registrationCard.style.display = 'none';
        if (successCard) {
          successCard.style.display = 'block';
          var nameEl = document.getElementById('success-org-name');
          var emailEl = document.getElementById('success-org-email');
          var idEl = document.getElementById('success-org-id');
          var empIdEl = document.getElementById('success-admin-emp-id');
          if (nameEl) nameEl.textContent = orgName;
          if (emailEl) emailEl.textContent = orgEmail;
          if (idEl) idEl.textContent = orgId;
          if (empIdEl) empIdEl.textContent = result.superUser ? result.superUser.employeeId : adminEmployeeId;
        }
      });
    });
  }
});