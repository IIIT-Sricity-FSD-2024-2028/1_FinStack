/* ============================================================
   escalated-expenses.js – Compliance Officer: Escalated Expenses
   Reads from FinStackStore, allows Approve → Finance, Reject → Submitter
   ============================================================ */
'use strict';

var allEscalated = [];
var selectedExpense = null;
var decisionInFlight = false;

/* ── Helpers ──────────────────────────────────────────────── */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function fmtINR(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
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
  return userMap[expense.employeeId] || expense.employeeId || expense.employee || '—';
}

function timeAgo(iso) {
  if (!iso) return '—';
  var diff = Date.now() - new Date(iso).getTime();
  var m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + ' min ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  var d = Math.floor(h / 24);
  return d + 'd ago';
}

function riskBadge(score) {
  score = Number(score || 0);
  if (score >= 70) return '<span class="badge badge-rose">' + score + ' High</span>';
  if (score >= 40) return '<span class="badge badge-yellow">' + score + ' Medium</span>';
  return '<span class="badge badge-green">' + score + ' Low</span>';
}

function escalatorLabel(expense) {
  if (expense.escalatedByManager) return '<span class="badge badge-purple">Manager</span>';
  if (expense.financeDecision === 'Flagged') return '<span class="badge badge-cyan">Finance</span>';
  return '<span class="badge badge-slate">System</span>';
}

/* ── Load & Render ────────────────────────────────────────── */
function loadEscalated() {
  if (!window.FinStackStore) return;
  window.FinStackStore.ready.then(function() {
    allEscalated = window.FinStackStore.getComplianceQueue();
    renderKPIs();
    filterEscalated();
    updateNavBadge();
  });
}

function renderKPIs() {
  var total    = allEscalated.length;
  var highRisk = allEscalated.filter(function(e) { return (e.risk_score || 0) >= 70; }).length;
  var amount   = allEscalated.reduce(function(s, e) { return s + Number(e.amount || 0); }, 0);
  var avgRisk  = total ? Math.round(allEscalated.reduce(function(s, e) { return s + Number(e.risk_score || 0); }, 0) / total) : 0;

  var el = function(id) { return document.getElementById(id); };
  if (el('kpi-total'))     el('kpi-total').textContent     = total;
  if (el('kpi-high-risk')) el('kpi-high-risk').textContent = highRisk;
  if (el('kpi-amount'))    el('kpi-amount').textContent    = fmtINR(amount);
  if (el('kpi-avg-risk'))  el('kpi-avg-risk').textContent  = avgRisk;
}

function updateNavBadge() {
  var badge = document.getElementById('escalated-nav-badge');
  if (!badge) return;
  var count = allEscalated.length;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function refreshEscalatedUI() {
  if (!window.FinStackStore) return;
  allEscalated = window.FinStackStore.getComplianceQueue();
  renderKPIs();
  filterEscalated();
  updateNavBadge();
}

function setDecisionSubmitting(isSubmitting) {
  document.querySelectorAll('button[onclick="submitApprove()"], button[onclick="submitReject()"], button[onclick^="approveEscalatedExpense("], button[onclick^="rejectEscalatedExpense("]').forEach(function(button) {
    button.disabled = isSubmitting;
  });
}

function closeExpenseReviewModal() {
  closeModal('approve-modal');
  closeModal('reject-modal');
  if (typeof closePanel === 'function') {
    closePanel('escalated-panel');
  } else {
    document.getElementById('overlay')?.classList.remove('open');
    document.getElementById('escalated-panel')?.classList.remove('open');
  }
  var body = document.getElementById('escalated-panel-body');
  if (body) body.innerHTML = '';
  selectedExpense = null;
}

function findEscalatedExpense(id) {
  return allEscalated.find(function(e) { return e.id === id; }) || null;
}

function runComplianceDecision(type, expenseId, note) {
  if (decisionInFlight) return null;
  decisionInFlight = true;
  setDecisionSubmitting(true);
  var result = null;
  try {
    result = type === 'approve'
      ? window.FinStackStore.complianceApprove(expenseId, note)
      : window.FinStackStore.complianceReject(expenseId, note);
  } catch (error) {
    result = null;
  }
  decisionInFlight = false;
  setDecisionSubmitting(false);
  return result;
}

function finishComplianceDecision(expenseId, type) {
  refreshEscalatedUI();
  closeExpenseReviewModal();
  if (type === 'approve') {
    Toast.success(expenseId + ' approved — forwarded to Finance Officer.');
  } else {
    Toast.error(expenseId + ' rejected — submitter has been notified.');
  }
}

window.filterEscalated = function() {
  var query     = (document.getElementById('escalated-search') || {}).value || '';
  var riskFilt  = (document.getElementById('escalated-filter-risk') || {}).value || 'all';
  var srcFilt   = (document.getElementById('escalated-filter-escalator') || {}).value || 'all';
  var sortFilt  = (document.getElementById('escalated-filter-sort') || {}).value || 'newest';
  var q = query.toLowerCase().trim();

  var list = allEscalated.filter(function(e) {
    var matchQ = !q || (e.id || '').toLowerCase().includes(q) ||
                       (e.employee || '').toLowerCase().includes(q) ||
                       (e.merchant || '').toLowerCase().includes(q) ||
                       (e.category || '').toLowerCase().includes(q);

    var score = Number(e.risk_score || 0);
    var matchRisk = riskFilt === 'all' ||
                    (riskFilt === 'high'   && score >= 70) ||
                    (riskFilt === 'medium' && score >= 40 && score < 70) ||
                    (riskFilt === 'low'    && score < 40);

    var matchSrc  = srcFilt === 'all' ||
                    (srcFilt === 'manager' && e.escalatedByManager) ||
                    (srcFilt === 'finance' && e.financeDecision === 'Flagged');

    return matchQ && matchRisk && matchSrc;
  });

  // Sort
  list = list.slice().sort(function(a, b) {
    if (sortFilt === 'newest')     return new Date(b.updatedAt || b.created) - new Date(a.updatedAt || a.created);
    if (sortFilt === 'oldest')     return new Date(a.updatedAt || a.created) - new Date(b.updatedAt || b.created);
    if (sortFilt === 'amount-desc') return Number(b.amount || 0) - Number(a.amount || 0);
    if (sortFilt === 'risk-desc')  return Number(b.risk_score || 0) - Number(a.risk_score || 0);
    return 0;
  });

  renderTable(list);
};

window.resetFilters = function() {
  ['escalated-search', 'escalated-filter-risk', 'escalated-filter-escalator', 'escalated-filter-sort'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.value = el.tagName === 'SELECT' ? el.options[0].value : ''; }
  });
  filterEscalated();
};

function renderTable(list) {
  var lbl = document.getElementById('escalated-count-label');
  if (lbl) lbl.textContent = list.length + ' expense' + (list.length !== 1 ? 's' : '');

  var tbody = document.getElementById('escalated-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:48px;color:var(--text-muted);">' +
      '<div style="font-size:2.5rem;margin-bottom:12px;">✅</div>' +
      '<div style="font-size:1rem;font-weight:600;color:var(--text-secondary);">No escalated expenses found.</div>' +
      '<div style="font-size:.875rem;color:var(--text-muted);margin-top:4px;">All clear — no expenses need compliance review right now.</div>' +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function(e) {
    var score = Number(e.risk_score || 0);
    var rowBorder = score >= 70 ? 'border-left:3px solid var(--red,#ef4444);' : score >= 40 ? 'border-left:3px solid var(--yellow,#f59e0b);' : '';
    var managerNote = esc(e.managerDecisionNote || e.financeDecisionNote || '—');
    if (managerNote.length > 45) managerNote = managerNote.slice(0, 42) + '…';
    return '<tr style="' + rowBorder + '">' +
      '<td><span style="font-weight:700;color:var(--accent,#22d3ee);">' + esc(formatExpenseId(e.id)) + '</span></td>' +
      '<td>' + esc(getEmployeeDisplay(e)) + '</td>' +
      '<td>' + esc(e.category || '—') + '</td>' +
      '<td style="font-weight:600;">' + fmtINR(e.amount) + '</td>' +
      '<td>' + escalatorLabel(e) + '</td>' +
      '<td>' + riskBadge(e.risk_score) + '</td>' +
      '<td style="color:var(--text-muted);font-size:.8rem;max-width:180px;" title="' + esc(e.managerDecisionNote || e.financeDecisionNote || '') + '">' + managerNote + '</td>' +
      '<td style="color:var(--text-muted);font-size:.8rem;">' + esc(timeAgo(e.updatedAt || e.created)) + '</td>' +
      '<td>' +
        '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
          '<button class="btn btn-sm btn-secondary" onclick="openDetail(\'' + esc(e.id) + '\')" title="View details">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            ' View' +
          '</button>' +
          '<button class="btn btn-sm" style="background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);" onclick="openApproveModal(\'' + esc(e.id) + '\')" title="Approve and forward to Finance">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>' +
            ' Approve' +
          '</button>' +
          '<button class="btn btn-sm" style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);" onclick="openRejectModal(\'' + esc(e.id) + '\')" title="Reject and notify submitter">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            ' Reject' +
          '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

/* ── Detail Panel ─────────────────────────────────────────── */
window.openDetail = function(id) {
  var expense = allEscalated.find(function(e) { return e.id === id; });
  if (!expense) return;
  selectedExpense = expense;
  renderDetailPanel(expense);
  openPanel('escalated-panel');
};

function renderDetailPanel(e) {
  var body = document.getElementById('escalated-panel-body');
  if (!body) return;
  var score = Number(e.risk_score || 0);
  var riskColor = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#10b981';
  var history = Array.isArray(e.history) ? e.history : [];

  body.innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">' +
      riskBadge(e.risk_score) +
      escalatorLabel(e) +
      '<span class="badge badge-cyan">' + esc(e.workflowStatus || 'compliance_review') + '</span>' +
    '</div>' +

    '<div class="detail-grid-2 detail-block" style="margin-bottom:20px;">' +
      detailCell('Expense ID', '<span style="color:var(--accent,#22d3ee);font-weight:700;">' + esc(formatExpenseId(e.id)) + '</span>') +
      detailCell('Employee', esc(getEmployeeDisplay(e))) +
      detailCell('Amount', '<span style="font-weight:700;font-size:1.1rem;">' + fmtINR(e.amount) + '</span>') +
      detailCell('Category', esc(e.category || '—')) +
      detailCell('Merchant', esc(e.merchant || '—')) +
      detailCell('Payment Method', esc(e.paymentMethod || '—')) +
      detailCell('Submitted Date', esc(e.date || '—')) +
      detailCell('Risk Score', '<span style="font-size:1.2rem;font-weight:800;color:' + riskColor + ';">' + score + '/100</span>') +
    '</div>' +

    '<div class="detail-block" style="margin-bottom:20px;">' +
      '<p class="detail-item-label">Manager Decision Note</p>' +
      '<div class="detail-callout">' + esc(e.managerDecisionNote || e.financeDecisionNote || 'No note provided.') + '</div>' +
    '</div>' +

    (e.notes ? '<div class="detail-block" style="margin-bottom:20px;"><p class="detail-item-label">Submitter Notes</p><div class="detail-callout">' + esc(e.notes) + '</div></div>' : '') +

    '<div class="detail-block" style="margin-bottom:20px;">' +
      '<p class="detail-item-label" style="margin-bottom:12px;">Expense Timeline</p>' +
      (history.length ? history.slice().reverse().map(function(h) {
        return '<div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent,#22d3ee);margin-top:5px;flex-shrink:0;"></div>' +
          '<div><div style="font-weight:600;font-size:.875rem;color:var(--text-primary);">' + esc(h.label || h.code) + '</div>' +
          (h.note ? '<div style="font-size:.8rem;color:var(--text-muted);margin-top:2px;">' + esc(h.note) + '</div>' : '') +
          '<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px;">' + esc(timeAgo(h.at)) + '</div></div>' +
        '</div>';
      }).join('') : '<div style="color:var(--text-muted);font-size:.875rem;">No history available.</div>') +
    '</div>' +

    '<div class="action-list violation-action-list" style="margin-top:8px;">' +
      '<button class="btn btn-secondary w-full" style="justify-content:center;border-color:rgba(16,185,129,.4);color:#10b981;" onclick="approveEscalatedExpense(\'' + esc(e.id) + '\')">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;"><path d="M20 6 9 17l-5-5"/></svg>' +
        'Approve — Forward to Finance' +
      '</button>' +
      '<button class="btn btn-secondary w-full" style="justify-content:center;border-color:rgba(239,68,68,.4);color:#ef4444;" onclick="rejectEscalatedExpense(\'' + esc(e.id) + '\')">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        'Reject — Notify Submitter' +
      '</button>' +
    '</div>';
}

function detailCell(label, valueHtml) {
  return '<div><div class="detail-item-label">' + label + '</div>' +
         '<div class="detail-item-value">' + valueHtml + '</div></div>';
}

window.approveEscalatedExpense = function(id) {
  var expense = findEscalatedExpense(id);
  if (!expense) { Toast.error('Could not approve this expense. Please try again.'); return; }
  selectedExpense = expense;
  var result = runComplianceDecision('approve', expense.id, 'Approved by compliance officer. Forwarded to finance.');
  if (!result) { Toast.error('Could not approve this expense. Please try again.'); return; }
  finishComplianceDecision(expense.id, 'approve');
};

window.rejectEscalatedExpense = function(id) {
  var expense = findEscalatedExpense(id);
  if (!expense) { Toast.error('Could not reject this expense. Please try again.'); return; }
  selectedExpense = expense;
  var result = runComplianceDecision('reject', expense.id, 'Rejected by compliance officer after review.');
  if (!result) { Toast.error('Could not reject this expense. Please try again.'); return; }
  finishComplianceDecision(expense.id, 'reject');
};

/* ── Approve ──────────────────────────────────────────────── */
window.openApproveModal = function(id) {
  var expense = findEscalatedExpense(id);
  if (!expense) return;
  selectedExpense = expense;
  var idEl = document.getElementById('approve-exp-id');
  var amtEl = document.getElementById('approve-exp-amount');
  var noteEl = document.getElementById('approve-note');
  if (idEl)   idEl.textContent  = formatExpenseId(expense.id);
  if (amtEl)  amtEl.textContent = fmtINR(expense.amount);
  if (noteEl) noteEl.value = '';
  openModal('approve-modal');
};

window.submitApprove = function() {
  if (!selectedExpense || decisionInFlight) return;
  var expenseId = selectedExpense.id;
  var note = (document.getElementById('approve-note') || {}).value || '';
  var result = runComplianceDecision('approve', expenseId, note || 'Approved by compliance officer. Forwarded to finance.');
  if (!result) { Toast.error('Could not approve this expense. Please try again.'); return; }
  finishComplianceDecision(expenseId, 'approve');
};

/* ── Reject ───────────────────────────────────────────────── */
window.openRejectModal = function(id) {
  var expense = findEscalatedExpense(id);
  if (!expense) return;
  selectedExpense = expense;
  var idEl = document.getElementById('reject-exp-id');
  var amtEl = document.getElementById('reject-exp-amount');
  var noteEl = document.getElementById('reject-note');
  if (idEl)   idEl.textContent  = formatExpenseId(expense.id);
  if (amtEl)  amtEl.textContent = fmtINR(expense.amount);
  if (noteEl) noteEl.value = '';
  openModal('reject-modal');
};

window.submitReject = function() {
  if (!selectedExpense || decisionInFlight) return;
  var note = ((document.getElementById('reject-note') || {}).value || '').trim();
  if (!note) { Toast.error('Please provide a rejection reason.'); return; }
  var expenseId = selectedExpense.id;
  var result = runComplianceDecision('reject', expenseId, note);
  if (!result) { Toast.error('Could not reject this expense. Please try again.'); return; }
  finishComplianceDecision(expenseId, 'reject');
};

/* ── Modal helpers ────────────────────────────────────────── */
window.openModal = function(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
};
window.closeModal = function(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
};

// Close modal on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

/* ── Toast helper (fallback if not defined) ───────────────── */
if (typeof Toast === 'undefined') {
  window.Toast = {
    success: function(msg) { showQuickToast(msg, '#10b981'); },
    error:   function(msg) { showQuickToast(msg, '#ef4444'); },
    warning: function(msg) { showQuickToast(msg, '#f59e0b'); }
  };
  function showQuickToast(msg, color) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:' + color + ';color:#fff;padding:12px 20px;border-radius:10px;font-size:.875rem;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);';
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }
}

/* ── Router route ─────────────────────────────────────────── */
if (typeof Router !== 'undefined') {
  Router.on('escalated', function() { loadEscalated(); });
}

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  if (window.FinStackStore && window.FinStackStore.ready) {
    loadEscalated();
  } else {
    document.addEventListener('finstackReady', loadEscalated);
  }
});
