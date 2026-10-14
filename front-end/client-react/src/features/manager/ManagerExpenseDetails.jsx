import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/OperationalStates";
import { notify } from "../../components/ToastHost";
import { managerApi } from "./managerApi";
import { useManagerWorkspace } from "./useManagerWorkspace";

export function ManagerExpenseDetails() {
  const { expenseId } = useParams();
  const navigate = useNavigate();
  const { queue, history, officers, status, error, refresh } = useManagerWorkspace({ includeOfficers: true });
  const [note, setNote] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingReceipt, setOpeningReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const expense = [...queue, ...history].find((item) => item.id === expenseId);

  async function decide(action) {
    if (saving) return;
    if ((action === "reject" || action === "return") && !note.trim()) return;
    if (action === "approve" && !officerId) return;
    const labels = { approve: "approve", return: "return for correction", reject: "reject", escalate: "escalate" };
    if (!window.confirm(`Are you sure you want to ${labels[action]} this expense?`)) return;
    setSaving(true);
    try {
      if (action === "approve") await managerApi.approve(expense.id, { financeOfficerId: officerId, ...(note.trim() ? { note: note.trim() } : {}) });
      if (action === "return") await managerApi.returnForCorrection(expense.id, note.trim());
      if (action === "reject") await managerApi.reject(expense.id, note.trim());
      if (action === "escalate") await managerApi.escalate(expense.id, note.trim());
      notify("The expense decision was saved.", "success");
      navigate("/manager/history");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "The decision could not be saved.", "error");
    } finally { setSaving(false); }
  }

  async function viewReceipt() {
    if (openingReceipt) return;
    setReceiptError("");
    // Reserve the tab within the user gesture so async fetch does not trigger
    // popup blocking. Clear opener access before loading the receipt.
    const receiptWindow = window.open("about:blank", "_blank");
    if (!receiptWindow) {
      setReceiptError("Allow pop-ups for this site to view the receipt.");
      return;
    }
    receiptWindow.opener = null;
    setOpeningReceipt(true);
    let receiptUrl;
    let closeCheck;
    let expiry;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (closeCheck) window.clearInterval(closeCheck);
      if (expiry) window.clearTimeout(expiry);
      if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    };
    try {
      const blob = await managerApi.receipt(expense.id);
      receiptUrl = URL.createObjectURL(blob);
      receiptWindow.location.replace(receiptUrl);
      let checks = 0;
      closeCheck = window.setInterval(() => {
        checks += 1;
        if (receiptWindow.closed || checks >= 300) cleanup();
      }, 1000);
      expiry = window.setTimeout(cleanup, 300_000);
    } catch (caught) {
      cleanup();
      receiptWindow.close();
      setReceiptError(caught instanceof Error ? caught.message : "Receipt could not be opened.");
    } finally { setOpeningReceipt(false); }
  }

  if (status === "loading") return <LoadingState message="Loading expense details…" />;
  if (status === "error") return <ErrorState title="Expense details unavailable" description={error} onRetry={refresh} />;
  if (!expense) return <section className="manager-page"><EmptyState title="Expense not found" description="This expense is not present in your authorized review queue or history." /><Link to="/manager/expenses">Return to queue</Link></section>;
  const canReview = expense.workflowStatus === "manager_review";
  return <section className="manager-page">
    <header className="page-header"><div><Link to={canReview ? "/manager/expenses" : "/manager/history"}>← Back</Link><h1>Expense details</h1><p>{expense.id}</p></div><span className="manager-badge">{expense.workflowStatus}</span></header>
    <div className="manager-detail-grid">
      <article className="card manager-section"><h2>{expense.merchant || "Expense"}</h2><dl className="manager-details">
        <div><dt>Employee</dt><dd>{expense.employee?.fullName || expense.employeeId || "—"}</dd></div>
        <div><dt>Amount</dt><dd>{expense.currency} {expense.amount}</dd></div>
        <div><dt>Category</dt><dd>{expense.category || "—"}</dd></div>
        <div><dt>Expense date</dt><dd>{expense.date ? new Date(expense.date).toLocaleDateString() : "—"}</dd></div>
        <div><dt>Submitted</dt><dd>{expense.createdAt ? new Date(expense.createdAt).toLocaleString() : "—"}</dd></div>
        <div><dt>Payment method</dt><dd>{expense.paymentMethod || "—"}</dd></div>
        <div><dt>Purpose / notes</dt><dd>{expense.notes || "—"}</dd></div>
        <div><dt>Review flag</dt><dd>{expense.flag || "None"}</dd></div>
        <div><dt>Risk score</dt><dd>{expense.riskScore ?? "—"}</dd></div>
      </dl>
      <div className="manager-receipt"><strong>Receipt</strong>{expense.receiptFileName ? <><span>{expense.receiptFileName}</span><button className="btn btn-secondary" type="button" disabled={openingReceipt} onClick={viewReceipt}>{openingReceipt ? "Loading receipt…" : "View receipt"}</button></> : <span>No receipt attached</span>}{receiptError && <p role="alert">{receiptError}</p>}</div>
      </article>
      <article className="card manager-section"><h2>Submission and decision history</h2>{expense.history?.length ? <ol className="manager-timeline">{expense.history.map((item, index) => <li key={`${item.code || item.label}-${item.at || index}`}><strong>{item.label || item.code}</strong><time>{item.at ? new Date(item.at).toLocaleString() : ""}</time><p>{item.note || ""}</p></li>)}</ol> : <p>No history is available for this expense.</p>}
        {expense.managerDecision && <div className="manager-decision"><strong>Manager decision: {expense.managerDecision}</strong><p>{expense.managerDecisionNote}</p>{expense.managerDecisionAt && <time>{new Date(expense.managerDecisionAt).toLocaleString()}</time>}</div>}
      </article>
    </div>
    {canReview && <form className="card manager-section manager-action-form" onSubmit={(event) => event.preventDefault()}><h2>Review decision</h2>
      <label>Finance officer for approval<select className="form-input" value={officerId} onChange={(event) => setOfficerId(event.target.value)}><option value="">Select an active Finance Officer</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.fullName} ({officer.employeeId})</option>)}</select></label>
      <label>Comment or reason<textarea className="form-input" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required for return or rejection" /></label>
      <div className="manager-actions"><button type="button" className="btn btn-primary" disabled={saving || !officerId} onClick={() => decide("approve")}>{saving ? "Saving…" : "Approve"}</button><button type="button" className="btn btn-secondary" disabled={saving || !note.trim()} onClick={() => decide("return")}>Return for correction</button><button type="button" className="btn btn-danger" disabled={saving || !note.trim()} onClick={() => decide("reject")}>Reject</button><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => decide("escalate")}>Escalate to Compliance</button></div>
      {officers.length === 0 && <p role="status">No active Finance Officers are available for assignment.</p>}
    </form>}
  </section>;
}
