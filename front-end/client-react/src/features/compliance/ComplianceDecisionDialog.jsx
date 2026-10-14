import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { complianceApi } from './complianceApi'

export function ComplianceDecisionDialog({ open, type, expense, onClose, onSuccess }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open || !expense) return null

  const titles = {
    approve: 'Approve & Forward to Finance',
    reject: 'Reject Compliance Claim',
    correctiveAction: 'Initiate Corrective Action',
  }

  const descriptions = {
    approve:
      'This will clear the compliance flag, record your approval, and return the expense to the Finance Officer review queue for final payment clearance.',
    reject:
      'This will permanently reject the expense for non-compliance. The submitter will be notified with your rejection reason.',
    correctiveAction:
      'This will record a formal corrective action on this expense audit record. Specify the required corrective measures below.',
  }

  const actionLabels = {
    approve: 'Approve Exception',
    reject: 'Confirm Rejection',
    correctiveAction: 'Submit Action',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmed = note.trim()
    if (type === 'reject' && !trimmed) {
      setError('A rejection reason is required for compliance audit trails.')
      return
    }

    if (type === 'correctiveAction' && !trimmed) {
      setError('Please provide specific instructions or reason for the corrective action.')
      return
    }

    try {
      setSubmitting(true)

      let res
      if (type === 'approve') {
        res = await complianceApi.approveClaim(expense.id, trimmed)
      } else if (type === 'reject') {
        res = await complianceApi.rejectClaim(expense.id, trimmed)
      } else if (type === 'correctiveAction') {
        res = await complianceApi.correctiveAction(expense.id, trimmed)
      }

      setNote('')
      onSuccess?.(res, type)
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to submit decision. Please check network connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={submitting ? undefined : onClose} label={titles[type]}>
      <div
        style={{
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-default, #1f2937)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
          color: 'var(--text-primary, #e5e7eb)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f9fafb' }}>{titles[type]}</h2>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={submitting}
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

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '16px', lineHeight: 1.5 }}>
          {descriptions[type]}
        </p>

        {/* Claim Summary Header */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            border: '1px solid var(--border-default, #1f2937)',
            fontSize: '0.8125rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Expense ID: </span>
            <span style={{ fontWeight: 600, color: '#c4b5fd' }}>{expense.id}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Amount: </span>
            <span style={{ fontWeight: 600, color: '#f9fafb' }}>₹{Number(expense.amount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Submitter: </span>
            <span style={{ fontWeight: 500 }}>{expense.employee?.fullName || expense.employeeId}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Category: </span>
            <span style={{ fontWeight: 500 }}>{expense.category || expense.categoryId}</span>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.875rem',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="compliance-decision-note"
              style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}
            >
              {type === 'reject' || type === 'correctiveAction' ? 'Required Note / Justification *' : 'Optional Decision Note'}
            </label>
            <textarea
              id="compliance-decision-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                type === 'approve'
                  ? 'e.g. Exception approved due to client site travel justification...'
                  : type === 'reject'
                    ? 'e.g. Violates section 4.2 of Corporate Travel Policy. Expense exceed permissible per diem...'
                    : 'e.g. Provide itemized vendor invoice or tax receipt within 48 hours...'
              }
              style={{
                width: '100%',
                background: '#0b0f19',
                border: '1px solid #374151',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#e5e7eb',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="compliance-btn compliance-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`compliance-btn ${
                type === 'approve'
                  ? 'compliance-btn-primary'
                  : type === 'reject'
                    ? 'compliance-btn-danger'
                    : 'compliance-btn-warning'
              }`}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : actionLabels[type]}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
