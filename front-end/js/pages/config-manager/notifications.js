initLayout('Notifications');
const notice = document.createElement('p');
notice.setAttribute('role', 'status');
notice.textContent = 'Notifications and their read or dismissed state are stored securely and persist after a backend restart.';
document.querySelector('main').prepend(notice);

(function () {
  var currentFilter = 'all', currentPage = 1, pages = 0, requestId = 0;
  var controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:16px';
  controls.innerHTML = '<button type="button" id="notifications-prev">Previous</button><span id="notifications-page" role="status"></span><button type="button" id="notifications-next">Next</button><button type="button" id="notifications-refresh">Refresh</button>';
  document.getElementById('notif-list').after(controls);
  function esc(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function load(initial) {
    var version = ++requestId;
    notice.textContent = 'Loading notifications...';
    var types = { approved: 'success', pending: 'warning', 'high-risk': 'danger', info: 'info' };
    var cached = initial === true && window.FinStackStore.getNotificationPage();
    var response = cached ? Promise.resolve(cached) : window.FinStackStore.loadNotifications(Object.assign({page:currentPage,pageSize:25}, types[currentFilter] ? {type:types[currentFilter]} : {}));
    return response.then(function (result) {
      if (version !== requestId) return;
      pages = result.totalPages;
      if (currentPage > Math.max(1,pages)) { currentPage = Math.max(1,pages); return load(); }
      notice.textContent = 'Notifications and their read or dismissed state are stored securely and persist after a backend restart.';
      document.getElementById('notifications-page').textContent = 'Page ' + currentPage + ' of ' + Math.max(1,pages) + ' / ' + result.total + ' notifications';
      document.getElementById('notifications-prev').disabled = currentPage <= 1;
      document.getElementById('notifications-next').disabled = currentPage >= pages;
      render();
    }).catch(function (error) { if(version===requestId) notice.textContent = 'Unable to load notifications. Use Refresh to retry. ' + error.message; });
  }
  document.getElementById('notifications-prev').onclick = function () { currentPage--; load(); };
  document.getElementById('notifications-next').onclick = function () { currentPage++; load(); };
  document.getElementById('notifications-refresh').onclick = load;

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
    var unread = window.FinStackStore.getUnreadNotificationCount();
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
          '<div class="notif-title">' + esc(item.title) + '</div>' +
          '<div class="notif-body">' + esc(item.message) + '</div>' +
          '<div class="notif-meta"><span>' + (item.time || window.FinStackStore.formatTimeAgo(item.createdAt)) + '</span><span class="dot-sep">â€¢</span><span>' + (read ? 'Read' : 'Unread') + '</span></div>' +
        '</div>' +
        '<div class="notif-actions">' +
          '<button onclick="toggleRead(\'' + item.id + '\')" title="' + (read ? 'Mark as unread' : 'Mark as read') + '"><i data-lucide="eye" style="width:16px;height:16px;"></i></button>' +
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
    currentPage = 1; load();
  };

  window.markAllRead = function () {
    try { window.FinStackStore.markAllNotificationsRead(true); } catch(error) { notice.textContent = 'Unable to update notifications. ' + error.message; return; }
    load();
  };

  window.toggleRead = function (id) {
    var item = window.FinStackStore.getNotifications().find(function (n) { return n.id === id; });
    try {
      if (item && item.unread === false) window.FinStackStore.markNotificationUnread(id, true);
      else window.FinStackStore.markNotificationRead(id, true);
    } catch (error) { notice.textContent = 'Unable to update notification. ' + error.message; return; }
    load();
  };

  window.deleteNotif = function (id) {
    try { window.FinStackStore.deleteNotification(id, true); } catch(error) { notice.textContent = 'Unable to dismiss notification. ' + error.message; return; }
    load();
  };

  window.FinStackStore.ready.then(function () { load(true); });
})();
