/* ================================================
   approval-history.js — Shared manager history
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;
  var statusFilter = 'All';
  var searchQuery = '';
  var _container = null;

  function getHistory() {
    var user = window.FinStackStore.getCurrentUser();
    return window.FinStackStore.getManagerHistory(user ? user.employeeId : null);
  }

  function historyStatus(expense) {
    if (expense.managerDecision === 'Escalated') return 'Escalated';
    if (expense.managerDecision === 'Returned') return 'Returned';
    if (expense.managerDecision === 'Rejected') return 'Rejected';
    return 'Approved';
  }

  function statusClass(status) {
    if (status === 'Approved') return 'badge-approved';
    if (status === 'Rejected') return 'badge-rejected';
    if (status === 'Returned') return 'badge-pending';
    return 'badge-escalated';
  }

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

  function getFilteredHistory() {
    return getHistory().filter(function(expense) {
      var status = historyStatus(expense);
      var query = searchQuery.toLowerCase();
      var matchesStatus = statusFilter === 'All' || status === statusFilter;
      var matchesSearch = !query ||
        String(expense.employee || '').toLowerCase().indexOf(query) !== -1 ||
        String(expense.id || '').toLowerCase().indexOf(query) !== -1 ||
        String(expense.merchant || '').toLowerCase().indexOf(query) !== -1;
      return matchesStatus && matchesSearch;
    });
  }

  function buildStatusDropdown() {
    var label = statusFilter === 'All' ? 'All Statuses' : statusFilter;
    return '' +
      '<div class="dropdown" id="ah-status-dd">' +
        '<button class="dropdown-trigger" type="button" id="ah-status-btn">' +
          '<span>' + icons.filter(16) + '</span>' +
          '<span>' + label + '</span>' +
          '<span class="trigger-chevron">' + icons.chevronDown(16) + '</span>' +
        '</button>' +
        '<div class="dropdown-menu" id="ah-status-menu">' +
          buildStatusOption('All', 'All Statuses') +
          buildStatusOption('Approved', 'Approved') +
          buildStatusOption('Rejected', 'Rejected') +
          buildStatusOption('Returned', 'Returned') +
          buildStatusOption('Escalated', 'Escalated') +
        '</div>' +
      '</div>';
  }

  function buildStatusOption(value, label) {
    return '<button class="dropdown-option' + (statusFilter === value ? ' selected' : '') + '" data-status="' + value + '" type="button">' + label + '</button>';
  }

  function buildPage() {
    var filtered = getFilteredHistory();
    var history = getHistory();

    return '' +
      '<div class="page-padding">' +
        '<div class="page-header"><div><h1>Approval History</h1><p>View all processed expense requests</p></div></div>' +
        '<div class="er-filters">' +
          buildStatusDropdown() +
          '<div class="er-search"><span class="search-icon">' + icons.search(18) + '</span><input type="text" class="search-input" id="ah-search" placeholder="Search by employee, merchant, or ID..." value="' + esc(searchQuery) + '" autocomplete="off" /></div>' +
          '<div class="er-count"><span>Showing <strong>' + filtered.length + '</strong> of <strong>' + history.length + '</strong> processed expenses</span></div>' +
        '</div>' +
        buildTable(filtered) +
      '</div>';
  }

  function buildTable(items) {
    if (!items.length) {
      return '<div class="card"><div class="empty-state"><h3>No Matching History</h3><p>Try adjusting your filters.</p></div></div>';
    }

    var rows = items.map(function(expense) {
      var status = historyStatus(expense);
      return '' +
        '<tr class="clickable" data-eid="' + expense.id + '">' +
          '<td><div class="cell-primary">' + esc(getEmployeeDisplay(expense)) + '</div><div class="cell-secondary">' + esc(formatExpenseId(expense.id)) + '</div></td>' +
          '<td><div class="cell-primary" style="font-weight:var(--fw-normal);">' + (expense.merchant || expense.category) + '</div><div class="cell-secondary">' + expense.category + '</div></td>' +
          '<td><span class="cell-amount">₹' + Number(expense.amount || 0).toLocaleString('en-IN') + '</span></td>' +
          '<td><span class="badge ' + statusClass(status) + '">' + status + '</span></td>' +
          '<td><span class="cell-date">' + formatDate(expense.managerDecisionAt || expense.updatedAt || expense.created) + '</span></td>' +
          '<td><button class="btn-link ah-view-btn" data-eid="' + expense.id + '" type="button">Open ' + icons.arrowRight(14) + '</button></td>' +
        '</tr>';
    }).join('');

    return '' +
      '<div class="card" style="padding:0;">' +
        '<div class="table-wrapper">' +
          '<table class="table">' +
            '<thead><tr><th>Employee</th><th>Expense</th><th>Amount</th><th>Status</th><th>Processed</th><th>Action</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function formatDate(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? String(value || '-') : date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  function openHistoryModal(expenseId) {
    var expense = window.FinStackStore.getExpenseById(expenseId);
    var root = document.getElementById('modal-root');
    if (!expense || !root) return;
    var status = historyStatus(expense);
    root.innerHTML = '' +
      '<div class="modal-backdrop" id="history-backdrop"></div>' +
      '<div class="modal-dialog">' +
        '<div class="modal-header"><div><h2 class="modal-title">History Details</h2><p class="modal-subtitle">' + esc(formatExpenseId(expense.id)) + '</p></div><button class="modal-close" id="history-close" type="button">' + icons.x(24) + '</button></div>' +
        '<div class="modal-body">' +
          '<div class="card">' +
            '<div class="detail-field"><div class="detail-field-label">Employee</div><div class="detail-field-value">' + esc(getEmployeeDisplay(expense)) + '</div></div>' +
            '<div class="detail-field"><div class="detail-field-label">Amount</div><div class="detail-field-value">₹' + Number(expense.amount || 0).toLocaleString('en-IN') + '</div></div>' +
            '<div class="detail-field"><div class="detail-field-label">Category</div><div class="detail-field-value">' + expense.category + '</div></div>' +
            '<div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value">' + status + '</div></div>' +
            '<div class="detail-field"><div class="detail-field-label">Manager Note</div><div class="detail-field-value">' + (expense.managerDecisionNote || 'No note provided.') + '</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.classList.add('active');
    root.setAttribute('aria-hidden', 'false');
    function close() {
      root.classList.remove('active');
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = '';
    }
    root.querySelector('#history-backdrop').addEventListener('click', close);
    root.querySelector('#history-close').addEventListener('click', close);
  }

  function bindPageEvents(container) {
    var statusBtn = container.querySelector('#ah-status-btn');
    var statusMenu = container.querySelector('#ah-status-menu');
    if (statusBtn && statusMenu) {
      statusBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        statusMenu.classList.toggle('open');
        statusBtn.classList.toggle('open');
      });
      [].slice.call(statusMenu.querySelectorAll('.dropdown-option')).forEach(function(option) {
        option.addEventListener('click', function(event) {
          event.stopPropagation();
          statusFilter = option.getAttribute('data-status');
          reRender();
        });
      });
    }

    var searchInput = container.querySelector('#ah-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        searchQuery = searchInput.value;
        reRender();
        var nextInput = _container.querySelector('#ah-search');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    [].slice.call(container.querySelectorAll('tr.clickable, .ah-view-btn')).forEach(function(node) {
      node.addEventListener('click', function(event) {
        event.stopPropagation();
        openHistoryModal(node.getAttribute('data-eid'));
      });
    });
  }

  function reRender() {
    if (!_container) return;
    _container.innerHTML = buildPage();
    bindPageEvents(_container);
  }

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  FinStack.approvalHistory = {
    render: function(container) {
      _container = container;
      window.FinStackStore.ready.then(function() {
        statusFilter = 'All';
        searchQuery = '';
        reRender();
      });
    }
  };
})();
