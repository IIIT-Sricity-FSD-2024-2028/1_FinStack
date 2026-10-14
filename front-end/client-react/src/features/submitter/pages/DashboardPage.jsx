import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSubmitter } from "../SubmitterContext";
import { currency, date, workflowClass, workflowLabel } from "../utils";
import { Icon } from "../components/Icons";
import ResourceState from "../components/ResourceState";
import { buildExpenseTrend } from "../dashboardAnalytics";

const CATEGORY_COLORS = [
  "#7c3aed",
  "#22d3ee",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

function KpiCard({ label, value, note, icon, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div className="kpi-icon" style={{ background: `${color}20`, color }}>
          <Icon name={icon} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-change">
        <span>{note}</span>
      </div>
    </div>
  );
}

function ExpenseTrend({ items }) {
  const maximumValue = Math.max(1, ...items.map((item) => item.value));
  const points = items.map((item, index) => ({
    ...item,
    x: items.length > 1 ? (index * 520) / (items.length - 1) : 260,
    y: 190 - (item.value / maximumValue) * 145,
  }));

  return (
    <div className="legacy-trend">
      <svg viewBox="0 0 520 220" aria-label="Expense submission trend">
        <path d="M0 190 H520" />
        <path d="M0 118 H520" />
        <path d="M0 45 H520" />
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        />
        {points.map((point) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r="5" fill="#7c3aed" />
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              fill="#d4d4d8"
              fontSize="11"
            >
              {currency(point.value)}
            </text>
          </g>
        ))}
      </svg>
      <div>
        {items.map((item) => (
          <span key={item.id}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function CategoryChart({ items }) {
  const maximumValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <>
      <div className="legacy-bars">
        {items.map((item) => (
          <div key={item.label}>
            <b>{currency(item.value)}</b>
            <i
              style={{
                height: `${Math.max(12, (item.value / maximumValue) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="category-legend">
        {items.map((item, index) => (
          <div className="cat-legend-item" key={item.label}>
            <div className="cat-legend-left">
              <span
                className="cat-dot"
                style={{
                  background: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                }}
              />
              <span>{item.label}</span>
            </div>
            <span>{currency(item.value)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { expenses, expenseState, refreshExpenses } = useSubmitter();
  const navigate = useNavigate();

  const analytics = useMemo(() => {
    const total = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0,
    );
    const pending = expenses.filter(
      (expense) =>
        !["paid", "approved_for_payment", "rejected"].includes(
          expense.workflowStatus,
        ),
    ).length;
    const approved = expenses.filter((expense) =>
      ["paid", "approved_for_payment"].includes(expense.workflowStatus),
    ).length;

    const categories = Object.values(
      expenses.reduce((result, expense) => {
        const label = expense.category || "Other";
        result[label] ||= { label, value: 0 };
        result[label].value += Number(expense.amount || 0);
        return result;
      }, {}),
    );

    const trend = buildExpenseTrend(expenses);

    return { total, pending, approved, categories, trend };
  }, [expenses]);

  return (
    <>
      <div className="dashboard-head">
        <div>
          <h1>Expense Submitter Dashboard</h1>
          <p className="text-text-muted mt-1">
            Your real expense activity and workflow overview
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
        <div className="kpi-grid">
          <KpiCard
            label="Total Expenses"
            value={expenses.length}
            note="All submissions"
            icon="receipt"
            color="#8b5cf6"
          />
          <KpiCard
            label="Total Amount"
            value={currency(analytics.total)}
            note="Submitted value"
            icon="money"
            color="#34d399"
          />
          <KpiCard
            label="Pending"
            value={analytics.pending}
            note="In review or returned"
            icon="clock"
            color="#fbbf24"
          />
          <KpiCard
            label="Approved"
            value={analytics.approved}
            note="Approved for payment or paid"
            icon="check"
            color="#a78bfa"
          />
        </div>

        {expenses.length ? (
          <>
            <div className="charts-row">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Expense Trends</span>
                </div>
                <div className="card-content">
                  <ExpenseTrend items={analytics.trend} />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Spend by Category</span>
                </div>
                <div className="card-content">
                  <CategoryChart items={analytics.categories} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header react-between">
                <span className="card-title">Recent Expenses</span>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => navigate("/expenses")}
                >
                  View all
                </button>
              </div>
              <div className="card-content p-0">
                {expenses.slice(0, 5).map((expense) => (
                  <div className="recent-item" key={expense.id}>
                    <div className="recent-left">
                      <div className="recent-icon">
                        <Icon name="receipt" />
                      </div>
                      <div>
                        <div className="recent-merchant">
                          {expense.merchant}
                        </div>
                        <div className="recent-meta">
                          <span>{expense.category}</span>
                          <span>•</span>
                          <span>{date(expense.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="recent-right">
                      <div className="recent-amount">
                        {currency(expense.amount, expense.currency || "INR")}
                      </div>
                      <span className={`badge ${workflowClass(expense)}`}>
                        {workflowLabel(expense)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="submitter-state">
            <Icon name="receipt" size={32} />
            <h3>No expenses yet</h3>
            <p>Submit your first expense to populate the dashboard.</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate("/submit")}
            >
              Submit expense
            </button>
          </div>
        )}
      </ResourceState>
    </>
  );
}
