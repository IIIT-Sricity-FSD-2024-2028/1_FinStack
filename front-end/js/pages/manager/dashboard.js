/* ================================================
   icons.js — Inline SVG Icon Library
   ================================================
   Lucide-compatible SVGs used across sidebar,
   topnav, and page components.
   ================================================ */

/**
 * Creates an SVG markup string from path data.
 * All icons use a 24×24 viewBox, stroke-based.
 */
function _icon(pathData, size) {
  size = size || 20;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + pathData + '</svg>';
}

// Global namespace
var FinStack = window.FinStack || {};

FinStack.icons = {
  // Navigation
  layoutDashboard: function(s) { return _icon('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/>', s); },
  fileSearch:      function(s) { return _icon('<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="m9 18-1.5-1.5"/><circle cx="5" cy="14" r="3"/>', s); },
  history:         function(s) { return _icon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>', s); },
  bell:            function(s) { return _icon('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', s); },
  userCog:         function(s) { return _icon('<circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m21.7 16.4-.9-.3"/><path d="m15.2 13.9-.9-.3"/><path d="m16.6 18.7.3-.9"/><path d="m19.1 12.2.3-.9"/><path d="m19.6 18.7-.4-1"/><path d="m16.8 12.3-.4-1"/><path d="m14.3 16.6 1-.4"/><path d="m20.7 13.8 1-.4"/>', s); },
  logOut:          function(s) { return _icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>', s); },

  // Top nav
  search:      function(s) { return _icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', s); },
  chevronDown: function(s) { return _icon('<path d="m6 9 6 6 6-6"/>', s); },
  chevronUp:   function(s) { return _icon('<path d="m18 15-6-6-6 6"/>', s); },
  check:       function(s) { return _icon('<path d="M20 6 9 17l-5-5"/>', s); },
  x:           function(s) { return _icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', s); },
  clock:       function(s) { return _icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', s); },

  // Sidebar toggle
  panelLeftClose: function(s) { return _icon('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>', s); },
  panelLeftOpen:  function(s) { return _icon('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>', s); },

  // Common
  alertTriangle: function(s) { return _icon('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', s); },
  checkCircle:   function(s) { return _icon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>', s); },
  xCircle:       function(s) { return _icon('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>', s); },
  eye:           function(s) { return _icon('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>', s); },
  eyeOff:        function(s) { return _icon('<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>', s); },
  fileText:      function(s) { return _icon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>', s); },
  user:          function(s) { return _icon('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', s); },
  shield:        function(s) { return _icon('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>', s); },
  shieldCheck:   function(s) { return _icon('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>', s); },
  tag:           function(s) { return _icon('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>', s); },
  download:      function(s) { return _icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>', s); },
  send:          function(s) { return _icon('<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>', s); },
  copy:          function(s) { return _icon('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', s); },
  trendingUp:    function(s) { return _icon('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>', s); },
  trendingDown:  function(s) { return _icon('<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>', s); },
  dollarSign:    function(s) { return _icon('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', s); },
  receipt:       function(s) { return _icon('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>', s); },
  arrowRight:    function(s) { return _icon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', s); },
  arrowLeft:     function(s) { return _icon('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', s); },
  edit2:         function(s) { return _icon('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>', s); },
  save:          function(s) { return _icon('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>', s); },
  mail:          function(s) { return _icon('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', s); },
  lock:          function(s) { return _icon('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', s); },
  briefcase:     function(s) { return _icon('<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>', s); },
  building2:     function(s) { return _icon('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>', s); },
  globe:         function(s) { return _icon('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>', s); },
  settings:      function(s) { return _icon('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', s); },
  users:         function(s) { return _icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', s); },
  messageSquare: function(s) { return _icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', s); },
  trash2:        function(s) { return _icon('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', s); },
  filter:        function(s) { return _icon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', s); },
  plus:          function(s) { return _icon('<path d="M5 12h14"/><path d="M12 5v14"/>', s); },
  minus:         function(s) { return _icon('<path d="M5 12h14"/>', s); },
  info:          function(s) { return _icon('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', s); },
};

window.FinStack = FinStack;
/* ================================================
   sidebar.js — Sidebar Navigation Component
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;
  var STORAGE_KEY = 'finstackManagerSidebarCollapsed';

  // ── State ──────────────────────────────────────
  var isCollapsed = false;
  var activeView  = 'dashboard';

  // ── Navigation Items ───────────────────────────
  var navItems = [
    { id: 'dashboard',        label: 'Dashboard',          icon: 'layoutDashboard' },
    { id: 'review-expenses',  label: 'Review Expenses',    icon: 'fileSearch'      },
    { id: 'approval-history', label: 'Approval History',   icon: 'history'         },
    { id: 'notifications',    label: 'Notifications',      icon: 'bell'            },
    { id: 'profile-settings', label: 'Profile & Settings', icon: 'userCog'         },
  ];


  // ── Build HTML ─────────────────────────────────

  function buildSidebarHTML() {
    var toggleIcon = isCollapsed
      ? icons.panelLeftOpen(18)
      : icons.panelLeftClose(18);

    var navLinksHTML = '';
    for (var i = 0; i < navItems.length; i++) {
      var item = navItems[i];
      var cls = 'nav-link' + (item.id === activeView ? ' active' : '');
      navLinksHTML +=
        '<li class="nav-item">' +
          '<button class="' + cls + '" data-view="' + item.id + '" type="button">' +
            '<span class="nav-icon">' + icons[item.icon](20) + '</span>' +
            '<span class="nav-label">' + item.label + '</span>' +
          '</button>' +
        '</li>';
    }

    return '' +
      '<!-- Logo -->' +
      '<div class="sidebar-logo">' +
        '<div class="logo-group">' +
          '<div class="logo-icon"><span>F</span></div>' +
          '<span class="logo-text">FinStack</span>' +
        '</div>' +
        '<button class="sidebar-toggle" id="sidebar-toggle" type="button" title="Toggle sidebar">' +
          toggleIcon +
        '</button>' +
      '</div>' +

      '<!-- Navigation -->' +
      '<nav class="sidebar-nav" aria-label="Main navigation">' +
        '<ul class="nav-list">' +
          navLinksHTML +
        '</ul>' +
      '</nav>' +

      '<!-- Footer -->' +
      '<div class="sidebar-footer">' +
        '<button class="logout-btn" id="logout-btn" type="button">' +
          '<span class="nav-icon">' + icons.logOut(20) + '</span>' +
          '<span class="logout-label">Logout</span>' +
        '</button>' +
      '</div>';
  }


  // ── Event Binding ──────────────────────────────

  function bindSidebarEvents(el, onNavigate) {
    function syncSidebarState() {
      el.classList.toggle('collapsed', isCollapsed);
      if (toggleBtn) {
        toggleBtn.innerHTML = isCollapsed
          ? icons.panelLeftOpen(18)
          : icons.panelLeftClose(18);
        toggleBtn.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
        toggleBtn.setAttribute('title', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
        toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
      }

      var labels = el.querySelectorAll('.nav-link');
      for (var j = 0; j < labels.length; j++) {
        var navLabel = labels[j].querySelector('.nav-label');
        if (navLabel) {
          labels[j].setAttribute('aria-label', navLabel.textContent.trim());
          labels[j].setAttribute('title', navLabel.textContent.trim());
        }
      }

      var logoutLabel = el.querySelector('.logout-label');
      var logoutBtnEl = el.querySelector('#logout-btn');
      if (logoutBtnEl && logoutLabel) {
        logoutBtnEl.setAttribute('aria-label', logoutLabel.textContent.trim());
        logoutBtnEl.setAttribute('title', logoutLabel.textContent.trim());
      }
    }

    // Collapse / Expand toggle
    var toggleBtn = el.querySelector('#sidebar-toggle');
    isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    syncSidebarState();

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        isCollapsed = !isCollapsed;
        localStorage.setItem(STORAGE_KEY, String(isCollapsed));
        syncSidebarState();
      });
    }

    // Nav item clicks
    var links = el.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      (function(link) {
        link.addEventListener('click', function() {
          var viewId = link.getAttribute('data-view');
          if (viewId && viewId !== activeView) {
            FinStack.sidebar.setActiveView(viewId);
            onNavigate(viewId);
          }
        });
      })(links[i]);
    }

    // Logout button
    var logoutBtn = el.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        performLogout();
      });
    }
  }

  function performLogout() {
    sessionStorage.removeItem('finstackUserSession');
    localStorage.removeItem('finstackUserSession');
    window.location.href = '../../login.html?role=manager';
  }


  // ── Public API ─────────────────────────────────

  FinStack.sidebar = {

    /**
     * Renders the sidebar into the #sidebar element.
     * @param {function} onNavigate — callback(viewId)
     */
    render: function(onNavigate) {
      var el = document.getElementById('sidebar');
      if (!el) return;
      el.innerHTML = buildSidebarHTML();
      bindSidebarEvents(el, onNavigate);
    },

    /**
     * Updates the active nav item highlight.
     * @param {string} viewId
     */
    setActiveView: function(viewId) {
      activeView = viewId;
      var links = document.querySelectorAll('.nav-link');
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (link.getAttribute('data-view') === viewId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    },

    /** Returns whether the sidebar is collapsed. */
    isCollapsed: function() {
      return isCollapsed;
    },

    /** Exposes direct logout for reuse by topnav. */
    performLogout: performLogout
  };

})();
/* ================================================
   topnav.js — Top Navigation Bar Component
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;

  // ── State ──────────────────────────────────────
  var notifOpen   = false;
  var profileOpen = false;

  // ── Session helpers ────────────────────────────
  function _getSession() {
    try { return JSON.parse(sessionStorage.getItem('finstackUserSession')) || {}; } catch(e) { return {}; }
  }
  function _getUserName() {
    return _getSession().fullName || 'Manager';
  }
  function _getUserInitials() {
    var name = _getUserName();
    return name.split(' ').map(function(n){ return n.charAt(0); }).join('').slice(0,2).toUpperCase();
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var latestNavigate = null;

  function normalizeNotificationType(type) {
    if (type === 'danger' || type === 'high-risk') return 'high-risk';
    if (type === 'success' || type === 'approved') return 'approved';
    if (type === 'rejected') return 'rejected';
    if (type === 'warning' || type === 'pending') return 'pending';
    return 'info';
  }

  function getDropdownNotifications() {
    if (!window.FinStackStore || typeof window.FinStackStore.getNotifications !== 'function') return [];
    var list = [];
    try {
      list = window.FinStackStore.getNotifications() || [];
    } catch (e) {
      list = [];
    }
    return list.map(function(n) {
      return {
        id: n.id,
        type: normalizeNotificationType(n.type),
        title: n.title || 'Notification',
        desc: n.message || '',
        time: n.time || (n.createdAt && window.FinStackStore.formatTimeAgo ? window.FinStackStore.formatTimeAgo(n.createdAt) : 'Recently'),
        unread: n.unread !== false
      };
    });
  }

  function getUnreadCount() {
    return getDropdownNotifications().filter(function(n) { return n.unread; }).length;
  }


  // ── Helpers ────────────────────────────────────

  function getNotifIconName(type) {
    switch (type) {
      case 'high-risk': return 'alertTriangle';
      case 'pending':   return 'clock';
      case 'approved':  return 'checkCircle';
      case 'rejected':  return 'xCircle';
      default:          return 'bell';
    }
  }

  function getNotifColors(type) {
    switch (type) {
      case 'high-risk': return { icon: 'var(--danger)',  bg: 'var(--danger-t2)'  };
      case 'pending':   return { icon: 'var(--warning)', bg: 'var(--warning-t2)' };
      case 'approved':  return { icon: 'var(--success)', bg: 'var(--success-t2)' };
      case 'rejected':  return { icon: 'var(--danger)',  bg: 'var(--danger-t2)'  };
      default:          return { icon: 'var(--text-muted)', bg: 'var(--border)'  };
    }
  }


  // ── Build Notification Dropdown HTML ────────────

  function buildNotifDropdownHTML() {
    var dropdownNotifications = getDropdownNotifications();
    var unreadCount = getUnreadCount();

    var listHTML = '';
    for (var j = 0; j < Math.min(dropdownNotifications.length, 5); j++) {
      var n = dropdownNotifications[j];
      var iconName = getNotifIconName(n.type);
      var colors   = getNotifColors(n.type);
      var cls = 'notif-item';
      if (n.unread) cls += ' unread';
      if (n.type === 'high-risk') cls += ' priority-high';

      listHTML +=
        '<div class="' + cls + '" data-notif-id="' + escHtml(n.id) + '">' +
          '<div class="notif-item-icon" style="background-color:' + colors.bg + ';">' +
            '<span style="color:' + colors.icon + ';">' + icons[iconName](16) + '</span>' +
          '</div>' +
          '<div class="notif-item-body">' +
            '<div class="notif-item-title">' +
              '<span>' + escHtml(n.title) + '</span>' +
              (n.unread ? '<span class="notif-unread-dot"></span>' : '') +
            '</div>' +
            '<div class="notif-item-desc">' + escHtml(n.desc) + '</div>' +
            '<div class="notif-item-time">' +
              icons.clock(11) + ' ' + escHtml(n.time) +
            '</div>' +
          '</div>' +
        '</div>';
    }
    if (!listHTML) {
      listHTML = '<div class="notif-dropdown-empty">No notifications</div>';
    }

    var markAllBtn =
      '<button class="notif-mark-read" id="mark-all-read" type="button"' + (unreadCount ? '' : ' disabled') + '>' +
          icons.check(14) + ' Mark all read' +
        '</button>';

    return '' +
      '<div class="notif-dropdown-header">' +
        '<div>' +
          '<h3>Notifications</h3>' +
          '<p>' + unreadCount + ' unread</p>' +
        '</div>' +
        markAllBtn +
      '</div>' +
      '<div class="notif-list">' +
        listHTML +
      '</div>' +
      '<div class="notif-dropdown-footer">' +
        '<button class="notif-view-all" id="view-all-notifs" type="button">View All Notifications</button>' +
      '</div>';
  }


  // ── Build Top Nav HTML ─────────────────────────

  function buildTopNavHTML() {
    var unreadCount = getUnreadCount();

    return '' +
      '<!-- Left -->' +
      '<div class="tn-left">' +
        '<span class="workspace-name">FinStack Workspace</span>' +
      '</div>' +

      '<!-- Center — Search -->' +
      '<div class="tn-center">' +
        '<div class="search-wrapper">' +
          '<span class="search-icon">' + icons.search(18) + '</span>' +
          '<input type="text" class="search-input" id="global-search" ' +
            'placeholder="Search expenses, employees..." autocomplete="off" />' +
        '</div>' +
      '</div>' +

      '<!-- Right -->' +
      '<div class="tn-right">' +

        '<!-- Notification Bell -->' +
        '<div style="position:relative;">' +
          '<button class="notif-btn" id="notif-toggle" type="button" title="Notifications">' +
            icons.bell(20) +
            (unreadCount > 0 ? '<span class="notif-dot">' + (unreadCount > 9 ? '9+' : unreadCount) + '</span>' : '') +
          '</button>' +
          '<div class="notif-dropdown" id="notif-dropdown">' +
            buildNotifDropdownHTML() +
          '</div>' +
        '</div>' +

        '<!-- User Profile -->' +
        '<div style="position:relative;">' +
          '<button class="user-profile-btn" id="profile-toggle" type="button">' +
            '<div class="user-avatar" id="tn-avatar">' + _getUserInitials() + '</div>' +
            '<div class="user-info">' +
              '<div class="user-name" style="font-weight:var(--fw-bold);">' + _getUserName() + '</div>' +
              '<div class="user-email">Manager</div>' +
            '</div>' +
            '<span class="user-chevron">' + icons.chevronDown(16) + '</span>' +
          '</button>' +
          '<div class="profile-dropdown" id="profile-dropdown">' +
            '<div class="profile-dropdown-header">' +
              '<div class="pd-name" style="font-weight:var(--fw-bold);">' + _getUserName() + '</div>' +
              '<div class="pd-email">Manager</div>' +
            '</div>' +
            '<div class="profile-dropdown-menu">' +
              '<button class="pd-item" data-action="profile-settings" type="button">Profile Settings</button>' +
              '<button class="pd-item" data-action="preferences" type="button">Preferences</button>' +
              '<div class="pd-divider"></div>' +
              '<button class="pd-item danger" data-action="logout" type="button">Logout</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>';
  }


  // ── Dropdown Helpers ───────────────────────────

  function closeNotifDropdown() {
    notifOpen = false;
    var dd = document.getElementById('notif-dropdown');
    if (dd) dd.classList.remove('open');
  }

  function closeProfileDropdown() {
    profileOpen = false;
    var dd = document.getElementById('profile-dropdown');
    if (dd) dd.classList.remove('open');
  }

  function refreshNotifDropdown(onNavigate) {
    var dd = document.getElementById('notif-dropdown');
    if (!dd) return;
    dd.innerHTML = buildNotifDropdownHTML();
    bindNotifDropdownEvents(dd, onNavigate);
  }

  function syncNotifBadge() {
    var toggle = document.getElementById('notif-toggle');
    if (!toggle) return;
    var unreadCount = getUnreadCount();
    var dot = toggle.querySelector('.notif-dot');
    if (!dot && unreadCount > 0) {
      dot = document.createElement('span');
      dot.className = 'notif-dot';
      toggle.appendChild(dot);
    }
    if (dot) {
      dot.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      dot.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
  }

  function bindNotifDropdownEvents(dd, onNavigate) {
    // Mark all read
    var markBtn = dd.querySelector('#mark-all-read');
    if (markBtn) {
      markBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.FinStackStore) window.FinStackStore.markAllNotificationsRead();
        refreshNotifDropdown(onNavigate);
        syncNotifBadge();
      });
    }

    // View all
    var viewAllBtn = dd.querySelector('#view-all-notifs');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeNotifDropdown();
        onNavigate('notifications');
      });
    }

    // Individual items
    var items = dd.querySelectorAll('.notif-item');
    for (var i = 0; i < items.length; i++) {
      (function(item) {
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = item.getAttribute('data-notif-id');
          if (id && window.FinStackStore) window.FinStackStore.markNotificationRead(id);
          refreshNotifDropdown(onNavigate);
          syncNotifBadge();
        });
      })(items[i]);
    }
  }


  // ── Event Binding ──────────────────────────────

  function bindTopNavEvents(el, onNavigate) {

    // Notification toggle
    var notifToggle   = el.querySelector('#notif-toggle');
    var notifDropdown = el.querySelector('#notif-dropdown');

    if (notifToggle) {
      notifToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        notifOpen = !notifOpen;
        notifDropdown.classList.toggle('open', notifOpen);
        if (notifOpen) closeProfileDropdown();
      });
    }

    // Bind inner notif dropdown events
    if (notifDropdown) {
      bindNotifDropdownEvents(notifDropdown, onNavigate);
    }

    // Stop propagation on dropdown itself
    if (notifDropdown) {
      notifDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    // Profile toggle
    var profileToggle   = el.querySelector('#profile-toggle');
    var profileDropdown = el.querySelector('#profile-dropdown');

    if (profileToggle) {
      profileToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        profileOpen = !profileOpen;
        profileDropdown.classList.toggle('open', profileOpen);
        if (profileOpen) closeNotifDropdown();
      });
    }

    // Profile dropdown items
    var pdItems = el.querySelectorAll('.pd-item');
    for (var i = 0; i < pdItems.length; i++) {
      (function(item) {
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          var action = item.getAttribute('data-action');
          closeProfileDropdown();
          if (action === 'profile-settings' || action === 'preferences') {
            onNavigate('profile-settings');
          } else if (action === 'logout') {
            sessionStorage.removeItem('finstackUserSession');
            if (FinStack.sidebar && FinStack.sidebar.performLogout) {
              FinStack.sidebar.performLogout();
            }
          }
        });
      })(pdItems[i]);
    }

    // Global click to close all dropdowns
    document.addEventListener('click', function() {
      closeNotifDropdown();
      closeProfileDropdown();
    });
  }


  // ── Public API ─────────────────────────────────

  FinStack.topnav = {
    /**
     * Renders the top navigation into the #top-nav element.
     * @param {function} onNavigate — callback(viewId)
     */
    render: function(onNavigate) {
      latestNavigate = onNavigate;
      var el = document.getElementById('top-nav');
      if (!el) return;
      el.innerHTML = buildTopNavHTML();
      bindTopNavEvents(el, onNavigate);
      if (window.FinStackStore && window.FinStackStore.ready) {
        window.FinStackStore.ready.then(function() {
          refreshNotifDropdown(onNavigate);
          syncNotifBadge();
        });
      }
    },

    refreshNotifications: function() {
      refreshNotifDropdown(latestNavigate || function(){});
      syncNotifBadge();
    },

    updateUnreadCount: function() {
      refreshNotifDropdown(latestNavigate || function(){});
      syncNotifBadge();
    }
  };

})();
/* ================================================
   app.js — Main Application Controller
   ================================================
   Hash-based SPA router. Listens for hashchange,
   maps routes to page modules, orchestrates the
   sidebar + topnav shell.

   Route format:  #dashboard  #review-expenses  etc.
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;

  // ── Route Registry ─────────────────────────────
  //
  // Each route maps to a view type ('shell' or 'standalone')
  // and an optional page module on the FinStack namespace.
  //
  var routes = {
    // Shell views (sidebar + topnav visible)
    'dashboard':        { type: 'shell', module: 'dashboard',       title: 'Dashboard',          subtitle: 'Overview of expense management activities',               icon: 'layoutDashboard' },
    'review-expenses':  { type: 'shell', module: 'reviewExpenses',  title: 'Review Expenses',    subtitle: 'Review and take action on pending expense requests',      icon: 'fileSearch'      },
    'approval-history': { type: 'shell', module: 'approvalHistory', title: 'Approval History',   subtitle: 'View historical records of processed expenses',          icon: 'history'         },
    'notifications':    { type: 'shell', module: 'notifications',   title: 'Notifications',      subtitle: 'Stay updated on expense activities and alerts',          icon: 'bell'            },
    'profile-settings': { type: 'shell', module: 'profileSettings', title: 'Profile & Settings', subtitle: 'Manage your account and preferences',                    icon: 'userCog'         },

    // Standalone views (no shell — auth pages)
    'login':            { type: 'standalone', module: 'login',           title: 'Login'                },
    'register':         { type: 'standalone', module: 'register',        title: 'Register Organization' },
    'forgot-password':  { type: 'standalone', module: 'forgotPassword',  title: 'Forgot Password'      },
    'reset-password':   { type: 'standalone', module: 'resetPassword',   title: 'Reset Password'       },
    'invitation-email': { type: 'standalone', module: 'invitationEmail', title: 'Invitation Email'     },
    'landing':          { type: 'standalone', module: 'landing',         title: 'Welcome to FinStack'  }
  };

  var DEFAULT_ROUTE = 'dashboard';
  var currentRoute  = null;
  var storeReadyResolved = false;
  var storeReadyPromise = null;

  function getStoreReadyPromise() {
    if (storeReadyResolved) return null;
    if (storeReadyPromise) return storeReadyPromise;
    if (!window.FinStackStore || !window.FinStackStore.ready || typeof window.FinStackStore.ready.then !== 'function') {
      storeReadyResolved = true;
      return null;
    }

    storeReadyPromise = window.FinStackStore.ready.then(
      function(result) {
        storeReadyResolved = true;
        return result;
      },
      function(error) {
        storeReadyResolved = true;
        console.error('[FinStack Manager] Failed to initialize store before rendering.', error);
        return null;
      }
    );

    return storeReadyPromise;
  }


  // ═══════════════════════════════════════════════
  //  ROUTING
  // ═══════════════════════════════════════════════

  /**
   * Navigate to a route. Updates the URL hash which
   * triggers hashchange → onRouteChange.
   * @param {string} route — route id (e.g. 'dashboard')
   */
  function navigateTo(route) {
    // Special action: logout redirects to shared login
    if (route === 'logout') {
      if (FinStack.sidebar && FinStack.sidebar.performLogout) {
        FinStack.sidebar.performLogout();
      }
      return;
    }

    // Validate route exists
    if (!routes[route]) {
      route = DEFAULT_ROUTE;
    }

    // Set hash — this triggers onRouteChange via hashchange event
    window.location.hash = '#' + route;
  }

  /**
   * Reads the current hash and resolves it to a route id.
   * Falls back to DEFAULT_ROUTE if hash is empty or unknown.
   * @returns {string}
   */
  function resolveRoute() {
    var hash = window.location.hash.replace(/^#\/?/, '');
    return routes[hash] ? hash : DEFAULT_ROUTE;
  }

  /**
   * Central route handler. Called on hashchange and initial load.
   */
  function onRouteChange() {
    var route = resolveRoute();

    // Skip if already on this route
    if (route === currentRoute) return;
    currentRoute = route;

    var config = routes[route];

    if (config.type === 'shell') {
      showShell();
      FinStack.sidebar.setActiveView(route);
      renderPage(route, config);
    } else {
      showStandalone();
      renderStandalonePage(route, config);
    }

    // Update document title
    document.title = config.title + ' — FinStack';

    // Scroll to top on navigation
    var content = document.getElementById('page-content');
    if (content) content.scrollTop = 0;
  }


  // ═══════════════════════════════════════════════
  //  SHELL VISIBILITY
  // ═══════════════════════════════════════════════

  function showShell() {
    document.getElementById('app-shell').style.display = 'flex';
    document.getElementById('standalone-view').style.display = 'none';
  }

  function showStandalone() {
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('standalone-view').style.display = 'block';
  }


  // ═══════════════════════════════════════════════
  //  PAGE RENDERING
  // ═══════════════════════════════════════════════

  /**
   * Renders a shell-view page into #page-content.
   * Delegates to the page module if available,
   * otherwise renders a placeholder.
   */
  function renderLoadingState(container, config) {
    var iconHTML = config.icon ? icons[config.icon](48) : icons.clock(48);

    container.innerHTML =
      '<div class="page-padding">' +
        '<div class="page-header">' +
          '<div>' +
            '<h1>' + config.title + '</h1>' +
            (config.subtitle ? '<p>' + config.subtitle + '</p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="empty-state">' +
            '<div class="empty-state-icon" style="color:var(--primary);">' +
              iconHTML +
            '</div>' +
            '<h3>Loading ' + config.title + '</h3>' +
            '<p>Preparing workspace data...</p>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function renderPage(route, config) {
    var container = document.getElementById('page-content');
    if (!container) return;

    var storeReady = getStoreReadyPromise();
    if (storeReady) {
      renderLoadingState(container, config);
      storeReady.then(function() {
        if (currentRoute !== route) return;
        renderPage(route, config);
      });
      return;
    }

    // Check if a page module is registered
    var mod = FinStack[config.module];
    if (mod && typeof mod.render === 'function') {
      mod.render(container, navigateTo);
      return;
    }

    // Fallback: placeholder
    var iconHTML = config.icon ? icons[config.icon](48) : '';

    container.innerHTML =
      '<div class="page-padding">' +
        '<div class="page-header">' +
          '<div>' +
            '<h1>' + config.title + '</h1>' +
            (config.subtitle ? '<p>' + config.subtitle + '</p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="empty-state">' +
            '<div class="empty-state-icon" style="color:var(--text-dim);">' +
              iconHTML +
            '</div>' +
            '<h3>' + config.title + '</h3>' +
            '<p>This page will be implemented in the next step.</p>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /**
   * Renders a standalone page (auth views) into #standalone-view.
   */
  function renderStandalonePage(route, config) {
    var container = document.getElementById('standalone-view');
    if (!container) return;

    // Check if a page module is registered
    var mod = FinStack[config.module];
    if (mod && typeof mod.render === 'function') {
      mod.render(container, navigateTo);
      return;
    }

    // Fallback: placeholder
    container.innerHTML =
      '<div style="min-height:100vh; display:flex; align-items:center; justify-content:center;">' +
        '<div class="card" style="max-width:480px; text-align:center; padding:var(--sp-12);">' +
          '<h2 style="margin-bottom:var(--sp-4);">' + config.title + '</h2>' +
          '<p style="color:var(--text-muted); margin-bottom:var(--sp-6);">This page will be implemented in the next step.</p>' +
          '<button class="btn btn-primary" id="back-to-dash" type="button">' +
            icons.arrowLeft(18) + ' Go to Dashboard' +
          '</button>' +
        '</div>' +
      '</div>';

    var backBtn = container.querySelector('#back-to-dash');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        navigateTo('dashboard');
      });
    }
  }


  // ═══════════════════════════════════════════════
  //  INITIALIZATION
  // ═══════════════════════════════════════════════

  function init() {
    // Expose navigateTo globally for all modules
    FinStack.navigateTo = navigateTo;

    // Render persistent shell components
    FinStack.sidebar.render(navigateTo);
    FinStack.topnav.render(navigateTo);

    // Listen for hash changes
    window.addEventListener('hashchange', onRouteChange);

    // Resolve initial route
    // If no hash is set, push the default
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#' + DEFAULT_ROUTE;
      // hashchange will fire and call onRouteChange
    } else {
      // Hash already present — render it now
      onRouteChange();
    }
  }

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
/* ================================================
   profile-settings.js — Profile & Settings Page
   ================================================
   Shared profile settings experience for managers.
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;
  var PREFS_KEY = 'finstack-manager-profile-preferences-v1';
  var defaultPreferences = {
    currency: 'INR (₹)',
    theme: 'Dark Mode',
    defaultPage: 'dashboard',
    language: 'English (US)',
    timezone: 'Asia/Kolkata',
    emailAlerts: true,
    pushNotifications: true,
    weeklyDigest: true
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadPreferences() {
    try {
      var stored = localStorage.getItem(PREFS_KEY);
      return stored ? Object.assign({}, defaultPreferences, JSON.parse(stored)) : Object.assign({}, defaultPreferences);
    } catch (error) {
      return Object.assign({}, defaultPreferences);
    }
  }

  function savePreferences(preferences) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }

  function getManagerSession() {
    try {
      return JSON.parse(sessionStorage.getItem('finstackUserSession')) || null;
    } catch (error) {
      return null;
    }
  }

  function getManagerUser() {
    var storeUser = window.FinStackStore && window.FinStackStore.getCurrentUser
      ? window.FinStackStore.getCurrentUser()
      : null;
    if (storeUser) return storeUser;

    var session = getManagerSession() || {};
    return {
      employeeId: session.employeeId || 'MGR-2001',
      fullName: session.fullName || 'Manager',
      email: session.email || 'manager@finstack.io',
      department: '',
      phone: '',
      location: 'India',
      roles: [session.role || 'manager'],
      managerEmployeeId: '',
      status: 'Active',
      organizationId: session.organizationId || 'finstack-tech-01'
    };
  }

  function getInitials(name) {
    return String(name || 'MG')
      .split(' ')
      .map(function(part) { return part.charAt(0); })
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  function getRoleLabel(user) {
    var roleId = user && user.roles && user.roles[0] ? user.roles[0] : 'manager';
    if (window.FinStackStore && typeof window.FinStackStore.getRoleName === 'function') {
      return window.FinStackStore.getRoleName(roleId);
    }
    return roleId === 'manager' ? 'Manager' : roleId;
  }

  function getLastLoginLabel() {
    var session = getManagerSession();
    if (!session || !session.loginAt) return 'Current session';
    return new Date(session.loginAt).toLocaleString();
  }

  function buildAlert(message, isError) {
    if (!message) return '';
    if (isError) {
      return '<div class="alert-panel alert-panel-danger" style="padding:var(--sp-3);display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-4);">' +
        icons.x(16) +
        '<span class="text-sm">' + escapeHtml(message) + '</span>' +
      '</div>';
    }
    return '<div class="alert-panel" style="padding:var(--sp-3);display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-4);background:var(--success-t);border-color:var(--success);color:var(--success);">' +
      icons.check(16) +
      '<span class="text-sm">' + escapeHtml(message) + '</span>' +
    '</div>';
  }

  function isSelected(value, expected) {
    return value === expected ? ' selected' : '';
  }

  function isChecked(value) {
    return value ? ' checked' : '';
  }

  function buildPage(user, preferences, viewState) {
    var name = user.fullName || 'Manager';
    var email = user.email || 'manager@finstack.io';
    var initials = getInitials(name);
    var roleLabel = getRoleLabel(user);
    var statusLabel = user.status || 'Active';
    var lastLogin = getLastLoginLabel();
    var sessionLocation = user.location || 'Bengaluru, India';

    return '' +
      '<div class="page-padding">' +
        '<div class="page-header">' +
          '<div>' +
            '<h1>Profile & Settings</h1>' +
            '<p>Manage your profile details, workspace preferences, and account security.</p>' +
          '</div>' +
        '</div>' +
        '<div class="settings-grid">' +
          '<div class="settings-main">' +
            '<div class="card">' +
              '<div class="card-header" style="border:none;padding-bottom:var(--sp-6);">' +
                '<h2 class="card-title" style="display:flex;align-items:center;gap:var(--sp-2);">' +
                  '<span style="color:var(--primary);">' + icons.user(24) + '</span> Personal Information' +
                '</h2>' +
              '</div>' +
              '<form id="manager-profile-form">' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;">' +
                  '<div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="manager-full-name" type="text" value="' + escapeHtml(name) + '" placeholder="Your full name"></div>' +
                  '<div class="form-group"><label class="form-label">Email Address</label><input class="form-input" id="manager-email" type="email" value="' + escapeHtml(email) + '" placeholder="name@company.com"></div>' +
                  '<div class="form-group"><label class="form-label">Employee ID</label><input class="form-input" id="manager-employee-id" type="text" value="' + escapeHtml(user.employeeId || '') + '" disabled></div>' +
                  '<div class="form-group"><label class="form-label">Department</label><input class="form-input" id="manager-department" type="text" value="' + escapeHtml(user.department || '') + '" placeholder="Department"></div>' +
                  '<div class="form-group"><label class="form-label">Phone Number</label><input class="form-input" id="manager-phone" type="text" value="' + escapeHtml(user.phone || '') + '" placeholder="+91 90000 00000"></div>' +
                  '<div class="form-group"><label class="form-label">Location</label><input class="form-input" id="manager-location" type="text" value="' + escapeHtml(user.location || '') + '" placeholder="Bengaluru, India"></div>' +
                  '<div class="form-group"><label class="form-label">Organization ID</label><input class="form-input" id="manager-organization-id" type="text" value="' + escapeHtml(user.organizationId || '') + '" disabled></div>' +
                  '<div class="form-group"><label class="form-label">Reporting Manager</label><input class="form-input" id="manager-reporting-manager" type="text" value="' + escapeHtml(user.managerEmployeeId || '') + '" placeholder="Reporting manager employee ID"></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;margin-top:24px;">' +
                  '<button class="btn btn-primary" type="submit">' + icons.save(16) + ' Save Changes</button>' +
                '</div>' +
                buildAlert(viewState.profileMessage, viewState.profileError) +
              '</form>' +
            '</div>' +

            '<div class="card">' +
              '<div class="card-header" style="border:none;padding-bottom:var(--sp-6);">' +
                '<h2 class="card-title" style="display:flex;align-items:center;gap:var(--sp-2);">' +
                  '<span style="color:var(--primary);">' + icons.settings(24) + '</span> Preferences' +
                '</h2>' +
              '</div>' +
              '<form id="manager-preferences-form">' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-bottom:24px;">' +
                  '<div class="form-group"><label class="form-label">Default Currency</label><select class="form-input" id="manager-pref-currency"><option value="INR (₹)"' + isSelected(preferences.currency, 'INR (₹)') + '>INR (₹)</option><option value="USD ($)"' + isSelected(preferences.currency, 'USD ($)') + '>USD ($)</option></select></div>' +
                  '<div class="form-group"><label class="form-label">Interface Theme</label><select class="form-input" id="manager-pref-theme"><option value="Dark Mode"' + isSelected(preferences.theme, 'Dark Mode') + '>Dark Mode</option><option value="Light Mode"' + isSelected(preferences.theme, 'Light Mode') + '>Light Mode</option></select></div>' +
                  '<div class="form-group"><label class="form-label">Default Landing Page</label><select class="form-input" id="manager-pref-page"><option value="dashboard"' + isSelected(preferences.defaultPage, 'dashboard') + '>Dashboard</option><option value="review-expenses"' + isSelected(preferences.defaultPage, 'review-expenses') + '>Review Expenses</option><option value="approval-history"' + isSelected(preferences.defaultPage, 'approval-history') + '>Approval History</option><option value="notifications"' + isSelected(preferences.defaultPage, 'notifications') + '>Notifications</option></select></div>' +
                  '<div class="form-group"><label class="form-label">Language</label><select class="form-input" id="manager-pref-language"><option value="English (US)"' + isSelected(preferences.language, 'English (US)') + '>English (US)</option><option value="English (India)"' + isSelected(preferences.language, 'English (India)') + '>English (India)</option><option value="Hindi"' + isSelected(preferences.language, 'Hindi') + '>Hindi</option></select></div>' +
                  '<div class="form-group"><label class="form-label">Time Zone</label><select class="form-input" id="manager-pref-timezone"><option value="Asia/Kolkata"' + isSelected(preferences.timezone, 'Asia/Kolkata') + '>Asia/Kolkata (IST)</option><option value="UTC"' + isSelected(preferences.timezone, 'UTC') + '>UTC</option><option value="America/Los_Angeles"' + isSelected(preferences.timezone, 'America/Los_Angeles') + '>America/Los_Angeles</option><option value="Europe/London"' + isSelected(preferences.timezone, 'Europe/London') + '>Europe/London</option></select></div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:16px;">' +
                  '<label class="pref-row"><div class="pref-info"><div class="pref-head"><span style="color:var(--accent);">' + icons.mail(18) + '</span> Email Alerts</div><p>Receive email updates for approvals, returns, and escalations.</p></div><input id="manager-pref-email" type="checkbox"' + isChecked(preferences.emailAlerts) + '></label>' +
                  '<label class="pref-row"><div class="pref-info"><div class="pref-head"><span style="color:var(--primary);">' + icons.bell(18) + '</span> Push Notifications</div><p>Show workspace alerts for queue changes and urgent actions.</p></div><input id="manager-pref-push" type="checkbox"' + isChecked(preferences.pushNotifications) + '></label>' +
                  '<label class="pref-row"><div class="pref-info"><div class="pref-head"><span style="color:var(--success);">' + icons.checkCircle(18) + '</span> Weekly Digest</div><p>Get a summary of approvals, rejections, and pending reviews every week.</p></div><input id="manager-pref-weekly" type="checkbox"' + isChecked(preferences.weeklyDigest) + '></label>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;margin-top:24px;">' +
                  '<button class="btn btn-secondary" type="submit">' + icons.save(16) + ' Save Preferences</button>' +
                '</div>' +
                buildAlert(viewState.preferenceMessage, viewState.preferenceError) +
              '</form>' +
            '</div>' +

            '<div class="card">' +
              '<div class="card-header" style="border:none;padding-bottom:var(--sp-6);">' +
                '<h2 class="card-title" style="display:flex;align-items:center;gap:var(--sp-2);">' +
                  '<span style="color:var(--primary);">' + icons.lock(24) + '</span> Security' +
                '</h2>' +
              '</div>' +
              '<form id="manager-password-form">' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;">' +
                  '<div class="form-group" style="grid-column:1 / -1;"><label class="form-label">Current Password</label><div class="pwd-input-wrap"><input class="form-input" id="manager-current-password" type="password" placeholder="Current password"><button class="pwd-toggle" data-toggle-password="manager-current-password" type="button">' + icons.eye(18) + '</button></div></div>' +
                  '<div class="form-group"><label class="form-label">New Password</label><div class="pwd-input-wrap"><input class="form-input" id="manager-new-password" type="password" placeholder="Minimum 8 characters"><button class="pwd-toggle" data-toggle-password="manager-new-password" type="button">' + icons.eye(18) + '</button></div></div>' +
                  '<div class="form-group"><label class="form-label">Confirm New Password</label><div class="pwd-input-wrap"><input class="form-input" id="manager-confirm-password" type="password" placeholder="Repeat new password"><button class="pwd-toggle" data-toggle-password="manager-confirm-password" type="button">' + icons.eye(18) + '</button></div></div>' +
                '</div>' +
                '<p style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:var(--sp-2);">Use a unique password with at least 8 characters.</p>' +
                '<div style="display:flex;justify-content:flex-end;margin-top:24px;">' +
                  '<button class="btn btn-primary" type="submit">' + icons.lock(16) + ' Update Password</button>' +
                '</div>' +
                buildAlert(viewState.passwordMessage, viewState.passwordError) +
              '</form>' +
            '</div>' +
          '</div>' +

          '<div class="settings-side">' +
            '<div class="card">' +
              '<div class="prof-layout">' +
                '<div class="prof-avatar">' + initials + '</div>' +
                '<div class="prof-fields">' +
                  '<div style="font-size:var(--fs-lg);font-weight:var(--fw-semibold);color:var(--text);">' + escapeHtml(name) + '</div>' +
                  '<div style="font-size:var(--fs-sm);color:var(--text-muted);margin-top:var(--sp-1);">' + escapeHtml(email) + '</div>' +
                  '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;">' +
                    '<span class="badge badge-tag">' + icons.briefcase(14) + ' ' + escapeHtml(roleLabel) + '</span>' +
                    '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.12);color:#86efac;font-size:var(--fs-xs);font-weight:var(--fw-semibold);">' + escapeHtml(statusLabel) + '</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="card">' +
              '<h2 class="card-title mb-4" style="display:flex;align-items:center;gap:var(--sp-2);">' +
                '<span style="color:var(--primary);">' + icons.building2(20) + '</span> Workspace Snapshot' +
              '</h2>' +
              '<div style="display:flex;flex-direction:column;gap:16px;">' +
                '<div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px;">Employee ID</div><div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text);">' + escapeHtml(user.employeeId || '-') + '</div></div>' +
                '<div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px;">Organization</div><div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text);">' + escapeHtml(user.organizationId || '-') + '</div></div>' +
                '<div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px;">Reporting Manager</div><div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text);">' + escapeHtml(user.managerEmployeeId || 'Not assigned') + '</div></div>' +
                '<div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:4px;">Last Login</div><div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text);">' + escapeHtml(lastLogin) + '</div></div>' +
              '</div>' +
            '</div>' +

            '<div class="card">' +
              '<h2 class="card-title mb-4" style="display:flex;align-items:center;gap:var(--sp-2);">' +
                '<span style="color:var(--primary);">' + icons.shieldCheck(20) + '</span> Active Sessions' +
              '</h2>' +
              '<div style="display:flex;flex-direction:column;gap:16px;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;background:var(--bg);">' +
                  '<div><div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text);">Chrome on Windows</div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:4px;">Current session • ' + escapeHtml(sessionLocation) + '</div></div>' +
                  '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.12);color:#86efac;font-size:var(--fs-xs);font-weight:var(--fw-semibold);">Active</span>' +
                '</div>' +
                (viewState.secondarySessionActive
                  ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;background:var(--bg);"><div><div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text);">Android App</div><div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:4px;">Last active 2 hours ago • Hyderabad, India</div></div><button class="btn btn-secondary" id="manager-revoke-session" type="button" style="padding:8px 14px;">Revoke</button></div>'
                  : '<div style="font-size:var(--fs-sm);color:var(--text-muted);padding:12px 14px;border:1px dashed var(--border);border-radius:var(--r-md);">No additional active sessions.</div>') +
              '</div>' +
              buildAlert(viewState.sessionMessage, viewState.sessionError) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function renderProfileSettings(container, onNavigate, viewState) {
    var user = getManagerUser();
    container.innerHTML = buildPage(user, viewState.preferences, viewState);
    bindEvents(container, onNavigate, viewState);
  }

  function bindEvents(container, onNavigate, viewState) {
    var profileForm = container.querySelector('#manager-profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', function(event) {
        event.preventDefault();
        var user = getManagerUser();
        if (!window.FinStackStore || !user || !user.employeeId) {
          viewState.profileError = true;
          viewState.profileMessage = 'Profile data is still loading. Please try again.';
          viewState.preferenceMessage = '';
          viewState.passwordMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }

        var fullName = (container.querySelector('#manager-full-name').value || '').trim();
        var email = (container.querySelector('#manager-email').value || '').trim();
        if (!fullName) {
          viewState.profileError = true;
          viewState.profileMessage = 'Full name is required.';
          viewState.preferenceMessage = '';
          viewState.passwordMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }
        if (!email) {
          viewState.profileError = true;
          viewState.profileMessage = 'Email address is required.';
          viewState.preferenceMessage = '';
          viewState.passwordMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }

        var updates = {
          fullName: fullName,
          email: email,
          department: (container.querySelector('#manager-department').value || '').trim(),
          phone: (container.querySelector('#manager-phone').value || '').trim(),
          location: (container.querySelector('#manager-location').value || '').trim(),
          managerEmployeeId: (container.querySelector('#manager-reporting-manager').value || '').trim()
        };

        var result = window.FinStackStore.updateUser(user.employeeId, updates);
        if (result && result.success === false) {
          viewState.profileError = true;
          viewState.profileMessage = result.error || 'Unable to update profile.';
          viewState.preferenceMessage = '';
          viewState.passwordMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }

        viewState.profileError = false;
        viewState.profileMessage = 'Profile updated successfully.';
        viewState.preferenceMessage = '';
        viewState.passwordMessage = '';
        viewState.sessionMessage = '';
        if (FinStack.topnav && typeof FinStack.topnav.render === 'function') {
          FinStack.topnav.render(onNavigate);
        }
        renderProfileSettings(container, onNavigate, viewState);
      });
    }

    var preferencesForm = container.querySelector('#manager-preferences-form');
    if (preferencesForm) {
      preferencesForm.addEventListener('submit', function(event) {
        event.preventDefault();
        viewState.preferences = {
          currency: container.querySelector('#manager-pref-currency').value,
          theme: container.querySelector('#manager-pref-theme').value,
          defaultPage: container.querySelector('#manager-pref-page').value,
          language: container.querySelector('#manager-pref-language').value,
          timezone: container.querySelector('#manager-pref-timezone').value,
          emailAlerts: !!container.querySelector('#manager-pref-email').checked,
          pushNotifications: !!container.querySelector('#manager-pref-push').checked,
          weeklyDigest: !!container.querySelector('#manager-pref-weekly').checked
        };
        savePreferences(viewState.preferences);
        viewState.preferenceError = false;
        viewState.preferenceMessage = 'Preferences saved.';
        viewState.profileMessage = '';
        viewState.passwordMessage = '';
        viewState.sessionMessage = '';
        renderProfileSettings(container, onNavigate, viewState);
      });
    }

    var passwordForm = container.querySelector('#manager-password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', function(event) {
        event.preventDefault();
        var user = getManagerUser();
        if (!window.FinStackStore || !user || !user.employeeId) {
          viewState.passwordError = true;
          viewState.passwordMessage = 'Profile data is still loading. Please try again.';
          viewState.profileMessage = '';
          viewState.preferenceMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }

        var currentPassword = container.querySelector('#manager-current-password').value || '';
        var newPassword = container.querySelector('#manager-new-password').value || '';
        var confirmPassword = container.querySelector('#manager-confirm-password').value || '';

        if (!currentPassword) {
          viewState.passwordError = true;
          viewState.passwordMessage = 'Current password is required.';
          viewState.profileMessage = '';
          viewState.preferenceMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }
        if (newPassword.length < 8) {
          viewState.passwordError = true;
          viewState.passwordMessage = 'New password must be at least 8 characters.';
          viewState.profileMessage = '';
          viewState.preferenceMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }
        if (newPassword !== confirmPassword) {
          viewState.passwordError = true;
          viewState.passwordMessage = 'New password and confirm password must match.';
          viewState.profileMessage = '';
          viewState.preferenceMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }

        var result = window.FinStackStore.changePassword(user.employeeId, currentPassword, newPassword);
        if (!result || result.success === false) {
          viewState.passwordError = true;
          viewState.passwordMessage = result && result.error ? result.error : 'Unable to update password.';
          viewState.profileMessage = '';
          viewState.preferenceMessage = '';
          viewState.sessionMessage = '';
          renderProfileSettings(container, onNavigate, viewState);
          return;
        }

        viewState.passwordError = false;
        viewState.passwordMessage = 'Password updated successfully.';
        viewState.profileMessage = '';
        viewState.preferenceMessage = '';
        viewState.sessionMessage = '';
        renderProfileSettings(container, onNavigate, viewState);
      });
    }

    var toggleButtons = container.querySelectorAll('[data-toggle-password]');
    for (var i = 0; i < toggleButtons.length; i++) {
      toggleButtons[i].addEventListener('click', function() {
        var input = container.querySelector('#' + this.getAttribute('data-toggle-password'));
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    }

    var revokeSessionButton = container.querySelector('#manager-revoke-session');
    if (revokeSessionButton) {
      revokeSessionButton.addEventListener('click', function() {
        viewState.secondarySessionActive = false;
        viewState.sessionError = false;
        viewState.sessionMessage = 'Additional session revoked.';
        viewState.profileMessage = '';
        viewState.preferenceMessage = '';
        viewState.passwordMessage = '';
        renderProfileSettings(container, onNavigate, viewState);
      });
    }
  }

  FinStack.profileSettings = {
    render: function(container, onNavigate) {
      renderProfileSettings(container, onNavigate, {
        preferences: loadPreferences(),
        profileMessage: '',
        profileError: false,
        preferenceMessage: '',
        preferenceError: false,
        passwordMessage: '',
        passwordError: false,
        sessionMessage: '',
        sessionError: false,
        secondarySessionActive: true
      });
    }
  };

})();
/* ================================================
   dashboard.js — Manager Dashboard Page
   ================================================
   Metrics · Pending Expenses · High-Risk Alerts
   Recent Activity
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;

  // ── Mock Data ────────────────────────────────────

  var metricsData = [
    {
      title: 'Pending Approvals',
      value: '18',
      icon: 'clock',
      color: 'var(--warning)',
      bgColor: 'var(--warning-t)',
      trend: 'this month +5',
      trendDir: 'up',
      trendColor: 'var(--success)'
    },
    {
      title: 'Approved',
      value: '12',
      icon: 'checkCircle',
      color: 'var(--success)',
      bgColor: 'var(--success-t)',
      trend: 'this month +4',
      trendDir: 'up',
      trendColor: 'var(--success)'
    },
    {
      title: 'Rejected',
      value: '3',
      icon: 'xCircle',
      color: 'var(--danger)',
      bgColor: 'var(--danger-t)',
      trend: 'this month -1',
      trendDir: 'down',
      trendColor: 'var(--danger)'
    },
    {
      title: 'Escalated',
      value: '5',
      icon: 'alertTriangle',
      color: 'var(--secondary-accent)',
      bgColor: 'var(--secondary-t)',
      trend: 'this month +2',
      trendDir: 'up',
      trendColor: 'var(--success)'
    }
  ];

  var pendingExpenses = [
    {
      id: 'EXP-1247',
      employee: 'Priya Reddy',
      title: 'Client Dinner Meeting',
      amount: '₹850.00',
      date: 'Mar 24, 2026',
      risk: 'Low',
      riskClass: 'badge-low',
      category: 'Meals & Entertainment'
    },
    {
      id: 'EXP-1248',
      employee: 'Aarav Sharma',
      title: 'Conference Travel',
      amount: '₹2,450.00',
      date: 'Mar 24, 2026',
      risk: 'Medium',
      riskClass: 'badge-medium',
      category: 'Travel'
    },
    {
      id: 'EXP-1249',
      employee: 'Ananya Iyer',
      title: 'Software Subscription',
      amount: '₹399.00',
      date: 'Mar 23, 2026',
      risk: 'Low',
      riskClass: 'badge-low',
      category: 'Software'
    },
    {
      id: 'EXP-1250',
      employee: 'Vikram Singh',
      title: 'Office Equipment',
      amount: '₹1,200.00',
      date: 'Mar 23, 2026',
      risk: 'High',
      riskClass: 'badge-high',
      category: 'Equipment'
    },
    {
      id: 'EXP-1251',
      employee: 'Neha Gupta',
      title: 'Team Building Event',
      amount: '₹680.00',
      date: 'Mar 22, 2026',
      risk: 'Low',
      riskClass: 'badge-low',
      category: 'Team Activities'
    }
  ];

  var highRiskAlerts = [
    {
      id: 'EXP-1250',
      employee: 'Vikram Singh',
      title: 'Office Equipment Purchase',
      amount: '₹1,200.00',
      reason: 'Exceeds category limit by 20%',
      time: '15 minutes ago'
    },
    {
      id: 'EXP-1246',
      employee: 'Rahul Mehta',
      title: 'International Flight Upgrade',
      amount: '₹950.00',
      reason: 'Missing required receipt',
      time: '1 hour ago'
    },
    {
      id: 'EXP-1242',
      employee: 'Sneha Desai',
      title: 'Marketing Campaign Expense',
      amount: '₹3,500.00',
      reason: 'Unusual spending pattern detected',
      time: '2 hours ago'
    }
  ];

  var recentActivity = [
    {
      user: 'You',
      action: 'Approved',
      entity: 'Travel Expense #1245',
      time: '10 minutes ago',
      type: 'approved',
      amount: '₹1,450.00'
    },
    {
      user: 'You',
      action: 'Rejected',
      entity: 'Office Supplies #1244',
      time: '25 minutes ago',
      type: 'rejected',
      amount: '₹280.00'
    },
    {
      user: 'System',
      action: 'Escalated',
      entity: 'High-Risk Expense #1243',
      time: '1 hour ago',
      type: 'escalated',
      amount: '₹2,100.00'
    },
    {
      user: 'You',
      action: 'Approved',
      entity: 'Software License #1241',
      time: '2 hours ago',
      type: 'approved',
      amount: '₹599.00'
    },
    {
      user: 'You',
      action: 'Approved',
      entity: 'Team Lunch #1240',
      time: '3 hours ago',
      type: 'approved',
      amount: '₹125.00'
    }
  ];


  // ── Build Helpers ────────────────────────────────

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getActivityIcon(type) {
    switch (type) {
      case 'approved':  return '<span style="color:var(--success);">' + icons.checkCircle(14) + '</span>';
      case 'rejected':  return '<span style="color:var(--danger);">'  + icons.xCircle(14)    + '</span>';
      case 'escalated': return '<span style="color:var(--warning);">' + icons.alertTriangle(14) + '</span>';
      default:          return '<span style="color:var(--text-muted);">' + icons.clock(14)    + '</span>';
    }
  }


  // ── Build Page ───────────────────────────────────

  function buildDashboard(onNavigate) {
    return '' +
      '<div class="page-padding">' +

        // ── Page Header ──
        '<div class="page-header">' +
          '<div>' +
            '<h1>Manager Dashboard</h1>' +
            '<p>Review and approve expense requests</p>' +
          '</div>' +
          '<div class="page-header-actions">' +
            '<button class="btn btn-primary" id="dash-review-btn" type="button">' +
              icons.eye(18) + ' Review Expenses' +
            '</button>' +
            '<button class="btn btn-secondary" id="dash-history-btn" type="button">' +
              icons.checkCircle(18) + ' View History' +
            '</button>' +
          '</div>' +
        '</div>' +

        // ── Metrics Grid ──
        buildMetricsGrid() +

        // ── Main Content (3-col: 2 + 1) ──
        '<div class="dash-grid">' +

          // Left: Pending + Activity (2/3)
          '<div class="dash-left space-y-6">' +
            buildPendingExpenses() +
            buildRecentActivity() +
          '</div>' +

          // Right: Alerts (1/3)
          '<div class="dash-right space-y-6">' +
            buildHighRiskAlerts() +
          '</div>' +

        '</div>' +

      '</div>';
  }


  // ── Metrics ──────────────────────────────────────

  function buildMetricsGrid() {
    var html = '<div class="grid grid-cols-4 lg\\:grid-cols-4 gap-6 mb-8">';

    for (var i = 0; i < metricsData.length; i++) {
      var m = metricsData[i];
      var trendIcon = m.trendDir === 'up'
        ? icons.trendingUp(14)
        : icons.trendingDown(14);

      html +=
        '<div class="metric-card">' +
          '<div class="metric-top">' +
            '<span class="metric-label">' + m.title + '</span>' +
            '<div class="metric-icon" style="background-color:' + m.bgColor + ';">' +
              '<span style="color:' + m.color + ';">' + icons[m.icon](24) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="metric-value">' + m.value + '</div>' +
          '<div class="metric-trend">' +
            '<span style="color:' + m.trendColor + ';">' + trendIcon + '</span>' +
            '<span>' + m.trend + '</span>' +
          '</div>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }


  // ── Pending Expenses Table ───────────────────────

  function buildPendingExpenses() {
    var rows = '';
    function formatExpenseId(id) {
      return 'EXP-' + String(id || '').slice(0, 6);
    }
    function getEmployeeDisplay(expense) {
      var users = window.FinStackStore && window.FinStackStore.getUsers ? window.FinStackStore.getUsers() : [];
      var userMap = {};
      users.forEach(function(user) {
        userMap[user.employeeId] = user.fullName;
      });
      return userMap[expense.employeeId] || expense.employeeId || expense.employee || '-';
    }
    if (pendingExpenses.length === 0) {
      rows = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-secondary);">No pending expense requests in your queue.</td></tr>';
    } else {
      for (var i = 0; i < pendingExpenses.length; i++) {
        var e = pendingExpenses[i];
        rows +=
          '<tr class="clickable" data-expense-id="' + e.id + '">' +
            '<td>' +
              '<div class="cell-primary">' + escapeHtml(getEmployeeDisplay(e)) + '</div>' +
              '<div class="cell-secondary">' + escapeHtml(formatExpenseId(e.id)) + '</div>' +
            '</td>' +
            '<td>' +
              '<div class="cell-primary" style="font-weight:var(--fw-normal);">' + e.title + '</div>' +
              '<div class="cell-secondary">' + e.category + '</div>' +
            '</td>' +
            '<td>' +
              '<span class="cell-amount">' + e.amount + '</span>' +
            '</td>' +
            '<td>' +
              '<span class="cell-date">' + e.date + '</span>' +
            '</td>' +
            '<td>' +
              '<span class="badge ' + e.riskClass + '">' + e.risk + '</span>' +
            '</td>' +
            '<td>' +
              '<button class="btn-link dash-review-expense" data-id="' + e.id + '" type="button">' +
                'Review ' + icons.chevronDown(14) +
              '</button>' +
            '</td>' +
          '</tr>';
      }
    }

    return '' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<div>' +
            '<h2 class="card-title">Pending Expense Requests</h2>' +
            '<p class="card-subtitle">Review and approve submitted expenses</p>' +
          '</div>' +
          '<button class="btn btn-secondary btn-sm" type="button">' +
            icons.filter(16) + ' Filter' +
          '</button>' +
        '</div>' +

        '<div class="table-wrapper">' +
          '<table class="table">' +
            '<thead>' +
              '<tr>' +
                '<th>Employee</th>' +
                '<th>Title</th>' +
                '<th>Amount</th>' +
                '<th>Date</th>' +
                '<th>Risk</th>' +
                '<th>Action</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              rows +
            '</tbody>' +
          '</table>' +
        '</div>' +

        '<div class="card-footer">' +
          '<span class="table-info">Showing ' + pendingExpenses.length + ' of ' + (window.FinStackStore ? window.FinStackStore.getManagerQueue(window.FinStackStore.getCurrentUser()?.employeeId).length : 0) + ' pending requests</span>' +
          '<button class="btn-link" id="dash-view-all-expenses" type="button">View All →</button>' +
        '</div>' +
      '</div>';
  }


  // ── High-Risk Alerts ─────────────────────────────

  function buildHighRiskAlerts() {
    var alertsHTML = '';
    if (highRiskAlerts.length === 0) {
      alertsHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:0.875rem;">No active risk alerts.</div>';
    } else {
      for (var i = 0; i < highRiskAlerts.length; i++) {
        var a = highRiskAlerts[i];
        alertsHTML +=
          '<div class="alert-card">' +
            '<div class="alert-card-top">' +
              '<div style="flex:1;">' +
                '<div class="alert-card-title">' + a.title + '</div>' +
                '<div class="alert-card-meta">' + a.employee + ' • ' + a.id + '</div>' +
              '</div>' +
              '<span class="alert-card-amount">' + a.amount + '</span>' +
            '</div>' +
            '<div class="alert-card-reason">' +
              icons.alertTriangle(14) +
              '<p>' + a.reason + '</p>' +
            '</div>' +
            '<div class="alert-card-time">' + a.time + '</div>' +
          '</div>';
      }
    }

    return '' +
      '<div class="card">' +
        '<div class="card-header" style="margin-bottom:var(--sp-4);">' +
          '<div class="card-header-left">' +
            '<div class="icon-box icon-box-sm" style="background-color:var(--danger-t); color:var(--danger);">' +
              icons.alertTriangle(16) +
            '</div>' +
            '<h3 class="card-section-title">High-Risk Alerts</h3>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-3">' +
          alertsHTML +
        '</div>' +
        '<div style="margin-top:var(--sp-4);">' +
          '<button class="btn-link" id="dash-view-all-alerts" style="width:100%; text-align:center; display:block;" type="button">View All Alerts →</button>' +
        '</div>' +
      '</div>';
  }


  // ── Recent Activity ──────────────────────────────

  function buildRecentActivity() {
    var itemsHTML = '';
    if (recentActivity.length === 0) {
      itemsHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:0.875rem;">No recent activities logged.</div>';
    } else {
      var limit = Math.min(recentActivity.length, 5);
      for (var i = 0; i < limit; i++) {
        var a = recentActivity[i];
        itemsHTML +=
          '<div class="activity-item">' +
            '<div class="activity-icon">' +
              getActivityIcon(a.type) +
            '</div>' +
            '<div class="activity-body">' +
              '<div class="activity-text">' +
                '<span class="actor">' + a.user + '</span> ' +
                '<span class="action">' + a.action + '</span> ' +
                '<span class="entity">' + a.entity + '</span>' +
              '</div>' +
              '<div class="activity-meta">' +
                '<span>' + a.time + '</span>' +
                (a.amount ? '<span class="dot">•</span><span class="amount">' + a.amount + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
      }
    }

    return '' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<div>' +
            '<h2 class="card-title">Recent Activity</h2>' +
            '<p class="card-subtitle">Overview of latest system changes</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-3">' +
          itemsHTML +
        '</div>' +
        '<div class="card-footer" style="padding-top:var(--sp-4);">' +
          '<button class="btn-link" id="dash-view-history" style="width:100%; text-align:center; display:block;" type="button">View Full History →</button>' +
        '</div>' +
      '</div>';
  }


  // ── Event Binding ────────────────────────────────

  function bindDashboardEvents(container, onNavigate) {
    // Review Expenses button
    var reviewBtn = container.querySelector('#dash-review-btn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function() {
        onNavigate('review-expenses');
      });
    }

    // View History button
    var historyBtn = container.querySelector('#dash-history-btn');
    if (historyBtn) {
      historyBtn.addEventListener('click', function() {
        onNavigate('approval-history');
      });
    }

    // View All Expenses link
    var viewAllBtn = container.querySelector('#dash-view-all-expenses');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', function() {
        onNavigate('review-expenses');
      });
    }

    // View Full History link
    var viewHistBtn = container.querySelector('#dash-view-history');
    if (viewHistBtn) {
      viewHistBtn.addEventListener('click', function() {
        onNavigate('approval-history');
      });
    }

    // View All Alerts link
    var viewAlertsBtn = container.querySelector('#dash-view-all-alerts');
    if (viewAlertsBtn) {
      viewAlertsBtn.addEventListener('click', function() {
        if (FinStack.notifications) FinStack.notifications.autoFilterTab = 'High Risk';
        onNavigate('notifications');
      });
    }

    // Review individual expenses
    var reviewLinks = container.querySelectorAll('.dash-review-expense');
    for (var i = 0; i < reviewLinks.length; i++) {
      reviewLinks[i].addEventListener('click', function(e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        if (FinStack.reviewExpenses) FinStack.reviewExpenses.autoOpenId = id;
        onNavigate('review-expenses');
      });
    }

    // Clickable table rows
    var rows = container.querySelectorAll('tr.clickable');
    for (var j = 0; j < rows.length; j++) {
      rows[j].addEventListener('click', function() {
        var id = this.getAttribute('data-expense-id');
        if (FinStack.reviewExpenses) FinStack.reviewExpenses.autoOpenId = id;
        onNavigate('review-expenses');
      });
    }
  }


  // ── Public API ─────────────────────────────────

  FinStack.dashboard = {
    render: function(container, onNavigate) {
      if (window.FinStackStore) {
        var user = window.FinStackStore.getCurrentUser() || {};
        var empId = user.employeeId || '';
        var queue = window.FinStackStore.getManagerQueue(empId);
        
        var pending = queue.length;
        var approved = window.FinStackStore.getExpenses().filter(function(e) { return e.managerEmployeeId === empId && e.managerDecision === 'Approved'; }).length;
        var rejected = window.FinStackStore.getExpenses().filter(function(e) { return e.managerEmployeeId === empId && e.managerDecision === 'Rejected'; }).length;
        var escalated = window.FinStackStore.getExpenses().filter(function(e) { return e.managerEmployeeId === empId && e.risk_score >= 70 && !e.managerDecision; }).length;
        
        metricsData = [
          { title: 'Pending Approvals', value: pending, icon: 'clock', color: 'var(--warning)', bgColor: 'var(--warning-t)', trend: 'Action Required', trendDir: 'up', trendColor: 'var(--warning)' },
          { title: 'Approved', value: approved, icon: 'checkCircle', color: 'var(--success)', bgColor: 'var(--success-t)', trend: 'This Month', trendDir: 'up', trendColor: 'var(--success)' },
          { title: 'Rejected', value: rejected, icon: 'xCircle', color: 'var(--danger)', bgColor: 'var(--danger-t)', trend: 'This Month', trendDir: 'down', trendColor: 'var(--danger)' },
          { title: 'Active Risk', value: escalated, icon: 'alertTriangle', color: 'var(--secondary-accent)', bgColor: 'var(--secondary-t)', trend: 'Requires Review', trendDir: 'up', trendColor: 'var(--secondary-accent)' }
        ];
        
        pendingExpenses = queue.slice(0, 5).map(function(e) {
          return {
            id: e.id,
            employee: e.employee,
            title: e.notes || e.merchant || 'Expense',
            amount: window.FinStackStore.formatCurrency(e.amount, e.currency || 'INR'),
            date: new Date(e.date).toLocaleDateString(),
            risk: e.risk_score >= 70 ? 'High' : e.risk_score >= 40 ? 'Medium' : 'Low',
            riskClass: e.risk_score >= 70 ? 'badge-high' : e.risk_score >= 40 ? 'badge-medium' : 'badge-low',
            category: e.category
          };
        });
        
        highRiskAlerts = queue.filter(function(e) { return e.risk_score >= 70 || (e.flag && e.flag !== 'none'); }).slice(0, 3).map(function(e) {
          return {
            id: e.id,
            employee: e.employee,
            title: e.merchant || 'Expense',
            amount: window.FinStackStore.formatCurrency(e.amount, e.currency || 'INR'),
            reason: e.flag === 'mismatch' ? 'Amount mismatch detected' : e.flag === 'duplicate' ? 'Potential duplicate expense' : 'High risk score',
            time: new Date(e.created).toLocaleDateString()
          };
        });
        
        recentActivity = window.FinStackStore.getAuditLogs()
          .filter(function(log) { return log.user === user.fullName && log.entityType === 'Expense'; })
          .slice(0, 5)
          .map(function(log) {
            return {
              user: 'You',
              action: log.action.split(' ')[0],
              entity: log.entityName,
              time: new Date(log.timestamp).toLocaleDateString(),
              type: log.action.includes('Approve') ? 'approved' : log.action.includes('Reject') ? 'rejected' : 'escalated',
              amount: null
            };
          });
      }

      container.innerHTML = buildDashboard(onNavigate);
      bindDashboardEvents(container, onNavigate);
    }
  };

})();
