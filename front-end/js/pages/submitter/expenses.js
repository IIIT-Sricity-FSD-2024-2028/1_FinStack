document.addEventListener('DOMContentLoaded', function () {
    FinStack.whenReady(function () {
    var searchInput = document.getElementById('searchInput');
    var statusFilter = document.getElementById('statusFilter');
    var categoryFilter = document.getElementById('categoryFilter');
    var editCategory = document.getElementById('editCategory');
    var categories = window.FinStackStore.getCategories().filter(function (category) {
        return category.status === 'Active';
    });

    categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
        categories.map(function (category) {
            return '<option value="' + category.name.toLowerCase() + '">' + category.name + '</option>';
        }).join('');

    editCategory.innerHTML = categories.map(function (category) {
        return '<option value="' + category.id + '">' + category.name + '</option>';
    }).join('');

    function formatExpenseId(id) {
        return 'EXP-' + String(id || '').slice(0, 6);
    }

    function getEmployeeDisplay(expense) {
        var users = window.FinStackStore && window.FinStackStore.getUsers ? window.FinStackStore.getUsers() : [];
        var userMap = {};
        users.forEach(function (user) {
            userMap[user.employeeId] = user.fullName;
        });
        return userMap[expense.employeeId] || expense.employeeId || expense.employee || '-';
    }

    function render() {
        var expenses = FinStack.getExpenses();
        var search = searchInput.value.toLowerCase();
        var status = statusFilter.value;
        var category = categoryFilter.value;

        var filtered = expenses.filter(function (e) {
            var matchSearch = e.id.toLowerCase().includes(search) || e.category.toLowerCase().includes(search) || (e.employee || '').toLowerCase().includes(search) || (e.merchant || '').toLowerCase().includes(search);
            var matchStatus = status === 'all' || e.status === status;
            var matchCategory = category === 'all' || e.category.toLowerCase() === category;
            return matchSearch && matchStatus && matchCategory;
        });

        var tbody = document.getElementById('expensesBody');
        var empty = document.getElementById('emptyState');

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'flex';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(function (e) {
            var badgeClass = FinStack.getWorkflowBadgeClass(e);
            var label = FinStack.getWorkflowLabel(e);
            var canEdit = e.workflowStatus === 'returned' || e.workflowStatus === 'manager_review';
            return '<tr>' +
                '<td><div class="expense-id"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' + formatExpenseId(e.id) + '</div></td>' +
                '<td style="color:white;font-weight:500;">' + getEmployeeDisplay(e) + '</td>' +
                '<td>' + e.category + '</td>' +
                '<td style="font-weight:600;color:white;">' + FinStack.formatCurrency(e.amount) + '</td>' +
                '<td><span class="badge ' + badgeClass + '">' + label + '</span></td>' +
                '<td style="color:var(--text-muted)">' + FinStack.formatDate(e.date) + '</td>' +
                '<td class="text-right"><div class="action-btns">' +
                '<button class="icon-btn" title="View" onclick="viewExpense(\'' + e.id + '\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
                '<button class="icon-btn" title="Edit"' + (canEdit ? ' onclick="editExpense(\'' + e.id + '\')"' : ' disabled') + '><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
                '<button class="icon-btn danger" title="Delete"' + (canEdit ? ' onclick="deleteExpense(\'' + e.id + '\')"' : ' disabled') + '><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
                '</div></td></tr>';
        }).join('');
    }

    function reloadExpenses(successMessage) {
        FinStack.reloadCanonical().then(function () {
            render();
            showToast(successMessage, 'success');
        }).catch(function (error) {
            showToast((error && error.message ? error.message : 'Unable to refresh expenses') + ' The saved change will appear after retry.', 'error');
        });
    }

    searchInput.addEventListener('input', render);
    statusFilter.addEventListener('change', render);
    categoryFilter.addEventListener('change', render);
    document.getElementById('clearFilters').addEventListener('click', function () {
        searchInput.value = '';
        statusFilter.value = 'all';
        categoryFilter.value = 'all';
        render();
    });

    // View expense
    window.viewExpense = function (id) {
        var e = FinStack.getExpenseById(id);
        if (!e) return;
        var badgeClass = FinStack.getWorkflowBadgeClass(e);
        var label = FinStack.getWorkflowLabel(e);
        var riskLabel = FinStack.getRiskLabel(e.risk_score || 0);
        var riskBadge = FinStack.getRiskBadgeClass(e.risk_score || 0);
        document.getElementById('viewContent').innerHTML =
            '<div class="space-y-3" style="font-size:14px;">' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Expense ID</span><span style="color:white;font-weight:500;">' + formatExpenseId(e.id) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Employee</span><span style="color:white;font-weight:500;">' + getEmployeeDisplay(e) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Amount</span><span style="color:white;font-weight:600;">' + FinStack.formatCurrency(e.amount) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Category</span><span style="color:white;">' + e.category + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Status</span><span class="badge ' + badgeClass + '">' + label + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Date</span><span style="color:white;">' + FinStack.formatDate(e.date) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Merchant</span><span style="color:white;">' + (e.merchant || 'N/A') + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Notes</span><span style="color:white;">' + (e.notes || 'N/A') + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Workflow</span><span style="color:white;">' + (e.workflowStatus || 'submitted') + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">OCR Confidence</span><span style="color:white;">' + (e.extraction_confidence || 'N/A') + '%</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Flag</span><span style="color:white;">' + (e.flag || 'none') + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted);">Risk Score</span><span class="badge ' + riskBadge + '">' + (e.risk_score || 0) + ' — ' + riskLabel + '</span></div>' +
            '</div>';
        document.getElementById('viewModal').classList.add('active');
    };

    // Edit expense
    window.editExpense = function (id) {
        var e = FinStack.getExpenseById(id);
        if (!e) return;
        document.getElementById('editId').value = e.id;
        document.getElementById('editAmount').value = e.amount;
        document.getElementById('editCategory').value = e.categoryId;
        document.getElementById('editMerchant').value = e.merchant || '';
        document.getElementById('editDate').value = e.date || '';
        document.getElementById('editNotes').value = e.notes || '';
        document.getElementById('editModal').classList.add('active');
    };

    document.getElementById('editForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var id = document.getElementById('editId').value;
        var amount = document.getElementById('editAmount').value;
        var categoryId = document.getElementById('editCategory').value;
        var merchant = document.getElementById('editMerchant').value;
        var date = document.getElementById('editDate').value;
        var notes = document.getElementById('editNotes').value;

        if (!amount || Number(amount) <= 0) { showToast('Please enter a valid amount', 'error'); return; }
        if (!merchant.trim()) { showToast('Please enter a merchant name', 'error'); return; }
        if (!date) { showToast('Please select a date', 'error'); return; }

        var expense = FinStack.getExpenseById(id);
        var resubmit = expense && expense.workflowStatus === 'returned';
        try {
            FinStack.updateExpense(id, {
                amount: Number(amount),
                categoryId: categoryId,
                merchant: merchant.trim(),
                date: date,
                notes: notes.trim()
            }, resubmit);
        } catch (error) {
            showToast(error && error.message ? error.message : 'Unable to update this expense', 'error');
            return;
        }
        document.getElementById('editModal').classList.remove('active');
        reloadExpenses('Expense ' + id + (resubmit ? ' updated and resubmitted' : ' updated successfully'));
    });

    // Delete expense
    window.deleteExpense = function (id) {
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteModal').classList.add('active');
    };

    document.getElementById('confirmDelete').addEventListener('click', function () {
        var id = document.getElementById('deleteId').value;
        try {
            FinStack.deleteExpense(id);
        } catch (error) {
            showToast(error && error.message ? error.message : 'Unable to delete this expense', 'error');
            return;
        }
        document.getElementById('deleteModal').classList.remove('active');
        reloadExpenses('Expense ' + id + ' deleted');
    });

    render();
    });
});
