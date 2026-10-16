import { useState, useMemo } from 'react'
import { formatCurrencyTotals } from '../shared/expensePresentation.js'
import { MAX_PAYMENT_BATCH, batchLimitMessage, validatePaymentBatch, togglePaymentSelection, selectAllPayments } from './paymentBatch.js'
import { Icon } from '../../components/Icon'
import { LoadingState, ErrorState, EmptyState } from '../../components/OperationalStates'
import { Modal } from '../../components/Modal'
import { notify } from '../../components/ToastHost'
import { financeApi } from './financeApi'
import { announceLiveRefresh } from '../../hooks/liveRefreshController.js'
import { useLiveRefresh } from '../../hooks/useLiveRefresh.js'

export function PaymentReleaseView() {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [releaseResult, setReleaseResult] = useState(null)
  const [selectionError, setSelectionError] = useState('')

  async function loadData({ background = false } = {}) {
    if (!background) {
      setLoading(true)
      setError('')
    }
    try {
      const [workspace, cats] = await Promise.all([
        financeApi.getFinanceWorkspace(),
        financeApi.getCategories().catch(() => []),
      ])
      const nextExpenses = workspace?.expenses || []
      const eligibleIds = new Set(
        nextExpenses
          .filter((expense) => expense.workflowStatus === 'approved_for_payment')
          .map((expense) => expense.id),
      )
      setExpenses(nextExpenses)
      setCategories(cats || [])
      setSelectedIds((current) =>
        background
          ? new Set(Array.from(current).filter((id) => eligibleIds.has(id)))
          : new Set(),
      )
      if (!background) setSelectionError('')
    } catch (err) {
      if (background) throw err
      setError(err.message || 'Failed to load payment release data.')
    } finally {
      if (!background) setLoading(false)
    }
  }

  const { refreshError, retryNow } = useLiveRefresh(loadData)

  // Eligible expenses for payment release:
  // Backend accepts: approved_for_payment and payment_processing
  const eligibleExpenses = useMemo(() => {
    return expenses.filter((e) =>
      ['approved_for_payment', 'payment_processing'].includes(e.workflowStatus),
    )
  }, [expenses])

  const readyToRelease = useMemo(() => {
    return eligibleExpenses.filter((e) => e.workflowStatus === 'approved_for_payment')
  }, [eligibleExpenses])

  const selectedExpenses = useMemo(() => {
    return eligibleExpenses.filter((e) => selectedIds.has(e.id))
  }, [eligibleExpenses, selectedIds])

  const selectedTotal = useMemo(() => {
    return formatCurrencyTotals(selectedExpenses)
  }, [selectedExpenses])

  function toggleSelectAll() {
    try {
      setSelectedIds(selectAllPayments(selectedIds, readyToRelease.map((e) => e.id)))
      setSelectionError('')
    } catch (err) { setSelectionError(err.message) }
  }

  function toggleSelectOne(id) {
    try {
      setSelectedIds(togglePaymentSelection(selectedIds, id))
      setSelectionError('')
    } catch (err) { setSelectionError(err.message) }
  }

  async function handleConfirmRelease() {
    if (selectedIds.size === 0) return
    try { validatePaymentBatch(Array.from(selectedIds)) }
    catch (err) { setSelectionError(err.message); return }
    setReleasing(true)
    setError('')
    try {
      const result = await financeApi.releasePayment(Array.from(selectedIds))
      setReleaseResult(result)
      notify(`Internal payment batch ${result.batchId} recorded. Bank settlement remains unverified.`, 'info')
      setConfirmModalOpen(false)
      announceLiveRefresh()
    } catch (err) {
      setError(err.message || 'Payment release failed.')
    } finally {
      setReleasing(false)
    }
  }

  if (loading) return <LoadingState message="Loading payment release candidates..." />
  if (error && !confirmModalOpen)
    return <ErrorState title="Error Loading Release Queue" description={error} onRetry={retryNow} />


  return (
    <div className="payment-release-page">
      {refreshError && <p role="alert" className="finance-refresh-error">Unable to refresh payment candidates. Showing the last loaded results.</p>}
      {/* Disclaimer / Notice */}
      <div className="finance-notice-banner warning">
        <Icon name="shieldCheck" size={20} />
        <div>
          <strong>Internal Payment Requests:</strong> Releasing expenses creates internal
          payment and transaction records within your organization. Bank transfer and settlement
          require verified bank evidence; creating a batch does not confirm payment completion.
        </div>
      </div>

      {releaseResult && (
        <div
          role="status"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '14px 18px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>Batch Created: {releaseResult.batchId}</strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Released {releaseResult.expenses?.length || 0} expense(s). Created{' '}
              {releaseResult.transactions?.length || 0} internal transaction(s).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => setReleaseResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action / Batch Header */}
      <div className="finance-batch-bar">
        <div>
          <h3 style={{ margin: 0, fontSize: '16px' }}>
            Expenses Approved for Release ({readyToRelease.length})
          </h3>
          <small className="text-muted">
            Select approved claims to bundle into an internal payment release batch.
          </small>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selectedIds.size > 0 && (
            <div style={{ fontSize: '13px', fontWeight: 500 }}>
              Selected: <strong>{selectedIds.size}</strong> claim(s) (
              {selectedTotal})
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary btn-xs"
            disabled={selectedIds.size === 0 || selectedIds.size > MAX_PAYMENT_BATCH}
            onClick={() => setConfirmModalOpen(true)}
          >
            Release Batch ({selectedIds.size})
          </button>
        </div>
      </div>

      <p role={selectionError ? 'alert' : 'status'}>{selectionError || (selectedIds.size === MAX_PAYMENT_BATCH ? batchLimitMessage : 'Maximum 100 claims per batch. No automatic splitting.')}</p>

      {readyToRelease.length === 0 ? (
        <EmptyState
          title="No Expenses Ready for Release"
          description="Approved expenses awaiting batch payment release will appear here once approved by finance."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center', padding: '12px 10px' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all eligible expenses"
                      checked={
                        readyToRelease.length > 0 &&
                        selectedIds.size === readyToRelease.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Reference</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Employee</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Merchant</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {readyToRelease.map((item) => {
                  const categoryName =
                    categories.find((c) => c.id === item.categoryId)?.name ||
                    item.categoryId ||
                    'General'
                  const isSelected = selectedIds.has(item.id)

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderTop: '1px solid var(--border-default)',
                        background: isSelected ? 'rgba(34, 211, 238, 0.05)' : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '12px 10px' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.id}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                        />
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{item.id}</td>
                      <td style={{ padding: '12px 14px' }}>{item.employeeId}</td>
                      <td style={{ padding: '12px 14px' }}>{item.merchant}</td>
                      <td style={{ padding: '12px 14px' }}>{categoryName}</td>
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: '#22d3ee',
                        }}
                      >
                        {item.currency}{' '}
                        {Number(item.amount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px' }}>
                        {item.date}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px' }}>
                        {item.paymentMethod || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={confirmModalOpen}
        onClose={releasing ? undefined : () => setConfirmModalOpen(false)}
        label="Confirm Payment Batch Release"
      >
        <div className="modal-content finance-modal-content">
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '18px' }}>Confirm Internal Payment Release</h2>
        </div>

        <div className="modal-body" style={{ padding: '16px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Are you sure you want to release the selected claims? This will create internal transaction records
            in <strong>Pending</strong> state and transition the expenses to <strong>Payment Processing</strong>.
          </p>

          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-deepest)',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              marginBottom: '14px',
              fontSize: '13px',
            }}
          >
            <div>
              <strong>Claims Selected:</strong> {selectedIds.size}
            </div>
            <div>
              <strong>Total Release Amount by Currency:</strong> {selectedTotal}
            </div>
          </div>

          <div style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Claims in this batch:</span>
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
              {selectedExpenses.map((exp) => (
                <li key={exp.id}>
                  {exp.id} — {exp.employeeId} ({exp.currency} {exp.amount})
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: '12px',
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setConfirmModalOpen(false)}
            disabled={releasing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmRelease}
            disabled={releasing}
          >
            {releasing ? 'Releasing Batch…' : `Confirm Release (${selectedIds.size})`}
          </button>
        </div>
        </div>
      </Modal>
    </div>
  )
}
