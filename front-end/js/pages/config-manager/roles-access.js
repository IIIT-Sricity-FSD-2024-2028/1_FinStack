initLayout('Roles & Access');

let selectedRoleId = null;
const colorMap = { purple:'var(--purple)', cyan:'var(--cyan)', pink:'var(--pink)', green:'var(--green)' };

function colorForRole(roleId) {
  if (roleId === 'expense_submitter' || roleId === 'configuration_manager') return 'purple';
  if (roleId === 'manager') return 'cyan';
  if (roleId === 'finance_officer') return 'pink';
  return 'green';
}

function iconForRole(roleId) {
  if (roleId === 'expense_submitter') return 'receipt';
  if (roleId === 'manager') return 'briefcase';
  if (roleId === 'finance_officer') return 'calculator';
  if (roleId === 'compliance_officer') return 'shield-check';
  return 'settings';
}

function renderRoles() {
  const roles = window.FinStackStore.getRoles();
  document.getElementById('roles-list').innerHTML = roles.map(role => {
    const color = colorForRole(role.id);
    const isSelected = selectedRoleId === role.id;
    return `<div class="role-item${isSelected ? ' selected' : ''}${!role.enabled ? ' disabled' : ''}" onclick="selectRole('${role.id}')">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="icon-box icon-box-${color}"><i data-lucide="${iconForRole(role.id)}" style="width:20px;height:20px;"></i></div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <h4 style="font-weight:500;color:var(--text-primary);">${role.name}</h4>
              ${role.required ? '<span class="badge badge-gray" style="font-size:0.625rem;">Required</span>' : ''}
            </div>
            <p style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">${role.description}</p>
          </div>
        </div>
        ${!role.required ? `<div class="toggle-switch${role.enabled ? ' active' : ''}" onclick="event.stopPropagation();toggleRoleAccess('${role.id}')"><span class="toggle-knob"></span></div>` : ''}
      </div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

window.selectRole = function(id) {
  selectedRoleId = id;
  const role = window.FinStackStore.getRoles().find(item => item.id === id);
  if (!role) return;
  const color = colorForRole(role.id);
  document.getElementById('role-details').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
      <div class="icon-box icon-box-${color}" style="width:48px;height:48px;"><i data-lucide="${iconForRole(role.id)}" style="width:24px;height:24px;"></i></div>
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <h2>${role.name}</h2>
          ${role.required ? '<span class="badge badge-gray">Required</span>' : ''}
        </div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:4px;">${role.description}</p>
      </div>
    </div>
    <div style="margin-bottom:16px;"><h3 style="font-size:0.875rem;font-weight:600;color:var(--text-primary);">Permissions</h3></div>
    <div class="space-y-3">
      ${(role.permissions || []).map(permission => `<div class="permission-item">
        <div class="permission-check granted"><i data-lucide="check" style="width:12px;height:12px;"></i></div>
        <div><div style="font-size:0.875rem;font-weight:500;color:var(--text-primary);">${permission}</div></div>
      </div>`).join('')}
    </div>`;
  renderRoles();
  lucide.createIcons();
};

window.toggleRoleAccess = function(id) {
  window.FinStackStore.toggleRole(id);
  renderRoles();
  if (selectedRoleId === id) selectRole(id);
};

window.FinStackStore.ready.then(() => {
  renderRoles();
  const firstRole = window.FinStackStore.getRoles()[0];
  if (firstRole) {
    selectRole(firstRole.id);
  }
});
