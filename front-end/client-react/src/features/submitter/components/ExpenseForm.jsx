export default function ExpenseForm({
  form,
  setForm,
  categories,
  categoryState,
  onRetryCategories,
  errors,
  submitting,
  onReset,
}) {
  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const categoriesUnavailable = Boolean(categoryState.error);
  const submitDisabled =
    submitting ||
    categoryState.loading ||
    categoriesUnavailable ||
    categories.length === 0;

  let categoryPlaceholder = "Select category";
  if (categoryState.loading) categoryPlaceholder = "Loading categories…";
  if (categoriesUnavailable) categoryPlaceholder = "Categories unavailable";

  return (
    <div className="submit-right space-y-6">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Expense details</span>
        </div>
        <div className="card-content">
          <div className="form-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="expense-amount">
                Amount (₹)
              </label>
              <input
                id="expense-amount"
                className={`form-input${errors.amount ? " react-invalid" : ""}`}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={updateField("amount")}
              />
              {errors.amount && (
                <small className="react-field-error">
                  Enter an amount of at least ₹0.01.
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="expense-date">
                Date
              </label>
              <input
                id="expense-date"
                className={`form-input${errors.date ? " react-invalid" : ""}`}
                type="date"
                value={form.date}
                onChange={updateField("date")}
              />
              {errors.date && (
                <small className="react-field-error">
                  Select an expense date.
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="expense-merchant">
                Merchant / vendor
              </label>
              <input
                id="expense-merchant"
                className={`form-input${errors.merchant ? " react-invalid" : ""}`}
                maxLength="200"
                placeholder="e.g. Uber"
                value={form.merchant}
                onChange={updateField("merchant")}
              />
              {errors.merchant && (
                <small className="react-field-error">
                  Enter the merchant name.
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="expense-category">
                Category
              </label>
              <select
                id="expense-category"
                className={`form-select${errors.category ? " react-invalid" : ""}`}
                disabled={categoryState.loading || categoriesUnavailable}
                value={form.categoryId}
                onChange={updateField("categoryId")}
              >
                <option value="">{categoryPlaceholder}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categoriesUnavailable && (
                <small className="react-field-error">
                  {categoryState.error}{" "}
                  <button type="button" onClick={onRetryCategories}>
                    Retry
                  </button>
                </small>
              )}
              {!categoryState.loading &&
                !categoriesUnavailable &&
                categories.length === 0 && (
                  <small className="react-field-error">
                    No active categories are available. Contact your
                    Configuration Manager.
                  </small>
                )}
            </div>

            <div className="form-group form-span-full">
              <label className="form-label" htmlFor="expense-payment">
                Payment method
              </label>
              <select
                id="expense-payment"
                className="form-select"
                value={form.paymentMethod}
                onChange={updateField("paymentMethod")}
              >
                <option value="personal-card">
                  Personal Card (Reimbursable)
                </option>
                <option value="corporate-card">Corporate Card</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div className="form-group form-span-full">
              <label className="form-label" htmlFor="expense-notes">
                Description / notes
              </label>
              <textarea
                id="expense-notes"
                className="form-textarea"
                maxLength="2000"
                placeholder="Briefly describe the business purpose…"
                value={form.notes}
                onChange={updateField("notes")}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="react-submit-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={onReset}
          disabled={submitting}
        >
          Reset
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitDisabled}
        >
          {submitting ? "Submitting…" : "Submit Expense"}
        </button>
      </div>
    </div>
  );
}
