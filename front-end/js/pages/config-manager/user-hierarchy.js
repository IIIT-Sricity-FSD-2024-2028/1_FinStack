initLayout('User Hierarchy');

(function () {
  const ROLE_ORDER = [
    'configuration_manager',
    'manager',
    'finance_officer',
    'compliance_officer',
    'expense_submitter'
  ];
  const ROLE_LABELS = {
    configuration_manager: 'Configuration Manager',
    manager: 'Manager',
    finance_officer: 'Finance Officer',
    compliance_officer: 'Compliance Officer',
    expense_submitter: 'Expense Submitter'
  };
  const roleColors = {
    configuration_manager: { bg: '#7C3AED20', text: '#7C3AED', border: '#7C3AED' },
    manager: { bg: '#22D3EE20', text: '#22D3EE', border: '#22D3EE' },
    finance_officer: { bg: '#EC489920', text: '#EC4899', border: '#EC4899' },
    compliance_officer: { bg: '#10B98120', text: '#10B981', border: '#10B981' },
    expense_submitter: { bg: '#F59E0B20', text: '#F59E0B', border: '#F59E0B' }
  };

  let users = [];
  let selectedEmployeeId = null;

  function currentOrgId() {
    try {
      var session = JSON.parse(sessionStorage.getItem('finstackUserSession') || localStorage.getItem('currentUser') || '{}');
      return session.organizationId || '';
    } catch (e) {
      return '';
    }
  }

  function refreshUsers() {
    var orgId = currentOrgId();
    var source = orgId ? window.FinStackStore.getUsersByOrg(orgId) : window.FinStackStore.getUsers();
    users = source.map(function (user) {
      return {
        id: user.employeeId,
        name: user.fullName,
        email: user.email,
        roles: user.roles || [],
        managerId: user.managerEmployeeId || '',
        department: user.department || 'General'
      };
    });
  }

  function initials(name) {
    return String(name || 'U').split(' ').map(function (part) { return part[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function renderUserCard(user, roleId) {
    var c = roleColors[roleId] || roleColors.expense_submitter;
    return '<div class="hierarchy-card" onclick="selectUser(\'' + user.id + '\')" style="cursor:pointer;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div class="avatar avatar-lg">' + initials(user.name) + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<h4 class="truncate">' + user.name + '</h4>' +
            '<span class="badge" style="background:' + c.bg + ';color:' + c.text + ';border-color:' + c.border + '40;">' + ROLE_LABELS[roleId] + '</span>' +
          '</div>' +
          '<p style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;" class="truncate">' + user.email + '</p>' +
          '<p style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">' + user.department + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderRoleGroup(roleId) {
    var assigned = users.filter(function (user) { return user.roles.indexOf(roleId) !== -1; });
    var c = roleColors[roleId] || roleColors.expense_submitter;
    return '<div class="hierarchy-node" style="padding-left:0;margin-bottom:18px;">' +
      '<div class="hierarchy-card" style="border-color:' + c.border + '40;background:rgba(255,255,255,0.02);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
          '<div><h4>' + ROLE_LABELS[roleId] + '</h4><p style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">' + assigned.length + ' assigned</p></div>' +
          '<span class="badge" style="background:' + c.bg + ';color:' + c.text + ';border-color:' + c.border + '40;">Role</span>' +
        '</div>' +
      '</div>' +
      '<div style="padding-left:36px;margin-top:10px;">' +
        (assigned.length ? assigned.map(function (user) { return renderUserCard(user, roleId); }).join('') : '<div class="empty-state" style="padding:18px;color:var(--text-secondary);">No users assigned</div>') +
      '</div>' +
    '</div>';
  }

  function render() {
    refreshUsers();
    var filter = document.getElementById('dept-filter') ? document.getElementById('dept-filter').value : 'All';
    if (filter !== 'All') {
      users = users.filter(function (user) { return user.department === filter; });
      document.getElementById('filter-badge').style.display = 'block';
      document.getElementById('filter-dept').textContent = filter;
    } else if (document.getElementById('filter-badge')) {
      document.getElementById('filter-badge').style.display = 'none';
    }

    var tree = document.getElementById('hierarchy-tree');
    if (!tree) return;
    tree.innerHTML = ROLE_ORDER.map(renderRoleGroup).join('');

    var unassigned = users.filter(function (user) { return !user.roles || !user.roles.length; });
    var unassignedSection = document.getElementById('unassigned-section');
    if (unassignedSection) {
      unassignedSection.style.display = unassigned.length ? 'block' : 'none';
      var grid = document.getElementById('unassigned-grid');
      if (grid) {
        grid.innerHTML = unassigned.length ? unassigned.map(function (user) { return renderUserCard(user, 'expense_submitter'); }).join('') : '';
      }
    }
    if (window.lucide) lucide.createIcons();
  }

  window.selectUser = function (id) {
    selectedEmployeeId = id;
    var user = users.find(function (item) { return item.id === id; });
    if (!user) return;
    var managers = users.filter(function (item) { return item.id === user.managerId; });
    var manager = managers.length ? managers[0].name : 'None';
    document.getElementById('panel-body').innerHTML =
      '<div style="text-align:center;margin-bottom:24px;">' +
        '<div class="avatar avatar-xl" style="margin:0 auto 16px;">' + initials(user.name) + '</div>' +
        '<h3 style="font-size:1.125rem;color:var(--text-primary);margin-bottom:4px;">' + user.name + '</h3>' +
        '<p style="font-size:0.875rem;color:var(--text-secondary);">' + user.email + '</p>' +
      '</div>' +
      '<div class="space-y-4">' +
        '<div class="settings-row"><div class="settings-row-info"><h4>Department</h4></div><span style="font-size:0.875rem;color:var(--text-primary);">' + user.department + '</span></div>' +
        '<div class="settings-row"><div class="settings-row-info"><h4>Roles</h4></div><span style="font-size:0.875rem;color:var(--text-primary);">' + user.roles.map(function (role) { return ROLE_LABELS[role] || role; }).join(', ') + '</span></div>' +
        '<div class="settings-row"><div class="settings-row-info"><h4>Manager</h4></div><span style="font-size:0.875rem;color:var(--text-primary);">' + manager + '</span></div>' +
      '</div>';
    document.getElementById('details-panel').classList.add('open');
    render();
  };

  window.closePanel = function () {
    document.getElementById('details-panel').classList.remove('open');
    selectedEmployeeId = null;
    render();
  };

  window.clearFilter = function () {
    document.getElementById('dept-filter').value = 'All';
    render();
  };

  window.toggleNode = function () {};
  window.addEventListener('finstack:users-updated', render);

  window.FinStackStore.ready.then(function () {
    render();
    var deptFilter = document.getElementById('dept-filter');
    if (deptFilter) deptFilter.addEventListener('change', render);
  });
})();
