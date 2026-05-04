/* ============================================================
   communications.js – Notifications page (Manager-standard UI)
   ============================================================ */

'use strict';

const NOTIFICATIONS_DATA = [
  {
    id: 'pol-311',
    status: 'high_risk',
    title: 'Critical Policy Violation Detected',
    message: 'Unauthorized customer data export breached the Data Handling Policy and requires immediate escalation.',
    meta: 'POL-311 • Data Handling Policy • Severity: Critical',
    time: '2 hours ago',
    cta: 'Review',
    action: 'review',
    unread: true
  },
  {
    id: 'pol-287',
    status: 'pending',
    title: 'Policy Update Awaiting Approval',
    message: 'The revised Vendor Due Diligence policy has been submitted and is waiting for compliance approval.',
    meta: 'POL-287 • Vendor Due Diligence • Submitted by Hari Vamsi',
    time: '3 hours ago',
    cta: 'Review',
    action: 'review',
    unread: true
  },
  {
    id: 'reg-104',
    status: 'high_risk',
    title: 'Regulatory Deadline at Risk',
    message: 'Mandatory quarterly AML attestation remains incomplete for one operating region.',
    meta: 'REG-104 • AML Attestation • Due in 18 hours',
    time: '4 hours ago',
    cta: 'Review',
    action: 'review',
    unread: true
  },
  {
    id: 'aud-552',
    status: 'approved',
    title: 'Remediation Plan Approved',
    message: 'The remediation plan for the access control exception was approved and moved to implementation.',
    meta: 'AUD-552 • Access Control Exception • Approved by Review Board',
    time: '20 hours ago',
    cta: 'View',
    action: 'view',
    unread: false
  },
  {
    id: 'pol-275',
    status: 'pending',
    title: 'Evidence Review Pending',
    message: 'Supporting evidence for the Information Security policy exception is waiting for your validation.',
    meta: 'POL-275 • Information Security Policy • Owner: Marcus Johnson',
    time: '1 day ago',
    cta: 'Review',
    action: 'review',
    unread: true
  },
  {
    id: 'cmp-143',
    status: 'approved',
    title: 'Compliance Report Published',
    message: 'The monthly compliance summary was finalized and distributed to stakeholders.',
    meta: 'CMP-143 • Monthly Compliance Summary • Published',
    time: '2 days ago',
    cta: 'View',
    action: 'view',
    unread: false
  },
  {
    id: 'pol-261',
    status: 'rejected',
    title: 'Policy Exception Rejected',
    message: 'The request to bypass multi-factor authentication controls was rejected during compliance review.',
    meta: 'POL-261 • MFA Exception Request • Rejected',
    time: '2 days ago',
    cta: 'View',
    action: 'view',
    unread: false
  }
];
window.NOTIFICATIONS_DATA = NOTIFICATIONS_DATA;

let notificationsTab = 'all';

function escapeCommsHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeStoreNotificationStatus(notification) {
  const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
  if (text.includes('reject')) return 'rejected';
  if (notification.type === 'success') return 'approved';
  if (notification.type === 'danger') return 'high_risk';
  if (notification.type === 'warning') return 'pending';
  return 'pending';
}

function syncNotificationsFromStore() {
  if (!window.FinStackStore || typeof window.FinStackStore.getNotifications !== 'function') return;
  let storeItems = [];
  try {
    storeItems = window.FinStackStore.getNotifications();
  } catch (error) {
    return;
  }
  NOTIFICATIONS_DATA.length = 0;
  storeItems.forEach((item) => {
    const status = normalizeStoreNotificationStatus(item);
    NOTIFICATIONS_DATA.push({
      id: item.id,
      status,
      title: item.title || 'Notification',
      message: item.message || '',
      meta: item.relatedExpenseId ? `Expense ${item.relatedExpenseId}` : 'Compliance notification',
      time: item.time || (item.createdAt && window.FinStackStore.formatTimeAgo ? window.FinStackStore.formatTimeAgo(item.createdAt) : 'Recently'),
      cta: status === 'pending' || status === 'high_risk' ? 'Review' : 'View',
      action: status === 'pending' || status === 'high_risk' ? 'review' : 'view',
      unread: item.unread !== false,
      storeId: item.id,
      relatedExpenseId: item.relatedExpenseId || ''
    });
  });
}

function getNotificationIcon(status) {
  if (status === 'approved') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6 9 17l-5-5"/>
      </svg>`;
  }
  if (status === 'pending') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>`;
  }
  if (status === 'rejected') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>`;
  }
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m10.29 3.86-7.58 13.13A2 2 0 0 0 4.42 20h15.16a2 2 0 0 0 1.73-3.01L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
}

function getNotificationTone(status) {
  if (status === 'pending') return 'pending';
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'high-risk';
}

function getFilteredNotifications() {
  if (notificationsTab === 'all') return NOTIFICATIONS_DATA;
  return NOTIFICATIONS_DATA.filter((item) => item.status === notificationsTab);
}

function renderNotificationCounts() {
  syncNotificationsFromStore();
  const countMap = {
    all: NOTIFICATIONS_DATA.length,
    pending: NOTIFICATIONS_DATA.filter((item) => item.status === 'pending').length,
    high_risk: NOTIFICATIONS_DATA.filter((item) => item.status === 'high_risk').length,
    approved: NOTIFICATIONS_DATA.filter((item) => item.status === 'approved').length,
    rejected: NOTIFICATIONS_DATA.filter((item) => item.status === 'rejected').length
  };

  Object.entries(countMap).forEach(([key, value]) => {
    const el = document.getElementById(`tab-count-${key}`);
    if (el) el.textContent = String(value);
  });

  /* Update the NEW badge */
  const unreadCount = NOTIFICATIONS_DATA.filter(n => n.unread).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    if (unreadCount > 0) {
      badge.style.display = 'inline';
      badge.textContent = unreadCount + ' NEW';
    } else {
      badge.style.display = 'none';
    }
  }
}

function renderNotifications() {
  syncNotificationsFromStore();
  const feed = document.getElementById('notifications-feed');
  const empty = document.getElementById('notifications-empty');
  if (!feed || !empty) return;

  const filtered = getFilteredNotifications();
  if (!filtered.length) {
    feed.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  feed.innerHTML = filtered.map((item) => {
    const tone = getNotificationTone(item.status);
    const buttonClass = item.action === 'review' ? 'primary' : 'secondary';
    return `
      <article class="notification-card ${tone}">
        <div class="notification-icon ${tone}">
          ${getNotificationIcon(item.status)}
        </div>
        <div class="notification-copy">
          <h3 class="notification-card-title">${escapeCommsHtml(item.title)}</h3>
          <p class="notification-card-message">${escapeCommsHtml(item.message)}</p>
          <div class="notification-card-meta">${escapeCommsHtml(item.meta)}<span class="notification-card-dot"></span>${item.unread ? '<span class="notification-card-dot"></span><span>Unread</span>' : '<span class="notification-card-dot"></span><span>Read</span>'}</div>
        </div>
        <div class="notification-card-side">
          <div class="notification-card-time">${escapeCommsHtml(item.time)}</div>
          <button class="notification-card-btn ${buttonClass}" type="button" onclick="handleNotificationAction('${escapeCommsHtml(item.id)}')">
            ${item.action === 'review'
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`
      }
            ${item.cta}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

window.setNotificationsTab = function (tab) {
  notificationsTab = tab;
  document.querySelectorAll('.notifications-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  renderNotifications();
};

window.markAllRead = function () {
  if (window.FinStackStore) window.FinStackStore.markAllNotificationsRead();
  syncNotificationsFromStore();
  Toast.success('All notifications marked as read');
  renderNotificationCounts();
  renderNotifications();
};

window.clearAllNotifications = function () {
  if (window.FinStackStore) {
    window.FinStackStore.getNotifications().forEach((item) => {
      window.FinStackStore.deleteNotification(item.id);
    });
  }
  syncNotificationsFromStore();
  Toast.success('Notifications cleared');
  renderNotificationCounts();
  renderNotifications();
};

window.handleNotificationAction = function (id) {
  const item = NOTIFICATIONS_DATA.find((entry) => entry.id === id);
  if (!item) return;

  if (window.FinStackStore) window.FinStackStore.markNotificationRead(item.storeId || item.id);
  syncNotificationsFromStore();
  renderNotificationCounts();
  renderNotifications();

  if (item.action === 'review') {
    Toast.info(`Opening ${item.id} for review`);
    Router.navigate(item.relatedExpenseId ? 'escalated' : 'policies');
    return;
  }

  Toast.info(`Viewing ${item.id}`);
};

function initCommunications() {
  const renderFromStore = () => {
    syncNotificationsFromStore();
    renderNotificationCounts();
    renderNotifications();
  };
  if (window.FinStackStore && window.FinStackStore.ready) {
    window.FinStackStore.ready.then(renderFromStore);
    return;
  }
  renderFromStore();
}

window.initCommunications = initCommunications;
