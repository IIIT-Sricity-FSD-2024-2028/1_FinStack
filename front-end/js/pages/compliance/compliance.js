/* ============================================================
   compliance.js - Policy Violations page
   ============================================================ */

'use strict';

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

let violations = [];
let selectedViolation = null;
let showCorrectiveOptions = false;

function getPolicyMetadata(policyName) {
  return POLICY_VIOLATION_DEFINITIONS[policyName] || {
    limit: 'Not configured',
    summary: 'No policy metadata available.',
  };
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

window.handleViolationAction = function(type) {
  if (!selectedViolation) return;
  const expenseId = selectedViolation.expenseId;
  const result = type === 'approve'
    ? window.FinStackStore.complianceApprove(expenseId, 'Approved by compliance officer. Forwarded to finance for payment.')
    : window.FinStackStore.complianceReject(expenseId, 'Rejected by compliance officer after review.');

  if (!result || result.success === false) {
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
  const result = window.FinStackStore.complianceCorrectiveAction(expenseId, action);

  if (!result || result.success === false) {
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
  violations = window.FinStackStore && typeof window.FinStackStore.getComplianceViolations === 'function'
    ? window.FinStackStore.getComplianceViolations()
    : [];
}

function initCompliance() {
  function renderFromStore() {
    syncViolations();
    renderViolationsTable();
  }

  if (!window.FinStackStore || !window.FinStackStore.ready) {
    violations = [];
    renderViolationsTable();
    Toast.error('Unable to load compliance expense state.');
    return;
  }

  window.FinStackStore.ready
    .then(renderFromStore)
    .catch(function() {
      violations = [];
      renderViolationsTable();
      Toast.error('Unable to load compliance expense state.');
    });
}

window.initCompliance = initCompliance;
