import { formatExpenseAmount, activePolicies } from '../shared/expensePresentation.js'
import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'
import { ComplianceCaseModal } from './ComplianceCaseModal'
import { ComplianceDecisionDialog } from './ComplianceDecisionDialog'

export function PoliciesViolationsView() {
  const [policies, setPolicies] = useState([])
  const [categories, setCategories] = useState([])
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [inspectExpense, setInspectExpense] = useState(null)
  const [decisionState, setDecisionState] = useState({ open: false, type: 'approve', expense: null })
  const [toastMessage, setToastMessage] = useState(null)

  function loadData() {
    setLoading(true)
    setError('')

    Promise.all([
      complianceApi.getPolicies(),
      complianceApi.getCategories().catch(() => []),
      complianceApi.getComplianceQueue(),
    ])
      .then(([pData, cData, qData]) => {
        setPolicies(activePolicies(pData))
        setCategories(Array.isArray(cData) ? cData : [])
        setQueue(Array.isArray(qData) ? qData : [])
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load organization policy rules.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  function handleDecisionSuccess(res, type) {
    const labels = {
      approve: 'Exception approved — returned to Finance Officer.',
      reject: 'Expense rejected — submitter notified.',
      correctiveAction: 'Corrective action initiated.',
    }
    setToastMessage(labels[type] || 'Action completed successfully.')
    loadData()
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

      {/* Header Info */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#f9fafb' }}>
          Policy & Violation Monitoring
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
          Active policy definitions and claims referred for manual compliance review. Definitions do not imply automatic enforcement.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
          <p>Loading policy definitions…</p>
        </div>
      ) : error ? (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ color: '#f87171', marginBottom: '12px' }}>{error}</div>
          <button type="button" className="compliance-btn compliance-btn-primary" onClick={loadData}>
            Retry
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active Policies Table */}
          <div className="compliance-card">
            <div className="compliance-card-header">
              <h3 className="compliance-card-title">
                <Icon name="file" size={18} />
                <span>Active Organization Policies ({policies.length})</span>
              </h3>
            </div>

            {policies.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
                No active policies configured for this organization.
              </div>
            ) : (
              <div className="compliance-table-container">
                <table className="compliance-table">
                  <thead>
                      <tr>
                        <th>Policy Name</th>
                        <th>Category</th>
                        <th>Spending Limit</th>
                        <th>Approval Level</th>
                        <th>Receipt Required</th>
                        <th>Status</th>
                      </tr>
                  </thead>
                  <tbody>
                    {policies.map((p) => {
                      const matchedCat = categories.find((c) => c.id === p.categoryId)
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#f9fafb' }}>{p.name}</div>
                            {p.description && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '2px' }}>
                                {p.description}
                              </div>
                            )}
                          </td>
                          <td>{matchedCat?.name || p.categoryId || 'General'}</td>
                          <td style={{ fontWeight: 700, color: '#c4b5fd' }}>
                            {formatExpenseAmount({ amount: p.maxAmount ?? p.limit, currency: p.currency })}
                          </td>
                          <td>
                            <span className="badge badge-purple">{p.approval || 'Standard'}</span>
                          </td>
                          <td>
                            {p.receiptRequired !== false ? (
                              <span className="badge badge-green">Yes</span>
                            ) : (
                              <span className="badge badge-slate">Optional</span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-green">Active</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detected Violations in Queue */}
          <div className="compliance-card">
            <div className="compliance-card-header">
              <h3 className="compliance-card-title">
                <Icon name="shieldCheck" size={18} />
                <span>Policy Exceptions Awaiting Review ({queue.length})</span>
              </h3>
            </div>

            {queue.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
                <div style={{ fontWeight: 600, color: '#f3f4f6' }}>Zero Open Policy Exceptions</div>
                <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
                  No claims are currently referred for compliance review.
                </div>
              </div>
            ) : (
              <div className="compliance-table-container">
                <table className="compliance-table">
                  <thead>
                    <tr>
                      <th>Claim ID</th>
                      <th>Submitter</th>
                      <th>Claim Amount</th>
                      <th>Category</th>
                      <th>Trigger / Exception Reason</th>
                      <th>Risk Score</th>
                      <th style={{ textAlign: 'right' }}>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => {
                      const score = Number(item.riskScore ?? item.risk_score ?? 0)
                      const trigger =
                        item.flag ||
                        item.managerDecisionNote ||
                        item.financeDecisionNote ||
                        'Policy threshold scrutiny'

                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 700, color: '#c4b5fd' }}>{item.id}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.employee?.fullName || item.employeeId}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>{item.employeeId}</div>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {formatExpenseAmount(item)}
                          </td>
                          <td>{item.category || item.categoryId}</td>
                          <td style={{ color: '#f87171', fontSize: '0.8125rem', fontWeight: 500 }}>{trigger}</td>
                          <td>
                            <span className={`badge ${score >= 70 ? 'badge-rose' : score >= 40 ? 'badge-yellow' : 'badge-green'}`}>
                              {score}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                              onClick={() => setInspectExpense(item)}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail / Case Modal */}
      <ComplianceCaseModal
        open={Boolean(inspectExpense)}
        expense={inspectExpense}
        onClose={() => setInspectExpense(null)}
        onAction={(type, exp) => {
          setInspectExpense(null)
          setDecisionState({ open: true, type, expense: exp })
        }}
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
