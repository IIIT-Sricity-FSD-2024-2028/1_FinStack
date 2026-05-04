document.addEventListener('DOMContentLoaded', function () {
    FinStack.whenReady(function () {
    var icons = {
        completed: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        current: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        rejected: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        upcoming: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
        cancelled: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
    };

    function escStatusHtml(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function normalizeStageCode(item) {
        var code = String(item && item.code || '').toLowerCase();
        var label = String(item && item.label || '').toLowerCase();

        if (code === 'paid' || label === 'paid' || label.indexOf('reimbursement released') !== -1) return 'paid';
        if (code.indexOf('rejected') !== -1 || label.indexOf('rejected') !== -1) {
            if (code.indexOf('manager') !== -1 || label.indexOf('manager') !== -1) return 'manager_rejected';
            if (code.indexOf('finance') !== -1 || label.indexOf('finance') !== -1) return 'finance_rejected';
            if (code.indexOf('compliance') !== -1 || label.indexOf('compliance') !== -1) return 'compliance_rejected';
            return 'rejected';
        }
        if (code === 'manager_approved' || label.indexOf('manager approved') !== -1) return 'manager_approved';
        if (code === 'finance_approved' || label.indexOf('finance approved') !== -1) return 'finance_approved';
        if (code === 'compliance_approved' || label.indexOf('compliance approved') !== -1) return 'compliance_approved';
        if (code === 'manager_escalated' || label.indexOf('escalated') !== -1) return 'manager_escalated';
        if (code === 'finance_flagged' || label.indexOf('flagged') !== -1) return 'finance_flagged';
        if (code === 'manager_returned' || label.indexOf('returned') !== -1) return 'manager_returned';
        if (code === 'finance_requested_info') return 'finance_requested_info';
        if (code === 'approved_for_payment' || code === 'payment_processing') return code;
        if (code === 'manager_review' || code === 'finance_review' || code === 'compliance_review') return code;
        if (code === 'submitted' || code === 'resubmitted' || code === 'draft' || code === 'created') return code;
        return code || label;
    }

    function getStageLabel(item) {
        var c = normalizeStageCode(item);
        var labels = {
            submitted: 'Submitted',
            resubmitted: 'Resubmitted',
            manager_review: 'Manager Review',
            manager_approved: 'Manager Approved',
            manager_escalated: 'Escalated by Manager',
            manager_returned: 'Returned by Manager',
            manager_rejected: 'Rejected by Manager',
            finance_review: 'Finance Review',
            finance_approved: 'Finance Approved',
            finance_rejected: 'Finance Rejected',
            finance_requested_info: 'Finance Requested Information',
            finance_flagged: 'Flagged by Finance',
            compliance_review: 'Compliance Review',
            compliance_approved: 'Compliance Approved Exception',
            compliance_rejected: 'Rejected by Compliance',
            approved_for_payment: 'Queued for Payment',
            payment_processing: 'Payment Processing',
            paid: 'Paid',
            rejected: 'Rejected'
        };
        return labels[c] || item.label || 'Status Update';
    }

    function getStepColorClass(code) {
        var c = normalizeStageCode({ code: code });
        if (c.indexOf('rejected') !== -1 || c === 'rejected') return 'status-red';
        if (c === 'manager_approved' || c === 'finance_approved' || c === 'compliance_approved' || c === 'approved_for_payment' || c === 'payment_processing' || c === 'paid') return 'status-green';
        if (c === 'manager_escalated' || c === 'finance_flagged' || c === 'manager_returned' || c === 'finance_requested_info' || c === 'manager_review' || c === 'finance_review' || c === 'compliance_review' || c === 'resubmitted') return 'status-yellow';
        return 'status-blue';
    }

    function isMeaningfulStage(item) {
        var c = normalizeStageCode(item);
        return [
            'submitted',
            'resubmitted',
            'manager_review',
            'manager_approved',
            'manager_escalated',
            'manager_returned',
            'manager_rejected',
            'finance_review',
            'finance_approved',
            'finance_rejected',
            'finance_requested_info',
            'finance_flagged',
            'compliance_review',
            'compliance_approved',
            'compliance_rejected',
            'approved_for_payment',
            'payment_processing',
            'paid',
            'rejected'
        ].indexOf(c) !== -1;
    }

    function dedupeTimeline(expense, timeline) {
        var seen = {};
        var filtered = (timeline || []).filter(isMeaningfulStage).filter(function (item) {
            var key = expense.id + '|' + normalizeStageCode(item);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
        var hasComplianceApproval = filtered.some(function (item) {
            return normalizeStageCode(item) === 'compliance_approved';
        });
        if (!hasComplianceApproval) return filtered;
        return filtered.filter(function (item) {
            return normalizeStageCode(item) !== 'finance_approved';
        });
    }

    function hasStage(timeline, code) {
        return timeline.some(function (item) {
            return normalizeStageCode(item) === code;
        });
    }

    function getCurrentWorkflowStep(expense, timeline) {
        var workflow = String(expense.workflowStatus || expense.status || '').toLowerCase();
        var stepMap = {
            manager_review: { code: 'manager_review', label: 'Manager Review', date: 'In review' },
            finance_review: { code: 'finance_review', label: 'Finance Review', date: 'In review' },
            compliance_review: { code: 'compliance_review', label: 'Compliance Review', date: 'In review' },
            approved_for_payment: { code: 'approved_for_payment', label: 'Queued for Payment', date: 'Queued for payment' },
            payment_processing: { code: 'payment_processing', label: 'Payment Processing', date: 'Processing' },
            paid: { code: 'paid', label: 'Paid', date: FinStack.formatDate(expense.paidAt || expense.updatedAt) }
        };
        if (workflow === 'rejected') {
            if (hasStage(timeline, 'manager_rejected') || hasStage(timeline, 'finance_rejected') || hasStage(timeline, 'compliance_rejected') || hasStage(timeline, 'rejected')) return null;
            if (expense.complianceDecision === 'Rejected') return { code: 'compliance_rejected', label: 'Rejected by Compliance', date: FinStack.formatDate(expense.updatedAt) };
            if (expense.financeDecision === 'Rejected') return { code: 'finance_rejected', label: 'Finance Rejected', date: FinStack.formatDate(expense.updatedAt) };
            return { code: 'manager_rejected', label: 'Rejected by Manager', date: FinStack.formatDate(expense.updatedAt) };
        }
        var next = stepMap[workflow];
        if (!next || hasStage(timeline, next.code)) return null;
        return next;
    }

    var container = document.getElementById('statusCards');
    var expenses = FinStack.getExpenses();
    if (!expenses.length) {
        container.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--text-muted);">No submitted expenses yet.</div>';
        return;
    }

    container.innerHTML = '';

    expenses.forEach(function (expense) {
        var timeline = dedupeTimeline(expense, FinStack.getStatusTimeline(expense.id));
        var currentStatus = FinStack.getWorkflowLabel(expense);
        var badgeClass = FinStack.getWorkflowBadgeClass(expense);
        var badgeLabel = currentStatus;

        var currentWorkflowStep = getCurrentWorkflowStep(expense, timeline);
        if (currentWorkflowStep) timeline.push(currentWorkflowStep);

        var steps = timeline.map(function (item, index) {
            var status = 'completed';
            var normalizedCode = normalizeStageCode(item);
            if (index === timeline.length - 1 && expense.workflowStatus !== 'paid' && expense.workflowStatus !== 'rejected') {
                status = 'current';
            }
            if (normalizedCode.indexOf('rejected') !== -1 || normalizedCode === 'rejected') {
                status = 'rejected';
            }
            return {
                label: getStageLabel(item),
                status: status,
                date: item.date || FinStack.formatDate(item.at),
                colorClass: getStepColorClass(normalizedCode)
            };
        });

        var stepsHtml = steps.map(function (step) {
            return '<div class="step ' + step.status + ' ' + (step.colorClass || '') + '">' +
                '<div class="step-circle">' + (icons[step.status] || icons.upcoming) + '</div>' +
                '<div><div class="step-label">' + escStatusHtml(step.label) + '</div><div class="step-date">' + escStatusHtml(step.date) + '</div></div></div>';
        }).join('');

        container.innerHTML += '<div class="card">' +
            '<div class="status-card-header">' +
            '<div class="status-card-header-left">' +
            '<div class="status-file-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
            '<div><div class="status-card-title-row"><h3 style="font-size:16px;font-weight:600;color:white;">' + escStatusHtml(expense.merchant || expense.category) + '</h3><span class="badge ' + badgeClass + '">' + escStatusHtml(badgeLabel) + '</span></div>' +
            '<div class="status-card-meta"><span class="font-medium">' + escStatusHtml(expense.id) + '</span><span>•</span><span>' + escStatusHtml(FinStack.formatCurrency(expense.amount)) + '</span><span>•</span><span>' + escStatusHtml(FinStack.formatDate(expense.date)) + '</span></div></div>' +
            '</div>' +
            '<div class="status-updated"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Last updated: ' + escStatusHtml(FinStack.formatDate(expense.updatedAt || expense.created)) + '</div>' +
            '</div>' +
            '<div class="steps-container"><div class="steps-line"></div><div class="steps-grid">' + stepsHtml + '</div></div></div>';
    });
    });
});
