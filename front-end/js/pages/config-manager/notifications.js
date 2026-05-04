initLayout('Notifications');

(function () {
  var currentFilter = 'all';

  function icon(type) {
    if (type === 'danger' || type === 'high-risk') return 'alert-triangle';
    if (type === 'success' || type === 'approved') return 'check-circle';
    if (type === 'rejected') return 'x-circle';
    if (type === 'warning' || type === 'pending') return 'clock';
    return 'bell';
  }

  function colors(type) {
    if (type === 'danger' || type === 'high-risk' || type === 'rejected') return { bg: 'var(--red-bg)', color: 'var(--red)' };
    if (type === 'success' || type === 'approved') return { bg: 'var(--green-bg)', color: 'var(--green)' };
    if (type === 'warning' || type === 'pending') return { bg: 'var(--orange-bg)', color: 'var(--orange)' };
    return { bg: 'var(--purple-bg)', color: 'var(--purple)' };
  }

  function normalizeType(notification) {
    if (notification.type === 'danger') return 'high-risk';
    if (notification.type === 'success') return 'approved';
    if (notification.type === 'warning') return 'pending';
    return notification.type || 'info';
  }

  function getList() {
    if (!window.FinStackStore) return [];
    var list = window.FinStackStore.getNotifications().map(function (item) {
      item.type = normalizeType(item);
      item.isRead = item.unread === false || item.isRead === true;
      return item;
    });
    if (currentFilter === 'all') return list;
    return list.filter(function (item) { return item.type === currentFilter; });
  }

  function updateBadge() {
    var all = window.FinStackStore ? window.FinStackStore.getNotifications() : [];
    var unread = all.filter(function (item) { return item.unread !== false && item.isRead !== true; }).length;
    var badge = document.getElementById('notif-badge');
    if (badge) {
      badge.style.display = unread ? 'inline' : 'none';
      badge.textContent = unread + ' NEW';
    }
    var markBtn = document.getElementById('mark-all-btn');
    if (markBtn) markBtn.style.display = unread ? '' : 'none';
    if (typeof renderConfigNotifDropdown === 'function') renderConfigNotifDropdown();
  }

  function render() {
    var container = document.getElementById('notif-list');
    if (!container) return;
    var list = getList();
    if (!list.length) {
      container.innerHTML = '<div class="notif-empty"><div class="notif-empty-icon"><i data-lucide="bell"></i></div><h3 style="color:var(--text-primary);margin-bottom:4px;">No Notifications</h3><p style="color:var(--text-secondary);font-size:0.875rem;">You are all caught up.</p></div>';
      updateBadge();
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = list.map(function (item) {
      var c = colors(item.type);
      var read = item.unread === false || item.isRead === true;
      return '<div class="notif-item' + (read ? '' : ' unread') + '">' +
        '<div class="notif-icon-wrap" style="background:' + c.bg + ';color:' + c.color + ';"><i data-lucide="' + icon(item.type) + '" style="width:18px;height:18px;"></i></div>' +
        '<div class="notif-content">' +
          '<div class="notif-title">' + item.title + '</div>' +
          '<div class="notif-body">' + item.message + '</div>' +
          '<div class="notif-meta"><span>' + (item.time || window.FinStackStore.formatTimeAgo(item.createdAt)) + '</span><span class="dot-sep">•</span><span>' + (read ? 'Read' : 'Unread') + '</span></div>' +
        '</div>' +
        '<div class="notif-actions">' +
          '<button onclick="toggleRead(\'' + item.id + '\')" title="Mark as read"><i data-lucide="eye" style="width:16px;height:16px;"></i></button>' +
          '<button class="del-btn" onclick="deleteNotif(\'' + item.id + '\')" title="Delete notification"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
    updateBadge();
    if (window.lucide) lucide.createIcons();
  }

  window.filterNotifs = function (filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('#notif-tabs .notif-tab').forEach(function (tab) { tab.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    render();
  };

  window.markAllRead = function () {
    if (window.FinStackStore) window.FinStackStore.markAllNotificationsRead();
    render();
  };

  window.toggleRead = function (id) {
    if (window.FinStackStore) window.FinStackStore.markNotificationRead(id);
    render();
  };

  window.deleteNotif = function (id) {
    if (window.FinStackStore && window.FinStackStore.deleteNotification) window.FinStackStore.deleteNotification(id);
    render();
  };

  window.FinStackStore.ready.then(render);
})();
