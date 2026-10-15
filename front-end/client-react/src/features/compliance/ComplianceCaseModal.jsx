import { formatExpenseAmount } from '../shared/expensePresentation.js'
import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'

export function ComplianceCaseModal({ open, expense, onClose, onAction }) {
  const [downloadingReceipt, setDownloadingReceipt] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [receiptError, setReceiptError] = useState('')

  useEffect(() => {
    // Reset receipt on expense change
    setReceiptUrl(null)
    setReceiptError('')
  }, [expense?.id])

  // Clean up object URL when modal unmounts or closes
  useEffect(() => {
    return () => {
      if (receiptUrl) URL.revokeObjectURL(receiptUrl)
    }
  }, [receiptUrl])

  if (!open || !expense) return null

  async function handleViewReceipt() {
    try {
      setDownloadingReceipt(true)
      setReceiptError('')
      const { blob, contentType } = await complianceApi.downloadReceipt(expense.id)

      if (contentType.startsWith('image/')) {
        const url = URL.createObjectURL(blob)
        setReceiptUrl(url)
      } else {
        // Download for PDFs or other documents
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = expense.receiptFileName || `receipt-${expense.id}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setReceiptError(err?.message || 'Receipt could not be loaded.')
    } finally {
      setDownloadingReceipt(false)
    }
  }

  const score = Number(expense.riskScore ?? expense.risk_score ?? 0)
  const riskClass = score >= 70 ? 'badge-rose' : score >= 40 ? 'badge-yellow' : 'badge-green'
  const riskLabel = score >= 70 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk'

  return (
    <Modal open={open} onClose={onClose} label={`Compliance Review for ${expense.id}`}>
      <div
        style={{
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-default, #1f2937)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--text-primary, #e5e7eb)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-default, #1f2937)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb' }}>{expense.id}</span>
            <span className={`badge ${riskClass}`}>
              {score} · {riskLabel}
            </span>
            <span className="badge badge-purple">
              {expense.workflowStatus?.replace('_', ' ') || 'Compliance Review'}
            </span>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: 'pointer',
              fontSize: '1.25rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Key Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              background: '#0b0f19',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-default, #1f2937)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Amount</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb', marginTop: '2px' }}>
                {formatExpenseAmount(expense)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Submitter</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '4px' }}>
                {expense.employee?.fullName || expense.employeeId}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>{expense.employeeId}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Category</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '4px' }}>
                {expense.category || expense.categoryId}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Merchant / Vendor</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginTop: '4px' }}>{expense.merchant || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Expense Date</div>
              <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>{expense.date || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Payment Method</div>
              <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>{expense.paymentMethod || 'Corporate Card'}</div>
            </div>
          </div>

          {/* Submitter Notes */}
          {expense.notes && (
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', marginBottom: '6px' }}>
                Submitter Business Purpose / Notes:
              </div>
              <div
                style={{
                  background: 'rgba(31, 41, 55, 0.4)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default, #1f2937)',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                }}
              >
                {expense.notes}
              </div>
            </div>
          )}

          {/* Escalation & Flag Context */}
          <div
            style={{
              background: 'rgba(124, 58, 237, 0.08)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#c4b5fd', marginBottom: '8px' }}>
              Escalation & Compliance Trigger Context
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '0.8125rem' }}>
              {expense.managerDecisionNote && (
                <div>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Manager Note: </span>
                  <span style={{ color: '#e5e7eb' }}>{expense.managerDecisionNote}</span>
                </div>
              )}
              {expense.financeDecisionNote && (
                <div>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Finance Flag Reason: </span>
                  <span style={{ color: '#e5e7eb' }}>{expense.financeDecisionNote}</span>
                </div>
              )}
              {expense.flag && (
                <div>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Detected Flag: </span>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{expense.flag}</span>
                </div>
              )}
              {expense.extractionConfidence != null && (
                <div>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>OCR Extraction Confidence: </span>
                  <span>{Math.round(Number(expense.extractionConfidence) * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Receipt Preview / Download */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)' }}>
                Supporting Evidence / Receipt:
              </span>
              <button
                type="button"
                className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                onClick={handleViewReceipt}
                disabled={downloadingReceipt}
              >
                <Icon name="receipt" size={14} />
                <span>{downloadingReceipt ? 'Loading receipt…' : 'Inspect Receipt'}</span>
              </button>
            </div>

            {receiptError && (
              <div style={{ fontSize: '0.8125rem', color: '#f87171', marginTop: '6px' }}>{receiptError}</div>
            )}

            {receiptUrl && (
              <div
                style={{
                  marginTop: '10px',
                  background: '#0b0f19',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default, #1f2937)',
                  textAlign: 'center',
                }}
              >
                <img
                  src={receiptUrl}
                  alt={`Receipt for ${expense.id}`}
                  style={{ maxHeight: '300px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                />
              </div>
            )}
          </div>

          {/* Audit History Timeline */}
          {Array.isArray(expense.history) && expense.history.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', marginBottom: '12px' }}>
                Complete Audit Trail:
              </div>
              <div className="compliance-timeline">
                {expense.history.map((item, idx) => (
                  <div key={idx} className="compliance-timeline-item">
                    <div className="compliance-timeline-dot" />
                    <div className="compliance-timeline-content">
                      <div className="compliance-timeline-header">
                        <span className="compliance-timeline-action">{item.label || item.action || item.code}</span>
                        <span className="compliance-timeline-time">
                          {item.at ? new Date(item.at).toLocaleString() : '—'}
                        </span>
                      </div>
                      {item.note && <div className="compliance-timeline-note">{item.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-default, #1f2937)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <button type="button" className="compliance-btn compliance-btn-secondary" onClick={onClose}>
            Back to Queue
          </button>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="compliance-btn compliance-btn-warning"
              onClick={() => onAction('correctiveAction', expense)}
            >
              Corrective Action
            </button>
            <button
              type="button"
              className="compliance-btn compliance-btn-danger"
              onClick={() => onAction('reject', expense)}
            >
              Reject Claim
            </button>
            <button
              type="button"
              className="compliance-btn compliance-btn-primary"
              onClick={() => onAction('approve', expense)}
            >
              Approve Exception
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
