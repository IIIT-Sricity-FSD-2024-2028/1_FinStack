import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/OperationalStates";
import { SharedPageHeader } from "../../layouts/TenantAppShell";
import { useManagerWorkspace } from "./useManagerWorkspace";

const riskLevel = (score) => (score ?? 0) >= 70 ? "High" : (score ?? 0) >= 40 ? "Medium" : "Low";
const money = (expense) => `${expense.currency || ""} ${expense.amount ?? "—"}`.trim();

export function ManagerExpenseQueue() {
  const { queue, status, error, refresh } = useManagerWorkspace();
  const [query, setQuery] = useState("");
  const [flagFilter, setFlagFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const filtered = useMemo(() => queue.filter((expense) => {
    const text = [expense.id, expense.merchant, expense.category, expense.employee?.fullName, expense.employeeId].join(" ").toLowerCase();
    const risk = riskLevel(expense.riskScore).toLowerCase();
    return text.includes(query.trim().toLowerCase()) &&
      (flagFilter === "all" || Boolean(expense.flag) === (flagFilter === "flagged")) &&
      (riskFilter === "all" || risk === riskFilter);
  }), [queue, query, flagFilter, riskFilter]);

  return <section className="manager-page">
    <SharedPageHeader title="Review Expenses" description="Review pending requests from your direct reports." actions={<span className="manager-count">{filtered.length} of {queue.length} pending</span>} />
    <div className="manager-filters">
      <label className="manager-search">Search expenses<input className="form-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Employee, merchant, category, or ID" /></label>
      <label>Attention<select className="form-input" value={flagFilter} onChange={(event) => setFlagFilter(event.target.value)}><option value="all">All items</option><option value="flagged">Flagged only</option><option value="unflagged">Not flagged</option></select></label>
      <label>Risk<select className="form-input" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="all">All risks</option><option value="high">High (70–100)</option><option value="medium">Medium (40–69)</option><option value="low">Low (0–39)</option></select></label>
    </div>
    {status === "loading" ? <LoadingState message="Loading pending expenses…" /> : status === "error" ? <ErrorState title="Review queue unavailable" description={error} onRetry={refresh} /> : filtered.length === 0 ? <EmptyState title={queue.length ? "No matching expenses" : "No pending expenses"} description={queue.length ? "Try changing your search or filters." : "New submissions assigned to you will appear here."} /> :
      <div className="card manager-table-wrap"><table className="manager-table"><thead><tr><th>Expense</th><th>Employee</th><th>Submitted</th><th>Amount</th><th>Risk</th><th>Review flag</th><th></th></tr></thead><tbody>{filtered.map((expense) => { const risk = riskLevel(expense.riskScore); return <tr key={expense.id}><td><strong>{expense.merchant || "Expense"}</strong><small>{expense.category} · {expense.id}</small></td><td>{expense.employee?.fullName || expense.employeeId}</td><td>{expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : "—"}</td><td>{money(expense)}</td><td><span className={`manager-badge ${risk === "High" ? "is-warning" : ""}`}>{risk} ({expense.riskScore ?? 0})</span></td><td><span className={`manager-badge ${expense.flag ? "is-warning" : ""}`}>{expense.flag || "None"}</span></td><td><Link className="manager-link-button" to={`/manager/expenses/${encodeURIComponent(expense.id)}`}>Review</Link></td></tr>; })}</tbody></table></div>}
  </section>;
}
