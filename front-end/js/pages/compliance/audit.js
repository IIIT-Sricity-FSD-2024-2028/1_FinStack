/* ============================================================
   audit.js – Audit Logs page
   ============================================================ */

'use strict';

let AUDIT_LOGS = [];

function loadAuditLogs() {
  if (window.FinStackStore) {
    const rawLogs = window.FinStackStore.getAuditLogs() || [];
    AUDIT_LOGS = rawLogs.map(log => {
      return {
        id: log.id,
        timestamp: new Date(log.timestamp).toLocaleString(),
        user: log.user || 'System',
        userRole: log.userRole || 'Role',
        entityType: log.entityType || 'Record',
        entityId: log.entityName || log.id,
        entityName: log.entityName || 'Unnamed Entity',
        entityMeta: log.entityType || 'General',
        action: log.action ? log.action.split(' ')[0] : 'Action',
        status: log.status || 'Success',
        oldValue: (log.details && log.details.oldValue) ? log.details.oldValue : 'N/A',
        newValue: (log.details && log.details.newValue) ? log.details.newValue : 'N/A',
        ipAddress: 'System-IP',
        logId: log.id,
        organizationId: window.FinStackStore.getOrganization()?.id || 'ORG-001',
        userId: 'System-Generated',
        reviewStatus: 'Pending Review',
        issueMarked: false,
        actionInitiated: false,
        issueTag: '',
        actionType: '',
        actionOwner: 'Compliance Officer',
        actionNotes: '',
        reviewNotes: '',
        closureReason: '',
      };
    });
    window.AUDIT_LOGS = AUDIT_LOGS;
  }
}

let selectedAuditLogId = null;

function getActionBadge(action) {
  const map = {
    Created: 'audit-action-create',
    Updated: 'audit-action-update',
    Deleted: 'audit-action-delete',
    Flagged: 'audit-action-flag',
    Approved: 'audit-action-approve',
    Rejected: 'audit-action-reject',
    Submitted: 'audit-action-review',
  };
  return `<span class="audit-action-pill ${map[action] || 'audit-action-review'}">${getActionIcon(action)}${action}</span>`;
}

function getActionColor(action) {
  const map = {
    Created: 'var(--green)', Updated: 'var(--accent)', Deleted: 'var(--red)',
    Flagged: 'var(--orange)', Approved: 'var(--blue)', Rejected: 'var(--red)', Submitted: 'var(--yellow)'
  };
  return map[action] || 'var(--text-secondary)';
}

function getFilteredLogs() {
  const q = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const d = document.getElementById('audit-date')?.value || 'Today';
  const u = document.getElementById('audit-user')?.value || 'All Users';
  const at = document.getElementById('audit-action')?.value || 'All Actions';
  return AUDIT_LOGS.filter(l =>
    matchesAuditDateFilter(l.timestamp, d) &&
    (q === '' || l.user.toLowerCase().includes(q) || l.entityId.toLowerCase().includes(q) || l.entityName.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.entityType.toLowerCase().includes(q)) &&
    (u === 'All Users' || l.user === u) &&
    (at === 'All Actions' || l.action === at)
  );
}

function matchesAuditDateFilter(timestampStr, filter) {
  if (filter === 'Today') {
    const d = new Date(timestampStr);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }
  return true;
}

function getReviewBadge(status) {
  const map = {
    'Pending Review': 'badge-slate',
    'Issue Marked': 'badge-orange',
    'Action Initiated': 'badge-yellow',
    'Action Recorded': 'badge-blue',
    'Review Closed': 'badge-green',
  };
  return `<span class="badge ${map[status] || 'badge-slate'}">${status}</span>`;
}

function renderAuditTable() {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  const filtered = getFilteredLogs();

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No audit logs found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(l => `
    <tr class="audit-log-row" onclick="viewLogDetails('${l.id}')">
      <td class="audit-expand-cell">
        <span class="audit-expand-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </td>
      <td class="table-cell-muted audit-timestamp">${l.timestamp}</td>
      <td>
        <div class="table-cell-stack">
          <span class="table-cell-stack-title">${l.user}</span>
          <span class="table-cell-stack-copy">${l.userRole}</span>
        </div>
      </td>
      <td>${getActionBadge(l.action)}</td>
      <td>
        <div class="audit-entity-cell">
          <span class="audit-entity-icon ${getEntityIconClass(l.entityType)}">${getEntityGlyph(l.entityType)}</span>
          <div class="table-cell-stack">
            <span class="table-cell-stack-title">${l.entityName}</span>
            <span class="table-cell-stack-copy">${l.entityMeta}</span>
          </div>
        </div>
      </td>
      <td>${getStatusBadge(l.status)}</td>
    </tr>
  `).join('');
}

function getStatusBadge(status) {
  const map = {
    Success: 'audit-status-success',
    Failed: 'audit-status-failed',
    Pending: 'audit-status-pending',
  };
  return `<span class="audit-status-pill ${map[status] || 'audit-status-pending'}">${status}</span>`;
}

function getEntityIconClass(entityType) {
  const map = {
    Expense: 'audit-entity-expense',
    Policy: 'audit-entity-policy',
    User: 'audit-entity-user',
    Category: 'audit-entity-category',
    Role: 'audit-entity-role',
  };
  return map[entityType] || 'audit-entity-generic';
}

function getEntityGlyph(entityType) {
  const map = {
    Expense: '$',
    Policy: '◫',
    User: '•',
    Category: '▤',
    Role: '⬡',
  };
  return map[entityType] || '•';
}

function getActionIcon(action) {
  const icons = {
    Approved: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    Updated: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    Created: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7h-7"/><path d="M3 10V3h7"/><path d="M3 3l7 7"/></svg>',
    Rejected: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    Deleted: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    Flagged: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22V4"/><path d="m4 4 13 2-3 5 3 5-13 2"/></svg>',
    Submitted: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/></svg>',
  };
  return icons[action] || '';
}

window.viewLogDetails = function (id) {
  selectedAuditLogId = id;
  renderAuditReviewPanel();
  openPanel('log-panel');
};

function renderAuditReviewPanel() {
  const log = AUDIT_LOGS.find(l => l.id === selectedAuditLogId);
  if (!log) return;

  document.getElementById('log-details-body').innerHTML = `
    <div class="audit-review-banner mb-4">
      <div>
        <p class="audit-review-banner-title">Audit Review Workflow</p>
        <p class="audit-review-banner-copy">Review activity records, determine whether an issue exists, and record the remediation handoff for compliance follow-up.</p>
      </div>
      <div>${getReviewBadge(log.reviewStatus)}</div>
    </div>
    <div class="card mb-4">
      <h3 class="detail-section-title">Log Information</h3>
      <div class="detail-stack">
        ${logDetailRow('Log ID', `<span class="font-mono">${log.logId}</span>`)}
        ${logDetailRow('Timestamp', log.timestamp)}
        ${logDetailRow('Organization ID', `<span class="font-mono">${log.organizationId}</span>`)}
      </div>
    </div>
    <div class="card mb-4">
      <h3 class="detail-section-title">User Information</h3>
      <div class="detail-stack">
        ${logDetailRow('User', log.user)}
        ${logDetailRow('User ID', `<span class="font-mono">${log.userId}</span>`)}
        ${logDetailRow('IP Address', `<span class="font-mono">${log.ipAddress}</span>`)}
      </div>
    </div>
    <div class="card mb-4">
      <h3 class="detail-section-title">Entity Information</h3>
      <div class="detail-stack">
        ${logDetailRow('Entity Type', log.entityType)}
        ${logDetailRow('Entity ID', `<span class="font-mono">${log.entityId}</span>`)}
      </div>
    </div>
    <div class="card mb-4">
      <h3 class="detail-section-title">Action Details</h3>
      <div class="detail-stack">
        ${logDetailRow('Action', `<span style="font-weight:600;color:${getActionColor(log.action)}">${log.action}</span>`)}
        <div>
          <p class="detail-item-label">Old Value</p>
          <p class="detail-value-box">${log.oldValue}</p>
        </div>
        <div>
          <p class="detail-item-label">New Value</p>
          <p class="detail-value-box-accent">${log.newValue}</p>
        </div>
      </div>
    </div>
    <div class="info-box">
      <div class="info-box-icon">${Icons.alertCircle}</div>
      <p>This audit log entry is immutable and stored for compliance purposes. All changes are tracked for security and regulatory requirements.</p>
    </div>
    <div class="card mt-4">
      <h3 style="color:var(--accent);font-size:1rem;font-weight:600;margin-bottom:16px;">Review and Initiate Action</h3>
      <div class="audit-workflow-shell">
        <div class="audit-workflow-step">
          <div>
            <p class="audit-workflow-title">1. Any issue?</p>
            <p class="audit-workflow-copy">Assess whether the activity requires escalation, follow-up, or documentation.</p>
          </div>
          <div class="audit-workflow-actions">
            <button class="btn btn-secondary btn-sm" onclick="closeAuditReview(false)">No Issue</button>
            <button class="btn btn-primary btn-sm" onclick="markAuditIssue()">Mark Issue</button>
          </div>
        </div>
        <div class="audit-workflow-step ${log.issueMarked ? '' : 'audit-workflow-step-disabled'}">
          <div>
            <p class="audit-workflow-title">2. Mark the issue</p>
            <p class="audit-workflow-copy">Classify the issue and prepare the action package for compliance operations.</p>
          </div>
          <div class="audit-review-grid">
            <div class="form-group">
              <label class="form-label">Issue Category</label>
              <select id="audit-issue-tag" class="form-control" ${log.issueMarked ? '' : 'disabled'}>
                <option ${log.issueTag === 'Suspicious Activity' ? 'selected' : ''}>Suspicious Activity</option>
                <option ${log.issueTag === 'Policy Breach' ? 'selected' : ''}>Policy Breach</option>
                <option ${log.issueTag === 'Duplicate Claim' ? 'selected' : ''}>Duplicate Claim</option>
                <option ${log.issueTag === 'Unauthorized Approval' ? 'selected' : ''}>Unauthorized Approval</option>
                <option ${log.issueTag === 'Data Integrity Risk' ? 'selected' : ''}>Data Integrity Risk</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Action Owner</label>
              <input id="audit-action-owner" class="form-control" type="text" value="${log.actionOwner || 'Compliance Officer'}" ${log.issueMarked ? '' : 'disabled'} />
            </div>
            <div class="form-group audit-review-grid-span-2">
              <label class="form-label">Review Notes</label>
              <textarea id="audit-review-notes" class="form-control" ${log.issueMarked ? '' : 'disabled'} placeholder="Describe the observed issue, trigger point, and why follow-up is required.">${log.reviewNotes || ''}</textarea>
            </div>
          </div>
          <div class="audit-workflow-actions">
            <button class="btn btn-secondary btn-sm" onclick="closeAuditReview(true)" ${log.issueMarked ? '' : 'disabled'}>Close Audit Review</button>
            <button class="btn btn-primary btn-sm" onclick="initiateAuditAction()" ${log.issueMarked ? '' : 'disabled'}>Initiate Action</button>
          </div>
        </div>
        <div class="audit-workflow-step ${log.actionInitiated ? '' : 'audit-workflow-step-disabled'}">
          <div>
            <p class="audit-workflow-title">3. Record action details</p>
            <p class="audit-workflow-copy">Record the action taken so the audit review closes with a documented response trail.</p>
          </div>
          <div class="audit-review-grid">
            <div class="form-group">
              <label class="form-label">Action Type</label>
              <select id="audit-action-type" class="form-control" ${log.actionInitiated ? '' : 'disabled'}>
                <option ${log.actionType === 'Flag for Investigation' ? 'selected' : ''}>Flag for Investigation</option>
                <option ${log.actionType === 'Escalate to Compliance Manager' ? 'selected' : ''}>Escalate to Compliance Manager</option>
                <option ${log.actionType === 'Request User Clarification' ? 'selected' : ''}>Request User Clarification</option>
                <option ${log.actionType === 'Freeze Reimbursement' ? 'selected' : ''}>Freeze Reimbursement</option>
                <option ${log.actionType === 'Document Only' ? 'selected' : ''}>Document Only</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Current Workflow Status</label>
              <div class="form-control" style="display:flex;align-items:center;">${POLICY_SAFE(log.reviewStatus)}</div>
            </div>
            <div class="form-group audit-review-grid-span-2">
              <label class="form-label">Action Details</label>
              <textarea id="audit-action-notes" class="form-control" ${log.actionInitiated ? '' : 'disabled'} placeholder="Record the action initiated, target team, and expected next step.">${log.actionNotes || ''}</textarea>
            </div>
          </div>
          <div class="audit-workflow-actions">
            <button class="btn btn-primary btn-sm" onclick="recordAuditAction()" ${log.actionInitiated ? '' : 'disabled'}>Record Action Details</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function logDetailRow(label, value) {
  return `<div class="detail-item">
    <p class="detail-item-label">${label}</p>
    <p class="detail-item-value">${value}</p>
  </div>`;
}

function POLICY_SAFE(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.markAuditIssue = function () {
  const log = AUDIT_LOGS.find(l => l.id === selectedAuditLogId);
  if (!log) return;
  log.issueMarked = true;
  log.reviewStatus = 'Issue Marked';
  if (!log.issueTag) log.issueTag = 'Suspicious Activity';
  renderAuditReviewPanel();
  Toast.warning('Issue marked for follow-up.');
};

window.initiateAuditAction = function () {
  const log = AUDIT_LOGS.find(l => l.id === selectedAuditLogId);
  if (!log) return;

  log.issueTag = document.getElementById('audit-issue-tag')?.value || log.issueTag;
  log.actionOwner = document.getElementById('audit-action-owner')?.value.trim() || 'Compliance Officer';
  log.reviewNotes = document.getElementById('audit-review-notes')?.value.trim() || '';

  if (!log.reviewNotes || log.reviewNotes.length < 12) {
    Toast.error('Add review notes before initiating action.');
    return;
  }

  log.actionInitiated = true;
  log.reviewStatus = 'Action Initiated';
  if (!log.actionType) log.actionType = 'Flag for Investigation';
  renderAuditReviewPanel();
  Toast.success('Action initiated and routed for follow-up.');
};

window.recordAuditAction = function () {
  const log = AUDIT_LOGS.find(l => l.id === selectedAuditLogId);
  if (!log) return;

  log.actionType = document.getElementById('audit-action-type')?.value || log.actionType;
  log.actionNotes = document.getElementById('audit-action-notes')?.value.trim() || '';
  if (!log.actionNotes || log.actionNotes.length < 12) {
    Toast.error('Record detailed action notes before closing the workflow.');
    return;
  }

  log.reviewStatus = 'Action Recorded';
  renderAuditTable();
  renderAuditReviewPanel();
  Toast.success('Action details recorded.');
};

window.closeAuditReview = function (hasIssue) {
  const log = AUDIT_LOGS.find(l => l.id === selectedAuditLogId);
  if (!log) return;

  if (hasIssue) {
    log.issueTag = document.getElementById('audit-issue-tag')?.value || log.issueTag;
    log.actionOwner = document.getElementById('audit-action-owner')?.value.trim() || log.actionOwner;
    log.reviewNotes = document.getElementById('audit-review-notes')?.value.trim() || log.reviewNotes;
    log.actionType = document.getElementById('audit-action-type')?.value || log.actionType;
    log.actionNotes = document.getElementById('audit-action-notes')?.value.trim() || log.actionNotes;
  } else {
    log.closureReason = 'No issue identified during audit review.';
  }

  log.reviewStatus = 'Review Closed';
  renderAuditTable();
  closePanel('log-panel');
  Toast.success(hasIssue ? 'Audit review closed with recorded action trail.' : 'Audit review closed with no issue found.');
};

function initAudit() {
  if (window.FinStackStore && window.FinStackStore.ready) {
    window.FinStackStore.ready.then(() => {
      loadAuditLogs();
      renderAuditTable();
      document.getElementById('audit-date')?.addEventListener('change', renderAuditTable);
      document.getElementById('audit-search')?.addEventListener('input', renderAuditTable);
      document.getElementById('audit-user')?.addEventListener('change', renderAuditTable);
      document.getElementById('audit-action')?.addEventListener('change', renderAuditTable);
    });
  } else {
    loadAuditLogs();
    renderAuditTable();
    document.getElementById('audit-date')?.addEventListener('change', renderAuditTable);
    document.getElementById('audit-search')?.addEventListener('input', renderAuditTable);
    document.getElementById('audit-user')?.addEventListener('change', renderAuditTable);
    document.getElementById('audit-action')?.addEventListener('change', renderAuditTable);
  }
}

window.initAudit = initAudit;
