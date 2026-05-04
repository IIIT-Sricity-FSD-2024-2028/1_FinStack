/* ================================================
   expense-review.js — Shared manager review queue
   ================================================ */

(function() {
  'use strict';

  var icons = FinStack.icons;
  var riskFilter = 'All';
  var searchQuery = '';
  var _container = null;

  function getQueue() {
    var user = window.FinStackStore.getCurrentUser();
    return window.FinStackStore.getManagerQueue(user ? user.employeeId : null);
  }

  function getRiskLabel(score) {
    if ((score || 0) >= 70) return 'High';
    if ((score || 0) >= 40) return 'Medium';
    return 'Low';
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

  function getFilteredQueue() {
    return getQueue().filter(function(expense) {
      var risk = getRiskLabel(expense.risk_score);
      var query = searchQuery.toLowerCase();
      var matchesRisk = riskFilter === 'All' || risk === riskFilter;
      var matchesSearch = !query ||
        String(expense.employee || '').toLowerCase().indexOf(query) !== -1 ||
        String(expense.id || '').toLowerCase().indexOf(query) !== -1 ||
        String(expense.merchant || '').toLowerCase().indexOf(query) !== -1 ||
        String(expense.category || '').toLowerCase().indexOf(query) !== -1;
      return matchesRisk && matchesSearch;
    });
  }

  function buildRiskDropdown() {
    var label = riskFilter === 'All' ? 'All Risks' : riskFilter;
    return '' +
      '<div class="dropdown" id="er-risk-dd">' +
        '<button class="dropdown-trigger" type="button" id="er-risk-btn">' +
          '<span>' + icons.filter(16) + '</span>' +
          '<span>' + label + '</span>' +
          '<span class="trigger-chevron">' + icons.chevronDown(16) + '</span>' +
        '</button>' +
        '<div class="dropdown-menu" id="er-risk-menu">' +
          buildRiskOption('All', 'All Risks') +
          buildRiskOption('High', 'High') +
          buildRiskOption('Medium', 'Medium') +
          buildRiskOption('Low', 'Low') +
        '</div>' +
      '</div>';
  }

  function buildRiskOption(value, label) {
    return '<button class="dropdown-option' + (riskFilter === value ? ' selected' : '') + '" data-risk="' + value + '" type="button">' + label + '</button>';
  }

  function buildPage() {
    var queue = getQueue();
    var filtered = getFilteredQueue();

    if (!queue.length) {
      return '' +
        '<div class="page-padding">' +
          '<div class="page-header"><div><h1>Expense Review</h1><p>Review and take action on pending expense requests</p></div></div>' +
          '<div class="card"><div class="empty-state"><div class="empty-state-icon" style="color:var(--primary);">' + icons.fileText(48) + '</div><h3>No Pending Expenses</h3><p>Your shared manager queue is clear.</p></div></div>' +
        '</div>';
    }

    return '' +
      '<div class="page-padding">' +
        '<div class="page-header"><div><h1>Expense Review</h1><p>Review and take action on pending expense requests</p></div></div>' +
        '<div class="er-filters">' +
          buildRiskDropdown() +
          '<div class="er-search"><span class="search-icon">' + icons.search(18) + '</span><input type="text" class="search-input" id="er-search" placeholder="Search by employee, merchant, category, or ID..." value="' + esc(searchQuery) + '" autocomplete="off" /></div>' +
          '<div class="er-count"><span>Showing <strong>' + filtered.length + '</strong> of <strong>' + queue.length + '</strong> expenses</span></div>' +
        '</div>' +
        buildTable(filtered) +
      '</div>';
  }

  function buildTable(items) {
    if (!items.length) {
      return '<div class="card"><div class="empty-state"><h3>No Matching Expenses</h3><p>Try adjusting your filters.</p></div></div>';
    }

    var rows = items.map(function(expense) {
      var risk = getRiskLabel(expense.risk_score);
      var riskClass = risk === 'High' ? 'badge-high' : risk === 'Medium' ? 'badge-medium' : 'badge-low';
      return '' +
        '<tr class="clickable" data-eid="' + expense.id + '">' +
          '<td><div class="cell-primary">' + esc(getEmployeeDisplay(expense)) + '</div><div class="cell-secondary">' + esc(formatExpenseId(expense.id)) + '</div></td>' +
          '<td><div class="cell-primary" style="font-weight:var(--fw-normal);">' + (expense.merchant || expense.category) + '</div><div class="cell-secondary">' + expense.category + '</div></td>' +
          '<td><span class="cell-amount">₹' + Number(expense.amount || 0).toLocaleString('en-IN') + '</span></td>' +
          '<td><span class="cell-date">' + formatDate(expense.date) + '</span></td>' +
          '<td><span class="badge ' + riskClass + '">' + risk + '</span></td>' +
          '<td><button class="btn-link er-view-btn" data-eid="' + expense.id + '" type="button">Open ' + icons.arrowRight(14) + '</button></td>' +
        '</tr>';
    }).join('');

    return '' +
      '<div class="card" style="padding:0;">' +
        '<div class="table-wrapper">' +
          '<table class="table">' +
            '<thead><tr><th>Employee</th><th>Expense</th><th>Amount</th><th>Date</th><th>Risk Level</th><th>Action</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function formatDate(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? String(value || '-') : date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  function openDetailModal(expenseId) {
    var expense = window.FinStackStore.getExpenseById(expenseId);
    var root = document.getElementById('modal-root');
    if (!expense || !root) return;

    root.innerHTML = '' +
      '<div class="modal-backdrop" id="detail-backdrop"></div>' +
      '<div class="modal-dialog modal-dialog-lg">' +
        '<div class="modal-header"><div><h2 class="modal-title">Expense Details</h2><p class="modal-subtitle">' + esc(formatExpenseId(expense.id)) + '</p></div><button class="modal-close" id="detail-close" type="button">' + icons.x(24) + '</button></div>' +
        '<div class="modal-body">' +
          '<div class="detail-grid">' +
            '<div class="detail-stack">' +
              buildDetailCard('Employee Information', icons.user(20), [
                detailRow('Name', esc(getEmployeeDisplay(expense))),
                detailRow('Employee ID', expense.employeeId || '-'),
                detailRow('Manager', expense.managerEmployeeId || '-')
              ]) +
              buildDetailCard('Expense Information', icons.fileText(20), [
                detailRow('Category', expense.category),
                detailRow('Merchant', expense.merchant || '-'),
                detailRow('Amount', '₹' + Number(expense.amount || 0).toLocaleString('en-IN')),
                detailRow('Date', formatDate(expense.date)),
                detailRow('Payment Method', expense.paymentMethod || '-'),
                detailRow('Notes', expense.notes || 'No notes provided.')
              ]) +
            '</div>' +
            '<div class="detail-stack">' +
              buildDetailCard('Risk Assessment', icons.shield(20), [
                detailRow('Risk Score', String(expense.risk_score || 0) + '/100'),
                detailRow('Flag', expense.flag || 'none'),
                detailRow('OCR Confidence', String(expense.extraction_confidence || 0) + '%'),
                detailRow('Workflow', expense.workflowStatus || 'manager_review')
              ]) +
              '<div class="card">' +
                '<h3 class="card-section-title mb-4" style="display:flex; align-items:center; gap:var(--sp-2);"><span style="color:var(--primary);">' + icons.messageSquare(20) + '</span> Manager Note</h3>' +
                '<textarea class="form-textarea" id="manager-action-note" rows="4" placeholder="Add approval, return, or rejection context...">' + esc(expense.managerDecisionNote || '') + '</textarea>' +
              '</div>' +
              '<div class="flex items-center justify-end gap-3" style="padding-top:var(--sp-2);">' +
                '<button class="btn btn-secondary" id="modal-return" type="button">' + icons.arrowLeft(18) + ' Return</button>' +
                '<button class="btn btn-danger-outline" id="modal-reject" type="button">' + icons.xCircle(18) + ' Reject</button>' +
                '<button class="btn" id="modal-escalate" type="button" style="border:1px solid var(--warning); color:var(--warning); background:transparent;" title="Escalate to Compliance Officer">' + icons.alertTriangle(18) + ' Escalate</button>' +
                '<button class="btn" id="modal-approve" type="button" style="background-color:var(--success); color:#fff;">' + icons.checkCircle(18) + ' Approve</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    root.classList.add('active');
    root.setAttribute('aria-hidden', 'false');

    function closeModal() {
      root.classList.remove('active');
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = '';
    }

    function noteValue() {
      var field = document.getElementById('manager-action-note');
      return field && field.value.trim() ? field.value.trim() : '';
    }

    root.querySelector('#detail-backdrop').addEventListener('click', closeModal);
    root.querySelector('#detail-close').addEventListener('click', closeModal);
    root.querySelector('#modal-approve').addEventListener('click', function() {
      window.FinStackStore.managerApprove(expense.id, noteValue());
      closeModal();
      reRender();
    });
    root.querySelector('#modal-escalate').addEventListener('click', function() {
      window.FinStackStore.managerEscalate(expense.id, noteValue() || 'Escalated to compliance officer for review.');
      closeModal();
      reRender();
    });
    root.querySelector('#modal-return').addEventListener('click', function() {
      window.FinStackStore.managerReturn(expense.id, noteValue() || 'Please clarify and resubmit this expense.');
      closeModal();
      reRender();
    });
    root.querySelector('#modal-reject').addEventListener('click', function() {
      window.FinStackStore.managerReject(expense.id, noteValue() || 'Rejected during manager review.');
      closeModal();
      reRender();
    });
  }

  function buildDetailCard(title, icon, rows) {
    return '<div class="card"><h3 class="card-section-title mb-4" style="display:flex; align-items:center; gap:var(--sp-2);"><span style="color:var(--primary);">' + icon + '</span> ' + title + '</h3>' + rows.join('') + '</div>';
  }

  function detailRow(label, value) {
    return '<div class="detail-field"><div class="detail-field-label">' + label + '</div><div class="detail-field-value">' + value + '</div></div>';
  }

  function bindPageEvents(container) {
    var riskBtn = container.querySelector('#er-risk-btn');
    var riskMenu = container.querySelector('#er-risk-menu');
    if (riskBtn && riskMenu) {
      riskBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        riskMenu.classList.toggle('open');
        riskBtn.classList.toggle('open');
      });
      [].slice.call(riskMenu.querySelectorAll('.dropdown-option')).forEach(function(option) {
        option.addEventListener('click', function(event) {
          event.stopPropagation();
          riskFilter = option.getAttribute('data-risk');
          reRender();
        });
      });
    }

    var searchInput = container.querySelector('#er-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        searchQuery = searchInput.value;
        reRender();
        var nextInput = _container.querySelector('#er-search');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    [].slice.call(container.querySelectorAll('tr.clickable, .er-view-btn')).forEach(function(node) {
      node.addEventListener('click', function(event) {
        event.stopPropagation();
        openDetailModal(node.getAttribute('data-eid'));
      });
    });

    document.addEventListener('click', function() {
      if (riskMenu) riskMenu.classList.remove('open');
      if (riskBtn) riskBtn.classList.remove('open');
    }, { once: true });
  }

  function reRender() {
    if (!_container) return;
    _container.innerHTML = buildPage();
    bindPageEvents(_container);
  }

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  FinStack.reviewExpenses = {
    autoOpenId: null,
    render: function(container) {
      _container = container;
      window.FinStackStore.ready.then(function() {
        riskFilter = 'All';
        searchQuery = '';
        reRender();
        if (FinStack.reviewExpenses.autoOpenId) {
          openDetailModal(FinStack.reviewExpenses.autoOpenId);
          FinStack.reviewExpenses.autoOpenId = null;
        }
      });
    }
  };
})();
