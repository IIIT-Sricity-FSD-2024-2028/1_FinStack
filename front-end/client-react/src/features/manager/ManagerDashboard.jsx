import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/OperationalStates";
import { SharedPageHeader } from "../../layouts/TenantAppShell";
import { useManagerWorkspace } from "./useManagerWorkspace";

function Metric({ label, value, note }) {
  return <article className="card manager-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
const money = (expense) => `${expense.currency || ""} ${expense.amount ?? "—"}`.trim();

export function ManagerDashboard() {
  const { queue, history, status, error, refresh } = useManagerWorkspace();
  if (status === "loading") return <LoadingState message="Loading your review workspace…" />;
  if (status === "error") return <ErrorState title="Dashboard unavailable" description={error} onRetry={refresh} />;
  const returned = history.filter((expense) => String(expense.managerDecision).toLowerCase().includes("return")).length;
  const highRisk = queue.filter((expense) => (expense.riskScore ?? 0) >= 70);
  const recent = [...history].sort((a, b) => new Date(b.managerDecisionAt || b.updatedAt || b.createdAt || 0) - new Date(a.managerDecisionAt || a.updatedAt || a.createdAt || 0)).slice(0, 5);
  const pending = [...queue].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0)).slice(0, 5);
  return <section className="manager-page">
    <SharedPageHeader title="Manager Dashboard" description="Review and approve expense requests from your reporting team." actions={<div className="manager-actions"><button className="btn btn-secondary" type="button" onClick={refresh}>Refresh</button><Link className="btn btn-primary" to="/manager/expenses">Review expenses</Link></div>} />
    <div className="manager-metrics"><Metric label="Pending approvals" value={queue.length} note="Awaiting your decision" /><Metric label="Processed expenses" value={history.length} note="In your approval history" /><Metric label="Returned for correction" value={returned} note="Manager returns" /><Metric label="High risk" value={highRisk.length} note="Score 70 or above" /></div>
    <div className="manager-dashboard-grid">
      <div>
        <section className="card manager-section"><div className="manager-section-heading"><div><h2>Pending expense requests</h2><p>Highest risk items appear first.</p></div><Link to="/manager/expenses">View all</Link></div>
          {pending.length ? <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Employee and expense</th><th>Amount</th><th>Risk</th><th></th></tr></thead><tbody>{pending.map((expense) => <tr key={expense.id}><td><strong>{expense.employee?.fullName || expense.employeeId}</strong><small>{expense.merchant || "Expense"} · {expense.category}</small></td><td>{money(expense)}</td><td><span className={`manager-badge ${(expense.riskScore ?? 0) >= 70 ? "is-warning" : ""}`}>{expense.riskScore ?? 0}/100</span></td><td><Link className="manager-link-button" to={`/manager/expenses/${encodeURIComponent(expense.id)}`}>Review</Link></td></tr>)}</tbody></table></div> : <EmptyState title="No pending requests" description="Your review queue is clear." />}
        </section>
        <section className="card manager-section"><div className="manager-section-heading"><div><h2>Recent decisions</h2><p>Latest expenses in your review history.</p></div><Link to="/manager/history">View history</Link></div>
          {recent.length ? <div className="manager-list">{recent.map((expense) => <Link className="manager-list-row" key={expense.id} to={`/manager/expenses/${encodeURIComponent(expense.id)}`}><span><strong>{expense.merchant || "Expense"}</strong><small>{expense.employee?.fullName || expense.employeeId} · {expense.category}</small></span><span className="manager-list-end">{money(expense)}<small>{expense.managerDecision || expense.workflowStatus}</small></span></Link>)}</div> : <EmptyState title="No processed expenses yet" description="Manager decisions will appear here." />}
        </section>
      </div>
      <section className="card manager-section"><div className="manager-section-heading"><div><h2>High risk alerts</h2><p>Pending expenses with a risk score of 70 or higher.</p></div><Link to="/manager/expenses">Review queue</Link></div>
        {highRisk.length ? <div className="manager-list">{highRisk.slice(0, 6).map((expense) => <Link className="manager-list-row" key={expense.id} to={`/manager/expenses/${encodeURIComponent(expense.id)}`}><span><strong>{expense.merchant || "Expense"}</strong><small>{expense.employee?.fullName || expense.employeeId} · {expense.flag || "Risk flagged"}</small></span><span className="manager-list-end">{expense.riskScore}/100<small>{money(expense)}</small></span></Link>)}</div> : <EmptyState title="No high risk items" description="No pending expense currently exceeds the high risk threshold." />}
      </section>
    </div>
  </section>;
}
