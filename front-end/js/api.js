(function () {
  'use strict';

  var BASE_URL = 'http://localhost:3000';
  var ROLE_MAP = {
    configuration_manager: 'superuser',
    manager: 'admin',
    finance_officer: 'admin',
    compliance_officer: 'admin',
    expense_submitter: 'user'
  };

  function getWorkspaceRole() {
    if (window.FinStackStore && typeof window.FinStackStore.getCurrentRole === 'function') {
      return window.FinStackStore.getCurrentRole();
    }
    try {
      var raw = sessionStorage.getItem('finstackUserSession') || localStorage.getItem('currentUser');
      var session = raw ? JSON.parse(raw) : null;
      if (session && session.role) return session.role;
    } catch (error) {}
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf('/views/config-manager/') !== -1 || path.indexOf('/configuration_manager/') !== -1) return 'configuration_manager';
    if (path.indexOf('/views/manager/') !== -1 || path.indexOf('/manager/') !== -1) return 'manager';
    if (path.indexOf('/views/finance/') !== -1 || path.indexOf('/finance_officer/') !== -1) return 'finance_officer';
    if (path.indexOf('/views/compliance/') !== -1 || path.indexOf('/compliance_officer/') !== -1) return 'compliance_officer';
    return 'expense_submitter';
  }

  function getRbacRole() {
    return ROLE_MAP[getWorkspaceRole()] || 'admin';
  }

  function unwrap(payload) {
    if (payload && payload.success === false) {
      throw new Error(payload.message || payload.error || 'Request failed.');
    }
    return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
  }

  function request(path, options) {
    options = options || {};
    var isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    var headers = { role: getRbacRole() };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return fetch(BASE_URL + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body === undefined
        ? undefined
        : (isFormData ? options.body : JSON.stringify(options.body))
    }).then(function (response) {
      return response.text().then(function (text) {
        var payload = text ? JSON.parse(text) : null;
        if (!response.ok) {
          var message = payload && (payload.message || payload.error)
            ? payload.message || payload.error
            : 'Request failed with status ' + response.status + '.';
          throw new Error(Array.isArray(message) ? message.join(', ') : message);
        }
        return unwrap(payload);
      });
    });
  }

  function syncRequest(path, options) {
    options = options || {};
    var xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', BASE_URL + path, false);
    xhr.setRequestHeader('role', getRbacRole());
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(options.body === undefined ? null : JSON.stringify(options.body));
    var payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
    if (xhr.status < 200 || xhr.status >= 300) {
      var message = payload && (payload.message || payload.error)
        ? payload.message || payload.error
        : 'Request failed with status ' + xhr.status + '.';
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    return unwrap(payload);
  }

  function getAll() {
    return Promise.all([
      request('/users'),
      request('/categories'),
      request('/expenses'),
      request('/policies'),
      request('/notifications'),
      request('/audit'),
      request('/transactions'),
      request('/reports'),
      request('/dashboard')
    ]).then(function (items) {
      return {
        users: items[0],
        categories: items[1],
        expenses: items[2],
        policies: items[3],
        notifications: items[4],
        auditLogs: items[5],
        transactions: items[6],
        reports: items[7],
        dashboard: items[8]
      };
    });
  }

  function syncGetAll() {
    return {
      users: syncRequest('/users'),
      categories: syncRequest('/categories'),
      expenses: syncRequest('/expenses'),
      policies: syncRequest('/policies'),
      notifications: syncRequest('/notifications'),
      auditLogs: syncRequest('/audit'),
      transactions: syncRequest('/transactions'),
      reports: syncRequest('/reports'),
      dashboard: syncRequest('/dashboard')
    };
  }

  function createExpense(payload, receipt) {
    var formData = new FormData();
    Object.keys(payload || {}).forEach(function (key) {
      var value = payload[key];
      if (key !== 'receiptFileName' && value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append('receipt', receipt, receipt.name);
    return request('/expenses', { method: 'POST', body: formData });
  }

  function downloadReceipt(expenseId) {
    return fetch(BASE_URL + '/expenses/' + encodeURIComponent(expenseId) + '/receipt', {
      headers: { role: getRbacRole() }
    }).then(function (response) {
      if (response.ok) return response.blob();
      return response.text().then(function (text) {
        var payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch (error) {}
        var message = payload && (payload.message || payload.error)
          ? payload.message || payload.error
          : 'Receipt download failed with status ' + response.status + '.';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      });
    });
  }

  window.FinStackApi = {
    baseUrl: BASE_URL,
    roleMap: ROLE_MAP,
    getWorkspaceRole: getWorkspaceRole,
    getRbacRole: getRbacRole,
    request: request,
    syncRequest: syncRequest,
    getAll: getAll,
    syncGetAll: syncGetAll,
    createExpense: createExpense,
    downloadReceipt: downloadReceipt,
    loadMockData: function () {
      return getAll();
    }
  };
})();
