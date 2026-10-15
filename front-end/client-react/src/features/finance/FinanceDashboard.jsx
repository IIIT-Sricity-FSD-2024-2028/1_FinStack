import { formatCurrencyTotals } from '../shared/expensePresentation.js'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { LoadingState, ErrorState } from '../../components/OperationalStates'
import { financeApi } from './financeApi'
import { ExpenseDetailModal } from './ExpenseDetailModal'
import { FinanceDecisionDialog } from './FinanceDecisionDialog'

export function FinanceDashboard() {
  const [data, setData] = useState({ expenses: [], transactions: [] })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [decisionModal, setDecisionModal] = useState({ open: false, expense: null, action: null })

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const [workspace, cats] = await Promise.all([
        financeApi.getFinanceWorkspace(),
        financeApi.getCategories().catch(() => []),
      ])
      setData(workspace || { expenses: [], transactions: [] })
      setCategories(cats || [])
    } catch (err) {
      setError(err.message || 'Failed to load finance dashboard metrics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) return <LoadingState message="Loading finance metrics and workspace data…" />
  if (error) return <ErrorState title="Dashboard Error" description={error} onRetry={loadDashboard} />

  const expenses = data.expenses || []
  const transactions = data.transactions || []

  // Computed metrics from real server data
  const queueExpenses = expenses.filter((e) => e.workflowStatus === 'finance_review')
  const approvedForPayment = expenses.filter((e) => e.workflowStatus === 'approved_for_payment')
  const paymentProcessing = expenses.filter((e) => e.workflowStatus === 'payment_processing')
  const paidExpenses = expenses.filter((e) => e.workflowStatus === 'paid')
  const returnedExpenses = expenses.filter((e) => e.workflowStatus === 'returned')
  const flaggedExpenses = expenses.filter((e) => e.workflowStatus === 'compliance_review')
  const rejectedExpenses = expenses.filter((e) => e.workflowStatus === 'rejected')



  const pendingTx = transactions.filter((t) => t.status === 'pending')
  const processedTx = transactions.filter((t) => t.status === 'processed')
  const failedTx = transactions.filter((t) => t.status === 'failed')



  return (
    <div className="finance-dashboard-page">
      <div className="finance-toolbar" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Financial Overview</h2>
          <small className="text-muted">Live metrics from your organization's finance workspace</small>
        </div>
        <button type="button" className="btn btn-secondary btn-xs" onClick={loadDashboard}>
          <Icon name="refresh" size={14} /> Refresh Data
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="finance-stats-grid">
        <div className="finance-stat-card">
          <div className="finance-stat-header">
            <span className="finance-stat-label">Awaiting Finance Review</span>
            <div className="finance-stat-icon warning">
              <Icon name="folder" size={18} />
            </div>
          </div>
          <div className="finance-stat-value">{queueExpenses.length}</div>
          <div className="finance-stat-subtext">
            <span>Volume: {formatCurrencyTotals(queueExpenses)}</span>
            <Link to="/finance/queue" style={{ fontSize: '12px', color: '#22d3ee' }}>
              Open Queue &rarr;
            </Link>
          </div>
        </div>

        <div className="finance-stat-card">
          <div className="finance-stat-header">
            <span className="finance-stat-label">Ready for Payment Release</span>
            <div className="finance-stat-icon success">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="finance-stat-value">{approvedForPayment.length}</div>
          <div className="finance-stat-subtext">
            <span>Approved: {formatCurrencyTotals(approvedForPayment)}</span>
            <Link to="/finance/payments" style={{ fontSize: '12px', color: '#34d399' }}>
              Release &rarr;
            </Link>
          </div>
        </div>

        <div className="finance-stat-card">
          <div className="finance-stat-header">
            <span className="finance-stat-label">In Payment Processing</span>
            <div className="finance-stat-icon info">
              <Icon name="refresh" size={18} />
            </div>
          </div>
          <div className="finance-stat-value">{paymentProcessing.length}</div>
          <div className="finance-stat-subtext">
            <span>{pendingTx.length} pending, {processedTx.length} processed</span>
            <Link to="/finance/transactions" style={{ fontSize: '12px', color: '#60a5fa' }}>
              Manage &rarr;
            </Link>
          </div>
        </div>

        <div className="finance-stat-card">
          <div className="finance-stat-header">
            <span className="finance-stat-label">Reconciled Workflow Records</span>
            <div className="finance-stat-icon success">
              <Icon name="shieldCheck" size={18} />
            </div>
          </div>
          <div className="finance-stat-value">{paidExpenses.length}</div>
          <div className="finance-stat-subtext">
            <span>Recorded value: {formatCurrencyTotals(paidExpenses)}. Bank settlement unverified.</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '28px',
        }}
      >
        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Additional Info Requested</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#c084fc', marginTop: '4px' }}>
            {returnedExpenses.length}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Flagged / Compliance Review</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#f472b6', marginTop: '4px' }}>
            {flaggedExpenses.length}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rejected Expenses</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#f87171', marginTop: '4px' }}>
            {rejectedExpenses.length}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Failed Transactions</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: failedTx.length > 0 ? '#ef4444' : 'var(--text-primary)', marginTop: '4px' }}>
            {failedTx.length}
          </div>
        </div>
      </div>

      {/* Immediate Review Queue Preview */}
      <div className="card" style={{ padding: '20px', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Pending Review Queue</h3>
            <small className="text-muted">
              {queueExpenses.length === 0
                ? 'Your review queue is currently clear'
                : `${queueExpenses.length} item(s) awaiting your review`}
            </small>
          </div>
          {queueExpenses.length > 0 && (
            <Link to="/finance/queue" className="btn btn-primary btn-xs">
              View Full Queue ({queueExpenses.length})
            </Link>
          )}
        </div>

        {queueExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
            <Icon name="check" size={32} style={{ color: '#10b981', marginBottom: '8px' }} />
            <p style={{ margin: 0 }}>No expenses currently awaiting finance officer action.</p>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Reference</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Employee</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Merchant</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueExpenses.slice(0, 5).map((expense) => {
                  const categoryName =
                    categories.find((c) => c.id === expense.categoryId)?.name ||
                    expense.categoryId ||
                    'General'
                  return (
                    <tr key={expense.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{expense.id}</td>
                      <td style={{ padding: '10px 12px' }}>{expense.employeeId}</td>
                      <td style={{ padding: '10px 12px' }}>{expense.merchant}</td>
                      <td style={{ padding: '10px 12px' }}>{categoryName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#22d3ee' }}>
                        {expense.currency} {Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px' }}>
                        {expense.date}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => setSelectedExpense(expense)}
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            style={{ background: '#10b981', borderColor: '#10b981' }}
                            onClick={() =>
                              setDecisionModal({ open: true, expense, action: 'approve' })
                            }
                          >
                            Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expense Detail Modal */}
      <ExpenseDetailModal
        open={Boolean(selectedExpense)}
        expense={selectedExpense}
        categories={categories}
        onClose={() => setSelectedExpense(null)}
        onOpenDecision={(expense, action) =>
          setDecisionModal({ open: true, expense, action })
        }
      />

      {/* Decision Dialog */}
      <FinanceDecisionDialog
        open={decisionModal.open}
        expense={decisionModal.expense}
        action={decisionModal.action}
        onClose={() => setDecisionModal({ open: false, expense: null, action: null })}
        onSuccess={() => {
          loadDashboard()
        }}
      />
    </div>
  )
}
