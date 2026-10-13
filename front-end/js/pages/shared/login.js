/* Tenant login: identity, organization and workspace come from the backend. */
(function () {
  'use strict';

  function employeeIdError(raw) {
    var value = raw.trim();
    if (!value) return 'Employee ID is required.';
    if (!/^[A-Za-z0-9._-]+$/.test(value)) return 'Employee ID contains unsupported characters. Use letters, numbers, periods, underscores or hyphens.';
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) return 'Employee ID format is invalid. Start with a letter or number and use at most 80 characters.';
    return '';
  }

  function passwordError(value) {
    if (!value) return 'Password is required.';
    if (value.length > 200) return 'Password must be at most 200 characters.';
    return '';
  }

  window.FinStackLoginValidation = { employeeIdError: employeeIdError, passwordError: passwordError };

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('login-form');
    if (!form) return;
    var employee = document.getElementById('employee-id');
    var password = document.getElementById('password-input');
    var button = document.getElementById('login-submit');
    var toggle = document.getElementById('password-toggle');
    var errorBox = document.getElementById('login-error');
    var errorText = document.getElementById('login-error-text');
    var successBox = document.getElementById('login-success');
    var touched = { employee: false, password: false };
    var submitting = false;
    var accepted = false;
    var rootPrefix = window.location.pathname.indexOf('/views/shared/') !== -1 ? '../../' : '';
    var genericCredentials = 'Employee ID or password is incorrect.';
    var unavailable = 'The sign-in server is temporarily unavailable. Please try again.';

    function fieldState(input, outputId, message, show) {
      var output = document.getElementById(outputId);
      output.textContent = show ? message : '';
      output.hidden = !show || !message;
      input.setAttribute('aria-invalid', String(Boolean(show && message)));
    }

    function validate() {
      var employeeMessage = employeeIdError(employee.value);
      var passwordMessage = passwordError(password.value);
      fieldState(employee, 'employee-id-error', employeeMessage, touched.employee);
      fieldState(password, 'password-error', passwordMessage, touched.password);
      button.disabled = submitting || Boolean(employeeMessage || passwordMessage);
      return !employeeMessage && !passwordMessage;
    }

    function showError(message) {
      errorText.textContent = message;
      errorBox.hidden = false;
      successBox.hidden = true;
      errorBox.focus();
    }

    [[employee, 'employee'], [password, 'password']].forEach(function (pair) {
      pair[0].addEventListener('input', function () { touched[pair[1]] = true; errorBox.hidden = true; validate(); });
      pair[0].addEventListener('blur', function () { touched[pair[1]] = true; validate(); });
      pair[0].addEventListener('change', validate);
    });
    window.addEventListener('pageshow', validate);
    toggle.addEventListener('click', function () {
      var show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-pressed', String(show));
    });

    async function authenticate() {
      var base = (window.FinStackApi && window.FinStackApi.baseUrl) || 'http://localhost:3000';
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await fetch(base + '/api/v1/tenant/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: employee.value.trim(), password: password.value }),
          signal: controller.signal,
        });
        if (response.status === 401) throw new Error(genericCredentials);
        if (response.status === 429) throw new Error('Too many sign-in attempts. Please wait a minute and try again.');
        if (!response.ok) throw new Error(unavailable);
        var envelope = await response.json();
        return Object.prototype.hasOwnProperty.call(envelope, 'data') ? envelope.data : envelope;
      } finally { clearTimeout(timeout); }
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (submitting) return;
      touched.employee = touched.password = true;
      if (!validate()) { (employeeIdError(employee.value) ? employee : password).focus(); return; }
      submitting = true; accepted = false;
      errorBox.hidden = successBox.hidden = true;
      form.setAttribute('aria-busy', 'true');
      button.textContent = 'Signing in…'; validate();
      var sessionCreated = false;
      var runtime = window.FinStackTenantSession;
      try {
        if (!runtime) throw new Error(unavailable);
        var result = await authenticate();
        runtime.setTenantSession(result);
        sessionCreated = true;
        var context = await runtime.request('/api/v1/tenant/auth/me');
        var workspace = context && context.workspace;
        if (!context || !context.user || context.user.id !== result.user.id || context.organizationId !== result.organizationId ||
          !Array.isArray(context.effectiveRoles) || context.effectiveRoles.indexOf(context.user.role) === -1 || !workspace ||
          workspace.key !== runtime.workspaceRoleForTenantRole(context.user.role) ||
          !/^views\/(config-manager|submitter|manager|finance|compliance)\/dashboard\.html$/.test(workspace.path)) {
          throw new Error('Your account has no available workspace. Contact your administrator.');
        }
        password.value = '';
        document.getElementById('login-success-text').textContent = 'Signed in. Opening your workspace…';
        successBox.hidden = false;
        accepted = true;
        window.location.assign(rootPrefix + workspace.path);
      } catch (error) {
        if (sessionCreated && runtime) runtime.clearTenantSession();
        var safeMessages = [genericCredentials, 'Too many sign-in attempts. Please wait a minute and try again.', 'Your account has no available workspace. Contact your administrator.'];
        showError(safeMessages.indexOf(error.message) !== -1 ? error.message : unavailable);
      } finally {
        if (!accepted) { submitting = false; form.setAttribute('aria-busy', 'false'); button.textContent = 'Sign in'; validate(); }
      }
    });

    var redirectReason = new URLSearchParams(window.location.search).get('error');
    if (redirectReason) showError(redirectReason);
    validate();
  });
})();
