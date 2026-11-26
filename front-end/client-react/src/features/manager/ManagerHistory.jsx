import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/OperationalStates";
import { useLiveRefresh } from "../../hooks/useLiveRefresh.js";
import { SharedPageHeader } from "../../layouts/TenantAppShell";
import { useGetManagerHistoryQuery } from "./managerApiSlice.js";
import { setHistorySearch, setHistoryStatus } from "./managerFiltersSlice.js";
import { decisionStatus, selectFilteredManagerHistory, selectManagerHistory } from "./managerSelectors.js";

export function ManagerHistory() {
  const dispatch = useDispatch();
  const { search: query, status: statusFilter } = useSelector((state) => state.managerFilters.history);
  const historyQuery = useGetManagerHistoryQuery();
  const history = useSelector(selectManagerHistory);
  const processed = useSelector(selectFilteredManagerHistory);
  const refresh = useCallback(() => historyQuery.refetch(), [historyQuery.refetch]);
  const { refreshNow } = useLiveRefresh(refresh, { refreshImmediately: false, ignoreLocalMutations: true });
  useEffect(() => {
    window.addEventListener("finstack:dashboard-refresh", refreshNow);
    return () => window.removeEventListener("finstack:dashboard-refresh", refreshNow);
  }, [refreshNow]);
  const status = historyQuery.isLoading ? "loading" : historyQuery.isError ? "error" : "success";
  const error = historyQuery.error?.data?.message || "The Manager workspace could not be loaded.";
  const statusOptions = useMemo(() => [...new Set(history.map(decisionStatus))].sort(), [history]);
  return <section className="manager-page">
    <SharedPageHeader title="Approval History" description="View expense requests processed in your Manager workflow." />
    <div className="manager-filters"><label className="manager-search">Search<input className="form-input" value={query} onChange={(event) => dispatch(setHistorySearch(event.target.value))} placeholder="Employee, merchant, category, or ID" /></label><label>Status<select className="form-input" value={statusFilter} onChange={(event) => dispatch(setHistoryStatus(event.target.value))}><option value="all">All statuses</option>{statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><span className="manager-count">Showing {processed.length} of {history.length}</span></div>
    {status === "loading" ? <LoadingState message="Loading approval history…" /> : status === "error" ? <ErrorState title="Approval history unavailable" description={error} onRetry={refresh} /> : processed.length === 0 ? <EmptyState title="No matching history" description={history.length ? "Try changing the search or status filter." : "Processed expenses will appear here."} /> : <div className="card manager-table-wrap"><table className="manager-table"><thead><tr><th>Expense</th><th>Employee</th><th>Decision</th><th>Updated</th><th>Amount</th><th></th></tr></thead><tbody>{processed.map((expense) => <tr key={expense.id}><td><strong>{expense.merchant || "Expense"}</strong><small>{expense.category} · {expense.id}</small></td><td>{expense.employee?.fullName || expense.employeeId}</td><td><span className="manager-badge">{decisionStatus(expense)}</span></td><td>{expense.managerDecisionAt ? new Date(expense.managerDecisionAt).toLocaleDateString() : expense.updatedAt ? new Date(expense.updatedAt).toLocaleDateString() : "—"}</td><td>{expense.currency} {expense.amount}</td><td><Link className="manager-link-button" to={`/manager/expenses/${encodeURIComponent(expense.id)}`}>View</Link></td></tr>)}</tbody></table></div>}
  </section>;
}
