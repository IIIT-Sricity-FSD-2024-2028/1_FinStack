/* ===== FINSTACK AUTH GUARD ===== */
/* Shared Client session handling for tenant workspaces. */
(function () {
  'use strict';

  var SESSION_KEY = 'finstackUserSession';
  var TENANT_TOKEN_KEY = 'finstackTenantAccessToken';
  var TENANT_USER_KEY = 'finstackTenantUser';
  var redirectingForTenantSession = false;
  var TENANT_ROLE_TO_WORKSPACE_ROLE = {
    CONFIGURATION_MANAGER: 'configuration_manager',
    EXPENSE_SUBMITTER: 'expense_submitter',
    MANAGER: 'manager',
    FINANCE_OFFICER: 'finance_officer',
    COMPLIANCE_OFFICER: 'compliance_officer',
  };

  function getWorkspaceRole() {
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf('/expense_submitter/') !== -1) return 'expense_submitter';
    if (path.indexOf('/views/submitter/') !== -1) return 'expense_submitter';
    if (path.indexOf('/manager/') !== -1) return 'manager';
    if (path.indexOf('/views/manager/') !== -1) return 'manager';
    if (path.indexOf('/finance_officer/') !== -1) return 'finance_officer';
    if (path.indexOf('/views/finance/') !== -1) return 'finance_officer';
    if (path.indexOf('/compliance_officer/') !== -1) return 'compliance_officer';
    if (path.indexOf('/views/compliance/') !== -1) return 'compliance_officer';
    if (path.indexOf('/configuration_manager/') !== -1) return 'configuration_manager';
    if (path.indexOf('/views/config-manager/') !== -1) return 'configuration_manager';
    return null;
  }

  function getLoginUrl() {
    var path = window.location.pathname;
    if (path.indexOf('/views/') !== -1) return '../../login.html';
    if (
      path.indexOf('/configuration_manager/') !== -1 ||
      path.indexOf('/expense_submitter/') !== -1 ||
      path.indexOf('/manager/') !== -1 ||
      path.indexOf('/finance_officer/') !== -1 ||
      path.indexOf('/compliance_officer/') !== -1
    ) {
      return '../login.html';
    }
    return 'login.html';
  }

  function isPublicAuthPage() {
    return /(?:^|\/)(?:login|register)\.html$/i.test(
      window.location.pathname,
    );
  }

  function redirect(reason) {
    if (isPublicAuthPage()) return;
    var loginUrl = getLoginUrl();
    var separator = loginUrl.indexOf('?') === -1 ? '?' : '&';
    window.location.replace(loginUrl + separator + 'error=' + encodeURIComponent(reason));
  }

  function parseJson(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function workspaceRoleForTenantRole(tenantRole) {
    return TENANT_ROLE_TO_WORKSPACE_ROLE[tenantRole] || null;
  }

  function isActiveTenantUser(user) {
    return Boolean(
      user &&
      user.id &&
      user.organizationId &&
      user.status === 'ACTIVE' &&
      workspaceRoleForTenantRole(user.role),
    );
  }

  function compatibilitySession(user, organizationId, loginAt) {
    var workspaceRole = workspaceRoleForTenantRole(user.role);
    return {
      id: user.id,
      employeeId: user.employeeId,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      email: user.email,
      role: workspaceRole,
      roles: [workspaceRole],
      organizationId: organizationId,
      loginAt: loginAt || new Date().toISOString(),
    };
  }

  function getTenantSession() {
    var token = sessionStorage.getItem(TENANT_TOKEN_KEY);
    var user = parseJson(sessionStorage.getItem(TENANT_USER_KEY));
    var savedSession = parseJson(sessionStorage.getItem(SESSION_KEY));
    if (
      !token ||
      !user ||
      !isActiveTenantUser(user)
    ) {
      return null;
    }
    return {
      accessToken: token,
      user: user,
      organizationId: user.organizationId,
      compatibility: compatibilitySession(
        user,
        user.organizationId,
        savedSession && savedSession.id === user.id && savedSession.role === workspaceRoleForTenantRole(user.role)
          ? savedSession.loginAt
          : null,
      ),
    };
  }

  function setTenantSession(payload) {
    var user = payload && payload.user;
    var organizationId = payload && (payload.organizationId || (user && user.organizationId));
    if (
      !payload ||
      !payload.accessToken ||
      !user ||
      !organizationId ||
      user.organizationId !== organizationId ||
      !isActiveTenantUser(user)
    ) {
      throw new Error('The tenant login response did not contain a valid active tenant session.');
    }
    var safeUser = {
      id: user.id,
      organizationId: user.organizationId,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
    };
    var session = compatibilitySession(safeUser, organizationId);
    sessionStorage.setItem(TENANT_TOKEN_KEY, payload.accessToken);
    sessionStorage.setItem(TENANT_USER_KEY, JSON.stringify(safeUser));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('currentUser', JSON.stringify(session));
    return getTenantSession();
  }

  function clearVisibleProfile() {
    [
      '.topnav-profile-name',
      '.topnav-profile-role',
      '.header-profile-name',
      '.header-profile-role',
      '.topbar-user-name',
      '.topbar-user-role',
    ].forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (element) {
        element.textContent = '';
      });
    });
    window.FinStackCurrentUser = null;
    document.dispatchEvent(new CustomEvent('finstack:tenant-session-cleared'));
  }

  function clearTenantSession() {
    sessionStorage.removeItem(TENANT_TOKEN_KEY);
    sessionStorage.removeItem(TENANT_USER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('currentUser');
    clearVisibleProfile();
  }

  function isTenantAuthenticated() {
    return Boolean(getTenantSession());
  }

  function handleTenantUnauthorized() {
    if (redirectingForTenantSession) return;
    redirectingForTenantSession = true;
    clearTenantSession();
    redirect('Your session has expired. Please sign in again.');
  }

  function tenantRequest(path, options) {
    options = options || {};
    var tenantSession = getTenantSession();
    if (!tenantSession) {
      handleTenantUnauthorized();
      var missing = new Error('TENANT_SESSION_EXPIRED');
      missing.code = 'TENANT_SESSION_EXPIRED';
      return Promise.reject(missing);
    }
    var headers = options.headers || {};
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    headers.Authorization = 'Bearer ' + tenantSession.accessToken;
    var apiBase = (window.FinStackApi && window.FinStackApi.baseUrl) || 'http://localhost:3000';
    return fetch(apiBase + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }).then(function (response) {
      return response.text().then(function (text) {
        var payload = parseJson(text);
        if (response.status === 401) {
          handleTenantUnauthorized();
          var expired = new Error('TENANT_SESSION_EXPIRED');
          expired.code = 'TENANT_SESSION_EXPIRED';
          throw expired;
        }
        if (response.status === 403) {
          var forbiddenMessage = payload && (payload.message || payload.error)
            ? payload.message || payload.error
            : 'You do not have permission to perform this action.';
          var forbidden = new Error(
            Array.isArray(forbiddenMessage)
              ? forbiddenMessage.join(', ')
              : forbiddenMessage,
          );
          forbidden.code = 'TENANT_ACCESS_FORBIDDEN';
          throw forbidden;
        }
        if (!response.ok) {
          var message = payload && (payload.message || payload.error)
            ? payload.message || payload.error
            : 'Request failed with status ' + response.status + '.';
          throw new Error(Array.isArray(message) ? message.join(', ') : message);
        }
        return payload && Object.prototype.hasOwnProperty.call(payload, 'data')
          ? payload.data
          : payload;
      });
    });
  }

  function validateTenantSession() {
    var workspaceRole = getWorkspaceRole();
    var tenantSession = getTenantSession();
    if (!workspaceRole || !tenantSession) {
      return Promise.resolve(null);
    }
    return tenantRequest('/api/v1/tenant/auth/me').then(function (context) {
      if (
        !context ||
        !context.user ||
        context.organizationId !== context.user.organizationId ||
        context.user.id !== tenantSession.user.id ||
        !isActiveTenantUser(context.user)
      ) {
        handleTenantUnauthorized();
        return null;
      }
      if (workspaceRoleForTenantRole(context.user.role) !== workspaceRole) {
        redirect('Access denied. You do not have permission to access this workspace.');
        return null;
      }
      return context;
    }).catch(function (error) {
      if (error && error.code === 'TENANT_SESSION_EXPIRED') return null;
      if (error && error.code === 'TENANT_ACCESS_FORBIDDEN') {
        redirect('Access denied. You do not have permission to access this workspace.');
        return null;
      }
      console.warn('[FinStack] Tenant session validation could not be completed. The session was preserved.', error);
      return null;
    });
  }

  function getCurrentSession() {
    if (getWorkspaceRole()) {
      var tenantSession = getTenantSession();
      return tenantSession ? tenantSession.compatibility : null;
    }
    return parseJson(
      sessionStorage.getItem(SESSION_KEY) || localStorage.getItem('currentUser'),
    );
  }

  function setSession(sessionData) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem('currentUser', JSON.stringify(sessionData));
  }

  function clearSession() {
    clearTenantSession();
  }

  function guard() {
    var workspaceRole = getWorkspaceRole();
    if (!workspaceRole) return;

    var tenantSession = getTenantSession();
    if (!tenantSession) {
      redirect('Please login to continue.');
      return;
    }
    if (tenantSession.compatibility.role !== workspaceRole) {
      redirect('Access denied. You do not have permission to access this workspace.');
      return;
    }
    validateTenantSession();
  }

  window.FinStackTenantSession = {
    getTenantSession: getTenantSession,
    setTenantSession: setTenantSession,
    clearTenantSession: clearTenantSession,
    isTenantAuthenticated: isTenantAuthenticated,
    request: tenantRequest,
    validate: validateTenantSession,
    handleUnauthorized: handleTenantUnauthorized,
    workspaceRoleForTenantRole: workspaceRoleForTenantRole,
    isRedirecting: function () { return redirectingForTenantSession; },
  };

  window.FinStackGuard = {
    getCurrentSession: getCurrentSession,
    setSession: setSession,
    clearSession: clearSession,
    getWorkspaceRole: getWorkspaceRole,
    guard: guard,
  };

  guard();
})();
