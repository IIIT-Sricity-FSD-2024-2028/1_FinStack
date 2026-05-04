/* ============================================================
   policies.js – Policies Management page
   ============================================================ */

'use strict';

const POLICY_STATUS_PRIORITY = {
  Draft: 1,
  'Needs Revision': 2,
  Submitted: 3,
  Approved: 4,
  Active: 5,
};

const PENDING_POLICY_HIGHLIGHT_KEY = 'finstack-pending-policy-highlight';
const PENDING_POLICY_OPEN_KEY = 'finstack-pending-policy-open';
const POLICY_WORKFLOW_STATUS_LABEL = {
  Draft: 'Draft',
  Submitted: 'Pending Implementation',
  'Needs Revision': 'Returned',
  Approved: 'Pending Implementation',
  Active: 'Active',
};

const POLICY_DEFAULTS = {
  policyType: 'Expense Control',
  appliesTo: 'Organization-wide',
  priorityLevel: 'High',
  effectiveDate: '',
  reviewDate: '',
  limitAmount: '',
  receiptRequirement: 'Required',
  approvalRequirement: 'Manager Approval',
  duplicateRule: 'Exact match within 30 days',
  ocrRule: 'Cross-check amount, merchant, and GST fields',
  exceptionConditions: '',
  escalationConditions: '',
  description: '',
  violationAction: 'Flag',
  riskScoreWeight: 70,
  manualReviewRequired: true,
  notifyStakeholders: true,
  auditLogging: true,
  attachments: [],
  version: '1.0',
  createdBy: 'Hari Vamsi',
  lastUpdatedBy: 'Hari Vamsi',
  reason: '',
  changeSummary: '',
  configNotes: '',
  status: 'Draft',
};

const POLICIES = [
  {
    id: 1,
    policyCode: 'POL-001',
    name: 'Travel Expense Limit',
    category: 'Travel',
    limit: '₹5,000 per trip',
    lastUpdated: 'Today',
    status: 'Active',
    policyType: 'Expense Control',
    appliesTo: 'Organization-wide',
    priorityLevel: 'Critical',
    effectiveDate: '2026-03-01',
    reviewDate: '2026-09-01',
    limitAmount: '5000',
    receiptRequirement: 'Required',
    approvalRequirement: 'Manager + Finance Approval',
    duplicateRule: 'Exact and near-duplicate match within 45 days',
    ocrRule: 'Cross-check merchant, GST, line-items, and amount',
    exceptionConditions: 'Allowed only for pre-approved emergency travel exceptions.',
    escalationConditions: 'Escalate when amount exceeds 125% of threshold or traveler has 2 prior violations.',
    description: 'Controls domestic and regional travel submissions against approved trip budgets and supporting receipts.',
    violationAction: 'Escalate',
    riskScoreWeight: 88,
    manualReviewRequired: true,
    notifyStakeholders: true,
    auditLogging: true,
    attachments: [
      { id: 'att-101', name: 'travel-policy-circular.pdf', type: 'PDF', uploadedAt: '2026-03-01', source: 'Circular' },
      { id: 'att-102', name: 'travel-sop-v3.docx', type: 'DOC', uploadedAt: '2026-03-02', source: 'SOP' },
    ],
    version: '3.2',
    createdBy: 'Hari Vamsi',
    lastUpdatedBy: 'Hari Vamsi',
    reason: 'Align travel spend thresholds with FY26 control framework.',
    changeSummary: 'Updated travel ceiling and strengthened escalation criteria.',
    configNotes: 'Deploy after OCR threshold update and route to Finance Ops queue.',
  },
  {
    id: 2,
    policyCode: 'POL-002',
    name: 'Meal Reimbursement',
    category: 'Meals',
    limit: '₹1,500 per day',
    lastUpdated: 'Yesterday',
    status: 'Draft',
    policyType: 'Expense Control',
    appliesTo: 'Employee Group',
    priorityLevel: 'Medium',
    effectiveDate: '2026-03-20',
    reviewDate: '2026-09-20',
    limitAmount: '1500',
    receiptRequirement: 'Required',
    approvalRequirement: 'Line Manager Approval',
    duplicateRule: 'Block duplicate merchant/date/amount combinations',
    ocrRule: 'Validate meal date, amount, and tax components',
    exceptionConditions: 'Late-night shifts and client events require event code in notes.',
    escalationConditions: 'Escalate when claim exceeds daily cap by 20% or repeats twice in 14 days.',
    description: 'Draft policy for employee meal reimbursements during approved business travel and overtime work.',
    violationAction: 'Warn',
    riskScoreWeight: 52,
    manualReviewRequired: false,
    notifyStakeholders: true,
    auditLogging: true,
    attachments: [],
    version: '1.1',
    createdBy: 'Hari Vamsi',
    lastUpdatedBy: 'Hari Vamsi',
    reason: 'Refresh meal reimbursement controls.',
    changeSummary: 'Initial draft for updated employee meal reimbursement limits.',
    configNotes: 'Awaiting final review before implementation submission.',
  },
  {
    id: 3,
    policyCode: 'POL-003',
    name: 'Vendor Expense Rule',
    category: 'Vendor',
    limit: '₹10,000 per purchase',
    lastUpdated: '2 days ago',
    status: 'Submitted',
    policyType: 'Vendor Governance',
    appliesTo: 'Department',
    priorityLevel: 'High',
    effectiveDate: '2026-03-10',
    reviewDate: '2026-12-10',
    limitAmount: '10000',
    receiptRequirement: 'Optional',
    approvalRequirement: 'Procurement + Compliance Approval',
    duplicateRule: 'Flag repeated vendor invoice references within 90 days',
    ocrRule: 'Validate invoice number, vendor GST, and PO reference',
    exceptionConditions: 'One-time vendor onboarding exceptions need procurement waiver attached.',
    escalationConditions: 'Escalate when vendor is non-whitelisted or invoice exceeds PO value.',
    description: 'Submitted control to tighten vendor spend governance and reduce reconciliation leakage.',
    violationAction: 'Flag',
    riskScoreWeight: 81,
    manualReviewRequired: true,
    notifyStakeholders: true,
    auditLogging: true,
    attachments: [
      { id: 'att-301', name: 'vendor-governance-note.pdf', type: 'PDF', uploadedAt: '2026-03-11', source: 'Memo' },
    ],
    version: '2.0',
    createdBy: 'Hari Vamsi',
    lastUpdatedBy: 'Hari Vamsi',
    reason: 'Reduce vendor leakage and unsupported payments.',
    changeSummary: 'Submitted vendor policy with procurement validation controls.',
    configNotes: 'Configuration Manager to map vendor whitelist service before activation.',
  },
  {
    id: 4,
    policyCode: 'POL-004',
    name: 'Accommodation Policy',
    category: 'Accommodation',
    limit: '₹8,000 per night',
    lastUpdated: '3 days ago',
    status: 'Active',
  },
  {
    id: 5,
    policyCode: 'POL-005',
    name: 'Office Supplies Budget',
    category: 'Office Supplies',
    limit: '₹3,000 per month',
    lastUpdated: '5 days ago',
    status: 'Needs Revision',
    policyType: 'Budget Control',
    appliesTo: 'Department',
    priorityLevel: 'Low',
    effectiveDate: '2026-02-01',
    reviewDate: '2026-08-01',
    limitAmount: '3000',
    receiptRequirement: 'Required',
    approvalRequirement: 'Department Head Approval',
    duplicateRule: 'Warn on repeat catalog item orders within 7 days',
    ocrRule: 'Validate supplier invoice and catalog codes',
    exceptionConditions: 'Emergency facilities orders require admin ticket number.',
    escalationConditions: 'Return for revision when category mapping is missing.',
    description: 'Returned policy requiring cleaner category mapping and exception notes.',
    violationAction: 'Warn',
    riskScoreWeight: 35,
    manualReviewRequired: false,
    notifyStakeholders: false,
    auditLogging: true,
    attachments: [],
    version: '0.9',
    createdBy: 'Hari Vamsi',
    lastUpdatedBy: 'Configuration Manager',
    reason: 'Control office spend across support teams.',
    changeSummary: 'Returned by configuration team for revision of category hierarchy.',
    configNotes: 'Need explicit category codes and procurement mapping before implementation.',
  },
].map(normalizePolicyRecord);
window.POLICIES = POLICIES;

let editingPolicy = null;
let viewingPolicy = null;
let policyDraftState = null;
let _popupPolicyId = null;

function normalizePolicyRecord(policy) {
  return {
    ...POLICY_DEFAULTS,
    ...policy,
    attachments: [...(policy.attachments || [])],
    policyCode: policy.policyCode || generatePolicyCode(policy.id),
    limitAmount: policy.limitAmount || String(extractAmount(policy.limit)),
  };
}

function generatePolicyCode(id) {
  return `POL-${String(id).padStart(3, '0')}`;
}

function extractAmount(limitText) {
  const match = String(limitText || '').replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getNextPolicyId() {
  return POLICIES.reduce((max, policy) => Math.max(max, policy.id), 0) + 1;
}

function getStatusBadge(status, labelOverride) {
  const map = {
    Draft: 'badge-slate',
    Submitted: 'badge-yellow',
    Active: 'badge-green',
    Approved: 'badge-blue',
    'Needs Revision': 'badge-red',
  };
  return `<span class="badge ${map[status] || 'badge-slate'}">${labelOverride || status}</span>`;
}

function getFilteredPolicies() {
  const q = document.getElementById('pol-search')?.value.toLowerCase() || '';
  const s = document.getElementById('pol-status')?.value || 'All';
  const c = document.getElementById('pol-category')?.value || 'All';
  return POLICIES.filter(p =>
    (q === '' || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) &&
    (s === 'All' || p.status === s) &&
    (c === 'All' || p.category === c)
  ).sort((a, b) => {
    const priorityDiff = (POLICY_STATUS_PRIORITY[a.status] || 999) - (POLICY_STATUS_PRIORITY[b.status] || 999);
    if (priorityDiff !== 0) return priorityDiff;
    return b.id - a.id;
  });
}

function formatLimit(amount) {
  const value = Number(amount);
  if (Number.isNaN(value) || value <= 0) return '';
  return `₹${value.toLocaleString('en-IN')} per rule`;
}

function getPolicyScopeLabel(value) {
  const map = {
    Department: 'Department-specific control',
    'Employee Group': 'Employee group control',
    'Organization-wide': 'Organization-wide control',
  };
  return map[value] || value;
}

function renderPoliciesTable() {
  const tbody = document.getElementById('policies-tbody');
  if (!tbody) return;
  const filtered = getFilteredPolicies();

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No policies found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr onclick="viewPolicy(${p.id})">
      <td class="table-cell-primary">${p.name}</td>
      <td class="table-cell-secondary">${p.category}</td>
      <td class="table-cell-secondary">${p.limit}</td>
      <td class="table-cell-muted">${p.lastUpdated}</td>
      <td>${getStatusBadge(p.status)}</td>
      <td>
        <div class="flex gap-2" onclick="event.stopPropagation()">
          <button class="btn-icon" title="View" onclick="viewPolicy(${p.id})">${Icons.eye}</button>
          <button class="btn-icon" title="Edit" onclick="editPolicy(${p.id})">${Icons.edit}</button>
          ${p.status === 'Draft' ? `<button class="btn-icon" title="Submit" onclick="submitPolicy(${p.id})">${Icons.send}</button>` : ''}
          <button class="btn-icon" title="Duplicate" onclick="duplicatePolicy(${p.id})">${Icons.copy}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.viewPolicy = function (id) {
  viewingPolicy = POLICIES.find(p => p.id === id);
  if (!viewingPolicy) return;

  document.getElementById('details-panel-title').textContent = viewingPolicy.name;
  document.getElementById('details-panel-body').innerHTML = `
    <div class="modal-status-banner">
      <div style="flex:1;">
        <p class="modal-status-banner-title">Workflow Status: ${POLICY_WORKFLOW_STATUS_LABEL[viewingPolicy.status]}</p>
        <p class="modal-status-banner-copy">This policy is currently ${viewingPolicy.status.toLowerCase()}. Last updated by ${viewingPolicy.lastUpdatedBy} ${viewingPolicy.lastUpdated}.</p>
      </div>
      <div style="flex-shrink:0;">${getStatusBadge(viewingPolicy.status)}</div>
    </div>

    <div class="modal-grid">
      <!-- Left Column: Core Definition -->
      <div class="flex flex-col gap-6" style="display:flex;flex-direction:column;gap:24px;">
        <div class="modal-card">
          <h3 class="modal-section-title">Core Definition</h3>
          <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
            ${detailRow('Policy Code', viewingPolicy.policyCode)}
            ${detailRow('Category', viewingPolicy.category)}
            ${detailRow('Effective Date', viewingPolicy.effectiveDate || 'Not set')}
            ${detailRow('Review Date', viewingPolicy.reviewDate || 'Not set')}
          </div>
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);">
            ${detailRow('Description', viewingPolicy.description || 'No description provided')}
          </div>
        </div>

        <div class="modal-card">
          <h3 class="modal-section-title">Rules & Controls</h3>
          <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
            ${detailRow('Limit / Threshold', viewingPolicy.limit)}
            ${detailRow('Applies To', getPolicyScopeLabel(viewingPolicy.appliesTo))}
            ${detailRow('Receipt Rule', viewingPolicy.receiptRequirement)}
            ${detailRow('Approval Routing', viewingPolicy.approvalRequirement)}
          </div>
        </div>

        <div class="modal-card">
          <h3 class="modal-section-title">Technical Handoff</h3>
          <div style="display:grid;grid-template-columns:repeat(1, 1fr);gap:16px;">
            ${detailRow('OCR Rule', viewingPolicy.ocrRule)}
            ${detailRow('Duplicate Rule', viewingPolicy.duplicateRule)}
          </div>
        </div>
      </div>

      <!-- Right Column: Meta & Actions -->
      <div class="flex flex-col gap-6" style="display:flex;flex-direction:column;gap:24px;">
        <div class="modal-card">
          <h3 class="modal-section-title">Risk Assessment</h3>
          <div style="margin-bottom:12px;">
            <div class="flex items-center justify-between mb-2" style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:0.85rem;color:var(--text-muted);font-weight:500;">Risk Score Weight</span>
              <span style="font-weight:700;color:var(--accent);">${viewingPolicy.riskScoreWeight}/100</span>
            </div>
            <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);">
              <div style="height:100%;width:${viewingPolicy.riskScoreWeight}%;background:linear-gradient(90deg, var(--primary), var(--accent));"></div>
            </div>
          </div>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.5;">
            Higher risk weights trigger priority reviews in the anomaly detection engine.
          </div>
        </div>

        <div class="modal-card">
          <h3 class="modal-section-title">Governance</h3>
          ${detailRow('Original Author', viewingPolicy.createdBy)}
          ${detailRow('Current Version', `v${viewingPolicy.version}`)}
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.02em;">Change Summary</p>
            <p style="font-size:0.88rem;color:var(--text-primary);line-height:1.5;">${viewingPolicy.changeSummary || 'Final policy review and compliance alignment.'}</p>
          </div>
        </div>

        <div class="flex flex-col gap-3" style="display:flex;flex-direction:column;gap:12px;">
          <button class="btn btn-primary w-full py-3" style="width:100%;padding:12px 0;display:flex;align-items:center;justify-content:center;gap:10px;" onclick="editPolicy(${viewingPolicy.id});closePanel('details-panel')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Submission
          </button>
          <button class="btn btn-secondary w-full py-3" style="width:100%;padding:12px 0;" onclick="closePanel('details-panel')">Close Panel</button>
        </div>
      </div>
    </div>
  `;
  openPanel('details-panel');
};

function detailRow(label, value) {
  return `<div class="detail-item">
    <p class="detail-item-label">${label}</p>
    <p class="detail-item-value">${value}</p>
  </div>`;
}

window.editPolicy = function (id) {
  editingPolicy = POLICIES.find(p => p.id === id) || null;
  openEditorPanel(editingPolicy);
};

window.submitPolicy = function (id) {
  const p = POLICIES.find(policy => policy.id === id);
  if (!p) return;
  p.status = 'Submitted';
  p.lastUpdated = 'Today';
  p.lastUpdatedBy = 'Hari Vamsi';
  renderPoliciesTable();
  Toast.success(`Submitted "${p.name}" for configuration approval`);
};

window.duplicatePolicy = function (id) {
  const p = POLICIES.find(policy => policy.id === id);
  if (!p) return;
  const cloneId = getNextPolicyId();
  const clone = normalizePolicyRecord({
    ...p,
    id: cloneId,
    policyCode: generatePolicyCode(cloneId),
    name: `${p.name} Copy`,
    status: 'Draft',
    lastUpdated: 'Today',
    version: '1.0',
    attachments: (p.attachments || []).map((attachment, idx) => ({
      ...attachment,
      id: `att-${cloneId}-${idx + 1}`,
    })),
  });
  POLICIES.push(clone);
  renderPoliciesTable();
  Toast.success(`Duplicated "${p.name}" as draft`);
};

window.openCreatePolicy = function () {
  editingPolicy = null;
  openEditorPanel(null);
};

function openEditorPanel(policy) {
  const normalized = normalizePolicyRecord(policy || {
    id: getNextPolicyId(),
    policyCode: generatePolicyCode(getNextPolicyId()),
    status: 'Draft',
    lastUpdated: 'Today',
  });

  policyDraftState = {
    attachments: [...(normalized.attachments || [])],
    mode: policy ? 'edit' : 'create',
  };

  const title = document.getElementById('editor-panel-title');
  if (title) title.textContent = policy ? 'Revise Policy' : 'Define Policy';

  setInputValue('pol-id', normalized.policyCode);
  setInputValue('pol-name', normalized.name);
  setInputValue('pol-type', normalized.policyType);
  setInputValue('pol-cat', normalized.category);
  setInputValue('pol-applies', normalized.appliesTo);
  setInputValue('pol-priority', normalized.priorityLevel);
  setInputValue('pol-date', normalized.effectiveDate);
  setInputValue('pol-review-date', normalized.reviewDate);
  setInputValue('pol-amount', normalized.limitAmount);
  setInputValue('pol-receipt', normalized.receiptRequirement);
  setInputValue('pol-approval', normalized.approvalRequirement);
  setInputValue('pol-duplicate', normalized.duplicateRule);
  setInputValue('pol-ocr', normalized.ocrRule);
  setInputValue('pol-exceptions', normalized.exceptionConditions);
  setInputValue('pol-escalation', normalized.escalationConditions);
  setInputValue('pol-desc', normalized.description);
  setInputValue('pol-violation-action', normalized.violationAction);
  setInputValue('pol-risk-weight', normalized.riskScoreWeight);
  setInputValue('pol-version', normalized.version);
  setInputValue('pol-created-by', normalized.createdBy);
  setInputValue('pol-updated-by', normalized.lastUpdatedBy || 'Hari Vamsi');
  setInputValue('pol-reason', normalized.reason);
  setInputValue('pol-change-summary', normalized.changeSummary);
  setInputValue('pol-config-notes', normalized.configNotes);

  setCheckboxValue('pol-manual-review', normalized.manualReviewRequired);
  setCheckboxValue('pol-notify', normalized.notifyStakeholders);
  setCheckboxValue('pol-audit-logging', normalized.auditLogging);

  syncRiskWeightLabel();
  syncEditorStatus(normalized.status);
  renderAttachmentCards();
  clearPolicyValidation();
  clearPolicyPreview();
  resetPolicyFileInput();

  openPanel('editor-panel');
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function setCheckboxValue(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(checked);
}

function readEditorStatus() {
  return document.getElementById('policy-current-status')?.dataset.status || 'Draft';
}

function syncEditorStatus(status) {
  const badgeWrap = document.getElementById('policy-editor-status');
  const helper = document.getElementById('policy-editor-status-note');
  const normalizedStatus = status || 'Draft';
  const workflowLabel = POLICY_WORKFLOW_STATUS_LABEL[normalizedStatus] || normalizedStatus;
  const currentStatus = document.getElementById('policy-current-status');

  if (badgeWrap) {
    badgeWrap.innerHTML = `<span id="policy-current-status" class="badge ${getStatusClass(normalizedStatus)}" data-status="${normalizedStatus}">${workflowLabel}</span>`;
  }
  if (helper) {
    helper.textContent = normalizedStatus === 'Submitted'
      ? 'Submitted items are routed to the Configuration Manager for system implementation and control mapping.'
      : normalizedStatus === 'Needs Revision'
        ? 'Returned items require clarification before they can be re-submitted for implementation.'
        : 'This submission will be sent to the Configuration Manager for system implementation after approval.';
  }
  if (currentStatus) currentStatus.dataset.status = normalizedStatus;
}

function getStatusClass(status) {
  return {
    Draft: 'badge-slate',
    Submitted: 'badge-yellow',
    Active: 'badge-green',
    Approved: 'badge-blue',
    'Needs Revision': 'badge-red',
  }[status] || 'badge-slate';
}

function collectFormData(statusOverride) {
  const data = {
    policyCode: document.getElementById('pol-id')?.value.trim(),
    name: document.getElementById('pol-name')?.value.trim(),
    policyType: document.getElementById('pol-type')?.value,
    category: document.getElementById('pol-cat')?.value,
    appliesTo: document.getElementById('pol-applies')?.value,
    priorityLevel: document.getElementById('pol-priority')?.value,
    effectiveDate: document.getElementById('pol-date')?.value,
    reviewDate: document.getElementById('pol-review-date')?.value,
    limitAmount: document.getElementById('pol-amount')?.value,
    receiptRequirement: document.getElementById('pol-receipt')?.value,
    approvalRequirement: document.getElementById('pol-approval')?.value,
    duplicateRule: document.getElementById('pol-duplicate')?.value,
    ocrRule: document.getElementById('pol-ocr')?.value,
    exceptionConditions: document.getElementById('pol-exceptions')?.value.trim(),
    escalationConditions: document.getElementById('pol-escalation')?.value.trim(),
    description: document.getElementById('pol-desc')?.value.trim(),
    violationAction: document.getElementById('pol-violation-action')?.value,
    riskScoreWeight: Number(document.getElementById('pol-risk-weight')?.value || 0),
    manualReviewRequired: Boolean(document.getElementById('pol-manual-review')?.checked),
    notifyStakeholders: Boolean(document.getElementById('pol-notify')?.checked),
    auditLogging: Boolean(document.getElementById('pol-audit-logging')?.checked),
    attachments: [...(policyDraftState?.attachments || [])],
    version: document.getElementById('pol-version')?.value.trim(),
    createdBy: document.getElementById('pol-created-by')?.value.trim(),
    lastUpdatedBy: document.getElementById('pol-updated-by')?.value.trim(),
    reason: document.getElementById('pol-reason')?.value.trim(),
    changeSummary: document.getElementById('pol-change-summary')?.value.trim(),
    configNotes: document.getElementById('pol-config-notes')?.value.trim(),
    status: statusOverride || readEditorStatus(),
  };

  data.limit = formatLimit(data.limitAmount);
  data.lastUpdated = 'Today';
  return data;
}

function validatePolicyData(data, mode = 'draft') {
  const issues = [];
  if (!data.name) issues.push('Policy Name is required.');
  if (!data.policyType) issues.push('Policy Type is required.');
  if (!data.category) issues.push('Expense Category is required.');
  if (!data.appliesTo) issues.push('Applies To must be selected.');
  if (!data.effectiveDate) issues.push('Effective Date is required.');
  if (!data.limitAmount || Number(data.limitAmount) <= 0) issues.push('Maximum Allowed Amount must be greater than zero.');
  if (!data.description || data.description.length < 30) issues.push('Rule Description should clearly describe the control logic.');
  if (!data.reason || data.reason.length < 20) issues.push('Reason for Policy Creation or Update must explain the business rationale.');
  if (!data.changeSummary || data.changeSummary.length < 20) issues.push('Change Summary is required for auditability.');
  if (!data.configNotes || data.configNotes.length < 20) issues.push('Notes for Configuration Manager should describe implementation expectations.');
  if (data.reviewDate && data.effectiveDate && data.reviewDate < data.effectiveDate) {
    issues.push('Review / Expiry Date cannot be earlier than Effective Date.');
  }
  if (mode === 'submit' && data.attachments.length === 0) {
    issues.push('At least one supporting document should be attached before submission.');
  }
  if (mode === 'submit' && data.riskScoreWeight < 25) {
    issues.push('Risk Score Weight should be at least 25 for implementation submission.');
  }
  return issues;
}

function renderValidationState(issues) {
  const box = document.getElementById('policy-validation-results');
  if (!box) return;
  if (!issues.length) {
    box.innerHTML = '<div class="policy-validation-success">Validation passed. Submission package is complete for Configuration Manager review.</div>';
    return;
  }
  box.innerHTML = `
    <div class="policy-validation-error-title">Validation checks require attention</div>
    <ul class="policy-validation-list">${issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
  `;
}

function clearPolicyValidation() {
  const box = document.getElementById('policy-validation-results');
  if (box) box.innerHTML = '<p class="policy-helper-copy">Validation checks will surface missing controls, metadata gaps, and weak handoff information before submission.</p>';
}

function clearPolicyPreview() {
  const box = document.getElementById('policy-preview-output');
  if (box) box.innerHTML = '<p class="policy-helper-copy">Preview Impact summarizes how this policy will behave once routed to the Configuration Manager.</p>';
}

function buildPreviewMarkup(data) {
  return `
    <div class="policy-preview-grid">
      <div class="policy-preview-card">
        <span class="policy-preview-label">Workflow</span>
        <strong>${POLICY_WORKFLOW_STATUS_LABEL[data.status] || data.status}</strong>
        <p>Submission will be handed off to the Configuration Manager for implementation and rule mapping.</p>
      </div>
      <div class="policy-preview-card">
        <span class="policy-preview-label">Coverage</span>
        <strong>${data.category} · ${data.appliesTo}</strong>
        <p>${data.receiptRequirement} receipts, ${data.approvalRequirement.toLowerCase()}, ${data.violationAction.toLowerCase()} on breach.</p>
      </div>
      <div class="policy-preview-card">
        <span class="policy-preview-label">Risk Posture</span>
        <strong>${data.riskScoreWeight}/100 risk weighting</strong>
        <p>${data.manualReviewRequired ? 'Manual review required.' : 'Manual review not required.'} ${data.notifyStakeholders ? 'Stakeholders will be notified.' : 'Stakeholder notifications disabled.'}</p>
      </div>
      <div class="policy-preview-card">
        <span class="policy-preview-label">Attachments</span>
        <strong>${data.attachments.length} supporting file${data.attachments.length === 1 ? '' : 's'}</strong>
        <p>${data.attachments.length ? data.attachments.map(file => file.name).join(', ') : 'No supporting files attached yet.'}</p>
      </div>
    </div>
  `;
}

function upsertPolicy(status) {
  const data = collectFormData(status);
  const issues = validatePolicyData(data, status === 'Submitted' ? 'submit' : 'draft');
  renderValidationState(issues);
  if (issues.length) {
    Toast.error('Policy form has validation gaps. Resolve them before continuing.');
    return null;
  }

  if (editingPolicy) {
    Object.assign(editingPolicy, data);
    return editingPolicy;
  }

  const newPolicy = normalizePolicyRecord({
    id: getNextPolicyId(),
    ...data,
  });
  POLICIES.push(newPolicy);
  return newPolicy;
}

function renderAttachmentCards() {
  const container = document.getElementById('policy-attachments-list');
  if (!container) return;
  const attachments = policyDraftState?.attachments || [];

  if (!attachments.length) {
    container.innerHTML = '<div class="policy-empty-attachments">No supporting documents attached yet. Upload circulars, SOPs, internal memos, or implementation notes.</div>';
    return;
  }

  container.innerHTML = attachments.map(file => `
    <div class="attachment-card">
      <div class="attachment-card-main">
        <div class="attachment-icon">${file.type}</div>
        <div>
          <div class="attachment-name">${file.name}</div>
          <div class="attachment-meta">${file.source} · Uploaded ${file.uploadedAt}</div>
        </div>
      </div>
      <div class="attachment-actions">
        <button type="button" class="btn btn-ghost btn-sm" onclick="viewPolicyAttachment('${file.id}')">View</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="removePolicyAttachment('${file.id}')">Remove</button>
      </div>
    </div>
  `).join('');
}

function resetPolicyFileInput() {
  const input = document.getElementById('policy-file-upload');
  if (input) input.value = '';
}

window.handlePolicyUploads = function (input) {
  if (!input?.files?.length) return;
  const uploadedAt = new Date().toISOString().slice(0, 10);
  Array.from(input.files).forEach((file, index) => {
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    policyDraftState.attachments.push({
      id: `att-${Date.now()}-${index}`,
      name: file.name,
      type: ext.length > 4 ? 'FILE' : ext,
      uploadedAt,
      source: 'Uploaded Document',
      url: URL.createObjectURL(file),
    });
  });
  renderAttachmentCards();
  resetPolicyFileInput();
  Toast.success('Supporting documents attached.');
};

window.viewPolicyAttachment = function (id) {
  const file = (policyDraftState?.attachments || []).find(item => item.id === id);
  if (!file) return;
  if (file.url) {
    window.open(file.url, '_blank', 'noopener');
    return;
  }
  Toast.info(`Preview not available for ${file.name}, but it is attached to the submission package.`);
};

window.removePolicyAttachment = function (id) {
  if (!policyDraftState) return;
  policyDraftState.attachments = policyDraftState.attachments.filter(item => item.id !== id);
  renderAttachmentCards();
  Toast.info('Attachment removed from submission package.');
};

window.syncRiskWeightLabel = function () {
  const input = document.getElementById('pol-risk-weight');
  const label = document.getElementById('pol-risk-weight-value');
  if (input && label) label.textContent = `${input.value}/100`;
};

window.validatePolicyForm = function () {
  const data = collectFormData(readEditorStatus());
  const issues = validatePolicyData(data, 'submit');
  renderValidationState(issues);
  if (issues.length) {
    Toast.warning('Validation completed with issues.');
  } else {
    Toast.success('Policy validation passed.');
  }
};

window.previewPolicyImpact = function () {
  const data = collectFormData(readEditorStatus());
  const box = document.getElementById('policy-preview-output');
  if (!box) return;
  box.innerHTML = buildPreviewMarkup(data);
  Toast.info('Impact preview generated.');
};

window.saveDraft = function (e) {
  e?.preventDefault();
  const policy = upsertPolicy('Draft');
  if (!policy) return;
  editingPolicy = null;
  syncEditorStatus('Draft');
  renderPoliciesTable();
  Toast.success('Policy saved as draft.');
  closePanel('editor-panel');
};

window.submitForApproval = function () {
  const policy = upsertPolicy('Submitted');
  if (!policy) return;
  editingPolicy = null;
  syncEditorStatus('Submitted');
  renderPoliciesTable();
  Toast.success('Submission sent to the Configuration Manager for implementation.');
  closePanel('editor-panel');
};

function initPolicies() {
  renderPoliciesTable();
  document.getElementById('pol-search')?.addEventListener('input', renderPoliciesTable);
  document.getElementById('pol-status')?.addEventListener('change', renderPoliciesTable);
  document.getElementById('pol-category')?.addEventListener('change', renderPoliciesTable);
  highlightPendingPolicy();
}

function highlightPendingPolicy() {
  const id = window.sessionStorage.getItem(PENDING_POLICY_HIGHLIGHT_KEY);
  const shouldOpen = window.sessionStorage.getItem(PENDING_POLICY_OPEN_KEY) === 'true';
  if (!id) return;

  window.sessionStorage.removeItem(PENDING_POLICY_HIGHLIGHT_KEY);
  window.sessionStorage.removeItem(PENDING_POLICY_OPEN_KEY);
  document.querySelectorAll('tr.policy-highlight').forEach(r => r.classList.remove('policy-highlight'));
  const tbody = document.getElementById('policies-tbody');
  if (!tbody) return;
  const policy = POLICIES.find(p => String(p.id) === String(id));
  if (!policy) return;

  let matchedRow = null;
  tbody.querySelectorAll('tr').forEach(row => {
    const cell = row.querySelector('td');
    if (cell && cell.textContent.trim() === policy.name) {
      matchedRow = row;
      row.classList.add('policy-highlight');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  if (shouldOpen && matchedRow) {
    window.setTimeout(() => viewPolicy(policy.id), 250);
  }
}

/* ── Dashboard Policy Popup ─────────────────────────── */
window.showPolicyPopup = function (id, name, issue, category, status) {
  _popupPolicyId = id;

  document.getElementById('popup-title').textContent = name;
  document.getElementById('popup-issue').textContent = issue;
  document.getElementById('popup-category').textContent = category;

  const statusEl = document.getElementById('popup-status');
  const colMap = {
    Active: 'var(--green)', Draft: 'var(--text-secondary)',
    Submitted: 'var(--yellow)', 'Needs Revision': 'var(--red)', Approved: 'var(--blue)'
  };
  statusEl.textContent = status;
  statusEl.style.color = colMap[status] || 'var(--text-secondary)';

  document.getElementById('policy-popup-backdrop').style.display = 'block';
  document.getElementById('policy-popup').style.display = 'block';
};

window.closePolicyPopup = function () {
  document.getElementById('policy-popup-backdrop').style.display = 'none';
  document.getElementById('policy-popup').style.display = 'none';
};

window.goToPolicyAndHighlight = function () {
  const id = _popupPolicyId;
  closePolicyPopup();
  if (id) {
    window.sessionStorage.setItem(PENDING_POLICY_HIGHLIGHT_KEY, String(id));
    window.sessionStorage.setItem(PENDING_POLICY_OPEN_KEY, 'true');
  }
  Router.navigate('policies');
};

window.initPolicies = initPolicies;
