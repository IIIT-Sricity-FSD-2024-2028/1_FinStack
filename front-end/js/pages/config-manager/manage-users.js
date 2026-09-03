(function () {
  var users = [];
  var roles = [];

  function request(path, options) {
    return window.FinStackTenantSession.request(path, options);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function roleName(key) {
    return String(key || '').split('_').map(function (part) { return part.charAt(0) + part.slice(1).toLowerCase(); }).join(' ');
  }

  function renderManagerOptions() {
    var select = document.getElementById('add-user-manager');
    if (!select) return;
    select.innerHTML = '<option value="">No manager</option>' + users.map(function (user) {
      return '<option value="' + esc(user.id) + '">' + esc(user.fullName) + ' (' + esc(user.employeeId) + ')</option>';
    }).join('');
  }

  function renderRoleOptions() {
    var select = document.getElementById('add-user-role');
    if (!select) return;
    select.innerHTML = roles.map(function (role) {
      return '<option value="' + esc(role.key) + '">' + esc(role.name) + '</option>';
    }).join('');
  }

  function filteredUsers() {
    var query = (document.getElementById('user-search').value || '').toLowerCase();
    var role = document.getElementById('role-filter').value;
    var status = document.getElementById('status-filter').value;
    return users.filter(function (user) {
      return (!query || [user.fullName, user.email, user.employeeId, user.department].join(' ').toLowerCase().indexOf(query) !== -1) &&
        (role === 'all' || user.role === role) &&
        (status === 'all' || user.status === status);
    });
  }

  function render() {
    var list = filteredUsers();
    var tbody = document.getElementById('users-tbody');
    tbody.innerHTML = list.length ? list.map(function (user) {
      var initials = user.fullName.split(' ').map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
      var nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      return '<tr><td><div style="display:flex;align-items:center;gap:12px;"><div class="avatar avatar-lg">' + esc(initials) + '</div><div><div style="font-weight:500;color:var(--text-primary);">' + esc(user.fullName) + '</div><div style="font-size:.75rem;color:var(--text-secondary);">' + esc(user.employeeId) + '</div></div></div></td>' +
        '<td style="color:var(--text-secondary);">' + esc(user.email) + '</td>' +
        '<td><span class="badge badge-purple">' + esc(roleName(user.role)) + '</span></td>' +
        '<td><span class="badge ' + (user.status === 'ACTIVE' ? 'badge-green' : 'badge-gray') + '">' + esc(user.status) + '</span></td>' +
        '<td style="color:var(--text-primary);">' + esc(user.manager ? user.manager.fullName : 'Unassigned') + '</td>' +
        '<td><button class="btn-icon" title="' + (nextStatus === 'INACTIVE' ? 'Deactivate' : 'Reactivate') + ' user" data-status-user="' + esc(user.id) + '" data-status="' + nextStatus + '"><i data-lucide="' + (nextStatus === 'INACTIVE' ? 'user-x' : 'user-check') + '" style="width:16px;height:16px;"></i></button></td></tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:24px;">No users found.</td></tr>';
    document.querySelector('#users-pagination .pagination-info').textContent = list.length ? 'Showing ' + list.length + ' user' + (list.length === 1 ? '' : 's') : 'No users found';
    tbody.querySelectorAll('[data-status-user]').forEach(function (button) {
      button.addEventListener('click', function () {
        button.disabled = true;
        request('/api/v1/tenant/configuration/users/' + button.dataset.statusUser + '/status', { method: 'PATCH', body: { status: button.dataset.status } }).then(load).catch(showError).finally(function () { button.disabled = false; });
      });
    });
    if (window.lucide) window.lucide.createIcons();
  }

  function showError(error) {
    var box = document.getElementById('add-user-error');
    var text = document.getElementById('add-user-error-text');
    if (box && text) { text.textContent = error.message || 'Request failed.'; box.style.display = 'block'; }
  }

  function load() {
    return Promise.all([request('/api/v1/tenant/configuration/users'), request('/api/v1/tenant/configuration/roles')]).then(function (result) {
      users = result[0].items || [];
      roles = result[1].items || [];
      renderManagerOptions();
      renderRoleOptions();
      render();
    }).catch(function (error) { if (!error || error.code !== 'TENANT_SESSION_EXPIRED') showError(error); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof initLayout === 'function') { initLayout('Manage Users'); if (typeof initSidebar === 'function') initSidebar(); if (typeof initTopNav === 'function') initTopNav(); }
    ['user-search', 'role-filter', 'status-filter'].forEach(function (id) { document.getElementById(id).addEventListener(id === 'user-search' ? 'input' : 'change', render); });
    document.getElementById('add-user-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var submit = document.getElementById('add-user-submit');
      submit.disabled = true;
      document.getElementById('add-user-error').style.display = 'none';
      request('/api/v1/tenant/configuration/users', {
        method: 'POST',
        body: {
          firstName: document.getElementById('add-user-first-name').value.trim(),
          lastName: document.getElementById('add-user-last-name').value.trim(),
          email: document.getElementById('add-user-email').value.trim(),
          employeeId: document.getElementById('add-user-employee-id').value.trim(),
          department: document.getElementById('add-user-department').value.trim() || 'General',
          role: document.getElementById('add-user-role').value,
          managerId: document.getElementById('add-user-manager').value || undefined,
          initialPassword: document.getElementById('add-user-password').value,
        },
      }).then(function () {
        event.target.reset();
        closeModal('add-user-modal');
        return load();
      }).catch(showError).finally(function () { submit.disabled = false; });
    });
    load();
  });
})();
