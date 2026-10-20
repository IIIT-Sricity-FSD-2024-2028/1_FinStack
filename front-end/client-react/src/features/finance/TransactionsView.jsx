import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { LoadingState, ErrorState, EmptyState } from '../../components/OperationalStates'
import { Modal } from '../../components/Modal'
import { notify } from '../../components/ToastHost'
import { financeApi } from './financeApi'

export function TransactionsView() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Confirmation modal state
  const [actionConfirm, setActionConfirm] = useState({
    open: false,
    transaction: null,
    action: null, // 'process' | 'fail' | 'reconcile'
  })
  const [processing, setProcessing] = useState(false)
  const [actionError, setActionError] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const workspace = await financeApi.getFinanceWorkspace()
      setTransactions(workspace?.transactions || [])
    } catch (err) {
      setError(err.message || 'Failed to load transaction records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchId = t.id?.toLowerCase().includes(q)
        const matchExp = t.expenseId?.toLowerCase().includes(q)
        const matchEmp = t.employeeId?.toLowerCase().includes(q)
        const matchMerchant = t.merchant?.toLowerCase().includes(q)
        if (!matchId && !matchExp && !matchEmp && !matchMerchant) return false
      }
      return true
    })
  }, [transactions, statusFilter, search])

  async function handleExecuteAction() {
    const { transaction, action } = actionConfirm
    if (!transaction || !action) return

    setProcessing(true)
    setActionError('')
    try {
      if (action === 'process') {
        await financeApi.processTransaction(transaction.id)
        notify(`Transaction ${transaction.id} marked processed.`, 'success')
      } else if (action === 'fail') {
        await financeApi.failTransaction(transaction.id)
        notify(`Transaction ${transaction.id} marked failed. Submitter notified.`, 'warning')
      } else if (action === 'reconcile') {
        await financeApi.reconcileTransaction(transaction.id)
        notify(`Transaction ${transaction.id} reconciled! Associated claim marked paid.`, 'success')
      }
      setActionConfirm({ open: false, transaction: null, action: null })
      await loadData()
    } catch (err) {
      setActionError(err.message || 'Operation failed. Verify transaction lifecycle rules.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <LoadingState message="Loading payment transactions..." />
  if (error && !actionConfirm.open)
    return <ErrorState title="Error Loading Transactions" description={error} onRetry={loadData} />

  return (
    <div className="transactions-page">
      <div className="finance-notice-banner">
        <Icon name="shieldCheck" size={20} />
        <div>
          <strong>Transaction Lifecycle:</strong> Transactions are internal records created upon payment release.
          Follow the server lifecycle transitions: <em>Pending &rarr; Processed &rarr; Reconciled</em>. Reconciling
          settles the associated expense and updates it to <strong>Paid</strong>.
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <input
            type="search"
            className="finance-search-input"
            placeholder="Search transaction, claim ID, employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="finance-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Transactions ({transactions.length})</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="reconciled">Reconciled</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="finance-toolbar-group">
          <button type="button" className="btn btn-secondary btn-xs" onClick={loadData}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Transactions Found"
          description={
            search || statusFilter !== 'all'
              ? 'No transactions match the selected filters.'
              : 'No payment release transactions exist in your workspace yet.'
          }
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Transaction ID</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Expense Claim</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Employee</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Merchant</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const isPending = tx.status === 'pending'
                  const isProcessed = tx.status === 'processed'

                  return (
                    <tr key={tx.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{tx.id}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ color: '#22d3ee' }}>{tx.expenseId}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{tx.employeeId}</td>
                      <td style={{ padding: '12px 14px' }}>{tx.merchant}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {tx.currency} {Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span className={`finance-badge ${tx.status}`}>
                          {tx.status?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px' }}>
                        {tx.transactionDate || (tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '—')}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div className="finance-table-actions" style={{ justifyContent: 'center' }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                style={{ background: '#3b82f6', borderColor: '#3b82f6' }}
                                onClick={() =>
                                  setActionConfirm({ open: true, transaction: tx, action: 'process' })
                                }
                              >
                                Process
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                onClick={() =>
                                  setActionConfirm({ open: true, transaction: tx, action: 'fail' })
                                }
                              >
                                Mark Failed
                              </button>
                            </>
                          )}
                          {isProcessed && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                style={{ background: '#10b981', borderColor: '#10b981' }}
                                onClick={() =>
                                  setActionConfirm({ open: true, transaction: tx, action: 'reconcile' })
                                }
                              >
                                Reconcile & Mark Paid
                              </button>
                            </>
                          )}
                          {!isPending && !isProcessed && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Finalized
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Modal
        open={actionConfirm.open}
        onClose={() => setActionConfirm({ open: false, transaction: null, action: null })}
        label="Confirm Transaction Action"
      >
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '18px' }}>
            {actionConfirm.action === 'process' && 'Process Transaction'}
            {actionConfirm.action === 'fail' && 'Mark Transaction Failed'}
            {actionConfirm.action === 'reconcile' && 'Reconcile Transaction'}
          </h2>
        </div>

        <div className="modal-body" style={{ padding: '16px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {actionConfirm.action === 'process' &&
              'Confirm that this transaction has been sent to and acknowledged by the bank sandbox.'}
            {actionConfirm.action === 'fail' &&
              'Mark this transaction as failed. The submitter will receive a failure notification.'}
            {actionConfirm.action === 'reconcile' &&
              'Reconciling this transaction confirms full settlement. The associated expense claim will permanently transition to PAID.'}
          </p>

          {actionConfirm.transaction && (
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
                <strong>Transaction ID:</strong> {actionConfirm.transaction.id}
              </div>
              <div>
                <strong>Claim ID:</strong> {actionConfirm.transaction.expenseId}
              </div>
              <div>
                <strong>Amount:</strong> {actionConfirm.transaction.currency}{' '}
                {Number(actionConfirm.transaction.amount).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          )}

          {actionError && (
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
              {actionError}
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
            onClick={() => setActionConfirm({ open: false, transaction: null, action: null })}
            disabled={processing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={
              actionConfirm.action === 'fail'
                ? { background: '#dc2626', borderColor: '#dc2626' }
                : actionConfirm.action === 'reconcile'
                ? { background: '#10b981', borderColor: '#10b981' }
                : undefined
            }
            onClick={handleExecuteAction}
            disabled={processing}
          >
            {processing ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
