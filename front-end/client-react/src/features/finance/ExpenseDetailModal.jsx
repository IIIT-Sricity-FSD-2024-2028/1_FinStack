import { useState, useEffect } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { financeApi } from './financeApi'

export function ExpenseDetailModal({
  expense,
  open,
  onClose,
  categories = [],
  onOpenDecision,
}) {
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [receiptType, setReceiptType] = useState(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError] = useState('')

  useEffect(() => {
    if (!open || !expense?.id || !expense.receiptFileName) {
      setReceiptUrl(null)
      setReceiptType(null)
      setReceiptError('')
      return
    }

    let active = true
    let blobUrl = null

    async function loadReceipt() {
      setReceiptLoading(true)
      setReceiptError('')
      try {
        const { blob, contentType } = await financeApi.downloadReceipt(expense.id)
        if (!active) return
        blobUrl = URL.createObjectURL(blob)
        setReceiptUrl(blobUrl)
        setReceiptType(contentType)
      } catch (err) {
        if (!active) return
        setReceiptError(err.message || 'Unable to load receipt preview.')
      } finally {
        if (active) setReceiptLoading(false)
      }
    }

    loadReceipt()

    return () => {
      active = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [open, expense?.id, expense?.receiptFileName])

  if (!expense) return null

  const categoryName =
    categories.find((c) => c.id === expense.categoryId)?.name ||
    expense.categoryId ||
    'Uncategorized'

  const isFinanceReview = expense.workflowStatus === 'finance_review'

  return (
    <Modal open={open} onClose={onClose} label={`Expense Details - ${expense.id}`}>
      <div className="modal-content finance-modal-content">
      <div className="modal-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Expense Review Details</h2>
          <small className="text-muted">Reference: {expense.id}</small>
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px' }}>
        {/* Core Financial Details */}
        <div className="finance-detail-grid">
          <div className="finance-detail-item">
            <span className="label">Amount & Currency</span>
            <span className="value" style={{ fontSize: '18px', color: '#22d3ee' }}>
              {expense.currency} {Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="finance-detail-item">
            <span className="label">Workflow Stage</span>
            <span className="value">
              <span className={`finance-badge ${expense.workflowStatus}`}>
                {expense.workflowStatus === 'paid' ? 'RECONCILED RECORD — SETTLEMENT UNVERIFIED' : expense.workflowStatus?.replace(/_/g, ' ').toUpperCase()}
              </span>
            </span>
          </div>
          <div className="finance-detail-item">
            <span className="label">Merchant</span>
            <span className="value">{expense.merchant || '—'}</span>
          </div>
          <div className="finance-detail-item">
            <span className="label">Category</span>
            <span className="value">{categoryName}</span>
          </div>
          <div className="finance-detail-item">
            <span className="label">Expense Date</span>
            <span className="value">{expense.date || '—'}</span>
          </div>
          <div className="finance-detail-item">
            <span className="label">Payment Method</span>
            <span className="value">{expense.paymentMethod || '—'}</span>
          </div>
          <div className="finance-detail-item">
            <span className="label">Submitter</span>
            <span className="value">{expense.employeeId || '—'}</span>
          </div>
          <div className="finance-detail-item">
            <span className="label">Assigned Manager</span>
            <span className="value">{expense.managerEmployeeId || '—'}</span>
          </div>
        </div>

        {/* Submitter Notes */}
        {expense.notes && (
          <div className="finance-detail-box">
            <h4>Submitter Description</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>{expense.notes}</p>
          </div>
        )}

        {/* Manager Decision Info */}
        <div className="finance-detail-box">
          <h4>Manager Review</h4>
          <div className="finance-detail-grid" style={{ marginBottom: 6 }}>
            <div className="finance-detail-item">
              <span className="label">Decision</span>
              <span className="value">{expense.managerDecision || 'Pending'}</span>
            </div>
            {expense.managerDecisionAt && (
              <div className="finance-detail-item">
                <span className="label">Reviewed At</span>
                <span className="value">{new Date(expense.managerDecisionAt).toLocaleString()}</span>
              </div>
            )}
          </div>
          {expense.managerDecisionNote && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong>Note:</strong> {expense.managerDecisionNote}
            </p>
          )}
        </div>

        {/* Compliance Decision Info if present */}
        {expense.complianceDecision && (
          <div className="finance-detail-box">
            <h4>Compliance Review</h4>
            <div className="finance-detail-grid" style={{ marginBottom: 6 }}>
              <div className="finance-detail-item">
                <span className="label">Decision</span>
                <span className="value">{expense.complianceDecision}</span>
              </div>
              {expense.complianceDecisionAt && (
                <div className="finance-detail-item">
                  <span className="label">Reviewed At</span>
                  <span className="value">{new Date(expense.complianceDecisionAt).toLocaleString()}</span>
                </div>
              )}
            </div>
            {expense.complianceDecisionNote && (
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <strong>Note:</strong> {expense.complianceDecisionNote}
              </p>
            )}
          </div>
        )}

        {/* Receipt Review */}
        <div className="finance-detail-box">
          <h4>Receipt Document</h4>
          {!expense.receiptFileName ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              No receipt file was attached by the employee.
            </p>
          ) : receiptLoading ? (
            <p style={{ margin: 0, fontSize: '13px' }}>Loading receipt securely…</p>
          ) : receiptError ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#f87171' }}>{receiptError}</p>
          ) : receiptUrl ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  File: {expense.receiptFileName} ({receiptType})
                </span>
                <a
                  href={receiptUrl}
                  download={expense.receiptFileName}
                  className="btn btn-secondary btn-xs"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="download" size={14} /> Download File
                </a>
              </div>
              {receiptType?.startsWith('image/') ? (
                <div className="finance-receipt-preview">
                  <img src={receiptUrl} alt={`Receipt for ${expense.id}`} />
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '6px' }}>
                  <Icon name="file" size={32} />
                  <p style={{ margin: '8px 0 0', fontSize: '13px' }}>Document available for download</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Decision & Lifecycle History */}
        {Array.isArray(expense.history) && expense.history.length > 0 && (
          <div className="finance-detail-box">
            <h4>Workflow Audit History</h4>
            <ul className="finance-history-timeline">
              {expense.history.map((entry, idx) => (
                <li key={idx} className="finance-history-entry">
                  <div className="finance-history-meta">
                    <strong>{entry.label || entry.code}</strong> — {entry.at ? new Date(entry.at).toLocaleString() : ''}
                  </div>
                  {entry.note && <div className="finance-history-note">{entry.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-default)' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>

        {isFinanceReview && onOpenDecision && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              style={{ color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.4)' }}
              onClick={() => {
                onClose()
                onOpenDecision(expense, 'request-info')
              }}
            >
              Request Info
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              style={{ color: '#f472b6', borderColor: 'rgba(236, 72, 153, 0.4)' }}
              onClick={() => {
                onClose()
                onOpenDecision(expense, 'flag')
              }}
            >
              Flag
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              onClick={() => {
                onClose()
                onOpenDecision(expense, 'reject')
              }}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn btn-primary btn-xs"
              style={{ background: '#10b981', borderColor: '#10b981' }}
              onClick={() => {
                onClose()
                onOpenDecision(expense, 'approve')
              }}
            >
              Approve for Payment
            </button>
          </div>
        )}
      </div>
      </div>
    </Modal>
  )
}
