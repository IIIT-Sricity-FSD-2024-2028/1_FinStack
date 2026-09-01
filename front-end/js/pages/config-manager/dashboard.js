/* ===== Shared Layout Template ===== */
/* Injects sidebar and topnav into pages that have the shell containers */

function renderSidebar() {
  return `
  <div class="sidebar-header">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon"><span>F</span></div>
      <span class="sidebar-logo-text">FinStack</span>
    </div>
    <button class="sidebar-toggle" aria-label="Toggle sidebar">
      <i data-lucide="panel-left-close" style="width:20px;height:20px;"></i>
    </button>
  </div>
  <nav class="sidebar-nav">
    <div class="sidebar-section">
      <div class="sidebar-section-title">Overview</div>
      <a href="dashboard.html" class="sidebar-item">
        <i data-lucide="layout-dashboard" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Dashboard</span>
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">User Management</div>
      <a href="javascript:void(0)" class="sidebar-item" data-submenu="user-submenu">
        <i data-lucide="users" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Users</span>
        <i data-lucide="chevron-down" class="sidebar-chevron" style="width:16px;height:16px;"></i>
      </a>
      <div class="sidebar-submenu" id="user-submenu">
        <a href="manage-users.html" class="sidebar-submenu-item">Manage Users</a>
        <a href="user-hierarchy.html" class="sidebar-submenu-item">User Hierarchy</a>
      </div>
      <a href="roles-access.html" class="sidebar-item">
        <i data-lucide="shield" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Roles & Access</span>
      </a>
      <a href="subscription.html" class="sidebar-item">
        <i data-lucide="credit-card" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Subscription</span>
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Expense Config</div>
      <a href="expense-categories.html" class="sidebar-item">
        <i data-lucide="tag" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Categories</span>
      </a>
      <a href="expense-policies.html" class="sidebar-item">
        <i data-lucide="file-check" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Policies</span>
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">System</div>
      <a href="audit-logs.html" class="sidebar-item">
        <i data-lucide="scroll-text" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Audit Logs</span>
      </a>
      <a href="notifications.html" class="sidebar-item">
        <i data-lucide="bell" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Notifications</span>
      </a>
      <a href="javascript:void(0)" class="sidebar-item" data-submenu="settings-submenu">
        <i data-lucide="settings" style="width:20px;height:20px;"></i>
        <span class="sidebar-item-text">Settings</span>
        <i data-lucide="chevron-down" class="sidebar-chevron" style="width:16px;height:16px;"></i>
      </a>
      <div class="sidebar-submenu" id="settings-submenu">
        <a href="organization-settings.html" class="sidebar-submenu-item">Organization</a>
        <a href="profile-settings.html" class="sidebar-submenu-item">Profile</a>
        <a href="preferences.html" class="sidebar-submenu-item">Preferences</a>
      </div>
    </div>
  </nav>
  <div class="sidebar-footer" style="padding:16px 12px;border-top:1px solid var(--border-default);margin-top:auto;">
    <a href="#" class="sidebar-item sidebar-logout-btn" id="sidebar-logout" style="color:var(--red);">
      <i data-lucide="log-out" style="width:20px;height:20px;"></i>
      <span class="sidebar-item-text">Logout</span>
    </a>
  </div>`;
}

function renderTopnav(breadcrumb) {
  return `
  <div class="topnav-left">
    <div class="topnav-brand" style="font-size:1rem;font-weight:600;color:var(--text-primary);white-space:nowrap;">FinStack Workspace</div>
  </div>
  <div class="topnav-right">
    <div class="topnav-search">
      <i data-lucide="search" class="search-icon" style="width:16px;height:16px;"></i>
      <input type="text" placeholder="Search...">
    </div>
    <div class="dropdown">
      <button class="topnav-icon-btn" id="notif-btn" aria-label="Notifications">
        <i data-lucide="bell" style="width:20px;height:20px;"></i>
        <span class="notification-dot"></span>
      </button>
      <div class="notif-dropdown" id="notif-dropdown"></div>
    </div>
    <div class="dropdown">
      <button class="topnav-profile" id="profile-btn">
        <div class="avatar avatar-md">PN</div>
        <div>
          <div class="topnav-profile-name">Polasa Nikhil</div>
          <div class="topnav-profile-role">Configuration Manager</div>
        </div>
        <i data-lucide="chevron-down" style="width:14px;height:14px;color:var(--text-muted);"></i>
      </button>
      <div class="dropdown-menu" id="profile-dropdown">
        <a href="profile-settings.html" class="dropdown-item"><i data-lucide="user" style="width:16px;height:16px;"></i> Profile Settings</a>
        <a href="preferences.html" class="dropdown-item"><i data-lucide="sliders" style="width:16px;height:16px;"></i> Preferences</a>
        <div class="dropdown-divider"></div>
        <a href="../../login.html?role=configuration_manager" class="dropdown-item" style="color:var(--red);"><i data-lucide="log-out" style="width:16px;height:16px;"></i> Logout</a>
      </div>
    </div>
  </div>`;
}

function initLayout(breadcrumb) {
  const sidebar = document.getElementById('sidebar');
  const topnav = document.querySelector('.topnav');
  if (sidebar) {
    sidebar.innerHTML = renderSidebar();
    /* Make sidebar flex-column so footer is pushed to bottom */
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
  }
  if (topnav) topnav.innerHTML = renderTopnav(breadcrumb);

  /* Populate profile from session */
  try {
    var session = JSON.parse(sessionStorage.getItem('finstackUserSession'));
    if (session && session.fullName) {
      var nameEl = document.querySelector('.topnav-profile-name');
      var roleEl = document.querySelector('.topnav-profile-role');
      var avatarEl = document.querySelector('.topnav-profile .avatar');
      var initials = session.fullName.split(' ').map(function(n){ return n.charAt(0); }).join('').slice(0,2).toUpperCase();
      if (nameEl) nameEl.textContent = session.fullName;
      if (avatarEl) avatarEl.textContent = initials;
      if (roleEl && session.roles && session.roles.length) {
        roleEl.textContent = session.roles[0].replace(/_/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
      }
    }
  } catch(e) {}

  /* Intercept logout links to clear session */
  function handleLogout(e) {
    e.preventDefault();
    if (window.FinStackGuard) window.FinStackGuard.clearSession();
    window.location.href = '../../login.html';
  }

  /* Profile dropdown logout */
  document.querySelectorAll('a[href*="login.html"]').forEach(function(link) {
    if (link.textContent.trim().toLowerCase().includes('logout') || link.style.color === 'var(--red)') {
      link.addEventListener('click', handleLogout);
    }
  });

  /* Sidebar logout button */
  var sidebarLogout = document.getElementById('sidebar-logout');
  if (sidebarLogout) {
    sidebarLogout.addEventListener('click', handleLogout);
  }
}
/* ===== FINSTACK APP.JS - Shared Application Logic ===== */

/* ===== CONFIG MANAGER NOTIFICATION DROPDOWN ===== */
function renderConfigNotifDropdown() {
  var dropdown = document.getElementById('notif-dropdown');
  var dot = document.querySelector('.notification-dot');
  if (!dropdown) return;

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var notifications = [];
  if (window.FinStackStore) {
    try {
      notifications = window.FinStackStore.getNotifications() || [];
    } catch (e) {
      notifications = [];
    }
  }
  var unread = notifications.filter(function(n) { return n.unread; });

  // Sync unread count badge
  if (dot) {
    dot.textContent = unread.length > 9 ? '9+' : String(unread.length);
    dot.style.display = unread.length > 0 ? 'flex' : 'none';
  }

  var displayList = notifications.slice(0, 5);
  var itemsHtml = '';

  if (displayList.length === 0) {
    itemsHtml = '<div class="notif-dropdown-empty">No notifications</div>';
  } else {
    displayList.forEach(function(n) {
      var cls = 'notif-item' + (n.unread ? ' unread' : '');
      var timeStr = n.time || (window.FinStackStore && n.createdAt ? window.FinStackStore.formatTimeAgo(n.createdAt) : 'Recently');
      var unreadDot = n.unread ? '<span class="notif-unread-dot"></span>' : '';
      itemsHtml +=
        '<div class="' + cls + '" data-notif-id="' + esc(n.id || '') + '">' +
          '<div class="notif-item-body">' +
            '<div class="notif-item-title">' +
              '<span>' + esc(n.title || 'Notification') + '</span>' + unreadDot +
            '</div>' +
            '<div class="notif-item-desc">' + esc(n.message || '') + '</div>' +
            '<div class="notif-item-time">' + esc(timeStr) + '</div>' +
          '</div>' +
        '</div>';
    });
  }

  var markAllBtn = '<button class="notif-mark-read" id="cm-mark-all-read" type="button"' + (unread.length ? '' : ' disabled') + '>Mark all as read</button>';

  dropdown.innerHTML =
    '<div class="notif-dropdown-header">' +
      '<div><h3>Notifications</h3></div>' +
      markAllBtn +
    '</div>' +
    '<div class="notif-list">' + itemsHtml + '</div>' +
    '<div class="notif-dropdown-footer">' +
      '<a href="notifications.html" class="notif-view-all">View All Notifications</a>' +
    '</div>';

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Bind mark-all-read
  var markBtn = document.getElementById('cm-mark-all-read');
  if (markBtn) {
    markBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (window.FinStackStore) {
        window.FinStackStore.markAllNotificationsRead();
      }
      renderConfigNotifDropdown();
    });
  }

  // Bind individual notification click → mark read
  dropdown.querySelectorAll('.notif-item[data-notif-id]').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      var nid = item.getAttribute('data-notif-id');
      if (nid && window.FinStackStore) {
        window.FinStackStore.markNotificationRead(nid);
      }
      renderConfigNotifDropdown();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTopNav();
  initActiveLink();
});

/* ===== SIDEBAR ===== */
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.querySelector('.sidebar-toggle');
  if (!sidebar || !toggleBtn) return;

  // Inject tooltip spans into every sidebar-item that doesn't already have one
  sidebar.querySelectorAll('.sidebar-item').forEach(item => {
    if (!item.querySelector('.sidebar-tooltip')) {
      const textEl = item.querySelector('.sidebar-item-text');
      if (textEl) {
        const tooltip = document.createElement('span');
        tooltip.className = 'sidebar-tooltip';
        tooltip.textContent = textEl.textContent.trim();
        item.appendChild(tooltip);
      }
    }
  });

  // Update toggle icon to reflect current state
  function updateToggleIcon() {
    const iconName = sidebar.classList.contains('collapsed') ? 'panel-left-open' : 'panel-left-close';
    const iconEl = toggleBtn.querySelector('[data-lucide]');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', iconName);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  // Restore collapsed state from localStorage
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
  }
  updateToggleIcon();

  // Toggle handler — works both ways
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    updateToggleIcon();
  });

  // Submenu toggles
  document.querySelectorAll('.sidebar-item[data-submenu]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      // Don't open submenus while collapsed
      if (sidebar.classList.contains('collapsed')) return;
      const submenuId = item.getAttribute('data-submenu');
      const submenu = document.getElementById(submenuId);
      const chevron = item.querySelector('.sidebar-chevron');
      if (submenu) {
        submenu.classList.toggle('open');
        if (chevron) chevron.classList.toggle('open');
      }
    });
  });
}

/* ===== TOP NAVIGATION ===== */
function initTopNav() {
  // Notification dropdown
  const notifBtn = document.getElementById('notif-btn');
  const notifDropdown = document.getElementById('notif-dropdown');
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderConfigNotifDropdown();
      const shouldOpen = !notifDropdown.classList.contains('open') && !notifDropdown.classList.contains('active');
      notifDropdown.classList.toggle('open', shouldOpen);
      notifDropdown.classList.toggle('active', shouldOpen);
      // Close profile dropdown if open
      document.getElementById('profile-dropdown')?.classList.remove('active');
    });
    notifDropdown.addEventListener('click', (e) => e.stopPropagation());
  }

  // Profile dropdown
  const profileBtn = document.getElementById('profile-btn');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('active');
      // Close notification dropdown if open
      document.getElementById('notif-dropdown')?.classList.remove('open');
      document.getElementById('notif-dropdown')?.classList.remove('active');
    });
  }

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.active').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.notif-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.dropdown-menu.open').forEach(d => d.classList.remove('open'));
  });
}

/* ===== ACTIVE LINK ===== */
function initActiveLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-item, .sidebar-submenu-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
      // If in a submenu, open it
      const submenu = link.closest('.sidebar-submenu');
      if (submenu) {
        submenu.classList.add('open');
        const parentItem = submenu.previousElementSibling;
        if (parentItem) {
          const chevron = parentItem.querySelector('.sidebar-chevron');
          if (chevron) chevron.classList.add('open');
        }
      }
    }
  });
}

/* ===== MODAL HELPERS ===== */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

/* ===== TOGGLE SWITCH HELPER ===== */
function initToggles() {
  document.querySelectorAll('.toggle-switch:not(.disabled)').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      const event = new CustomEvent('toggle-change', {
        detail: { active: toggle.classList.contains('active') },
        bubbles: true
      });
      toggle.dispatchEvent(event);
    });
  });
}

/* ===== SEARCH FILTER HELPER ===== */
function filterTable(tableId, searchValue, columns = []) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  const query = searchValue.toLowerCase().trim();

  rows.forEach(row => {
    if (!query) {
      row.style.display = '';
      return;
    }
    const cells = row.querySelectorAll('td');
    let match = false;
    columns.forEach(colIndex => {
      if (cells[colIndex] && cells[colIndex].textContent.toLowerCase().includes(query)) {
        match = true;
      }
    });
    // If no columns specified, search all cells
    if (columns.length === 0) {
      cells.forEach(cell => {
        if (cell.textContent.toLowerCase().includes(query)) match = true;
      });
    }
    row.style.display = match ? '' : 'none';
  });
}

/* ===== PAGINATION HELPER ===== */
function initPagination(containerId, itemsPerPage = 10) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const items = container.querySelectorAll('[data-page-item]');
  const paginationInfo = container.querySelector('.pagination-info');
  const paginationBtns = container.querySelector('.pagination-buttons');
  let currentPage = 1;
  const totalPages = Math.ceil(items.length / itemsPerPage);

  function showPage(page) {
    currentPage = page;
    items.forEach((item, index) => {
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      item.style.display = (index >= start && index < end) ? '' : 'none';
    });

    if (paginationInfo) {
      const start = (page - 1) * itemsPerPage + 1;
      const end = Math.min(page * itemsPerPage, items.length);
      paginationInfo.textContent = `Showing ${start} to ${end} of ${items.length}`;
    }

    // Update button states
    if (paginationBtns) {
      paginationBtns.querySelectorAll('.pagination-btn').forEach(btn => {
        const pageNum = parseInt(btn.dataset.page);
        if (!isNaN(pageNum)) {
          btn.classList.toggle('active', pageNum === currentPage);
        }
        if (btn.dataset.action === 'prev') btn.disabled = currentPage === 1;
        if (btn.dataset.action === 'next') btn.disabled = currentPage === totalPages;
      });
    }
  }

  if (paginationBtns) {
    paginationBtns.addEventListener('click', (e) => {
      const btn = e.target.closest('.pagination-btn');
      if (!btn || btn.disabled) return;
      if (btn.dataset.action === 'prev') showPage(currentPage - 1);
      else if (btn.dataset.action === 'next') showPage(currentPage + 1);
      else if (btn.dataset.page) showPage(parseInt(btn.dataset.page));
    });
  }

  showPage(1);
  return { showPage, totalPages };
}

/* ===== FORMAT HELPERS ===== */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('');
}
/* ===== FINSTACK CONFIGURATION MANAGER DASHBOARD ===== */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  /* Update profile display from session */
  var session = null;
  try { session = JSON.parse(sessionStorage.getItem('finstackUserSession')); } catch (e) {}
  if (session) {
    var profileName = document.querySelector('.topnav-profile-name');
    var profileRole = document.querySelector('.topnav-profile-role');
    var avatar = document.querySelector('.topnav-profile .avatar');
    if (profileName) profileName.textContent = session.fullName || 'Configuration Manager';
    if (profileRole) profileRole.textContent = 'Configuration Manager';
    if (avatar && session.fullName) {
      avatar.textContent = session.fullName.split(' ').map(function(n) { return n[0]; }).join('');
    }
  }

  /* Handle logout */
  var logoutLinks = document.querySelectorAll('a[href*="login.html"]');
  logoutLinks.forEach(function (link) {
    if (link.style.color === 'var(--red)' || link.textContent.trim().toLowerCase().includes('logout')) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.FinStackGuard) window.FinStackGuard.clearSession();
        window.location.href = '../../login.html';
      });
    }
  });

  /* Wait for FinStackStore */
  if (typeof window.FinStackStore === 'undefined') return;
  window.FinStackStore.ready.then(function () {
    renderConfigNotifDropdown();
    loadPendingRequests();
    loadDashboardMetrics();
  });
});

function loadPendingRequests() {
  var section = document.getElementById('pending-requests-section');
  var tbody = document.getElementById('pending-requests-body');
  var badge = document.getElementById('pending-count-badge');
  if (!section || !tbody) return;

  var session = null;
  try { session = JSON.parse(sessionStorage.getItem('finstackUserSession')); } catch (e) {}
  var orgId = session ? session.organizationId : '';

  var requests = window.FinStackStore.getAccountRequests(orgId);
  var pending = requests.filter(function (r) { return r.status === 'pending'; });

  if (pending.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  if (badge) badge.textContent = pending.length;

  tbody.innerHTML = pending.map(function (req) {
    var roleName = window.FinStackStore.titleCase(req.requestedRole);
    var date = new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var initials = req.fullName.split(' ').map(function (n) { return n[0]; }).join('');
    return '<tr>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div class="avatar avatar-lg">' + initials + '</div>' +
          '<div>' +
            '<div style="font-weight:500;color:var(--text-primary);">' + req.fullName + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-secondary);">' + req.email + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td style="color:var(--text-secondary);">' + req.employeeId + '</td>' +
      '<td><span class="badge badge-purple">' + roleName + '</span></td>' +
      '<td style="color:var(--text-secondary);">' + date + '</td>' +
      '<td>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-primary" style="padding:6px 12px;font-size:0.75rem;" onclick="approveRequest(\'' + req.id + '\')">Approve</button>' +
          '<button class="btn btn-secondary" style="padding:6px 12px;font-size:0.75rem;color:var(--red);border-color:rgba(239,68,68,0.3);" onclick="rejectRequest(\'' + req.id + '\')">Reject</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function approveRequest(requestId) {
  var result = window.FinStackStore.approveAccountRequest(requestId);
  if (result.success) {
    loadPendingRequests();
  }
}

function rejectRequest(requestId) {
  var result = window.FinStackStore.rejectAccountRequest(requestId);
  if (result.success) {
    loadPendingRequests();
  }
}

function loadDashboardMetrics() {
  var tenantToken = sessionStorage.getItem('finstackTenantAccessToken');
  if (tenantToken) {
    var apiBase = window.FinStackApi && window.FinStackApi.baseUrl ? window.FinStackApi.baseUrl : 'http://localhost:3000';
    fetch(apiBase + '/api/v1/tenant/subscription', { headers: { Authorization: 'Bearer ' + tenantToken } })
      .then(function (response) { return response.json(); })
      .then(function (payload) {
        var subscription = payload.data || payload;
        if (!subscription || !subscription.plan) return;
        var labels = document.querySelectorAll('.metric-label');
        var values = document.querySelectorAll('.metric-value');
        if (labels[0]) labels[0].textContent = 'Organization';
        if (values[0]) values[0].textContent = subscription.organization.name;
        if (labels[1]) labels[1].textContent = 'Current Plan';
        if (values[1]) values[1].textContent = subscription.plan.name;
        if (labels[2]) labels[2].textContent = 'Recurring Price';
        if (values[2]) values[2].textContent = subscription.currency + ' ' + subscription.priceAtSubscription;
        if (labels[3]) labels[3].textContent = 'Employee Seats';
        if (values[3]) values[3].textContent = String(subscription.employeeCount);
      })
      .catch(function () {});
  }
  /* Dynamic metrics from store */
  var state = window.FinStackStore.getState();
  var expenses = state.expenses || [];
  var users = state.users || [];

  var totalAmount = expenses.reduce(function (sum, e) { return sum + Number(e.amount || 0); }, 0);
  var pending = expenses.filter(function (e) { return e.status === 'pending'; }).length;
  var approved = expenses.filter(function (e) { return e.status === 'approved'; }).length;
  var violations = expenses.filter(function (e) { return e.flag && e.flag !== 'none'; }).length;

  var metricValues = document.querySelectorAll('.metric-value');
  if (metricValues[0]) metricValues[0].textContent = '₹' + totalAmount.toLocaleString('en-IN');
  if (metricValues[1]) metricValues[1].textContent = pending;
  if (metricValues[2]) metricValues[2].textContent = approved;
  if (metricValues[3]) metricValues[3].textContent = violations;

  loadRecentActivity();
}

function loadRecentActivity() {
  var tbody = document.getElementById('recent-activity-tbody');
  if (!tbody) return;

  var logs = (window.FinStackStore.getAuditLogs() || []).slice().reverse().slice(0, 8);
  var users = window.FinStackStore.getUsers ? window.FinStackStore.getUsers() : [];
  var userMap = {};

  users.forEach(function(user) {
    if (user && user.employeeId) {
      userMap[user.employeeId] = user.fullName;
    }
  });

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:24px;">No recent activity yet.</td></tr>';
    return;
  }

  var actionColors = {
    'Created': { bg: '#10B98120', text: '#10B981', border: '#10B981' },
    'Updated': { bg: '#3B82F620', text: '#60A5FA', border: '#3B82F6' },
    'Deleted': { bg: '#EF444420', text: '#EF4444', border: '#EF4444' },
    'Approved': { bg: '#10B98120', text: '#10B981', border: '#10B981' },
    'Rejected': { bg: '#EF444420', text: '#EF4444', border: '#EF4444' },
    'Escalated': { bg: '#F59E0B20', text: '#F59E0B', border: '#F59E0B' },
    'Submitted': { bg: '#8B5CF620', text: '#A78BFA', border: '#8B5CF6' },
    'Flagged': { bg: '#F97316' + '20', text: '#F97316', border: '#F97316' }
  };

  function getActionColor(action) {
    var key = Object.keys(actionColors).find(function(k) {
      return (action || '').toLowerCase().includes(k.toLowerCase());
    });
    return key ? actionColors[key] : { bg: '#6B728020', text: '#9CA3AF', border: '#6B7280' };
  }

  function getUserName(log) {
    return userMap[log.userEmployeeId] || 'Unknown User';
  }

  function getInitial(name) {
    return String(name || 'Unknown User').charAt(0).toUpperCase();
  }

  function formatTimeAgo(ts) {
    if (!ts) return 'Now';
    var diff = Date.now() - new Date(ts).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  tbody.innerHTML = logs.map(function(log) {
    var userName = getUserName(log);
    var initial = getInitial(userName);
    var resource = [log.entityType, log.entityName].filter(Boolean).join(' • ') || '—';
    var color = getActionColor(log.action);
    var timeAgo = formatTimeAgo(log.timestamp);
    var statusBg = log.status === 'Success' ? '#10B98120' : '#EF444420';
    var statusColor = log.status === 'Success' ? '#10B981' : '#EF4444';
    return '<tr>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div class="avatar avatar-lg">' + initial + '</div>' +
          '<div>' +
            '<div style="font-weight:500;color:var(--text-primary);font-size:0.875rem;">' + userName + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-secondary);">' + (log.action || '—') + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td style="color:var(--text-secondary);font-size:0.875rem;">' + resource + '</td>' +
      '<td style="color:var(--text-secondary);font-size:0.8rem;">' + (log.userRole || '—') + '</td>' +
      '<td><span class="badge" style="background:' + statusBg + ';color:' + statusColor + ';border-color:' + statusColor + '40;">' + (log.status || 'Success') + '</span></td>' +
      '<td style="color:var(--text-secondary);font-size:0.8rem;white-space:nowrap;">' + timeAgo + '</td>' +
    '</tr>';
  }).join('');
}
