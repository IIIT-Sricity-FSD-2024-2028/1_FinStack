/* ============================================================
   compliance.js - Policy Violations page
   ============================================================ */

'use strict';

const SHARED_STATE_KEY = 'finstack-prototype-state';

const POLICY_VIOLATION_DEFINITIONS = {
  'Travel Expense Limit': {
    limit: '₹5,000 per trip',
    summary: 'Controls domestic and regional travel submissions against approved trip budgets and supporting receipts.',
  },
  'Daily Meal Allowance': {
    limit: '₹1,500 per day',
    summary: 'Meal reimbursements require business justification and a valid supporting receipt.',
  },
  'Software Purchase Policy': {
    limit: '₹12,000 per purchase',
    summary: 'Software subscriptions above the threshold need additional finance and compliance scrutiny.',
  },
  'Equipment Purchase Threshold': {
    limit: '₹15,000 per purchase',
    summary: 'Equipment spend must map to approved business purpose and procurement documentation.',
  },
};

const FALLBACK_VIOLATIONS = [
  {
    id: 'VIO-101',
    policyId: 1,
    policyCode: 'POL-001',
    policy: 'Travel Expense Limit',
    amount: '₹6,250.00',
    severity: 'High',
    detectedTime: '10:15 AM',
    status: 'Open',
    description: 'Travel claim exceeded the approved trip cap and the attached itinerary does not justify the excess amount.',
    expenseId: 'EXP-DEMO-1',
    employee: 'Demo User',
    merchant: 'Demo Merchant',
    riskScore: 82,
  }
];

let violations = [];
let selectedViolation = null;
let showCorrectiveOptions = false;

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function readSharedState() {
  try {
    const raw = localStorage.getItem(SHARED_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeSharedState(state) {
  localStorage.setItem(SHARED_STATE_KEY, JSON.stringify(state));
}

function getComplianceUser(state) {
  return (state?.users || []).find(user => (user.roles || []).includes('compliance_officer')) || {
    employeeId: 'CMP-2001',
    fullName: 'Compliance Officer',
    roles: ['compliance_officer']
  };
}

function getPolicyMetadata(policyName) {
  return POLICY_VIOLATION_DEFINITIONS[policyName] || {
    limit: 'Not configured',
    summary: 'No policy metadata available.',
  };
}

function formatTimeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

function createHistoryEntry(code, label, note) {
  return {
    code,
    label,
    at: nowIso(),
    note: note || ''
  };
}

function addAuditLog(state, user, action, entityType, entityName, status) {
  state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
  state.auditLogs.unshift({
    id: makeId('AUD'),
    timestamp: nowIso(),
    user: user.fullName,
    userRole: 'Compliance Officer',
    action,
    entityType,
    entityName,
    status: status || 'Success'
  });
}

function addNotification(state, payload) {
  state.notifications = Array.isArray(state.notifications) ? state.notifications : [];
  state.notifications.unshift({
    id: makeId('NTF'),
    unread: true,
    createdAt: nowIso(),
    type: payload.type || 'info',
    recipientEmployeeId: payload.recipientEmployeeId || '',
    recipientRole: payload.recipientRole || '',
    title: payload.title,
    message: payload.message,
    relatedExpenseId: payload.relatedExpenseId || ''
  });
}

function deriveViolationsFromState(state) {
  if (!state || !Array.isArray(state.expenses)) {
    return FALLBACK_VIOLATIONS.slice();
  }

  const policies = Array.isArray(state.policies) ? state.policies : [];
  const flaggedExpenses = state.expenses.filter(expense => expense.workflowStatus === 'compliance_review');

  return flaggedExpenses.map((expense, index) => {
    const policy = policies.find(item => item.categoryId === expense.categoryId) || null;
    return {
      id: `VIO-${index + 101}`,
      policyId: policy ? policy.id : 0,
      policyCode: policy ? `POL-${String(policy.id).padStart(3, '0')}` : 'POL-000',
      policy: policy ? policy.name : `${expense.category} Review`,
      amount: `₹${Number(expense.amount || 0).toLocaleString('en-IN')}`,
      severity: (expense.risk_score || 0) >= 70 ? 'High' : (expense.risk_score || 0) >= 40 ? 'Medium' : 'Low',
      detectedTime: formatTimeAgo(expense.updatedAt || expense.created),
      status: expense.complianceDecision === 'Corrective Action' ? 'Corrective Action Initiated' : 'Open',
      description: expense.financeDecisionNote || expense.notes || 'Flagged by finance for compliance investigation.',
      expenseId: expense.id,
      employee: expense.employee,
      merchant: expense.merchant,
      riskScore: expense.risk_score || 0,
    };
  });
}

function getSeverityBadge(sev) {
  const map = { High: 'badge-rose', Medium: 'badge-orange', Low: 'badge-yellow' };
  return `<span class="badge ${map[sev] || 'badge-slate'}">${sev}</span>`;
}

function getStatusBadge(status) {
  const map = {
    Open: 'badge-cyan',
    'Under Review': 'badge-purple',
    'Corrective Action Initiated': 'badge-teal',
    Resolved: 'badge-green',
  };
  return `<span class="badge ${map[status] || 'badge-slate'}">${status}</span>`;
}

function renderViolationsTable() {
  const tbody = document.getElementById('violations-tbody');
  if (!tbody) return;

  if (!violations.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-cell-muted" style="text-align:center;padding:32px;">No flagged expenses currently require compliance review.</td></tr>';
    return;
  }

  tbody.innerHTML = violations.map(v => {
    const policyMeta = getPolicyMetadata(v.policy);
    return `
      <tr class="violations-row">
        <td class="table-cell-primary">${v.id}</td>
        <td class="table-cell-secondary">${v.policyCode}</td>
        <td>
          <div class="table-cell-stack">
            <span class="table-cell-stack-title">${v.policy}</span>
            <span class="table-cell-stack-copy">Limit: ${policyMeta.limit}</span>
          </div>
        </td>
        <td>${getSeverityBadge(v.severity)}</td>
        <td class="table-cell-muted">${v.detectedTime}</td>
        <td>${getStatusBadge(v.status)}</td>
        <td class="violations-action-cell">
          <button class="btn btn-sm btn-secondary violation-review-btn" onclick="reviewViolation('${v.id}')">
            ${Icons.eye} Review
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.reviewViolation = function(id) {
  selectedViolation = violations.find(v => v.id === id) || null;
  if (!selectedViolation) return;
  showCorrectiveOptions = false;
  renderViolationPanel();
  openPanel('violation-panel');
};

window.goToSourcePolicy = function() {
  if (!selectedViolation?.policyId) return;
  window.sessionStorage.setItem('finstack-pending-policy-highlight', String(selectedViolation.policyId));
  window.sessionStorage.setItem('finstack-pending-policy-open', 'true');
  closePanel('violation-panel');
  Router.navigate('policies');
};

function renderViolationPanel() {
  const violation = selectedViolation;
  if (!violation) return;
  const body = document.getElementById('violation-panel-body');
  if (!body) return;
  const policyMeta = getPolicyMetadata(violation.policy);

  body.innerHTML = `
    <div class="flex gap-2 mb-6 flex-wrap violation-review-badges">
      ${getSeverityBadge(violation.severity)} ${getStatusBadge(violation.status)}
    </div>

    <div class="detail-grid-2 detail-block violation-review-grid">
      ${vDetailCell('Violation ID', violation.id)}
      ${vDetailCell('Policy ID', `<span class="detail-item-value-accent violation-policy-code">${violation.policyCode}</span>`)}
      <div class="detail-span-2">${vDetailCell('Policy Violated', violation.policy)}</div>
      ${vDetailCell('Expense Amount', `<span class="detail-item-value-danger">${violation.amount}</span>`)}
      ${vDetailCell('Policy Limit', policyMeta.limit)}
      <div class="detail-span-2">${vDetailCell('Policy Intent', policyMeta.summary)}</div>
      <div class="detail-span-2">${vDetailCell('Detected Time', violation.detectedTime)}</div>
    </div>

    <div class="detail-block violation-details-block">
      <p class="detail-item-label">Violation Details</p>
      <div class="detail-callout violation-detail-callout">
        ${violation.description}
      </div>
    </div>

    <div class="violation-resolution-shell">
      <p class="detail-item-label-tight violation-resolution-heading">Resolution Actions</p>
      <div class="action-list violation-action-list">
        <button class="btn btn-secondary w-full" onclick="handleViolationAction('approve')">
          <span class="detail-item-value violation-action-icon violation-action-icon-success">${Icons.checkCircle2}</span> Approve Exception
        </button>
        <button class="btn btn-secondary w-full" onclick="handleViolationAction('reject')">
          <span class="detail-item-value violation-action-icon violation-action-icon-danger">${Icons.xCircle}</span> Reject Expense
        </button>
        <button class="btn btn-secondary w-full" onclick="goToSourcePolicy()">
          <span class="detail-item-value-accent violation-action-icon">${Icons.edit}</span> Review Source Policy
        </button>
        <button class="btn btn-primary w-full" onclick="toggleCorrectiveOptions()" id="corrective-btn">
          ${Icons.arrowRight} Initiate Corrective Action
        </button>
        <div id="corrective-options" class="violation-corrective-options${showCorrectiveOptions ? ' is-open' : ''}">
          ${['Notify Finance Officer', 'Request Policy Revision', 'Escalate to Management', 'Flag Account for Monitoring'].map(action =>
            `<button class="btn btn-ghost w-full violation-corrective-btn" onclick="handleCorrectiveAction('${action}')">• ${action}</button>`
          ).join('')}
        </div>
      </div>
    </div>
  `;
}

function vDetailCell(label, value) {
  return `<div class="detail-item">
    <p class="detail-item-label-tight">${label}</p>
    <p class="detail-item-value-strong">${value}</p>
  </div>`;
}

window.toggleCorrectiveOptions = function() {
  showCorrectiveOptions = !showCorrectiveOptions;
  const el = document.getElementById('corrective-options');
  if (el) el.style.display = showCorrectiveOptions ? 'block' : 'none';
};

function updateExpenseInSharedState(expenseId, updater) {
  const state = readSharedState();
  if (!state || !Array.isArray(state.expenses)) return false;
  const expense = state.expenses.find(item => item.id === expenseId);
  if (!expense) return false;
  updater(state, expense);
  expense.updatedAt = nowIso();
  writeSharedState(state);
  return true;
}

window.handleViolationAction = function(type) {
  if (!selectedViolation) return;
  const expenseId = selectedViolation.expenseId;
  const success = updateExpenseInSharedState(expenseId, (state, expense) => {
    const complianceUser = getComplianceUser(state);
    if (type === 'approve') {
      expense.complianceDecision = 'Approved';
      expense.complianceDecisionAt = nowIso();
      expense.complianceDecisionNote = `Approved by compliance officer. Forwarded to finance for payment.`;
      expense.workflowStatus = 'finance_review';
      expense.status = 'pending';
      expense.history = Array.isArray(expense.history) ? expense.history : [];
      expense.history.push(createHistoryEntry('compliance_approved', 'Compliance Approved — Sent to Finance', expense.complianceDecisionNote));
      addNotification(state, {
        recipientEmployeeId: 'FIN-2001',
        recipientRole: 'finance_officer',
        title: 'Compliance-Reviewed Expense Ready',
        message: `${expense.id} from ${expense.employee} has been approved by compliance and is now in your finance review queue.`,
        type: 'success',
        relatedExpenseId: expense.id
      });
      addNotification(state, {
        recipientEmployeeId: expense.employeeId,
        recipientRole: 'expense_submitter',
        title: 'Compliance Approved Your Expense',
        message: `${expense.id} was approved by compliance and is now in finance review for reimbursement.`,
        type: 'success',
        relatedExpenseId: expense.id
      });
      addAuditLog(state, complianceUser, 'Compliance Approved Expense', 'Expense', expense.id, 'Success');
    } else {
      expense.complianceDecision = 'Rejected';
      expense.complianceDecisionAt = nowIso();
      expense.complianceDecisionNote = `Rejected by compliance officer after review.`;
      expense.workflowStatus = 'rejected';
      expense.status = 'rejected';
      expense.history = Array.isArray(expense.history) ? expense.history : [];
      expense.history.push(createHistoryEntry('compliance_rejected', 'Rejected by Compliance', expense.complianceDecisionNote));
      addNotification(state, {
        recipientEmployeeId: expense.employeeId,
        recipientRole: 'expense_submitter',
        title: 'Expense Rejected by Compliance',
        message: `${expense.id} was reviewed by the compliance officer and rejected. Reason: ${expense.complianceDecisionNote}`,
        type: 'danger',
        relatedExpenseId: expense.id
      });
      addAuditLog(state, complianceUser, 'Compliance Rejected Expense', 'Expense', expense.id, 'Success');
    }
  });

  if (!success) {
    Toast.error('Unable to update this compliance case.');
    return;
  }

  syncViolations();
  renderViolationsTable();
  selectedViolation = null;
  closePanel('violation-panel');
  Toast.success(type === 'approve' ? 'Exception approved' : 'Expense rejected');
};

window.handleCorrectiveAction = function(action) {
  if (!selectedViolation) return;
  const expenseId = selectedViolation.expenseId;
  const success = updateExpenseInSharedState(expenseId, (state, expense) => {
    const complianceUser = getComplianceUser(state);
    expense.complianceDecision = 'Corrective Action';
    expense.complianceDecisionAt = nowIso();
    expense.complianceDecisionNote = action;
    expense.history = Array.isArray(expense.history) ? expense.history : [];
    expense.history.push(createHistoryEntry('compliance_corrective_action', 'Corrective Action Initiated', action));
    addAuditLog(state, complianceUser, 'Initiated Corrective Action', 'Expense', expense.id, 'Success');
  });

  if (!success) {
    Toast.error('Unable to start corrective action for this case.');
    return;
  }

  syncViolations();
  selectedViolation = violations.find(v => v.expenseId === expenseId) || null;
  showCorrectiveOptions = false;
  renderViolationsTable();
  if (selectedViolation) renderViolationPanel();
  Toast.success(`Action initiated: ${action}`);
};

function syncViolations() {
  violations = deriveViolationsFromState(readSharedState());
}

function initCompliance() {
  try {
    syncViolations();
    renderViolationsTable();
  } catch (error) {
    violations = FALLBACK_VIOLATIONS.slice();
    renderViolationsTable();
    Toast.warning('Loaded fallback compliance data.');
  }
}

window.initCompliance = initCompliance;
