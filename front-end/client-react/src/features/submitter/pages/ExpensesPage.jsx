import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { submitterApi } from "../api/submitterApi";
import { useSubmitter } from "../SubmitterContext";
import {
  currency,
  date,
  formatExpenseId,
  workflowClass,
  workflowLabel,
} from "../utils";
import { Icon } from "../components/Icons";
import { Toast } from "../components/PageBits";
import ResourceState from "../components/ResourceState";
import { isValidExpenseAmount } from "../expenseValidation";

const editableWorkflowStates = ["manager_review", "returned"];

function isEditable(expense) {
  return editableWorkflowStates.includes(expense.workflowStatus);
}

function paymentMethodLabel(paymentMethod) {
  const labels = {
    "personal-card": "Personal Card (Reimbursable)",
    "corporate-card": "Corporate Card",
    cash: "Cash",
  };
  return labels[paymentMethod] || paymentMethod || "—";
}

function DetailItem({ label, value, fullWidth = false }) {
  return (
    <div className={fullWidth ? "submitter-detail-item--full" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ExpensesPage() {
  const { expenses, categories, expenseState, refreshExpenses } =
    useSubmitter();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [busy, setBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  const statuses = useMemo(
    () => [
      ...new Set(
        expenses.map((expense) => expense.workflowStatus).filter(Boolean),
      ),
    ],
    [expenses],
  );

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !query ||
        [
          expense.id,
          expense.category,
          expense.merchant,
          expense.workflowStatus,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );
      const matchesStatus =
        status === "all" || expense.workflowStatus === status;
      const matchesCategory =
        category === "all" || expense.categoryId === category;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [expenses, search, status, category]);

  const updateEditField = (field) => (event) => {
    setEditExpense((current) => ({ ...current, [field]: event.target.value }));
  };

  const saveExpense = async (event) => {
    event.preventDefault();
    if (!editExpense) return;
    if (!isValidExpenseAmount(editExpense.amount)) {
      setToast({
        type: "error",
        message: "Enter an amount of at least ₹0.01 with up to two decimals.",
      });
      return;
    }

    const isReturnedExpense = editExpense.workflowStatus === "returned";
    setBusy(true);
    try {
      // Backend owns workflow state; only editable expense fields are sent.
      await submitterApi.updateExpense(editExpense.id, {
        amount: Number(editExpense.amount),
        categoryId: editExpense.categoryId,
        merchant: editExpense.merchant.trim(),
        date: editExpense.date,
        notes: (editExpense.notes || "").trim(),
        paymentMethod: editExpense.paymentMethod || "personal-card",
        currency: editExpense.currency || "INR",
      });
      await refreshExpenses();
      setEditExpense(null);
      setToast({
        message: isReturnedExpense
          ? `Expense ${formatExpenseId(editExpense.id)} resubmitted.`
          : `Expense ${formatExpenseId(editExpense.id)} updated.`,
      });
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteExpense = async () => {
    if (!deletingExpense) return;

    setBusy(true);
    try {
      await submitterApi.deleteExpense(deletingExpense.id);
      await refreshExpenses();
      setDeletingExpense(null);
      setToast({
        message: `Expense ${formatExpenseId(deletingExpense.id)} deleted.`,
      });
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const viewReceipt = async () => {
    if (!viewExpense || receiptBusy) return;

    setReceiptBusy(true);
    let receiptUrl = "";
    try {
      const blob = await submitterApi.getReceipt(viewExpense.id);
      receiptUrl = URL.createObjectURL(blob);
      const receiptLink = document.createElement("a");
      receiptLink.href = receiptUrl;
      receiptLink.target = "_blank";
      receiptLink.rel = "noopener noreferrer";
      receiptLink.click();
      window.setTimeout(() => URL.revokeObjectURL(receiptUrl), 60_000);
      receiptUrl = "";
    } catch (error) {
      if (receiptUrl) URL.revokeObjectURL(receiptUrl);
      setToast({
        type: "error",
        message: error.message || "Unable to open this receipt.",
      });
    } finally {
      setReceiptBusy(false);
    }
  };

  return (
    <>
      <div className="react-page-head">
        <div>
          <h1>My Expenses</h1>
          <p className="text-text-muted mt-1">
            Search, review, and update eligible submissions
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => navigate("/submit")}
        >
          + New Expense
        </button>
      </div>

      <ResourceState {...expenseState} onRetry={refreshExpenses}>
        <div className="card">
          <div className="card-header expenses-filters">
            <div className="search-wrap">
              <Icon name="search" size={16} />
              <input
                className="form-input"
                aria-label="Search expenses"
                placeholder="Search expenses…"
                style={{ paddingLeft: 36 }}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="filter-row">
              <select
                className="form-select"
                aria-label="Filter by status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {workflowLabel({ workflowStatus: value })}
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                aria-label="Filter by category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card-content p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Expense</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatExpenseId(expense.id)}</td>
                      <td>{expense.merchant}</td>
                      <td>{expense.category}</td>
                      <td>
                        {currency(expense.amount, expense.currency || "INR")}
                      </td>
                      <td>
                        <span className={`badge ${workflowClass(expense)}`}>
                          {workflowLabel(expense)}
                        </span>
                      </td>
                      <td>{date(expense.date)}</td>
                      <td className="text-right">
                        <div className="action-btns">
                          <button
                            className="icon-btn"
                            type="button"
                            aria-label={`View ${formatExpenseId(expense.id)}`}
                            onClick={() => setViewExpense(expense)}
                          >
                            <Icon name="eye" size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            aria-label={`${expense.workflowStatus === "returned" ? "Fix and resubmit" : "Edit"} ${formatExpenseId(expense.id)}`}
                            disabled={!isEditable(expense)}
                            onClick={() => setEditExpense({ ...expense })}
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            className="icon-btn danger"
                            type="button"
                            aria-label={`Delete ${formatExpenseId(expense.id)}`}
                            disabled={!isEditable(expense)}
                            onClick={() => setDeletingExpense(expense)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredExpenses.length === 0 && (
              <div className="empty-state">
                <Icon name="file" size={32} />
                <h3>
                  {expenses.length ? "No matching expenses" : "No expenses yet"}
                </h3>
                <p>
                  {expenses.length
                    ? "Adjust your search or filters."
                    : "Submit an expense to see it here."}
                </p>
              </div>
            )}
          </div>
        </div>
      </ResourceState>

      {viewExpense && (
        <div
          className="modal-overlay active"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-details-title"
        >
          <div className="modal-box submitter-modal--wide">
            <div id="expense-details-title" className="modal-title">
              Expense details
            </div>
            <div className="submitter-detail-grid">
              <DetailItem
                label="Expense ID"
                value={formatExpenseId(viewExpense.id)}
              />
              <DetailItem label="Status" value={workflowLabel(viewExpense)} />
              <DetailItem label="Merchant" value={viewExpense.merchant} />
              <DetailItem label="Category" value={viewExpense.category} />
              <DetailItem
                label="Amount"
                value={currency(
                  viewExpense.amount,
                  viewExpense.currency || "INR",
                )}
              />
              <DetailItem label="Date" value={date(viewExpense.date)} />
              <DetailItem
                label="Payment method"
                value={paymentMethodLabel(viewExpense.paymentMethod)}
              />
              <DetailItem
                label="Notes"
                value={viewExpense.notes || "—"}
                fullWidth
              />
            </div>
            <div className="submitter-modal-footer">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={receiptBusy}
                onClick={viewReceipt}
              >
                {receiptBusy ? "Opening receipt…" : "View Receipt"}
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setViewExpense(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editExpense && (
        <div
          className="modal-overlay active"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-expense-title"
        >
          <div className="modal-box submitter-modal--wide">
            <div id="edit-expense-title" className="modal-title">
              {editExpense.workflowStatus === "returned"
                ? "Fix & Resubmit"
                : "Edit expense"}
            </div>
            <form className="submitter-form-grid" onSubmit={saveExpense}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-expense-amount">
                  Amount
                </label>
                <input
                  id="edit-expense-amount"
                  className="form-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={editExpense.amount}
                  onChange={updateEditField("amount")}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-expense-date">
                  Date
                </label>
                <input
                  id="edit-expense-date"
                  className="form-input"
                  type="date"
                  required
                  value={String(editExpense.date || "").slice(0, 10)}
                  onChange={updateEditField("date")}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-expense-merchant">
                  Merchant
                </label>
                <input
                  id="edit-expense-merchant"
                  className="form-input"
                  required
                  value={editExpense.merchant}
                  onChange={updateEditField("merchant")}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-expense-category">
                  Category
                </label>
                <select
                  id="edit-expense-category"
                  className="form-select"
                  required
                  value={editExpense.categoryId}
                  onChange={updateEditField("categoryId")}
                >
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group form-span-full">
                <label className="form-label" htmlFor="edit-expense-payment">
                  Payment method
                </label>
                <select
                  id="edit-expense-payment"
                  className="form-select"
                  value={editExpense.paymentMethod || "personal-card"}
                  onChange={updateEditField("paymentMethod")}
                >
                  <option value="personal-card">
                    Personal Card (Reimbursable)
                  </option>
                  <option value="corporate-card">Corporate Card</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="form-group form-span-full">
                <label className="form-label" htmlFor="edit-expense-notes">
                  Notes
                </label>
                <textarea
                  id="edit-expense-notes"
                  className="form-textarea"
                  value={editExpense.notes || ""}
                  onChange={updateEditField("notes")}
                />
              </div>
              <div className="submitter-modal-footer form-span-full">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setEditExpense(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  {editExpense.workflowStatus === "returned"
                    ? "Fix & Resubmit"
                    : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingExpense && (
        <div
          className="modal-overlay active"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-expense-title"
        >
          <div className="modal-box">
            <div id="delete-expense-title" className="modal-title">
              Delete expense?
            </div>
            <p>
              This permanently deletes expense{" "}
              {formatExpenseId(deletingExpense.id)}.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setDeletingExpense(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                type="button"
                disabled={busy}
                onClick={deleteExpense}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} onClose={() => setToast(null)} />
    </>
  );
}
