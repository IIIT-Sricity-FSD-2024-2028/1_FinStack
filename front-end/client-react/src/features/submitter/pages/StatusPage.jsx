import { useSubmitter } from "../SubmitterContext";
import {
  currency,
  date,
  formatExpenseId,
  workflowClass,
  workflowLabel,
} from "../utils";
import { Icon } from "../components/Icons";
import ResourceState from "../components/ResourceState";

function StatusCard({ expense }) {
  const history = [...(expense.history || [])]
    .filter((item) => item?.at && (item.code || item.label))
    .sort((a, b) => new Date(a.at) - new Date(b.at));
  return (
    <article className="card">
      <div className="status-card-header">
        <div className="status-card-header-left">
          <div className="status-file-icon">
            <Icon name="file" size={22} />
          </div>
          <div>
            <div className="status-card-title-row">
              <h3 className="react-status-title">
                {expense.merchant || expense.category}
              </h3>
              <span className={`badge ${workflowClass(expense)}`}>
                {workflowLabel(expense)}
              </span>
            </div>
            <div className="status-card-meta">
              <span>{formatExpenseId(expense.id)}</span>
              <span>•</span>
              <span>{currency(expense.amount, expense.currency || "INR")}</span>
              <span>•</span>
              <span>{date(expense.date)}</span>
            </div>
          </div>
        </div>
        <div className="status-updated">
          <Icon name="clock" size={16} />
          Updated {date(expense.updatedAt || expense.createdAt)}
        </div>
      </div>
      <div className="steps-container">
        {history.length ? (
          <div className="steps-grid">
            {history.map((item, index) => (
              <div
                className={`step ${index === history.length - 1 ? "current" : "completed"}`}
                key={`${item.code || item.label}-${item.at}`}
              >
                <div className="step-circle">
                  <Icon
                    name={index === history.length - 1 ? "clock" : "check"}
                    size={18}
                  />
                </div>
                <div>
                  <div className="step-label">
                    {item.label || String(item.code).replaceAll("_", " ")}
                  </div>
                  <div className="step-date">{date(item.at)}</div>
                  {item.note && <div className="step-date">{item.note}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted">
            No workflow history has been recorded. Current backend state:{" "}
            <strong>{workflowLabel(expense)}</strong>.
          </p>
        )}
      </div>
    </article>
  );
}
export default function StatusPage() {
  const { expenses, expenseState, refreshExpenses } = useSubmitter();
  return (
    <>
      <div className="dashboard-head">
        <div>
          <h1>Track Status</h1>
          <p className="text-text-muted mt-1">
            Backend-recorded workflow state and history
          </p>
        </div>
      </div>
      <ResourceState
        {...expenseState}
        onRetry={refreshExpenses}
        empty={
          !expenses.length && (
            <>
              <Icon name="pulse" size={30} />
              <h3>No submitted expenses</h3>
              <p>Your workflow history will appear here.</p>
            </>
          )
        }
      >
        <div className="space-y-6">
          {expenses.map((expense) => (
            <StatusCard key={expense.id} expense={expense} />
          ))}
        </div>
      </ResourceState>
    </>
  );
}
