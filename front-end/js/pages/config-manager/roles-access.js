(function () {
  var roles = [];
  var selectedKey = null;
  function request(path) { return window.FinStackTenantSession.request(path); }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function icon(key) { return key === 'CONFIGURATION_MANAGER' ? 'settings' : key === 'MANAGER' ? 'briefcase' : key === 'FINANCE_OFFICER' ? 'calculator' : key === 'COMPLIANCE_OFFICER' ? 'shield-check' : 'receipt'; }
  function render() {
    var list = document.getElementById('roles-list');
    list.innerHTML = roles.map(function (role) {
      return '<button type="button" class="role-item' + (selectedKey === role.key ? ' selected' : '') + '" data-role="' + esc(role.key) + '" style="width:100%;text-align:left;border:0;background:transparent;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="icon-box icon-box-purple"><i data-lucide="' + icon(role.key) + '" style="width:20px;height:20px;"></i></div><div style="min-width:0;flex:1;"><div style="display:flex;justify-content:space-between;gap:8px;"><h4 style="font-weight:500;color:var(--text-primary);">' + esc(role.name) + '</h4><span class="badge badge-gray">' + esc(role.userCount) + '</span></div><p style="font-size:.75rem;color:var(--text-secondary);margin-top:2px;">' + esc(role.description) + '</p></div></div></button>';
    }).join('');
    list.querySelectorAll('[data-role]').forEach(function (item) { item.addEventListener('click', function () { selectedKey = item.dataset.role; render(); renderDetails(); }); });
    if (window.lucide) window.lucide.createIcons();
  }
  function renderDetails() {
    var role = roles.filter(function (item) { return item.key === selectedKey; })[0];
    var node = document.getElementById('role-details');
    if (!role) return;
    node.innerHTML = '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;"><div class="icon-box icon-box-purple" style="width:48px;height:48px;"><i data-lucide="' + icon(role.key) + '" style="width:24px;height:24px;"></i></div><div><h2>' + esc(role.name) + '</h2><p style="font-size:.875rem;color:var(--text-secondary);margin-top:4px;">' + esc(role.description) + '</p></div></div><div style="margin-bottom:16px;"><h3 style="font-size:.875rem;font-weight:600;color:var(--text-primary);">System capabilities</h3><p style="font-size:.75rem;color:var(--text-secondary);margin-top:4px;">Roles are fixed system roles for this tenant workflow.</p></div><div class="space-y-3">' + role.capabilities.map(function (capability) { return '<div class="permission-item"><div class="permission-check granted"><i data-lucide="check" style="width:12px;height:12px;"></i></div><div style="font-size:.875rem;font-weight:500;color:var(--text-primary);">' + esc(capability) + '</div></div>'; }).join('') + '</div>';
    if (window.lucide) window.lucide.createIcons();
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof initLayout === 'function') { initLayout('Roles & Access'); if (typeof initSidebar === 'function') initSidebar(); if (typeof initTopNav === 'function') initTopNav(); }
    request('/api/v1/tenant/configuration/roles').then(function (result) { roles = result.items || []; selectedKey = roles.length ? roles[0].key : null; render(); renderDetails(); }).catch(function (error) { document.getElementById('role-details').textContent = error.message || 'Unable to load roles.'; });
  });
})();
