initLayout('Manage Users');
lucide.createIcons();

var _session = null;
try { _session = JSON.parse(sessionStorage.getItem('finstackUserSession')); } catch (e) {}
var _orgId = _session ? _session.organizationId : '';

const ROLE_LABELS = {
  expense_submitter: 'Expense Submitter',
  manager: 'Manager',
  finance_officer: 'Finance Officer',
  compliance_officer: 'Compliance Officer',
  configuration_manager: 'Configuration Manager'
};

const ROLE_BADGE_COLORS = [
  { bg:'#7C3AED20', text:'#7C3AED', border:'#7C3AED' },
  { bg:'#22D3EE20', text:'#22D3EE', border:'#22D3EE' },
  { bg:'#EC489920', text:'#EC4899', border:'#EC4899' }
];

function roleLabel(roleId) {
  return ROLE_LABELS[roleId] || roleId;
}

function getManagerName(users, employeeId) {
  const manager = users.find(user => user.employeeId === employeeId);
  return manager ? manager.fullName : 'Unassigned';
}

function getUsersForRender() {
  var users = _orgId ? window.FinStackStore.getUsersByOrg(_orgId) : window.FinStackStore.getUsers();
  return users.map(user => ({
    ...user,
    rolesDisplay: (user.roles || []).map(roleLabel)
  }));
}

function renderManagerOptions(users) {
  const select = document.getElementById('add-user-manager');
  if (!select) return;
  const managers = users.filter(user => (user.roles || []).includes('manager'));
  select.innerHTML = '<option value="">Select a manager...</option>' + managers.map(user => (
    `<option value="${user.employeeId}">${user.fullName}</option>`
  )).join('');
}

function renderUsers(list, allUsers) {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = list.map(user => {
    const initials = user.fullName.split(' ').map(name => name[0]).join('').slice(0, 2).toUpperCase();
    const statusColor = user.status === 'Active'
      ? {bg:'#10B98120',text:'#10B981',border:'#10B981'}
      : {bg:'#EF444420',text:'#EF4444',border:'#EF4444'};
    const rolesHtml = user.rolesDisplay.map((role, index) => {
      const color = ROLE_BADGE_COLORS[index % ROLE_BADGE_COLORS.length];
      return `<span class="badge" style="background:${color.bg};color:${color.text};border-color:${color.border}40;">${role}</span>`;
    }).join('');
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:12px;"><div class="avatar avatar-lg">${initials}</div><span style="font-weight:500;color:var(--text-primary);">${user.fullName}</span></div></td>
      <td style="color:var(--text-secondary);">${user.email}</td>
      <td><div style="display:flex;flex-wrap:wrap;gap:6px;">${rolesHtml}</div></td>
      <td><span class="badge" style="background:${statusColor.bg};color:${statusColor.text};border-color:${statusColor.border}40;">${user.status}</span></td>
      <td style="color:var(--text-primary);">${getManagerName(allUsers, user.managerEmployeeId)}</td>
      <td><div style="display:flex;gap:4px;">
        <button class="btn-icon" title="${user.status === 'Active' ? 'Disable' : 'Enable'} User" onclick="toggleUserStatus('${user.employeeId}')"><i data-lucide="${user.status === 'Active' ? 'user-x' : 'user-check'}" style="width:16px;height:16px;"></i></button>
      </div></td>
    </tr>`;
  }).join('');
  lucide.createIcons();
  const count = list.length;
  const info = document.querySelector('#users-pagination .pagination-info');
  if (info) {
    info.textContent = count ? `Showing 1-${count} of ${count} users` : 'No users found';
  }
}

function filterUsers() {
  const users = getUsersForRender();
  const allUsers = _orgId ? window.FinStackStore.getUsersByOrg(_orgId) : window.FinStackStore.getUsers();
  renderManagerOptions(allUsers);
  const query = document.getElementById('user-search').value.toLowerCase();
  const role = document.getElementById('role-filter').value;
  const status = document.getElementById('status-filter').value;
  const filtered = users.filter(user => {
    const matchQuery = !query || user.fullName.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.employeeId.toLowerCase().includes(query);
    const matchRole = role === 'all' || user.rolesDisplay.includes(role);
    const matchStatus = status === 'all' || user.status === status;
    return matchQuery && matchRole && matchStatus;
  });
  renderUsers(filtered, allUsers);
}

window.toggleUserStatus = function(employeeId) {
  var users = _orgId ? window.FinStackStore.getUsersByOrg(_orgId) : window.FinStackStore.getUsers();
  const user = users.find(item => item.employeeId === employeeId);
  if (!user) return;
  window.FinStackStore.updateUser(employeeId, {
    status: user.status === 'Active' ? 'Inactive' : 'Active'
  });
  filterUsers();
  window.dispatchEvent(new CustomEvent('finstack:users-updated'));
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function applyRoleControl() {
  const org = window.FinStackStore.getOrganization();
  if (!org || !org.enabledRoles) return;
  const roleCheckboxes = document.querySelectorAll('#add-user-form input[data-role]');
  roleCheckboxes.forEach(cb => {
    if (!org.enabledRoles.includes(cb.dataset.role)) {
      cb.closest('label').style.display = 'none';
      cb.checked = false;
    } else {
      cb.closest('label').style.display = 'flex';
    }
  });
}

function bindAddUserForm() {
  const form = document.getElementById('add-user-form');
  if (!form) return;

  const errorBox = document.getElementById('add-user-error');
  const errorText = document.getElementById('add-user-error-text');

  function showError(msg) {
    if (errorBox) {
      errorText.textContent = msg;
      errorBox.style.display = 'block';
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      console.warn(msg);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (errorBox) errorBox.style.display = 'none';
    const firstName = document.getElementById('add-user-first-name').value.trim();
    const lastName = document.getElementById('add-user-last-name').value.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const email = document.getElementById('add-user-email').value.trim();
    const employeeId = document.getElementById('add-user-employee-id').value.trim();
    const department = document.getElementById('add-user-department').value.trim() || 'General';
    const managerEmployeeId = document.getElementById('add-user-manager').value;
    const password = document.getElementById('add-user-password').value;
    const roles = [...form.querySelectorAll('input[data-role]:checked')].map(input => input.dataset.role);

    // Validation
    if (!firstName || !lastName) { showError('First name and last name are required.'); return; }
    if (!email) { showError('Email address is required.'); return; }
    if (!isValidEmail(email)) { showError('Please enter a valid email address.'); return; }
    if (!employeeId) { showError('Employee ID is required.'); return; }
    if (!roles.length) { showError('Please assign at least one role.'); return; }
    if (!password) { showError('A temporary password is required.'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }
    if (!_orgId) { showError('Session error: Organization ID not found. Please re-login.'); return; }

    var result = window.FinStackStore.addUser({
      fullName: fullName,
      email: email,
      employeeId: employeeId,
      department: department,
      managerEmployeeId: managerEmployeeId,
      roles: roles,
      password: password,
      organizationId: _orgId,
      status: 'Active',
      accountStatus: 'approved'
    });

    if (!result || !result.success) {
      showError(result && result.error ? result.error : 'Failed to add user. Please try again.');
      return;
    }

    form.reset();
    form.querySelector('input[data-role="expense_submitter"]').checked = true;
    closeModal('add-user-modal');
    filterUsers();
    window.dispatchEvent(new CustomEvent('finstack:users-updated'));
  });
}

window.FinStackStore.ready.then(() => {
  filterUsers();
  bindAddUserForm();
  applyRoleControl();
  document.getElementById('user-search').addEventListener('input', filterUsers);
  document.getElementById('role-filter').addEventListener('change', filterUsers);
  document.getElementById('status-filter').addEventListener('change', filterUsers);
});
