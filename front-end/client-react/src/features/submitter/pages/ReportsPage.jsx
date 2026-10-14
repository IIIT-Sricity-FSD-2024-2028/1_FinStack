import { useMemo } from "react";
import { useSubmitter } from "../SubmitterContext";
import { demoAiForExpense, flagLabel, riskLabel } from "../aiDemo";
import { currency, date, formatExpenseId, workflowLabel } from "../utils";
import ResourceState from "../components/ResourceState";

const RISK_COLORS = ["#10b981", "#f59e0b", "#ef4444"];
const BAR_COLORS = [
  "#7c3aed",
  "#8b5cf6",
  "#22d3ee",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];
const FLAG_INFO = [
  ["mismatch", "Amount Mismatch", "#f59e0b"],
  ["duplicate", "Duplicate Entry", "#ef4444"],
  ["low_ocr_quality", "Low OCR Quality", "#8b5cf6"],
  ["suspicious_amount", "Suspicious Amount", "#ec4899"],
];
const riskClass = (score) =>
  score < 30 ? "badge-success" : score < 70 ? "badge-warning" : "badge-danger";

function RiskGauge({ score }) {
  const color =
    score < 30 ? RISK_COLORS[0] : score < 70 ? RISK_COLORS[1] : RISK_COLORS[2];
  return (
    <div className="report-gauge">
      <svg viewBox="0 0 36 36" aria-label={`Overall risk score ${score}`}>
        <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" />
        <path
          className="report-gauge-value"
          style={{ stroke: color }}
          strokeDasharray={`${score}, 100`}
          d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
        />
      </svg>
      <div>
        <strong>{score}</strong>
        <span>{riskLabel(score)}</span>
      </div>
    </div>
  );
}

function RiskDonut({ counts }) {
  const total = Math.max(
    1,
    counts.reduce((sum, value) => sum + value, 0),
  );
  let offset = 0;
  return (
    <div className="report-donut">
      <svg viewBox="0 0 36 36" aria-label="Risk distribution">
        <circle cx="18" cy="18" r="15.915" />
        {counts.map((value, index) => {
          const dash = (value / total) * 100;
          const node = (
            <circle
              className="report-donut-segment"
              key={RISK_COLORS[index]}
              cx="18"
              cy="18"
              r="15.915"
              style={{ stroke: RISK_COLORS[index] }}
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return node;
        })}
      </svg>
      <div>
        {["Low Risk", "Moderate Risk", "High Risk"].map((label, index) => (
          <p key={label}>
            <span>
              <i style={{ background: RISK_COLORS[index] }} />
              {label}
            </span>
            <strong>{counts[index]}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}

function ConfidenceBars({ items }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="report-bars">
      {items.map((item, index) => (
        <div key={item.label}>
          <b>{item.value}%</b>
          <i
            style={{
              height: `${Math.max(20, (item.value / max) * 100)}%`,
              background: BAR_COLORS[index % BAR_COLORS.length],
            }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { expenses, expenseState, refreshExpenses } = useSubmitter();
  const report = useMemo(() => {
    const analyses = expenses
      .slice(0, 25)
      .map((expense) => ({ expense, ...demoAiForExpense(expense) }));
    const flagCounts = {
      mismatch: 0,
      duplicate: 0,
      low_ocr_quality: 0,
      suspicious_amount: 0,
      none: 0,
    };
    const categoryConfidence = {};
    let riskTotal = 0,
      confidenceTotal = 0;
    analyses.forEach((analysis) => {
      riskTotal += analysis.riskScore;
      confidenceTotal += analysis.confidence;
      flagCounts[analysis.flag] = (flagCounts[analysis.flag] || 0) + 1;
      (categoryConfidence[analysis.expense.category] ||= []).push(
        analysis.confidence,
      );
    });
    const averageRisk = analyses.length
      ? Math.round(riskTotal / analyses.length)
      : 0;
    const averageConfidence = analyses.length
      ? Math.round(confidenceTotal / analyses.length)
      : 0;
    const distribution = [
      analyses.filter((item) => item.riskScore < 30).length,
      analyses.filter((item) => item.riskScore >= 30 && item.riskScore < 70)
        .length,
      analyses.filter((item) => item.riskScore >= 70).length,
    ];
    const categories = Object.entries(categoryConfidence).map(
      ([label, values]) => ({
        label,
        value: Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        ),
      }),
    );
    const totalFlags = analyses.filter((item) => item.flag !== "none").length;
    return {
      analyses,
      flagCounts,
      averageRisk,
      averageConfidence,
      distribution,
      categories,
      totalFlags,
    };
  }, [expenses]);

  const riskColor =
    report.averageRisk < 30
      ? RISK_COLORS[0]
      : report.averageRisk < 70
        ? RISK_COLORS[1]
        : RISK_COLORS[2];
  return (
    <>
      <div className="report-heading">
        <h1>AI Validation &amp; Results</h1>
        <p>Intelligent analysis of your expense submissions</p>
      </div>
      <ResourceState
        {...expenseState}
        onRetry={refreshExpenses}
        empty={
          !report.analyses.length && (
            <>
              <h3>No expenses analyzed</h3>
              <p>Submit an expense to see validation results.</p>
            </>
          )
        }
      >
        <div className="kpi-grid report-summary">
          <div className="kpi-card">
            <div className="kpi-label">Avg Risk Score</div>
            <div className="kpi-value" style={{ color: riskColor }}>
              {report.averageRisk}%
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Flags</div>
            <div className="kpi-value">{report.totalFlags}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Avg OCR Confidence</div>
            <div className="kpi-value report-cyan">
              {report.averageConfidence}%
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Expenses Analyzed</div>
            <div className="kpi-value">{report.analyses.length}</div>
          </div>
        </div>
        <div className="charts-row report-chart-row">
          <section className="card report-card">
            <h3>Average Risk Score</h3>
            <p>Aggregated from all submitted expenses</p>
            <RiskGauge score={report.averageRisk} />
          </section>
          <section className="card report-card">
            <h3>Risk Distribution</h3>
            <p>Breakdown by risk level</p>
            <RiskDonut counts={report.distribution} />
          </section>
        </div>
        <div className="charts-row report-chart-row">
          <section className="card report-card">
            <h3>OCR Confidence by Category</h3>
            <p>Average extraction quality per expense type</p>
            <ConfidenceBars items={report.categories} />
          </section>
          <section className="card report-card">
            <h3>Flag Summary</h3>
            <p>AI-detected anomalies across expenses</p>
            <div className="report-flags">
              {FLAG_INFO.map(([key, label, color]) => (
                <div key={key}>
                  <span>
                    <i style={{ background: `${color}20`, color }}>!</i>
                    {label}
                  </span>
                  <strong>{report.flagCounts[key]}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="card report-results">
          <div className="card-header">
            <span className="card-title">Validation Results</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Amount</th>
                  <th>OCR Confidence</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Validation Result</th>
                  <th>Status / Date</th>
                </tr>
              </thead>
              <tbody>
                {report.analyses.map(
                  ({ expense, confidence, riskScore, riskLevel, flag }) => (
                    <tr key={expense.id}>
                      <td>
                        <strong>{expense.merchant || "Expense"}</strong>
                        <small>
                          {formatExpenseId(expense.id)} · {expense.category}
                        </small>
                      </td>
                      <td>
                        {currency(expense.amount, expense.currency || "INR")}
                      </td>
                      <td>
                        <div className="report-confidence">
                          <span style={{ width: `${confidence}%` }} />
                          <b>{confidence}%</b>
                        </div>
                      </td>
                      <td>{riskScore}</td>
                      <td>
                        <span className={`badge ${riskClass(riskScore)}`}>
                          {riskLevel}
                        </span>
                      </td>
                      <td
                        className={
                          flag === "none" ? "report-valid" : "report-flagged"
                        }
                      >
                        {flagLabel(flag)}
                      </td>
                      <td>
                        <strong>{workflowLabel(expense)}</strong>
                        <small>{date(expense.date)}</small>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      </ResourceState>
    </>
  );
}
