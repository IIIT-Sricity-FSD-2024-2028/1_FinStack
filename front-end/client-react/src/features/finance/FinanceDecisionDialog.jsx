import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { notify } from '../../components/ToastHost'
import { financeApi } from './financeApi'
import { announceLiveRefresh } from '../../hooks/liveRefreshController.js'

const CONFIG = {
  approve: {
    title: 'Approve Expense for Payment',
    description: 'This will move the expense to "Approved for Payment" status so it can be released in a payment batch.',
    buttonText: 'Confirm Approval',
    buttonClass: 'btn btn-primary',
    requireNote: false,
    notePlaceholder: 'Optional approval memo or verification notes...',
    successToast: 'Expense successfully approved for payment release.',
  },
  reject: {
    title: 'Reject Expense',
    description: 'This will reject the expense reimbursement. The submitter will be notified.',
    buttonText: 'Confirm Rejection',
    buttonClass: 'btn btn-secondary',
    buttonStyle: { background: '#dc2626', borderColor: '#dc2626', color: '#fff' },
    requireNote: true,
    notePlaceholder: 'Reason for rejection (required)...',
    successToast: 'Expense has been rejected.',
  },
  'request-info': {
    title: 'Request Additional Information',
    description: 'The expense will be returned to the submitter with your request notes.',
    buttonText: 'Send Request',
    buttonClass: 'btn btn-secondary',
    buttonStyle: { background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' },
    requireNote: true,
    notePlaceholder: 'Specify what additional details or receipts are needed...',
    successToast: 'Information request sent to submitter.',
  },
  flag: {
    title: 'Flag for Compliance Review',
    description: 'This expense will be escalated to the organization Compliance Officer for policy audit.',
    buttonText: 'Flag Expense',
    buttonClass: 'btn btn-secondary',
    buttonStyle: { background: '#db2777', borderColor: '#db2777', color: '#fff' },
    requireNote: true,
    notePlaceholder: 'Reason for compliance concern (required)...',
    successToast: 'Expense flagged and routed to Compliance Officer.',
  },
}

export function FinanceDecisionDialog({
  expense,
  action, // 'approve' | 'reject' | 'request-info' | 'flag'
  open,
  onClose,
  onSuccess,
}) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setNote('')
    setError('')
  }, [open, expense?.id, action])

  if (!open || !expense || !action) return null

  const config = CONFIG[action] || CONFIG.approve

  async function handleSubmit(e) {
    e.preventDefault()
    if (config.requireNote && !note.trim()) {
      setError('Please provide a note explaining this decision.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      if (action === 'approve') {
        await financeApi.approveExpense(expense.id, note)
      } else if (action === 'reject') {
        await financeApi.rejectExpense(expense.id, note)
      } else if (action === 'request-info') {
        await financeApi.requestInfoExpense(expense.id, note)
      } else if (action === 'flag') {
        await financeApi.flagExpense(expense.id, note)
      }

      notify(config.successToast, 'success')
      announceLiveRefresh()
      setNote('')
      onClose()
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err.message || 'Action failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={submitting ? undefined : onClose} label={config.title}>
      <form className="modal-content finance-modal-content" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '18px' }}>{config.title}</h2>
        </div>

        <div className="modal-body" style={{ padding: '16px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {config.description}
          </p>

          <div
            style={{
              padding: '10px 14px',
              background: 'var(--bg-deepest)',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              marginBottom: '14px',
              fontSize: '13px',
            }}
          >
            <div>
              <strong>Expense:</strong> {expense.id} ({expense.merchant})
            </div>
            <div>
              <strong>Amount:</strong> {expense.currency}{' '}
              {Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div>
              <strong>Submitter:</strong> {expense.employeeId}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label htmlFor="finance-decision-note" style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Decision Note {config.requireNote ? '(Required)' : '(Optional)'}
            </label>
            <textarea
              id="finance-decision-note"
              className="form-input"
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                if (error) setError('')
              }}
              placeholder={config.notePlaceholder}
              style={{ width: '100%', resize: 'vertical' }}
              disabled={submitting}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 16px',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className={config.buttonClass}
            style={config.buttonStyle}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : config.buttonText}
          </button>
        </div>
      </form>
    </Modal>
  )
}
