/* ============================================================
   app.js – Router (show/hide), Toast, Icons, Panel helpers
   ============================================================ */
'use strict';

/* ── Toast ──────────────────────────────────────────── */
const Toast = (() => {
  let container;
  function get() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }
  function show(msg, type) {
    type = type || 'info';
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    const icons = { success: '✓', info: 'ℹ', warning: '⚠', error: '✕' };
    t.innerHTML = '<span style="font-size:1rem">' + (icons[type] || 'ℹ') + '</span><span>' + msg + '</span>';
    get().appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0'; t.style.transition = 'opacity .3s';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }
  return {
    success: m => show(m, 'success'),
    info: m => show(m, 'info'),
    warning: m => show(m, 'warning'),
    error: m => show(m, 'error')
  };
})();
window.Toast = Toast;

/* ── Router ─────────────────────────────────────────── */
const Router = (() => {
  const hooks = {};
  let current = null;
  const routes = {
    dashboard: 'dashboard.html',
    policies: 'policies.html',
    audit: 'audit.html',
    communications: 'communications.html',
    compliance: 'compliance.html',
    escalated: 'escalated-expenses.html',
    profile: 'profile-settings.html',
  };

  function navigate(pageId) {
    const target = routes[pageId];
    if (!target) return;
    if (current === pageId) return;
    window.location.href = target;
  }

  function init(pageId) {
    current = pageId;
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(n =>
      n.classList.toggle('active', n.dataset.page === pageId)
    );

    // Close mobile sidebar
    document.querySelector('.sidebar')?.classList.remove('open');
    const so = document.getElementById('sidebar-overlay');
    if (so) so.style.display = 'none';

    // Run init hook
    if (hooks[pageId]) hooks[pageId]();
  }

  function on(pageId, fn) { hooks[pageId] = fn; }
  function getCurrent() { return current; }

  return { navigate, init, on, getCurrent };
})();
window.Router = Router;

/* ── Panel helpers ──────────────────────────────────── */
window.openPanel = function (id) {
  document.getElementById('overlay')?.classList.add('open');
  document.getElementById(id)?.classList.add('open');
};
window.closePanel = function (id) {
  document.getElementById('overlay')?.classList.remove('open');
  document.getElementById(id)?.classList.remove('open');
};
window.closeAllPanels = function () {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  document.getElementById('overlay')?.classList.remove('open');
};

/* ── Mobile sidebar ─────────────────────────────────── */
function initMobileSidebar() {
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  btn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    if (overlay) overlay.style.display = sidebar?.classList.contains('open') ? 'block' : 'none';
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  });
}
window.initMobileSidebar = initMobileSidebar;

/* ── Desktop sidebar collapse ───────────────────────── */
function initSidebarCollapse() {
  const sidebar = document.querySelector('.sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const storageKey = 'finstack-sidebar-collapsed';

  if (!sidebar || !collapseBtn) return;

  function updateToggleIcon(collapsed) {
    collapseBtn.innerHTML = collapsed
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path><path d="m13 9 3 3-3 3"></path></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path><path d="m16 15-3-3 3-3"></path></svg>';

    collapseBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    collapseBtn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  }

  // Restore state
  const isCollapsed = localStorage.getItem(storageKey) === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }
  updateToggleIcon(isCollapsed);

  // Clean up init class after paint to allow future transitions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('sidebar-collapsed-init');
    });
  });

  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const currentlyCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem(storageKey, String(currentlyCollapsed));
    updateToggleIcon(currentlyCollapsed);
  });

  // Mobile responsiveness
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  mobileQuery.addEventListener('change', (e) => {
    if (e.matches) {
      sidebar.classList.remove('collapsed');
    } else {
      const saved = localStorage.getItem(storageKey) === 'true';
      sidebar.classList.toggle('collapsed', saved);
      updateToggleIcon(saved);
    }
  });
}
window.initSidebarCollapse = initSidebarCollapse;

/* ── Header profile menu ───────────────────────────── */
function initHeaderProfileMenu() {
  const wrap = document.querySelector('.header-profile-wrap');
  const trigger = document.querySelector('[data-profile-menu-trigger]');
  const menu = document.querySelector('[data-profile-menu]');

  if (!wrap || !trigger || !menu) return;

  function setOpen(open) {
    wrap.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!wrap.classList.contains('open'));
  });

  menu.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target.closest('.header-profile-menu-item')) setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}
window.initHeaderProfileMenu = initHeaderProfileMenu;

function logoutToSharedLogin() {
  sessionStorage.removeItem('finstackUserSession');
  window.location.href = '../../login.html?role=compliance_officer';
}
window.logoutToSharedLogin = logoutToSharedLogin;

/* ── Icons ──────────────────────────────────────────── */
const Icons = {
  eye: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  edit: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  send: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  save: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  alertCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  checkCircle2: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  xCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  messageCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  shieldAlert: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  archive: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  moreVertical: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
  reply: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
  bell: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>',
  bellDot: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><circle cx="19" cy="7" r="3" fill="#22d3ee" stroke="#111827" stroke-width="2" /></svg>',
};
window.Icons = Icons;
/* main.js – Entry point */
'use strict';

Router.on('dashboard',      () => initDashboard());
Router.on('policies',       () => initPolicies());
Router.on('audit',          () => initAudit());
Router.on('communications', () => initCommunications());
Router.on('compliance',     () => initCompliance());
Router.on('profile',        () => initProfile());

document.addEventListener('DOMContentLoaded', () => {
  initMobileSidebar();
  initSidebarCollapse();
  initHeaderProfileMenu();

  /* Populate header profile from session */
  try {
    var session = JSON.parse(sessionStorage.getItem('finstackUserSession'));
    if (session && session.fullName) {
      var avatar = document.querySelector('.header-profile-avatar');
      var name = document.querySelector('.header-profile-name');
      var menuName = document.querySelector('.header-profile-menu-name');
      var initials = session.fullName.split(' ').map(function(n){ return n.charAt(0); }).join('').slice(0,2).toUpperCase();
      if (avatar) avatar.textContent = initials;
      if (name) name.textContent = session.fullName;
      if (menuName) menuName.textContent = session.fullName;
      if (session.email) {
        var email = document.querySelector('.header-profile-email');
        var menuEmail = document.querySelector('.header-profile-menu-email');
        if (email) email.textContent = session.email;
        if (menuEmail) menuEmail.textContent = session.email;
      }
    }
  } catch(e) {}

  /* ── Notification bell dropdown ───────────────────────── */
  function escapeNotificationHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureComplianceNotificationShell() {
    var bellBtn = document.getElementById('compliance-bell-btn');
    if (!bellBtn) {
      bellBtn = document.querySelector('.header-actions > .header-btn');
      if (bellBtn) bellBtn.id = 'compliance-bell-btn';
    }
    if (!bellBtn) return null;

    bellBtn.type = 'button';
    bellBtn.removeAttribute('onclick');
    bellBtn.setAttribute('aria-label', 'Notifications');
    bellBtn.setAttribute('aria-haspopup', 'menu');

    var badge = bellBtn.querySelector('.badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge';
      bellBtn.appendChild(badge);
    }

    var anchor = bellBtn.parentElement;
    if (!anchor || !anchor.classList.contains('compliance-notif-anchor')) {
      if (anchor && anchor.querySelector && anchor.querySelector('#compliance-notif-dropdown')) {
        anchor.classList.add('compliance-notif-anchor');
      } else {
        var nextAnchor = document.createElement('div');
        nextAnchor.className = 'compliance-notif-anchor';
        bellBtn.parentNode.insertBefore(nextAnchor, bellBtn);
        nextAnchor.appendChild(bellBtn);
        anchor = nextAnchor;
      }
    }

    var dropdown = document.getElementById('compliance-notif-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'compliance-notif-dropdown';
      anchor.appendChild(dropdown);
    } else if (dropdown.parentElement !== anchor) {
      anchor.appendChild(dropdown);
    }
    dropdown.removeAttribute('style');
    dropdown.className = 'notif-dropdown compliance-notif-dropdown';
    return { bellBtn: bellBtn, dropdown: dropdown };
  }

  try {
    window.FinStackStore.ready.then(function () {
      var shell = ensureComplianceNotificationShell();
      renderComplianceBellDropdown();

      if (shell && !shell.bellBtn.dataset.notifBound) {
        shell.bellBtn.dataset.notifBound = 'true';
        shell.bellBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          renderComplianceBellDropdown();
          var shouldOpen = !shell.dropdown.classList.contains('open');
          shell.dropdown.classList.toggle('open', shouldOpen);
          shell.bellBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        });
        shell.dropdown.addEventListener('click', function(e) { e.stopPropagation(); });
        document.addEventListener('click', function() {
          shell.dropdown.classList.remove('open');
          shell.bellBtn.setAttribute('aria-expanded', 'false');
        });
      }
    });
  } catch(e) {}

  function renderComplianceBellDropdown() {
    var shell = ensureComplianceNotificationShell();
    var bellBadge = shell ? shell.bellBtn.querySelector('.badge') : document.querySelector('#compliance-bell-btn .badge');
    var dropdown = shell ? shell.dropdown : document.getElementById('compliance-notif-dropdown');
    var notifications = window.FinStackStore.getNotifications() || [];
    var count = notifications.filter(function(n) { return n.unread; }).length;

    // Sync badge
    if (bellBadge) {
      if (count > 0) {
        bellBadge.textContent = count > 9 ? '9+' : String(count);
        bellBadge.style.display = 'flex';
      } else {
        bellBadge.style.display = 'none';
      }
    }

    if (!dropdown) return;

    var displayList = notifications.slice(0, 5);
    var itemsHtml = '';
    if (displayList.length === 0) {
      itemsHtml = '<div class="notif-dropdown-empty">No notifications</div>';
    } else {
      displayList.forEach(function(n) {
        var cls = 'notif-item' + (n.unread ? ' unread' : '');
        var unreadDot = n.unread ? '<span class="notif-unread-dot"></span>' : '';
        var timeStr = n.time || (window.FinStackStore.formatTimeAgo && n.createdAt ? window.FinStackStore.formatTimeAgo(n.createdAt) : 'Recently');
        itemsHtml +=
          '<div class="' + cls + '" data-notif-id="' + escapeNotificationHtml(n.id || '') + '">' +
            '<div class="notif-item-body">' +
              '<div class="notif-item-title">' +
                '<span>' + escapeNotificationHtml(n.title || 'Notification') + '</span>' + unreadDot +
              '</div>' +
              '<div class="notif-item-desc">' + escapeNotificationHtml(n.message || '') + '</div>' +
              '<div class="notif-item-time">' + escapeNotificationHtml(timeStr) + '</div>' +
            '</div>' +
          '</div>';
      });
    }

    var markAllBtn = '<button class="notif-mark-read" id="co-mark-all-read" type="button"' + (count ? '' : ' disabled') + '>Mark all as read</button>';

    dropdown.innerHTML =
      '<div class="notif-dropdown-header">' +
        '<div><h3>Notifications</h3></div>' +
        markAllBtn +
      '</div>' +
      '<div class="notif-list">' + itemsHtml + '</div>' +
      '<div class="notif-dropdown-footer">' +
        '<button class="notif-view-all" id="co-view-all-notifs" type="button">View All Notifications</button>' +
      '</div>';

    // Bind events
    var markBtn = document.getElementById('co-mark-all-read');
    if (markBtn) {
      markBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        window.FinStackStore.markAllNotificationsRead();
        renderComplianceBellDropdown();
      });
    }
    var viewAllBtn = document.getElementById('co-view-all-notifs');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof Router !== 'undefined') Router.navigate('communications');
        if (dropdown) dropdown.classList.remove('open');
        var bellBtn = document.getElementById('compliance-bell-btn');
        if (bellBtn) bellBtn.setAttribute('aria-expanded', 'false');
      });
    }
    dropdown.querySelectorAll('.notif-item[data-notif-id]').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        var nid = item.getAttribute('data-notif-id');
        if (nid) window.FinStackStore.markNotificationRead(nid);
        renderComplianceBellDropdown();
      });
    });
  }

  if (typeof window.applyProfilePreferences === 'function') {
    window.applyProfilePreferences();
  } else if (document.body) {
    document.body.classList.add('table-density-comfortable');
  }
  const currentPage = document.body?.dataset.page;
  const defaultPage = typeof window.getDefaultPage === 'function' ? window.getDefaultPage() : 'dashboard';
  const navEntry = window.performance?.getEntriesByType?.('navigation')?.[0];
  const isReload = navEntry?.type === 'reload';

  if (isReload && currentPage && defaultPage && currentPage !== defaultPage) {
    Router.navigate(defaultPage);
    return;
  }

  if (currentPage && typeof Router.init === 'function') {
    Router.init(currentPage);
  }
});

'use strict';

const PROFILE_PREFS_KEY = 'finstack-profile-settings-v2';

const defaultPreferences = {
  defaultPage: 'dashboard',
  currency: 'INR (\u20b9)',
  theme: 'Dark Mode',
  language: 'English (US)',
  timezone: 'Asia/Kolkata',
  emailAlerts: true,
  pushNotifications: true,
  weeklyDigest: true
};

let profilePreferences = loadProfilePreferences();

function getComplianceSession() {
  try {
    return JSON.parse(sessionStorage.getItem('finstackUserSession')) || null;
  } catch (_) {
    return null;
  }
}

function getComplianceUser() {
  if (!window.FinStackStore) return null;
  return window.FinStackStore.getCurrentUser() || null;
}

function getUserInitials(fullName) {
  return String(fullName || 'CO')
    .split(' ')
    .map(function(part) { return part.charAt(0); })
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getRoleLabel(user) {
  if (!user || !Array.isArray(user.roles) || !user.roles[0]) return 'Compliance Officer';
  return window.FinStackStore && typeof window.FinStackStore.titleCase === 'function'
    ? window.FinStackStore.titleCase(user.roles[0])
    : 'Compliance Officer';
}

function updateComplianceHeader(profile) {
  if (!profile) return;

  const initials = getUserInitials(profile.fullName);
  document.querySelectorAll('.header-profile-avatar').forEach(function(node) {
    node.textContent = initials;
  });
  document.querySelectorAll('.header-profile-name, .header-profile-menu-name').forEach(function(node) {
    node.textContent = profile.fullName || 'Compliance Officer';
  });
  document.querySelectorAll('.header-profile-email, .header-profile-menu-email').forEach(function(node) {
    node.textContent = profile.email || 'No email available';
  });
}

function updateComplianceProfileSummary(user) {
  if (!user) return;

  const session = getComplianceSession();
  const lastLogin = session && session.loginAt
    ? new Date(session.loginAt).toLocaleString()
    : 'Current session';
  const roleLabel = getRoleLabel(user);
  const statusLabel = user.status || 'Active';

  document.querySelectorAll('[data-profile-avatar]').forEach(function(node) {
    node.textContent = getUserInitials(user.fullName);
  });
  document.querySelectorAll('[data-profile-name]').forEach(function(node) {
    node.textContent = user.fullName || 'Compliance Officer';
  });
  document.querySelectorAll('[data-profile-email]').forEach(function(node) {
    node.textContent = user.email || 'No email on file';
  });
  document.querySelectorAll('[data-profile-role]').forEach(function(node) {
    node.textContent = roleLabel;
  });
  document.querySelectorAll('[data-profile-status]').forEach(function(node) {
    node.textContent = statusLabel;
  });
  document.querySelectorAll('[data-profile-employee-id]').forEach(function(node) {
    node.textContent = user.employeeId || '-';
  });
  document.querySelectorAll('[data-profile-org-id]').forEach(function(node) {
    node.textContent = user.organizationId || '-';
  });
  document.querySelectorAll('[data-profile-manager-id]').forEach(function(node) {
    node.textContent = user.managerEmployeeId || 'Not assigned';
  });
  document.querySelectorAll('[data-profile-last-login]').forEach(function(node) {
    node.textContent = lastLogin;
  });

  updateComplianceHeader(user);
}

function populateComplianceProfileFields() {
  const user = getComplianceUser();
  if (!user) return;

  const fieldMap = {
    'full-name': user.fullName || '',
    'email-address': user.email || '',
    'employee-id': user.employeeId || '',
    'department': user.department || '',
    'phone-number': user.phone || '',
    'location': user.location || '',
    'organization-id': user.organizationId || '',
    'manager-id': user.managerEmployeeId || ''
  };

  Object.keys(fieldMap).forEach(function(id) {
    const field = document.getElementById(id);
    if (field) field.value = fieldMap[id];
  });

  updateComplianceProfileSummary(user);
}

function loadProfilePreferences() {
  try {
    const stored = window.localStorage.getItem(PROFILE_PREFS_KEY);
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : { ...defaultPreferences };
  } catch (_) {
    return { ...defaultPreferences };
  }
}

function saveProfilePreferences() {
  try {
    window.localStorage.setItem(PROFILE_PREFS_KEY, JSON.stringify(profilePreferences));
  } catch (_) {
    // Ignore localStorage failures.
  }
}

function syncPreferenceFields() {
  const currency = document.getElementById('default-currency');
  const theme = document.getElementById('interface-theme');
  const defaultLandingPage = document.getElementById('default-landing-page');
  const language = document.getElementById('preference-language');
  const timezone = document.getElementById('preference-timezone');
  const emailAlerts = document.getElementById('notif-email');
  const pushNotifications = document.getElementById('notif-push');
  const weeklyDigest = document.getElementById('notif-weekly-digest');

  if (currency) currency.value = profilePreferences.currency;
  if (theme) theme.value = profilePreferences.theme;
  if (defaultLandingPage) defaultLandingPage.value = profilePreferences.defaultPage;
  if (language) language.value = profilePreferences.language;
  if (timezone) timezone.value = profilePreferences.timezone;
  if (emailAlerts) emailAlerts.checked = profilePreferences.emailAlerts;
  if (pushNotifications) pushNotifications.checked = profilePreferences.pushNotifications;
  if (weeklyDigest) weeklyDigest.checked = profilePreferences.weeklyDigest;
}

function applyThemePreference() {
  document.body.classList.toggle('light-mode', profilePreferences.theme === 'Light Mode');
}

function bindProfileForms() {
  const personalInfoForm = document.getElementById('personal-info-form');
  const passwordForm = document.getElementById('password-form');
  const savePreferencesBtn = document.getElementById('save-preferences-btn');

  personalInfoForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = getComplianceUser();
    if (!user || !window.FinStackStore) {
      Toast.error('Profile data is still loading. Please try again.');
      return;
    }

    const updates = {
      fullName: document.getElementById('full-name')?.value.trim() || user.fullName,
      email: document.getElementById('email-address')?.value.trim() || user.email,
      department: document.getElementById('department')?.value.trim(),
      phone: document.getElementById('phone-number')?.value.trim(),
      location: document.getElementById('location')?.value.trim(),
      managerEmployeeId: document.getElementById('manager-id')?.value.trim()
    };

    const result = window.FinStackStore.updateUser(user.employeeId, updates);
    if (result && result.success === false) {
      Toast.error(result.error || 'Unable to update profile.');
      return;
    }

    updateComplianceProfileSummary(result || user);
    populateComplianceProfileFields();
    Toast.success('Personal information updated.');
  });

  savePreferencesBtn?.addEventListener('click', () => {
    profilePreferences.currency = document.getElementById('default-currency')?.value || defaultPreferences.currency;
    profilePreferences.theme = document.getElementById('interface-theme')?.value || defaultPreferences.theme;
    profilePreferences.defaultPage = document.getElementById('default-landing-page')?.value || defaultPreferences.defaultPage;
    profilePreferences.language = document.getElementById('preference-language')?.value || defaultPreferences.language;
    profilePreferences.timezone = document.getElementById('preference-timezone')?.value || defaultPreferences.timezone;
    profilePreferences.emailAlerts = !!document.getElementById('notif-email')?.checked;
    profilePreferences.pushNotifications = !!document.getElementById('notif-push')?.checked;
    profilePreferences.weeklyDigest = !!document.getElementById('notif-weekly-digest')?.checked;
    saveProfilePreferences();
    applyThemePreference();
    Toast.success('Preferences saved.');
  });

  passwordForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = getComplianceUser();
    if (!user || !window.FinStackStore) {
      Toast.error('Profile data is still loading. Please try again.');
      return;
    }

    const currentPassword = document.getElementById('current-password')?.value || '';
    const newPassword = document.getElementById('new-password')?.value || '';
    const confirmPassword = document.getElementById('confirm-password')?.value || '';

    if (!currentPassword) {
      Toast.error('Current password is required.');
      return;
    }

    if (newPassword.length < 8) {
      Toast.error('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Toast.error('New password and confirm password must match.');
      return;
    }

    const result = window.FinStackStore.changePassword(user.employeeId, currentPassword, newPassword);
    if (!result || result.success === false) {
      Toast.error(result && result.error ? result.error : 'Unable to update password.');
      return;
    }

    Toast.success('Password updated successfully.');
    passwordForm.reset();
  });
}

window.applyProfilePreferences = function() {
  applyThemePreference();
};

window.getDefaultPage = function() {
  return document.body?.dataset.page || profilePreferences.defaultPage || 'dashboard';
};

window.initProfile = function() {
  const initialize = function() {
    populateComplianceProfileFields();
    syncPreferenceFields();
    applyThemePreference();
    bindProfileForms();
  };

  if (window.FinStackStore && window.FinStackStore.ready) {
    window.FinStackStore.ready.then(initialize);
    return;
  }

  initialize();
};
/* ============================================================
   dashboard.js – Dashboard page: KPIs + Charts
   ============================================================ */

'use strict';

function getThemeValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '').trim();
  if (value.length !== 6) return hex;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDashboardChartTheme() {
  const accent = getThemeValue('--accent') || '#22d3ee';
  const primary = getThemeValue('--primary') || '#7c3aed';
  const secondaryAccent = getThemeValue('--secondary-accent') || '#ec4899';
  const yellow = getThemeValue('--yellow') || '#f59e0b';
  const red = getThemeValue('--red') || '#ef4444';
  const surface = getThemeValue('--bg-card-solid') || '#111827';
  const border = getThemeValue('--border-base') || '#1f2937';
  const textSecondary = getThemeValue('--text-secondary') || '#9ca3af';
  const textMuted = getThemeValue('--text-muted') || '#6b7280';

  return {
    accent,
    primary,
    secondaryAccent,
    yellow,
    red,
    surface,
    border,
    textSecondary,
    textMuted,
  };
}

function initDashboard() {
  renderPolicyActivityChart();
  renderAnomalyDetectionChart();
  renderAuditPreview();
  renderPolicyPreview();
  renderNotificationsPreview();

  // Populate live KPIs from FinStackStore
  if (window.FinStackStore && window.FinStackStore.ready) {
    window.FinStackStore.ready.then(function() {
      var expenses   = window.FinStackStore.getExpenses ? window.FinStackStore.getExpenses() : [];
      var policies   = window.FinStackStore.getPolicies ? window.FinStackStore.getPolicies() : [];
      var auditLogs  = window.FinStackStore.getAuditLogs ? window.FinStackStore.getAuditLogs() : [];
      var notifications = window.FinStackStore.getNotifications ? window.FinStackStore.getNotifications() : [];

      var complianceQueue = expenses.filter(function(e) { return e.workflowStatus === 'compliance_review'; });
      var unreadAlerts    = notifications.filter(function(n) { return n.unread; });

      var elPolicies  = document.getElementById('kpi-policies');
      var elAnomalies = document.getElementById('kpi-anomalies');
      var elPending   = document.getElementById('kpi-pending');
      var elAlerts    = document.getElementById('kpi-alerts');

      if (elPolicies)  elPolicies.textContent  = String(policies.length);
      if (elAnomalies) elAnomalies.textContent = String(complianceQueue.length);
      if (elPending)   elPending.textContent   = String(complianceQueue.length);
      if (elAlerts)    elAlerts.textContent    = String(unreadAlerts.length);
    });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAuditPreview() {
  const tbody = document.getElementById('dashboard-audit-preview');
  if (!tbody) return;

  if (window.FinStackStore && window.FinStackStore.ready) {
    window.FinStackStore.ready.then(() => {
      const logs = window.FinStackStore.getAuditLogs().slice(0, 4);
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Audit preview unavailable</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map((log) => `
        <tr style="cursor:pointer;" onclick="Router.navigate('audit')" title="Open audit logs">
          <td style="color:var(--text-secondary);">${escapeHtml(formatAuditPreviewTime(log.timestamp))}</td>
          <td style="color:var(--text-primary);">${escapeHtml(formatAuditPreviewAction(log))}</td>
          <td style="color:var(--text-secondary);">${escapeHtml(log.userRole || log.user || 'System')}</td>
          <td>${getDashboardResultBadge(log.status)}</td>
        </tr>
      `).join('');
    });
  }
}

function formatAuditPreviewTime(timestamp) {
  const value = String(timestamp || '');
  const datePart = value.split(' ')[0];
  const timePart = value.split(' ')[1]?.slice(0, 5) || '';

  if (datePart === '2024-03-24' && timePart) {
    return formatTwentyFourHourTime(timePart);
  }
  if (datePart === '2024-03-23') return 'Yesterday';
  return datePart || value;
}

function formatTwentyFourHourTime(value) {
  const [hourText, minute] = String(value).split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour) || !minute) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${minute} ${suffix}`;
}

function formatAuditPreviewAction(log) {
  const entity = log.entityType === 'Policy' ? (log.entityName || 'Policy') : (log.entityType || 'Record');
  return `${entity} ${log.action}`.trim();
}

function getDashboardResultBadge(status) {
  const normalized = String(status || 'Pending');
  const badgeClass = normalized === 'Success'
    ? 'badge-green'
    : normalized === 'Failed'
      ? 'badge-red'
      : 'badge-cyan';
  return `<span class="badge ${badgeClass}">${escapeHtml(normalized)}</span>`;
}

function renderPolicyPreview() {
  const container = document.getElementById('dashboard-policy-preview');
  if (!container) return;

  if (window.FinStackStore && window.FinStackStore.ready) {
    window.FinStackStore.ready.then(() => {
      const policies = window.FinStackStore.getPolicies().filter((policy) => !policy.isActive).slice(0, 2);

      if (!policies.length) {
        container.innerHTML = '<div class="list-item"><div style="color:var(--text-secondary);font-size:.9rem;">No policies currently need revision.</div></div>';
        return;
      }

      container.innerHTML = policies.map((policy) => `
        <div class="list-item" style="cursor:pointer;" onclick="openPolicyPreview('${policy.id}')" title="Open in policies">
          <div class="list-item-icon dashboard-list-icon-warning">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="color:var(--text-primary);font-weight:600;margin-bottom:4px;">${escapeHtml(policy.name)}</div>
            <div style="color:var(--text-secondary);font-size:.85rem;">${escapeHtml(policy.description || 'Draft policy awaiting review.')}</div>
          </div>
          <span class="badge badge-yellow">Draft</span>
        </div>
      `).join('');
    });
  }
}

function renderNotificationsPreview() {
  const container = document.getElementById('dashboard-notification-preview');
  if (!container) return;

  if (window.FinStackStore && window.FinStackStore.ready) {
    window.FinStackStore.ready.then(() => {
      const user = window.FinStackStore.getCurrentUser();
      const notifications = user ? window.FinStackStore.getNotifications(user.employeeId).slice(0, 2) : [];
      if (!notifications.length) {
        container.innerHTML = '<div class="list-item"><div style="color:var(--text-secondary);font-size:.9rem;">No notifications available.</div></div>';
        return;
      }

      container.innerHTML = notifications.map((item) => `
        <div class="list-item" style="cursor:pointer;" onclick="openNotificationPreview('${escapeHtml(item.id)}')" title="Open notifications">
          <div class="list-item-icon ${getNotificationPreviewIconClass(item.type)}">
            ${getNotificationPreviewIcon(item.type)}
          </div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:.95rem;color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(item.title)}
            </p>
            <p style="font-size:.78rem;color:var(--text-muted);margin-top:4px;">${escapeHtml(new Date(item.createdAt).toLocaleDateString())}</p>
          </div>
          <span class="badge ${getNotificationPreviewBadgeClass(item)}" style="flex-shrink:0;">${escapeHtml(getNotificationPreviewBadgeLabel(item))}</span>
        </div>
      `).join('');
    });
  }
}

function getNotificationPreviewBadgeClass(item) {
  if (item.unread) return 'badge-cyan';
  if (item.type === 'danger') return 'badge-rose';
  if (item.type === 'warning') return 'badge-yellow';
  if (item.type === 'success') return 'badge-green';
  return 'badge-slate';
}

function getNotificationPreviewBadgeLabel(item) {
  if (item.unread) return 'Unread';
  if (item.type === 'danger') return 'High Risk';
  if (item.type === 'warning') return 'Pending';
  if (item.type === 'success') return 'Approved';
  return 'Info';
}

function getNotificationPreviewIconClass(status) {
  if (status === 'danger') return 'dashboard-list-icon-critical';
  if (status === 'warning') return 'dashboard-list-icon-warning';
  return 'dashboard-list-icon-info';
}

function getNotificationPreviewIcon(status) {
  if (status === 'warning') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>`;
  }
  if (status === 'success') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6 9 17l-5-5" />
      </svg>`;
  }
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m10.29 3.86-7.58 13.13A2 2 0 0 0 4.42 20h15.16a2 2 0 0 0 1.73-3.01L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
}

window.openPolicyPreview = function (id) {
  if (!id) return;
  window.sessionStorage.setItem('finstack-pending-policy-highlight', String(id));
  window.sessionStorage.setItem('finstack-pending-policy-open', 'true');
  Router.navigate('policies');
};

window.openNotificationPreview = function () {
  Router.navigate('communications');
};

function renderPolicyActivityChart() {
  const ctx = document.getElementById('policyActivityChart');
  if (!ctx) return;
  const theme = getDashboardChartTheme();
  const host = ctx.parentElement;
  if (!host) return;

  const series = [
    { label: 'Created', color: theme.accent, values: [4, 3, 5, 6, 4, 7] },
    { label: 'Updated', color: theme.primary, values: [2, 5, 3, 4, 6, 5] },
    { label: 'Activated', color: theme.secondaryAccent, values: [3, 2, 4, 5, 3, 6] },
  ];
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const max = Math.max.apply(null, series.reduce((all, item) => all.concat(item.values), []));

  host.innerHTML = `
    <div style="height:100%;display:flex;flex-direction:column;gap:14px;">
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${series.map((item) => `<span style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:${theme.textSecondary};"><span style="width:10px;height:10px;border-radius:999px;background:${item.color};display:inline-block;"></span>${item.label}</span>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;align-items:end;height:100%;">
        ${labels.map((label, index) => {
          return `<div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:10px;">
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:5px;height:180px;">
              ${series.map((item) => {
                const height = Math.max(16, Math.round((item.values[index] / max) * 100));
                return `<span style="width:14px;height:${height}%;min-height:16px;border-radius:999px;background:${item.color};display:inline-block;"></span>`;
              }).join('')}
            </div>
            <span style="text-align:center;font-size:12px;color:${theme.textMuted};">${label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderAnomalyDetectionChart() {
  const ctx = document.getElementById('anomalyDetectionChart');
  if (!ctx) return;
  const theme = getDashboardChartTheme();
  const host = ctx.parentElement;
  if (!host) return;

  const values = [2, 4, 3, 5, 7, 3];
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const max = Math.max.apply(null, values);

  host.innerHTML = `
    <div style="height:100%;display:flex;flex-direction:column;gap:14px;">
      <div style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:${theme.textSecondary};">
        <span style="width:10px;height:10px;border-radius:999px;background:${theme.red};display:inline-block;"></span>
        Violations Flagged
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;align-items:end;height:100%;">
        ${labels.map((label, index) => {
          const height = Math.max(18, Math.round((values[index] / max) * 100));
          return `<div style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:10px;">
            <div style="font-size:11px;color:${theme.textSecondary};">${values[index]}</div>
            <div style="width:32px;height:${height}%;min-height:18px;border-radius:12px 12px 6px 6px;background:${hexToRgba(theme.red, 0.78)};"></div>
            <span style="font-size:12px;color:${theme.textMuted};">${label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

window.initDashboard = initDashboard;
