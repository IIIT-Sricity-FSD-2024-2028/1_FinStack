/* ===== SHARED.JS — FinStack Global Utilities ===== */

function redirectToSharedLogin() {
    sessionStorage.removeItem('finstackUserSession');
    window.location.href = '../../login.html?role=expense_submitter';
}

var FinStack = {
    whenReady: function (callback) {
        if (!window.FinStackStore || !window.FinStackStore.ready) {
            callback();
            return;
        }
        window.FinStackStore.ready.then(callback);
    },

    getExpenses: function () {
        return window.FinStackStore ? window.FinStackStore.getExpensesForCurrentUser() : [];
    },
    getExpenseById: function (id) {
        return window.FinStackStore ? window.FinStackStore.getExpenseById(id) : null;
    },
    updateExpense: function (id, updates, resubmit) {
        if (!window.FinStackStore) return null;
        return window.FinStackStore.updateExpenseAsSubmitter(id, updates, !!resubmit);
    },
    deleteExpense: function (id) {
        if (!window.FinStackStore) return false;
        return window.FinStackStore.deleteExpense(id);
    },

    getNotifications: function () {
        return window.FinStackStore ? window.FinStackStore.getNotifications() : [];
    },
    markNotificationRead: function (id) {
        return window.FinStackStore ? window.FinStackStore.markNotificationRead(id) : null;
    },
    markAllRead: function () {
        if (window.FinStackStore) {
            window.FinStackStore.markAllNotificationsRead();
        }
    },
    getUnreadCount: function () {
        return this.getNotifications().filter(function (notification) {
            return notification.unread;
        }).length;
    },

    getProfile: function () {
        return window.FinStackStore ? window.FinStackStore.getCurrentUser() || {} : {};
    },
    saveProfile: function (profile) {
        if (!window.FinStackStore) return null;
        var currentUser = window.FinStackStore.getCurrentUser();
        if (!currentUser) return null;
        return window.FinStackStore.updateUser(currentUser.employeeId, profile);
    },

    getStatusTimeline: function (expenseId) {
        return window.FinStackStore ? window.FinStackStore.getStatusTimeline(expenseId) : [];
    },

    getFlagRisk: function (flag) {
        if (flag === 'mismatch') return 20;
        if (flag === 'duplicate') return 25;
        if (flag === 'low_ocr_quality') return 15;
        if (flag === 'suspicious_amount') return 30;
        return 0;
    },
    calculateRisk: function (flag, confidence) {
        var baseRisk = Math.floor(Math.random() * 40);
        var flagRisk = this.getFlagRisk(flag);
        var ocrImpact = 100 - confidence;
        return Math.min(baseRisk + flagRisk + ocrImpact, 100);
    },
    randomConfidence: function () {
        return Math.floor(Math.random() * 61) + 40;
    },
    randomFlag: function () {
        var flags = ['none', 'mismatch', 'duplicate', 'low_ocr_quality', 'suspicious_amount'];
        return flags[Math.floor(Math.random() * flags.length)];
    },
    getRiskLabel: function (score) {
        if (score <= 30) return 'Good';
        if (score <= 70) return 'Moderate';
        return 'High Risk';
    },
    getRiskBadgeClass: function (score) {
        if (score < 30) return 'badge-success';
        if (score < 70) return 'badge-warning';
        return 'badge-danger';
    },
    getWorkflowLabel: function (expense) {
        var labels = {
            manager_review: 'Manager Review',
            finance_review: 'Finance Review',
            compliance_review: 'Compliance Review',
            approved_for_payment: 'Approved for Payment',
            payment_processing: 'Payment Processing',
            paid: 'Paid',
            returned: 'Returned',
            rejected: 'Rejected'
        };
        return labels[expense.workflowStatus] || labels[expense.status] || 'Submitted';
    },
    getWorkflowBadgeClass: function (expense) {
        if (expense.workflowStatus === 'rejected' || expense.status === 'rejected') return 'badge-danger';
        if (expense.workflowStatus === 'paid' || expense.workflowStatus === 'approved_for_payment' || expense.status === 'approved') return 'badge-success';
        return 'badge-warning';
    },

    formatCurrency: function (amount) {
        return '₹' + Number(amount || 0).toLocaleString('en-IN');
    },
    formatDate: function (dateStr) {
        if (!dateStr) return '';
        var date = new Date(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }
};

function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    var icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<div class="toast-icon">' + (icons[type] || icons.info) + '</div><span>' + message + '</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>';
    container.appendChild(toast);
    setTimeout(function () { toast.classList.add('toast-show'); }, 10);
    setTimeout(function () {
        toast.classList.remove('toast-show');
        setTimeout(function () {
            if (toast.parentElement) toast.remove();
        }, 300);
    }, 4000);
}

function escapeNotificationHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateTopbarUser() {
    var session = null;
    try { session = JSON.parse(sessionStorage.getItem('finstackUserSession')); } catch(e) {}
    var profile = session || FinStack.getProfile();
    var nameEl = document.querySelector('.topbar-user-name');
    var roleEl = document.querySelector('.topbar-user-role');
    var avatarEl = document.querySelector('.topbar-avatar');
    if (nameEl) nameEl.textContent = profile.fullName || 'Expense Submitter';
    if (roleEl) roleEl.textContent = 'expense submitter';
    if (avatarEl) {
        var initials = String(profile.fullName || 'ES')
            .split(' ')
            .map(function (part) { return part.charAt(0); })
            .join('')
            .slice(0, 2)
            .toUpperCase();
        avatarEl.textContent = initials;
    }
    /* Override topbar title to FinStack Workspace pattern */
    var titleEl = document.querySelector('.topbar-title');
    if (titleEl) {
        titleEl.textContent = 'FinStack Workspace';
    }
}

function initTopbar() {
    var userEl = document.querySelector('.topbar-user');
    if (userEl && !userEl.querySelector('.topbar-dropdown')) {
        userEl.style.position = 'relative';
        userEl.style.cursor = 'pointer';
        var dropdown = document.createElement('div');
        dropdown.className = 'topbar-dropdown';
        dropdown.id = 'userDropdown';
        dropdown.innerHTML =
            '<a href="expenses.html" class="topbar-dd-item">My Expenses</a>' +
            '<a href="status.html" class="topbar-dd-item">Expense Status</a>' +
            '<a href="profile-settings.html" class="topbar-dd-item">Profile &amp; Settings</a>' +
            '<div class="topbar-dd-divider"></div>' +
            '<a href="#" class="topbar-dd-item topbar-dd-danger" id="ddLogout">Logout</a>';
        userEl.appendChild(dropdown);

        userEl.addEventListener('click', function (event) {
            event.stopPropagation();
            dropdown.classList.toggle('active');
            var bellDropdown = document.getElementById('bellDropdown');
            if (bellDropdown) {
                bellDropdown.classList.remove('active');
                bellDropdown.classList.remove('open');
            }
        });

        var ddLogout = document.getElementById('ddLogout');
        if (ddLogout) {
            ddLogout.addEventListener('click', function (event) {
                event.preventDefault();
                redirectToSharedLogin();
            });
        }
    }

    var bellEl = document.querySelector('.topbar-bell');
    if (bellEl && !document.getElementById('bellDropdown')) {
        bellEl.style.position = 'relative';
        var bellAnchor = bellEl.parentElement;
        if (!bellAnchor || !bellAnchor.classList.contains('notif-anchor')) {
            bellAnchor = document.createElement('div');
            bellAnchor.className = 'notif-anchor';
            bellAnchor.style.position = 'relative';
            bellAnchor.style.display = 'flex';
            bellAnchor.style.alignItems = 'center';
            bellEl.parentNode.insertBefore(bellAnchor, bellEl);
            bellAnchor.appendChild(bellEl);
        }
        var bellDropdown = document.createElement('div');
        bellDropdown.className = 'bell-dropdown notif-dropdown';
        bellDropdown.id = 'bellDropdown';
        bellAnchor.appendChild(bellDropdown);
        bellDropdown.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        bellEl.addEventListener('click', function (event) {
            event.stopPropagation();
            event.preventDefault();
            renderBellDropdown();
            var shouldOpen = !bellDropdown.classList.contains('active') && !bellDropdown.classList.contains('open');
            bellDropdown.classList.toggle('active', shouldOpen);
            bellDropdown.classList.toggle('open', shouldOpen);
            var userDropdown = document.getElementById('userDropdown');
            if (userDropdown) userDropdown.classList.remove('active');
        });
    }

    updateBellDot();
    updateTopbarUser();

    document.addEventListener('click', function () {
        var userDropdown = document.getElementById('userDropdown');
        if (userDropdown) userDropdown.classList.remove('active');
        var bellDropdown = document.getElementById('bellDropdown');
        if (bellDropdown) {
            bellDropdown.classList.remove('active');
            bellDropdown.classList.remove('open');
        }
    });
}

function initLogoutActions() {
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            redirectToSharedLogin();
        });
    }
}

function updateBellDot() {
    var bell = document.querySelector('.topbar-bell');
    if (!bell) return;
    var dot = bell.querySelector('.dot');
    if (!dot) {
        dot = document.createElement('span');
        dot.className = 'dot';
        bell.appendChild(dot);
    }
    var count = FinStack.getUnreadCount();
    dot.textContent = count > 9 ? '9+' : String(count);
    dot.style.display = count > 0 ? 'flex' : 'none';
}

function renderBellDropdown() {
    var dropdown = document.getElementById('bellDropdown');
    if (!dropdown) return;
    var notifications = FinStack.getNotifications();
    var unreadCount = notifications.filter(function (notification) { return notification.unread; }).length;
    if (!notifications.length) {
        dropdown.innerHTML =
            '<div class="notif-dropdown-header"><div><h3>Notifications</h3><p>0 unread</p></div><button class="notif-mark-read" type="button" disabled>Mark all as read</button></div>' +
            '<div class="notif-dropdown-empty">No notifications</div>' +
            '<div class="notif-dropdown-footer"><a href="notifications.html" class="notif-view-all">View All Notifications</a></div>';
        return;
    }

    var markAllBtn = '<button class="notif-mark-read" id="sub-mark-all-read" type="button"' + (unreadCount ? '' : ' disabled') + '>Mark all as read</button>';

    var itemsHtml = notifications.slice(0, 5).map(function (notification) {
        var isUnread = notification.unread !== false;
        return '<div class="notif-item' + (isUnread ? ' unread' : '') + '" data-notif-id="' + escapeNotificationHtml(notification.id) + '">' +
            '<div class="notif-item-body">' +
                '<div class="notif-item-title"><span>' + escapeNotificationHtml(notification.title) + '</span>' + (isUnread ? '<span class="notif-unread-dot"></span>' : '') + '</div>' +
                '<div class="notif-item-desc">' + escapeNotificationHtml(notification.message) + '</div>' +
                '<div class="notif-item-time">' + escapeNotificationHtml(notification.time || 'Recently') + '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    dropdown.innerHTML =
        '<div class="notif-dropdown-header"><div><h3>Notifications</h3><p>' + unreadCount + ' unread</p></div>' + markAllBtn + '</div>' +
        '<div class="notif-list">' + itemsHtml + '</div>' +
        '<div class="notif-dropdown-footer"><a href="notifications.html" class="notif-view-all">View All Notifications</a></div>';

    // Bind mark-all-read
    var markBtn = document.getElementById('sub-mark-all-read');
    if (markBtn) {
        markBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            FinStack.markAllRead();
            updateBellDot();
            renderBellDropdown();
        });
    }

    dropdown.querySelectorAll('.notif-item[data-notif-id]').forEach(function (item) {
        item.addEventListener('click', function (event) {
            event.stopPropagation();
            var id = item.getAttribute('data-notif-id');
            if (id) FinStack.markNotificationRead(id);
            updateBellDot();
            renderBellDropdown();
        });
    });
}

function initSidebarCollapse() {
    var sidebar = document.querySelector('.sidebar');
    var toggleBtn = document.getElementById('sidebar-collapse-btn');
    if (!sidebar) return;

    var isCollapsed = localStorage.getItem('finstack-sidebar-collapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }

    setTimeout(function () {
        document.documentElement.classList.remove('sidebar-collapsed-init');
    }, 50);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            var collapsed = sidebar.classList.toggle('collapsed');
            localStorage.setItem('finstack-sidebar-collapsed', collapsed);
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    FinStack.whenReady(function () {
        initTopbar();
        initSidebarCollapse();
        initLogoutActions();
    });
});
document.addEventListener('DOMContentLoaded', function () {
    FinStack.whenReady(function () {
    var currentUser = window.FinStackStore.getCurrentUser();
    var allExpenses = window.FinStackStore.getExpenses() || [];
    var expenses = allExpenses.filter(function (e) {
        return currentUser && e.employeeId === currentUser.employeeId;
    });
    function renderBarChart(container, items, color) {
        if (!container) return;
        var max = items.reduce(function (current, item) {
            return Math.max(current, item.value);
        }, 1);
        container.innerHTML = '<div style="display:flex;align-items:flex-end;gap:12px;height:100%;padding-top:12px;">' +
            items.map(function (item) {
                var height = Math.max(18, Math.round((item.value / max) * 100));
                return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">' +
                    '<div style="font-size:11px;color:#d4d4d8;margin-bottom:8px;">' + item.value + '</div>' +
                    '<div style="width:100%;max-width:38px;height:' + height + '%;min-height:18px;border-radius:14px 14px 6px 6px;background:' + color + ';box-shadow:0 10px 18px rgba(0,0,0,0.18);"></div>' +
                    '<div style="margin-top:10px;font-size:12px;color:#a1a1aa;text-align:center;">' + item.label + '</div>' +
                '</div>';
            }).join('') +
            '</div>';
    }

    function renderLineChart(container, points) {
        if (!container) return;
        var max = points.reduce(function (current, item) {
            return Math.max(current, item.value);
        }, 1);
        var min = points.reduce(function (current, item) {
            return Math.min(current, item.value);
        }, max);
        var range = Math.max(1, max - min);
        var width = 520;
        var height = 220;
        var step = points.length > 1 ? width / (points.length - 1) : width;
        var linePoints = points.map(function (item, index) {
            var x = Math.round(index * step);
            var y = Math.round(height - (((item.value - min) / range) * 150) - 24);
            return { x: x, y: y, label: item.label, value: item.value };
        });
        var polyline = linePoints.map(function (point) {
            return point.x + ',' + point.y;
        }).join(' ');

        container.innerHTML = '<div style="height:100%;display:flex;flex-direction:column;justify-content:space-between;">' +
            '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:220px;overflow:visible;">' +
                '<path d="M0 196 H520" stroke="rgba(113,113,122,0.3)" stroke-width="1"/>' +
                '<path d="M0 126 H520" stroke="rgba(113,113,122,0.18)" stroke-width="1"/>' +
                '<path d="M0 56 H520" stroke="rgba(113,113,122,0.12)" stroke-width="1"/>' +
                '<polyline points="' + polyline + '" fill="none" stroke="#7c3aed" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
                linePoints.map(function (point) {
                    return '<circle cx="' + point.x + '" cy="' + point.y + '" r="5" fill="#7c3aed"/>' +
                        '<text x="' + point.x + '" y="' + (point.y - 12) + '" text-anchor="middle" fill="#d4d4d8" font-size="12">' + point.value + '</text>';
                }).join('') +
            '</svg>' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#a1a1aa;">' +
                points.map(function (point) {
                    return '<span>' + point.label + '</span>';
                }).join('') +
            '</div>' +
        '</div>';
    }

    // Compute KPIs from expenses
    var totalExpenses = expenses.length;
    var totalAmount = expenses.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0);
    var pending = expenses.filter(function (e) { return e.status === 'pending'; }).length;
    var approved = expenses.filter(function (e) { return e.status === 'approved'; }).length;

    var kpis = [
        { label: 'Total Expenses', value: totalExpenses.toString(), change: '+12%', arrow: 'up', color: 'rgba(124,58,237,0.15)', iconColor: '#8b5cf6' },
        { label: 'Total Amount', value: FinStack.formatCurrency(totalAmount), change: '+8%', arrow: 'up', color: 'rgba(16,185,129,0.15)', iconColor: '#34d399' },
        { label: 'Pending', value: pending.toString(), change: 'Awaiting', arrow: '', color: 'rgba(245,158,11,0.15)', iconColor: '#fbbf24' },
        { label: 'Approved', value: approved.toString(), change: '+3 this week', arrow: 'up', color: 'rgba(139,92,246,0.15)', iconColor: '#a78bfa' }
    ];

    var kpiIcons = [
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5V6.5"/></svg>',
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    ];

    var kpiGrid = document.getElementById('kpiGrid');
    if (kpiGrid) {
        kpiGrid.innerHTML = kpis.map(function (k, i) {
            var arrowSvg = k.arrow === 'up' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' : '';
            return '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">' + k.label + '</span><div class="kpi-icon" style="background:' + k.color + ';color:' + k.iconColor + ';">' + kpiIcons[i] + '</div></div><div class="kpi-value">' + k.value + '</div><div class="kpi-change">' + arrowSvg + '<span style="color:' + (k.arrow === 'up' ? '#10b981' : '#a1a1aa') + ';">' + k.change + '</span></div></div>';
        }).join('');
    }

    // Expense Trend Chart
    var trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        var trendHost = trendCtx.parentElement;
        if (trendHost) {
            trendHost.innerHTML = '';
            var trendMount = document.createElement('div');
            trendMount.style.height = '100%';
            trendHost.appendChild(trendMount);
            var baseTrend = expenses.length > 0 ? [18500, 24300, 31200, 22800, 45600] : [0, 0, 0, 0, 0];
            renderLineChart(trendMount, [
                { label: 'May', value: baseTrend[0] },
                { label: 'Jun', value: baseTrend[1] },
                { label: 'Jul', value: baseTrend[2] },
                { label: 'Aug', value: baseTrend[3] },
                { label: 'Sep', value: baseTrend[4] },
                { label: 'Oct', value: totalAmount }
            ]);
        }
    }

    // Category Chart
    var catCtx = document.getElementById('categoryChart');
    if (catCtx) {
        var catAmounts = {};
        expenses.forEach(function (e) {
            catAmounts[e.category] = (catAmounts[e.category] || 0) + e.amount;
        });
        var catLabels = Object.keys(catAmounts);
        var catData = catLabels.map(function (c) { return catAmounts[c]; });
        var catColors = ['#7c3aed', '#8b5cf6', '#22d3ee', '#10b981', '#f59e0b', '#ef4444'];
        var catHost = catCtx.parentElement;
        if (catHost) {
            catHost.innerHTML = '';
            var catMount = document.createElement('div');
            catMount.style.height = '100%';
            catHost.appendChild(catMount);
            renderBarChart(catMount, catLabels.map(function (label, index) {
                return { label: label, value: catData[index] };
            }), 'linear-gradient(180deg, #8b5cf6, #7c3aed)');
        }

        // Category legend
        var legendEl = document.getElementById('categoryLegend');
        if (legendEl) {
            legendEl.innerHTML = catLabels.map(function (cat, i) {
                return '<div class="cat-legend-item"><div class="cat-legend-left"><div class="cat-dot" style="background:' + catColors[i % catColors.length] + ';"></div><span style="color:#a1a1aa;">' + cat + '</span></div><span style="color:white;font-weight:500;">' + FinStack.formatCurrency(catAmounts[cat]) + '</span></div>';
            }).join('');
        }
    }

    // Recent Transactions from localStorage
    var recentContainer = document.getElementById('recentTransactions');
    if (recentContainer) {
        var recent = expenses.slice(0, 5);
        if (recent.length === 0) {
            recentContainer.innerHTML = '<div style="padding:32px;text-align:center;color:#71717a;">No recent transactions</div>';
        } else {
            recentContainer.innerHTML = recent.map(function (e) {
                var badgeClass = FinStack.getWorkflowBadgeClass(e);
                var label = FinStack.getWorkflowLabel(e);
                return '<div class="recent-item"><div class="recent-left"><div class="recent-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="recent-merchant">' + (e.merchant || e.category) + '</div><div class="recent-meta"><span>' + e.category + '</span><span>' + FinStack.formatDate(e.date) + '</span></div></div></div><div class="recent-right"><span class="badge ' + badgeClass + '">' + label + '</span><span class="recent-amount">' + FinStack.formatCurrency(e.amount) + '</span></div></div>';
            }).join('');
        }
    }
    });
});
