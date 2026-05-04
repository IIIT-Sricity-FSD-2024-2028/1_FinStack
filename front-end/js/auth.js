/* ===== FINSTACK AUTH GUARD ===== */
/* Include at the top of every dashboard page to enforce auth. */
(function () {
  'use strict';

  var SESSION_KEY = 'finstackUserSession';

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
    if (path.indexOf('/views/') !== -1) {
      return '../../login.html';
    }
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

  function redirect(reason) {
    var loginUrl = getLoginUrl();
    var sep = loginUrl.indexOf('?') === -1 ? '?' : '&';
    window.location.replace(loginUrl + sep + 'error=' + encodeURIComponent(reason));
  }

  function getCurrentSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(sessionData) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem('currentUser', JSON.stringify(sessionData));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('currentUser');
  }

  function guard() {
    var workspaceRole = getWorkspaceRole();
    if (!workspaceRole) return; // Not in a role workspace, skip guard

    var session = getCurrentSession();
    if (!session) {
      redirect('Please login to continue.');
      return;
    }

    // Verify role match
    if (session.role !== workspaceRole) {
      redirect('Access denied. You do not have permission to access this workspace.');
      return;
    }

  }

  // Export the guard utilities
  window.FinStackGuard = {
    getCurrentSession: getCurrentSession,
    setSession: setSession,
    clearSession: clearSession,
    getWorkspaceRole: getWorkspaceRole,
    guard: guard
  };

  // Run guard automatically
  guard();
})();
