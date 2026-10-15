import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/OperationalStates";
import { useManagerWorkspace } from "./useManagerWorkspace";

function decisionStatus(expense) {
  const decision = String(expense.managerDecision || "").toLowerCase();
  if (decision.includes("escalat")) return "Escalated";
  if (decision.includes("return")) return "Returned";
  if (decision.includes("reject")) return "Rejected";
  if (decision.includes("approv")) return "Approved";
  const workflow = String(expense.workflowStatus || "").toLowerCase();
  if (workflow.includes("compliance")) return "Escalated";
  return workflow || "Processed";
}

export function ManagerHistory() {
  const { history, status, error, refresh } = useManagerWorkspace();
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const statusOptions = useMemo(() => [...new Set(history.map(decisionStatus))].sort(), [history]);
  const processed = useMemo(() => history.filter((expense) => {
    const matchesStatus = statusFilter === "all" || decisionStatus(expense) === statusFilter;
    const text = [expense.id, expense.merchant, expense.category, expense.employee?.fullName, expense.employeeId].join(" ").toLowerCase();
    return matchesStatus && text.includes(query.trim().toLowerCase());
  }), [history, statusFilter, query]);
  return <section className="manager-page">
    <header className="page-header"><div><h1>Approval History</h1><p>View expense requests processed in your Manager workflow.</p></div></header>
    <div className="manager-filters"><label className="manager-search">Search<input className="form-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Employee, merchant, category, or ID" /></label><label>Status<select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><span className="manager-count">Showing {processed.length} of {history.length}</span></div>
    {status === "loading" ? <LoadingState message="Loading approval history…" /> : status === "error" ? <ErrorState title="Approval history unavailable" description={error} onRetry={refresh} /> : processed.length === 0 ? <EmptyState title="No matching history" description={history.length ? "Try changing the search or status filter." : "Processed expenses will appear here."} /> : <div className="card manager-table-wrap"><table className="manager-table"><thead><tr><th>Expense</th><th>Employee</th><th>Decision</th><th>Updated</th><th>Amount</th><th></th></tr></thead><tbody>{processed.map((expense) => <tr key={expense.id}><td><strong>{expense.merchant || "Expense"}</strong><small>{expense.category} · {expense.id}</small></td><td>{expense.employee?.fullName || expense.employeeId}</td><td><span className="manager-badge">{decisionStatus(expense)}</span></td><td>{expense.managerDecisionAt ? new Date(expense.managerDecisionAt).toLocaleDateString() : expense.updatedAt ? new Date(expense.updatedAt).toLocaleDateString() : "—"}</td><td>{expense.currency} {expense.amount}</td><td><Link className="manager-link-button" to={`/manager/expenses/${encodeURIComponent(expense.id)}`}>View</Link></td></tr>)}</tbody></table></div>}
  </section>;
}
