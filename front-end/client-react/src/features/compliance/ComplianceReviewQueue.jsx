import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'
import { ComplianceCaseModal } from './ComplianceCaseModal'
import { ComplianceDecisionDialog } from './ComplianceDecisionDialog'

export function ComplianceReviewQueue() {
  const [queue, setQueue] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters & search
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortOption, setSortOption] = useState('newest')

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Modals
  const [inspectExpense, setInspectExpense] = useState(null)
  const [decisionState, setDecisionState] = useState({ open: false, type: 'approve', expense: null })
  const [toastMessage, setToastMessage] = useState(null)

  function loadData() {
    setLoading(true)
    setError('')

    Promise.all([complianceApi.getComplianceQueue(), complianceApi.getCategories().catch(() => [])])
      .then(([qData, cData]) => {
        setQueue(Array.isArray(qData) ? qData : [])
        setCategories(Array.isArray(cData) ? cData : [])
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load compliance review queue.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Filter & sort logic
  const filtered = queue.filter((item) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      item.id?.toLowerCase().includes(q) ||
      item.employee?.fullName?.toLowerCase().includes(q) ||
      item.employeeId?.toLowerCase().includes(q) ||
      item.merchant?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.notes?.toLowerCase().includes(q)

    const score = Number(item.riskScore ?? item.risk_score ?? 0)
    const matchesRisk =
      riskFilter === 'all' ||
      (riskFilter === 'high' && score >= 70) ||
      (riskFilter === 'medium' && score >= 40 && score < 70) ||
      (riskFilter === 'low' && score < 40)

    const matchesSource =
      sourceFilter === 'all' ||
      (sourceFilter === 'manager' && item.escalatedByManager) ||
      (sourceFilter === 'finance' && item.financeDecision === 'Flagged')

    const matchesCategory =
      categoryFilter === 'all' || item.categoryId === categoryFilter || item.category === categoryFilter

    return matchesSearch && matchesRisk && matchesSource && matchesCategory
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === 'newest') return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
    if (sortOption === 'oldest') return new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date)
    if (sortOption === 'amount-desc') return Number(b.amount || 0) - Number(a.amount || 0)
    if (sortOption === 'risk-desc') {
      const sa = Number(a.riskScore ?? a.risk_score ?? 0)
      const sb = Number(b.riskScore ?? b.risk_score ?? 0)
      return sb - sa
    }
    return 0
  })

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  function openDecision(type, exp) {
    setInspectExpense(null)
    setDecisionState({ open: true, type, expense: exp })
  }

  function handleDecisionSuccess(res, type) {
    const labels = {
      approve: 'Exception approved — expense returned to Finance Officer.',
      reject: 'Expense rejected — submitter notified.',
      correctiveAction: 'Corrective action initiated.',
    }
    setToastMessage(labels[type] || 'Action completed successfully.')
    loadData()
  }

  function renderRiskBadge(score) {
    score = Number(score || 0)
    if (score >= 70) return <span className="badge badge-rose">{score} High</span>
    if (score >= 40) return <span className="badge badge-yellow">{score} Medium</span>
    return <span className="badge badge-green">{score} Low</span>
  }

  function renderSourceBadge(exp) {
    if (exp.escalatedByManager) return <span className="badge badge-purple">Manager</span>
    if (exp.financeDecision === 'Flagged') return <span className="badge badge-cyan">Finance</span>
    return <span className="badge badge-slate">Policy</span>
  }

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
            color: '#fff',
            padding: '14px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <Icon name="check" size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Overview Metric Banner */}
      <div className="compliance-stat-grid">
        <div className="compliance-stat-card">
          <div>
            <div className="compliance-stat-label">Pending Reviews</div>
            <div className="compliance-stat-value">{queue.length}</div>
            <div className="compliance-stat-sub">Awaiting compliance decision</div>
          </div>
          <div className="compliance-stat-icon-wrap stat-icon-violet">
            <Icon name="shieldCheck" size={24} />
          </div>
        </div>

        <div className="compliance-stat-card">
          <div>
            <div className="compliance-stat-label">High Risk Claims</div>
            <div className="compliance-stat-value">
              {queue.filter((e) => Number(e.riskScore ?? e.risk_score ?? 0) >= 70).length}
            </div>
            <div className="compliance-stat-sub">Risk score ≥ 70</div>
          </div>
          <div className="compliance-stat-icon-wrap stat-icon-rose">
            <Icon name="zap" size={24} />
          </div>
        </div>

        <div className="compliance-stat-card">
          <div>
            <div className="compliance-stat-label">Flagged Amount</div>
            <div className="compliance-stat-value">
              ₹{queue.reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toLocaleString('en-IN')}
            </div>
            <div className="compliance-stat-sub">Total value in queue</div>
          </div>
          <div className="compliance-stat-icon-wrap stat-icon-cyan">
            <Icon name="receipt" size={24} />
          </div>
        </div>
      </div>

      {/* Main Review Queue Card */}
      <div className="compliance-card">
        <div className="compliance-card-header">
          <h2 className="compliance-card-title">
            <Icon name="folder" size={20} />
            <span>Escalated & Flagged Expenses</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 400 }}>
              ({filtered.length} matching)
            </span>
          </h2>

          <button
            type="button"
            className="compliance-btn compliance-btn-secondary compliance-btn-sm"
            onClick={loadData}
            disabled={loading}
          >
            <Icon name="refresh" size={14} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="compliance-filter-bar">
          <input
            type="text"
            className="compliance-search-input"
            placeholder="Search by ID, submitter, merchant, notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />

          <select
            className="compliance-select"
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk (≥ 70)</option>
            <option value="medium">Medium Risk (40 - 69)</option>
            <option value="low">Low Risk (&lt; 40)</option>
          </select>

          <select
            className="compliance-select"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">All Escalation Sources</option>
            <option value="manager">Manager Escalated</option>
            <option value="finance">Finance Flagged</option>
          </select>

          {categories.length > 0 && (
            <select
              className="compliance-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="compliance-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount-desc">Highest Amount</option>
            <option value="risk-desc">Highest Risk</option>
          </select>
        </div>

        {/* Content State: Loading, Error, Empty, or Table */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
            <p>Loading compliance review queue…</p>
          </div>
        ) : error ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ color: '#f87171', marginBottom: '12px', fontSize: '0.9375rem' }}>{error}</div>
            <button type="button" className="compliance-btn compliance-btn-primary" onClick={loadData}>
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6' }}>All Clear</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted, #9ca3af)', marginTop: '4px' }}>
              No escalated expenses currently require compliance review.
            </div>
          </div>
        ) : (
          <>
            <div className="compliance-table-container">
              <table className="compliance-table">
                <thead>
                  <tr>
                    <th>Claim ID</th>
                    <th>Submitter</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Source</th>
                    <th>Risk</th>
                    <th>Escalation Note</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => {
                    const score = Number(item.riskScore ?? item.risk_score ?? 0)
                    const rowRiskClass = score >= 70 ? 'row-high-risk' : score >= 40 ? 'row-med-risk' : ''
                    const noteSnippet = item.managerDecisionNote || item.financeDecisionNote || item.notes || '—'

                    return (
                      <tr key={item.id} className={rowRiskClass}>
                        <td>
                          <span style={{ fontWeight: 700, color: '#c4b5fd' }}>{item.id}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.employee?.fullName || item.employeeId}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>{item.employeeId}</div>
                        </td>
                        <td>{item.category || item.categoryId}</td>
                        <td style={{ fontWeight: 700 }}>
                          ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td>{renderSourceBadge(item)}</td>
                        <td>{renderRiskBadge(score)}</td>
                        <td
                          style={{
                            maxWidth: '180px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-muted, #9ca3af)',
                            fontSize: '0.8125rem',
                          }}
                          title={noteSnippet}
                        >
                          {noteSnippet}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #9ca3af)', whiteSpace: 'nowrap' }}>
                          {item.date || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                              onClick={() => setInspectExpense(item)}
                              title="Inspect full claim details"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              className="compliance-btn compliance-btn-success compliance-btn-sm"
                              onClick={() => openDecision('approve', item)}
                              title="Approve and forward to Finance"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="compliance-btn compliance-btn-danger compliance-btn-sm"
                              onClick={() => openDecision('reject', item)}
                              title="Reject non-compliant expense"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderTop: '1px solid var(--border-default, #1f2937)',
                }}
              >
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #9ca3af)' }}>
                  Page {page} of {totalPages}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail / Case Modal */}
      <ComplianceCaseModal
        open={Boolean(inspectExpense)}
        expense={inspectExpense}
        onClose={() => setInspectExpense(null)}
        onAction={(type, exp) => openDecision(type, exp)}
      />

      {/* Decision Dialog */}
      <ComplianceDecisionDialog
        open={decisionState.open}
        type={decisionState.type}
        expense={decisionState.expense}
        onClose={() => setDecisionState({ open: false, type: 'approve', expense: null })}
        onSuccess={handleDecisionSuccess}
      />
    </div>
  )
}
