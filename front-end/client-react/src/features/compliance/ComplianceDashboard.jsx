import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'
import { ComplianceCaseModal } from './ComplianceCaseModal'
import { ComplianceDecisionDialog } from './ComplianceDecisionDialog'

export function ComplianceDashboard() {
  const [queue, setQueue] = useState([])
  const [policies, setPolicies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [inspectExpense, setInspectExpense] = useState(null)
  const [decisionState, setDecisionState] = useState({ open: false, type: 'approve', expense: null })
  const [toastMessage, setToastMessage] = useState(null)

  function loadDashboardData() {
    setLoading(true)
    setError('')

    Promise.all([
      complianceApi.getComplianceQueue(),
      complianceApi.getPolicies().catch(() => []),
      complianceApi.getCategories().catch(() => []),
    ])
      .then(([qData, pData, cData]) => {
        setQueue(Array.isArray(qData) ? qData : [])
        setPolicies(Array.isArray(pData) ? pData : [])
        setCategories(Array.isArray(cData) ? cData : [])
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load compliance dashboard metrics.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const pendingCount = queue.length
  const highRiskCount = queue.filter((e) => Number(e.riskScore ?? e.risk_score ?? 0) >= 70).length
  const medRiskCount = queue.filter((e) => {
    const s = Number(e.riskScore ?? e.risk_score ?? 0)
    return s >= 40 && s < 70
  }).length
  const lowRiskCount = queue.filter((e) => Number(e.riskScore ?? e.risk_score ?? 0) < 40).length
  const totalAmount = queue.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  function openDecision(type, exp) {
    setInspectExpense(null)
    setDecisionState({ open: true, type, expense: exp })
  }

  function handleDecisionSuccess(res, type) {
    const labels = {
      approve: 'Exception approved — returned to Finance Officer.',
      reject: 'Expense rejected — submitter notified.',
      correctiveAction: 'Corrective action initiated.',
    }
    setToastMessage(labels[type] || 'Action completed successfully.')
    loadDashboardData()
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

      {/* Hero Welcome & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#f9fafb' }}>
            Compliance Overview
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
            Monitor policy violations, review escalated claims, and enforce organization expense policies.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="compliance-btn compliance-btn-secondary"
            onClick={loadDashboardData}
            disabled={loading}
          >
            <Icon name="refresh" size={16} />
            <span>Refresh</span>
          </button>

          <Link to="/compliance/queue" className="compliance-btn compliance-btn-primary">
            <Icon name="folder" size={16} />
            <span>Open Review Queue</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="compliance-stat-grid">
        <div className="compliance-stat-card">
          <div>
            <div className="compliance-stat-label">Pending Reviews</div>
            <div className="compliance-stat-value">{loading ? '…' : pendingCount}</div>
            <div className="compliance-stat-sub">Claims awaiting compliance decision</div>
          </div>
          <div className="compliance-stat-icon-wrap stat-icon-violet">
            <Icon name="shieldCheck" size={24} />
          </div>
        </div>

        <div className="compliance-stat-card">
          <div>
            <div className="compliance-stat-label">Value Under Review</div>
            <div className="compliance-stat-value">
              {loading ? '…' : `₹${totalAmount.toLocaleString('en-IN')}`}
            </div>
            <div className="compliance-stat-sub">Total amount in review queue</div>
          </div>
          <div className="compliance-stat-icon-wrap stat-icon-amber">
            <Icon name="receipt" size={24} />
          </div>
        </div>

        <div className="compliance-stat-card">
          <div>
            <div className="compliance-stat-label">High Risk Anomalies</div>
            <div className="compliance-stat-value">{loading ? '…' : highRiskCount}</div>
            <div className="compliance-stat-sub">Claims with risk score ≥ 70</div>
          </div>
          <div className="compliance-stat-icon-wrap stat-icon-rose">
            <Icon name="zap" size={24} />
          </div>
        </div>

        <div className="compliance-stat-card">
          <div>
            <div className="compliance-stat-label">Active Policies</div>
            <div className="compliance-stat-value">{loading ? '…' : policies.length}</div>
            <div className="compliance-stat-sub">{categories.length} expense categories</div>
          </div>
          <div className="compliance-stat-icon-wrap stat-icon-cyan">
            <Icon name="file" size={24} />
          </div>
        </div>
      </div>

      {/* Loading or Error State */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
          <p>Loading compliance dashboard metrics…</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#f87171', marginBottom: '12px' }}>{error}</div>
          <button type="button" className="compliance-btn compliance-btn-primary" onClick={loadDashboardData}>
            Retry
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '24px' }}>
          {/* Priority Queue Section */}
          <div className="compliance-card" style={{ margin: 0 }}>
            <div className="compliance-card-header">
              <h3 className="compliance-card-title">
                <Icon name="folder" size={18} />
                <span>Pending Compliance Claims</span>
              </h3>
              <Link to="/compliance/queue" style={{ fontSize: '0.8125rem', color: '#c4b5fd', textDecoration: 'none', fontWeight: 600 }}>
                View All ({queue.length}) →
              </Link>
            </div>

            <div style={{ padding: 0 }}>
              {queue.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
                  <div style={{ fontWeight: 600, color: '#f3f4f6' }}>No Pending Escalations</div>
                  <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
                    All compliance cases have been resolved.
                  </div>
                </div>
              ) : (
                <div className="compliance-table-container">
                  <table className="compliance-table">
                    <thead>
                      <tr>
                        <th>Claim ID</th>
                        <th>Submitter</th>
                        <th>Amount</th>
                        <th>Risk</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.slice(0, 5).map((item) => {
                        const score = Number(item.riskScore ?? item.risk_score ?? 0)
                        const riskBadge =
                          score >= 70 ? (
                            <span className="badge badge-rose">{score} High</span>
                          ) : score >= 40 ? (
                            <span className="badge badge-yellow">{score} Med</span>
                          ) : (
                            <span className="badge badge-green">{score} Low</span>
                          )

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 700, color: '#c4b5fd' }}>{item.id}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.employee?.fullName || item.employeeId}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                                {item.category || item.categoryId}
                              </div>
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td>{riskBadge}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                                onClick={() => setInspectExpense(item)}
                              >
                                Inspect
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

          {/* Right Column: Risk Breakdown & Active Policies */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Risk Breakdown Card */}
            <div className="compliance-card" style={{ margin: 0 }}>
              <div className="compliance-card-header">
                <h3 className="compliance-card-title">
                  <Icon name="zap" size={18} />
                  <span>Risk Distribution</span>
                </h3>
              </div>
              <div className="compliance-card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                      <span style={{ color: '#f87171', fontWeight: 600 }}>High Risk (≥ 70)</span>
                      <span style={{ fontWeight: 700 }}>{highRiskCount} claims</span>
                    </div>
                    <div style={{ height: '8px', background: '#1f2937', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pendingCount ? (highRiskCount / pendingCount) * 100 : 0}%`,
                          background: '#ef4444',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>Medium Risk (40 - 69)</span>
                      <span style={{ fontWeight: 700 }}>{medRiskCount} claims</span>
                    </div>
                    <div style={{ height: '8px', background: '#1f2937', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pendingCount ? (medRiskCount / pendingCount) * 100 : 0}%`,
                          background: '#f59e0b',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>Low Risk (&lt; 40)</span>
                      <span style={{ fontWeight: 700 }}>{lowRiskCount} claims</span>
                    </div>
                    <div style={{ height: '8px', background: '#1f2937', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pendingCount ? (lowRiskCount / pendingCount) * 100 : 0}%`,
                          background: '#10b981',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Policies Preview */}
            <div className="compliance-card" style={{ margin: 0 }}>
              <div className="compliance-card-header">
                <h3 className="compliance-card-title">
                  <Icon name="file" size={18} />
                  <span>Monitored Policies</span>
                </h3>
                <Link to="/compliance/policies" style={{ fontSize: '0.8125rem', color: '#c4b5fd', textDecoration: 'none', fontWeight: 600 }}>
                  View All ({policies.length}) →
                </Link>
              </div>

              <div className="compliance-card-body" style={{ padding: '12px 20px' }}>
                {policies.length === 0 ? (
                  <div style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem' }}>No policies configured yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {policies.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingBottom: '8px',
                          borderBottom: '1px solid rgba(31, 41, 55, 0.5)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                            Limit: ₹{Number(p.maxAmount || p.limit || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <span className="badge badge-green">Active</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
