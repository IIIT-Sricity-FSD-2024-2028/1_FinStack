import { useState } from "react";
import { submitterApi } from "../api/submitterApi";
import { useSubmitter } from "../SubmitterContext";
import ExpenseForm from "../components/ExpenseForm";
import ReceiptUpload from "../components/ReceiptUpload";
import { Toast } from "../components/PageBits";
import { isValidExpenseAmount } from "../expenseValidation";
import { validateReceipt } from "../receiptValidation";

const initialForm = {
  amount: "",
  date: "",
  merchant: "",
  categoryId: "",
  paymentMethod: "corporate-card",
  notes: "",
};

export default function SubmitExpensePage() {
  const {
    categories,
    categoryState,
    refreshCategories,
    refreshExpenses,
    refreshNotifications,
  } = useSubmitter();
  const [form, setForm] = useState(initialForm);
  const [receipt, setReceipt] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const resetForm = () => {
    setForm(initialForm);
    setReceipt(null);
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = {};
    if (!isValidExpenseAmount(form.amount)) nextErrors.amount = true;
    if (!form.merchant.trim()) nextErrors.merchant = true;
    if (!form.date) nextErrors.date = true;
    if (!form.categoryId) nextErrors.category = true;
    const receiptError = validateReceipt(receipt, { required: true });
    if (receiptError) nextErrors.receipt = receiptError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast({
        type: "error",
        message: "Please fill in all required fields",
      });
      return;
    }

    setSubmitting(true);
    try {
      const expense = await submitterApi.createExpense(
        {
          amount: form.amount,
          currency: "INR",
          categoryId: form.categoryId,
          merchant: form.merchant.trim(),
          date: form.date,
          notes: form.notes.trim(),
          paymentMethod: form.paymentMethod,
        },
        receipt,
      );
      await Promise.allSettled([refreshExpenses(), refreshNotifications()]);
      resetForm();
      setToast({ message: `Expense ${expense.id} submitted successfully!` });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || "Expense submission failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-2xl font-bold text-white">Submit Expense</h1>
        <p className="text-text-muted mt-1 text-sm">
          Upload receipt and enter expense details
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="submit-grid">
          <ReceiptUpload
            file={receipt}
            onFileChange={(file) => {
              setReceipt(file);
              if (file)
                setErrors((current) => ({ ...current, receipt: false }));
            }}
            onInvalidFile={(message) => setToast({ type: "error", message })}
            error={errors.receipt || ""}
          />
          <ExpenseForm
            form={form}
            setForm={setForm}
            categories={categories}
            categoryState={categoryState}
            onRetryCategories={refreshCategories}
            errors={errors}
            submitting={submitting}
            onReset={resetForm}
          />
        </div>
      </form>
      <Toast {...toast} onClose={() => setToast(null)} />
    </>
  );
}
