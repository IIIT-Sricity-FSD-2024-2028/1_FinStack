/* ================================================
   notifications.js — Notifications Page
   ================================================
   View all read and unread notifications with
   filtering by status (High Risk, Pending, etc).
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;

  // ── Mock Data ────────────────────────────────────
  var notifs = [];

  function loadNotifications() {
    if (window.FinStackStore) {
      var user = window.FinStackStore.getCurrentUser() || {};
      var raw = window.FinStackStore.getNotifications(user.employeeId) || [];
      notifs = raw.map(function(n) {
        var icon = 'bell';
        var color = 'var(--text-secondary)';
        var type = 'info';
        
        switch (n.type) {
          case 'warning': icon = 'clock'; color = 'var(--warning)'; type = 'pending'; break;
          case 'danger': icon = 'alertTriangle'; color = 'var(--danger)'; type = 'high-risk'; break;
          case 'success': icon = 'checkCircle'; color = 'var(--success)'; type = 'approved'; break;
        }
        
        var expense = window.FinStackStore.getExpenses().find(function(e){ return e.id === n.relatedExpenseId; });
        var amount = expense ? window.FinStackStore.formatCurrency(expense.amount, expense.currency || 'INR') : '';

        return {
          id: n.id,
          type: type,
          title: n.title,
          message: n.message,
          timeAgo: new Date(n.createdAt).toLocaleString(),
          isRead: !n.unread,
          expenseId: n.relatedExpenseId,
          amount: amount,
          icon: icon,
          color: color,
          original: n
        };
      });
      notifs.sort(function(a,b) { return new Date(b.original.createdAt) - new Date(a.original.createdAt); });
    }
  }

  // ── State ────────────────────────────────────────
  var activeTab = 'All'; // All, Pending, High Risk, Approved, Rejected

  function getFiltered() {
    if (activeTab === 'All') return notifs;
    return notifs.filter(function(n) {
      if (activeTab === 'Pending') return n.type === 'pending';
      if (activeTab === 'High Risk') return n.type === 'high-risk';
      if (activeTab === 'Approved') return n.type === 'approved';
      if (activeTab === 'Rejected') return n.type === 'rejected';
      return true;
    });
  }


  // ═════════════════════════════════════════════════
  //  PAGE BUILD
  // ═════════════════════════════════════════════════

  function typeIcon(type) {
    if (type === 'approved') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
    if (type === 'high-risk' || type === 'rejected') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    if (type === 'pending') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10.29 3.86-7.58 13.13A2 2 0 0 0 4.42 20h15.16a2 2 0 0 0 1.73-3.01L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  }

  function typeColors(type) {
    if (type === 'approved')  return { bg: 'rgba(16,185,129,0.12)',  color: '#10B981', border: 'rgba(16,185,129,0.25)' };
    if (type === 'high-risk') return { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444', border: 'rgba(239,68,68,0.25)' };
    if (type === 'rejected')  return { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444', border: 'rgba(239,68,68,0.25)' };
    if (type === 'pending')   return { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', border: 'rgba(245,158,11,0.25)' };
    return { bg: 'rgba(99,102,241,0.12)', color: '#818CF8', border: 'rgba(99,102,241,0.25)' };
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtTimeAgo(ts) {
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

  function buildPage() {
    var unreadCount = notifs.filter(function(n) { return !n.isRead; }).length;
    var filtered    = getFiltered();
    var unread      = filtered.filter(function(n) { return !n.isRead; });
    var read        = filtered.filter(function(n) { return n.isRead; });

    return '' +
      '<div class="page-padding">' +
        // Header — submitter style
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap;">' +
          '<div>' +
            '<h1 style="font-size:1.75rem;font-weight:700;color:#fff;margin:0 0 4px;">Notifications</h1>' +
            '<p style="color:var(--text-secondary,#9ca3af);font-size:0.875rem;margin:0;">Stay updated on your expense approvals, rejections, and escalations.</p>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center;">' +
            (unreadCount > 0 ? '<span style="background:var(--primary,#6366f1);color:#fff;font-size:0.75rem;font-weight:600;padding:3px 12px;border-radius:999px;">' + unreadCount + ' Unread</span>' : '') +
            (unreadCount > 0 ? '<button id="notif-mark-all" type="button" style="background:transparent;border:1px solid var(--border-default,#374151);color:var(--text-secondary,#9ca3af);font-size:0.8rem;padding:7px 16px;border-radius:8px;cursor:pointer;">Mark All Read</button>' : '') +
          '</div>' +
        '</div>' +

        // Tabs — kept from manager for filter functionality
        '<div class="tabs" style="margin-bottom:20px;">' +
          buildTab('All') + buildTab('Pending') + buildTab('High Risk') + buildTab('Approved') + buildTab('Rejected') +
        '</div>' +

        // Feed
        '<div id="notif-feed" style="display:flex;flex-direction:column;gap:0;">' +
          buildSection('Unread', unread) +
          buildSection('Earlier', read) +
          (filtered.length === 0 ? buildEmpty() : '') +
        '</div>' +
      '</div>';
  }

  function buildTab(label) {
    var active = label === activeTab ? ' active' : '';
    return '<button class="tab-item' + active + '" data-tab="' + label + '" type="button">' + label + '</button>';
  }

  function buildSection(title, items) {
    if (!items.length) return '';
    return '' +
      '<div style="padding:8px 0 4px;">' +
        '<p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted,#6b7280);padding:0 4px 8px;">' + title + '</p>' +
        items.map(buildCard).join('') +
      '</div>';
  }

  function buildCard(n) {
    var colors = typeColors(n.type);
    var icon   = typeIcon(n.type);
    var ago    = fmtTimeAgo(n.original ? n.original.createdAt : null);
    var unreadBg     = n.isRead ? 'var(--bg-card,#1a2035)'   : 'rgba(99,102,241,0.06)';
    var unreadBorder = n.isRead ? 'rgba(255,255,255,0.06)'   : 'rgba(99,102,241,0.2)';
    return '' +
      '<div id="mgr-notif-' + escHtml(n.id) + '" style="' +
        'display:flex;align-items:flex-start;gap:14px;padding:16px 18px;' +
        'border-radius:14px;margin-bottom:8px;cursor:pointer;transition:background 0.15s;' +
        'background:' + unreadBg + ';border:1px solid ' + unreadBorder + ';' +
      '" data-notif-click="' + escHtml(n.id) + '">' +
        // Icon circle
        '<div style="' +
          'width:42px;height:42px;min-width:42px;border-radius:12px;' +
          'background:' + colors.bg + ';border:1px solid ' + colors.border + ';' +
          'display:flex;align-items:center;justify-content:center;margin-top:2px;' +
          'color:' + colors.color + ';' +
        '">' + icon + '</div>' +
        // Content
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">' +
            '<p style="font-size:0.9rem;font-weight:' + (n.isRead ? '500' : '600') + ';color:' + (n.isRead ? 'var(--text-secondary,#9ca3af)' : '#fff') + ';margin:0;">' + escHtml(n.title) + '</p>' +
            (!n.isRead ? '<span style="width:8px;height:8px;min-width:8px;border-radius:50%;background:#818cf8;flex-shrink:0;"></span>' : '') +
          '</div>' +
          '<p style="font-size:0.8rem;color:var(--text-muted,#6b7280);line-height:1.5;margin:0 0 6px;">' + escHtml(n.message) + '</p>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.72rem;color:var(--text-muted,#6b7280);">' + ago + '</span>' +
            '<button class="notif-del-btn" data-id="' + escHtml(n.id) + '" style="font-size:0.72rem;color:var(--text-muted,#6b7280);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px;">Dismiss</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function buildEmpty() {
    return '' +
      '<div style="text-align:center;padding:64px 24px;">' +
        '<div style="width:64px;height:64px;background:rgba(99,102,241,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818CF8" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>' +
        '</div>' +
        '<p style="color:var(--text-primary,#f9fafb);font-weight:600;font-size:1rem;margin-bottom:6px;">All caught up!</p>' +
        '<p style="color:var(--text-muted,#6b7280);font-size:0.875rem;">No ' + activeTab.toLowerCase() + ' notifications at the moment.</p>' +
      '</div>';
  }


  // ═════════════════════════════════════════════════
  //  EVENTS & Render
  // ═════════════════════════════════════════════════

  var _container = null;

  function reRender() {
    if (_container) {
      _container.innerHTML = buildPage();
      bindEvents(_container);
      
      // Update topnav bell if possible
      if (FinStack.topnav && typeof FinStack.topnav.updateUnreadCount === 'function') {
        var c = notifs.filter(function(n) { return !n.isRead; }).length;
        FinStack.topnav.updateUnreadCount(c);
      }
    }
  }

  function bindEvents(container) {
    // Tabs
    var tabs = container.querySelectorAll('.tab-item');
    for (var i = 0; i < tabs.length; i++) {
      (function(t) {
        t.addEventListener('click', function() {
          activeTab = t.getAttribute('data-tab');
          reRender();
        });
      })(tabs[i]);
    }

    // Mark all read
    var markAll = container.querySelector('#notif-mark-all');
    if (markAll) {
      markAll.addEventListener('click', function() {
        notifs.forEach(function(n) {
          n.isRead = true;
          if (window.FinStackStore) window.FinStackStore.markNotificationRead(n.id);
        });
        reRender();
      });
    }

    // Card click → mark as read
    var cards = container.querySelectorAll('[data-notif-click]');
    for (var c = 0; c < cards.length; c++) {
      (function(card) {
        card.addEventListener('click', function(e) {
          // Don't fire if clicking Dismiss button
          if (e.target.classList.contains('notif-del-btn') || e.target.closest('.notif-del-btn')) return;
          var id = card.getAttribute('data-notif-click');
          var n = findNotif(id);
          if (n && !n.isRead) {
            n.isRead = true;
            if (window.FinStackStore) window.FinStackStore.markNotificationRead(id);
            reRender();
          }
        });
      })(cards[c]);
    }

    // Dismiss (delete)
    var delBtns = container.querySelectorAll('.notif-del-btn');
    for (var d = 0; d < delBtns.length; d++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = btn.getAttribute('data-id');
          notifs = notifs.filter(function(x) { return x.id !== id; });
          if (window.FinStackStore) window.FinStackStore.deleteNotification(id);
          reRender();
        });
      })(delBtns[d]);
    }
  }

  function findNotif(id) {
    for (var i = 0; i < notifs.length; i++) {
      if (notifs[i].id === id) return notifs[i];
    }
    return null;
  }

  // ═════════════════════════════════════════════════
  //  PUBLIC API
  // ═════════════════════════════════════════════════

  FinStack.notifications = {
    autoFilterTab: null,
    render: function(container, navigateTo) {
      _container = container;
      // Use auto-filter if provided, else reset to All
      activeTab = this.autoFilterTab || 'All';
      this.autoFilterTab = null;
      loadNotifications();
      reRender();
    }
  };

})();
