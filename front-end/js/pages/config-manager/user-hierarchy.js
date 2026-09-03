(function () {
  var users = [];
  function request(path, options) { return window.FinStackTenantSession.request(path, options); }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function initials(name) { return String(name || 'U').split(' ').map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
  function roleName(role) { return String(role).split('_').map(function (part) { return part.charAt(0) + part.slice(1).toLowerCase(); }).join(' '); }
  function card(user, depth) {
    return '<div class="hierarchy-node" style="margin-left:' + (depth * 28) + 'px;margin-top:10px;"><button type="button" class="hierarchy-card" data-user="' + esc(user.id) + '" style="width:100%;text-align:left;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="avatar avatar-lg">' + esc(initials(user.fullName)) + '</div><div><h4>' + esc(user.fullName) + '</h4><p style="font-size:.75rem;color:var(--text-secondary);margin-top:2px;">' + esc(roleName(user.role)) + ' · ' + esc(user.department) + '</p></div></div></button></div>';
  }
  function renderTree(user, depth, childMap) {
    return card(user, depth) + (childMap[user.id] || []).map(function (child) { return renderTree(child, depth + 1, childMap); }).join('');
  }
  function render() {
    var department = document.getElementById('dept-filter').value;
    var visible = department === 'All' ? users : users.filter(function (user) { return user.department === department; });
    var childMap = {};
    visible.forEach(function (user) { if (user.managerId && visible.some(function (candidate) { return candidate.id === user.managerId; })) (childMap[user.managerId] = childMap[user.managerId] || []).push(user); });
    var roots = visible.filter(function (user) { return !user.managerId || !visible.some(function (candidate) { return candidate.id === user.managerId; }); });
    document.getElementById('hierarchy-tree').innerHTML = roots.length ? roots.map(function (user) { return renderTree(user, 0, childMap); }).join('') : '<div class="empty-state">No users match this department.</div>';
    var unassigned = visible.filter(function (user) { return !user.managerId && user.role !== 'CONFIGURATION_MANAGER'; });
    document.getElementById('unassigned-section').style.display = unassigned.length ? 'block' : 'none';
    document.getElementById('unassigned-grid').innerHTML = unassigned.map(function (user) { return card(user, 0); }).join('');
    document.querySelectorAll('[data-user]').forEach(function (button) { button.addEventListener('click', function () { showUser(button.dataset.user); }); });
  }
  function showUser(id) {
    var user = users.filter(function (item) { return item.id === id; })[0];
    if (!user) return;
    var choices = users.filter(function (item) { return item.id !== user.id; }).map(function (item) { return '<option value="' + esc(item.id) + '"' + (item.id === user.managerId ? ' selected' : '') + '>' + esc(item.fullName) + '</option>'; }).join('');
    document.getElementById('panel-body').innerHTML = '<div style="text-align:center;margin-bottom:24px;"><div class="avatar avatar-xl" style="margin:0 auto 16px;">' + esc(initials(user.fullName)) + '</div><h3>' + esc(user.fullName) + '</h3><p style="font-size:.875rem;color:var(--text-secondary);">' + esc(user.email) + '</p></div><div class="space-y-4"><div class="settings-row"><div class="settings-row-info"><h4>Department</h4></div><span>' + esc(user.department) + '</span></div><div class="settings-row"><div class="settings-row-info"><h4>Role</h4></div><span>' + esc(roleName(user.role)) + '</span></div><div><label class="form-label" for="user-manager">Reports to</label><select class="form-input" id="user-manager"><option value="">No manager</option>' + choices + '</select></div><button class="btn btn-primary" id="save-reporting">Save reporting line</button></div>';
    document.getElementById('details-panel').classList.add('open');
    document.getElementById('save-reporting').addEventListener('click', function () { var button = this; button.disabled = true; request('/api/v1/tenant/configuration/users/' + user.id + '/reporting', { method: 'PATCH', body: { managerId: document.getElementById('user-manager').value || null } }).then(load).then(function () { document.getElementById('details-panel').classList.remove('open'); }).catch(function (error) { button.disabled = false; var errorNode = document.createElement('p'); errorNode.style.cssText = 'color:var(--red);font-size:.8125rem;margin-top:8px;'; errorNode.textContent = error.message || 'Unable to update reporting line.'; button.insertAdjacentElement('afterend', errorNode); }); });
  }
  window.closePanel = function () { document.getElementById('details-panel').classList.remove('open'); };
  function load() { return request('/api/v1/tenant/configuration/users').then(function (result) { users = result.items || []; var departments = users.map(function (user) { return user.department; }).filter(function (value, index, values) { return values.indexOf(value) === index; }); var filter = document.getElementById('dept-filter'); filter.innerHTML = '<option value="All">Department: All</option>' + departments.map(function (value) { return '<option value="' + esc(value) + '">Department: ' + esc(value) + '</option>'; }).join(''); render(); }); }
  document.addEventListener('DOMContentLoaded', function () { if (typeof initLayout === 'function') { initLayout('User Hierarchy'); if (typeof initSidebar === 'function') initSidebar(); if (typeof initTopNav === 'function') initTopNav(); } document.getElementById('dept-filter').addEventListener('change', render); load().catch(function (error) { document.getElementById('hierarchy-tree').textContent = error.message || 'Unable to load users.'; }); });
})();
