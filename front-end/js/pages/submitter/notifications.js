'use strict';

/* ── Helpers ──────────────────────────────────────── */
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  if (!ts) return 'Now';
  var diff = Date.now() - new Date(ts).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24)  return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  if (days < 7)  return days + 'd ago';
  return new Date(ts).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function typeIcon(type) {
  if (type === 'success') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
  if (type === 'danger')  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  if (type === 'warning') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10.29 3.86-7.58 13.13A2 2 0 0 0 4.42 20h15.16a2 2 0 0 0 1.73-3.01L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
}

function typeColors(type) {
  if (type === 'success') return { bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.25)' };
  if (type === 'danger')  return { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', border: 'rgba(239,68,68,0.25)' };
  if (type === 'warning') return { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' };
  return { bg: 'rgba(99,102,241,0.12)', color: '#818CF8', border: 'rgba(99,102,241,0.25)' };
}

/* ── Render ───────────────────────────────────────── */
function renderNotifications() {
  var container = document.getElementById('notifications-container');
  if (!container) return;

  var all   = window.FinStackStore.getNotifications();
  var unread = all.filter(function(n) { return n.unread; });
  var read   = all.filter(function(n) { return !n.unread; });

  // Update unread badge
  var badge = document.getElementById('unread-count-badge');
  if (badge) {
    if (unread.length > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = unread.length + ' Unread';
    } else {
      badge.style.display = 'none';
    }
  }

  // Update sidebar badge
  var sidebarBadge = document.getElementById('notif-sidebar-badge');
  if (sidebarBadge) {
    sidebarBadge.style.display = unread.length > 0 ? 'block' : 'none';
  }

  if (!all.length) {
    container.innerHTML = [
      '<div style="text-align:center;padding:64px 24px;">',
        '<div style="width:64px;height:64px;background:rgba(99,102,241,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">',
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818CF8" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        '</div>',
        '<p style="color:var(--zinc-300);font-weight:600;font-size:1rem;margin-bottom:6px;">All caught up!</p>',
        '<p style="color:var(--zinc-500);font-size:0.875rem;">No notifications yet. Submit an expense to get started.</p>',
      '</div>'
    ].join('');
    return;
  }

  function buildSection(title, items) {
    if (!items.length) return '';
    return [
      '<div style="padding:8px 0 4px;">',
        '<p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--zinc-500);padding:0 4px 8px;">' + title + '</p>',
        items.map(buildCard).join(''),
      '</div>'
    ].join('');
  }

  function buildCard(n) {
    var colors = typeColors(n.type);
    var icon   = typeIcon(n.type);
    var ago    = timeAgo(n.createdAt);
    return [
      '<div id="notif-card-' + esc(n.id) + '" style="',
        'display:flex;align-items:flex-start;gap:14px;padding:16px 18px;',
        'border-radius:14px;margin-bottom:8px;cursor:pointer;transition:background 0.15s;',
        'background:' + (n.unread ? 'rgba(99,102,241,0.06)' : 'var(--zinc-900,#111)') + ';',
        'border:1px solid ' + (n.unread ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)') + ';',
        '" onclick="markRead(\'' + esc(n.id) + '\')" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'' + (n.unread ? 'rgba(99,102,241,0.06)' : 'var(--zinc-900,#111)') + '\'">',
        '<div style="',
          'width:42px;height:42px;min-width:42px;border-radius:12px;',
          'background:' + colors.bg + ';border:1px solid ' + colors.border + ';',
          'display:flex;align-items:center;justify-content:center;margin-top:2px;',
          'color:' + colors.color + ';',
        '">',
          icon,
        '</div>',
        '<div style="flex:1;min-width:0;">',
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">',
            '<p style="font-size:0.9rem;font-weight:' + (n.unread ? '600' : '500') + ';color:' + (n.unread ? '#fff' : 'var(--zinc-300)') + ';margin:0;">' + esc(n.title) + '</p>',
            (n.unread ? '<span style="width:8px;height:8px;min-width:8px;border-radius:50%;background:var(--indigo-400,#818cf8);"></span>' : ''),
          '</div>',
          '<p style="font-size:0.8rem;color:var(--zinc-500);line-height:1.5;margin:0 0 6px;">' + esc(n.message) + '</p>',
          '<div style="display:flex;align-items:center;justify-content:space-between;">',
            '<span style="font-size:0.72rem;color:var(--zinc-600);">' + ago + '</span>',
            '<button onclick="event.stopPropagation();deleteNotif(\'' + esc(n.id) + '\')" style="font-size:0.72rem;color:var(--zinc-600);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px;" onmouseover="this.style.color=\'#EF4444\'" onmouseout="this.style.color=\'var(--zinc-600)\'">Dismiss</button>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }

  container.innerHTML = buildSection('Unread', unread) + buildSection('Earlier', read);
}

/* ── Actions ──────────────────────────────────────── */
window.markRead = function(id) {
  window.FinStackStore.markNotificationRead(id);
  renderNotifications();
};

window.deleteNotif = function(id) {
  window.FinStackStore.deleteNotification(id);
  renderNotifications();
};

/* ── Init ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  window.FinStackStore.ready.then(function() {
    // Populate profile header
    try {
      var user = window.FinStackStore.getCurrentUser();
      if (user) {
        var initials = String(user.fullName || 'ES').split(' ').map(function(n){ return n[0]; }).join('').slice(0,2).toUpperCase();
        var avatarEl = document.getElementById('topbar-avatar');
        var nameEl   = document.getElementById('topbar-name');
        if (avatarEl) avatarEl.textContent = initials;
        if (nameEl)   nameEl.textContent   = user.fullName || 'Expense Submitter';
      }
    } catch(e) {}

    renderNotifications();

    // Mark all read button
    var btn = document.getElementById('mark-all-read-btn');
    if (btn) {
      btn.addEventListener('click', function() {
        window.FinStackStore.markAllNotificationsRead();
        renderNotifications();
      });
    }

    // Sidebar collapse
    if (typeof window.initSidebarCollapse === 'function') window.initSidebarCollapse();

    // Logout
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        sessionStorage.removeItem('finstackUserSession');
        window.location.href = '../../login.html?role=expense_submitter';
      });
    }
  });
});
