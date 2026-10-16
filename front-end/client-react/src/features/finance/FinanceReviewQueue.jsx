import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { LoadingState, ErrorState, EmptyState } from '../../components/OperationalStates'
import { Pagination } from '../../components/Pagination'
import { financeApi } from './financeApi'
import { ExpenseDetailModal } from './ExpenseDetailModal'
import { FinanceDecisionDialog } from './FinanceDecisionDialog'
import { useLiveRefresh } from '../../hooks/useLiveRefresh.js'

const PAGE_SIZE = 10

export function FinanceReviewQueue() {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('finance_review')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortKey, setSortKey] = useState('date_desc')
  const [page, setPage] = useState(1)

  const [selectedExpense, setSelectedExpense] = useState(null)
  const [decisionModal, setDecisionModal] = useState({ open: false, expense: null, action: null })

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
      setExpenses(workspace?.expenses || [])
      setCategories(cats || [])
    } catch (err) {
      if (background) throw err
      setError(err.message || 'Unable to load finance queue records.')
    } finally {
      if (!background) setLoading(false)
    }
  }

  const { refreshError, refreshNow, retryNow } = useLiveRefresh(loadData)

  // Filter & Search Logic
  const filtered = useMemo(() => {
    return expenses.filter((item) => {
      // Stage filter
      if (stageFilter !== 'all' && item.workflowStatus !== stageFilter) {
        return false
      }
      // Category filter
      if (categoryFilter && item.categoryId !== categoryFilter) {
        return false
      }
      // Search text
      if (search.trim()) {
        const query = search.toLowerCase().trim()
        const matchRef = item.id?.toLowerCase().includes(query)
        const matchEmp = item.employeeId?.toLowerCase().includes(query)
        const matchMerchant = item.merchant?.toLowerCase().includes(query)
        const matchNotes = item.notes?.toLowerCase().includes(query)
        if (!matchRef && !matchEmp && !matchMerchant && !matchNotes) {
          return false
        }
      }
      return true
    })
  }, [expenses, stageFilter, categoryFilter, search])

  // Sorting
  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      if (sortKey === 'date_desc') return (b.date || '').localeCompare(a.date || '')
      if (sortKey === 'date_asc') return (a.date || '').localeCompare(b.date || '')
      if (sortKey === 'amount_desc') return Number(b.amount || 0) - Number(a.amount || 0)
      if (sortKey === 'amount_asc') return Number(a.amount || 0) - Number(b.amount || 0)
      return 0
    })
    return list
  }, [filtered, sortKey])

  // Pagination
  const totalItems = sorted.length
  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sorted.slice(start, start + PAGE_SIZE)
  }, [sorted, page])

  useEffect(() => {
    setPage(1)
  }, [stageFilter, categoryFilter, search, sortKey])

  if (loading) return <LoadingState message="Loading finance expenses..." />
  if (error) return <ErrorState title="Error Loading Expenses" description={error} onRetry={retryNow} />

  return (
    <div className="finance-queue-page">
      {refreshError && <p role="alert" className="finance-refresh-error">Unable to refresh the queue. Showing the last loaded results.</p>}
      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <input
            type="search"
            className="finance-search-input"
            placeholder="Search reference, employee, merchant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="finance-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="finance_review">Awaiting Finance Review</option>
            <option value="approved_for_payment">Approved for Payment</option>
            <option value="payment_processing">Payment Processing</option>
            <option value="returned">Returned / Info Requested</option>
            <option value="compliance_review">Flagged / Compliance</option>
            <option value="paid">Reconciled Records (settlement unverified)</option>
            <option value="rejected">Rejected</option>
            <option value="all">All Stages ({expenses.length})</option>
          </select>

          <select
            className="finance-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            className="finance-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="date_desc">Date: Newest First</option>
            <option value="date_asc">Date: Oldest First</option>
            <option value="amount_desc">Amount: Highest First</option>
            <option value="amount_asc">Amount: Lowest First</option>
          </select>
        </div>

        <div className="finance-toolbar-group">
          <button type="button" className="btn btn-secondary btn-xs" onClick={refreshNow}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {pagedItems.length === 0 ? (
        <EmptyState
          title="No Expenses Found"
          description={
            search || categoryFilter || stageFilter !== 'finance_review'
              ? 'No expense claims match your active filters.'
              : 'There are currently no expenses awaiting finance review.'
          }
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Reference</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Employee</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Merchant</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Workflow Stage</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Receipt</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => {
                  const categoryName =
                    categories.find((c) => c.id === item.categoryId)?.name ||
                    item.categoryId ||
                    'General'
                  const isReviewable = item.workflowStatus === 'finance_review'

                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{item.id}</td>
                      <td style={{ padding: '12px 14px' }}>{item.employeeId}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px' }}>{item.date}</td>
                      <td style={{ padding: '12px 14px' }}>{categoryName}</td>
                      <td style={{ padding: '12px 14px' }}>{item.merchant}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#22d3ee' }}>
                        {item.currency} {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span className={`finance-badge ${item.workflowStatus}`}>
                          {item.workflowStatus === 'paid' ? 'RECONCILED RECORD — SETTLEMENT UNVERIFIED' : item.workflowStatus?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {item.receiptFileName ? (
                          <span title={item.receiptFileName} style={{ color: '#10b981' }}>
                            <Icon name="receipt" size={16} />
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div className="finance-table-actions" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => setSelectedExpense(item)}
                          >
                            Details
                          </button>
                          {isReviewable && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                style={{ background: '#10b981', borderColor: '#10b981' }}
                                title="Approve for payment"
                                onClick={() =>
                                  setDecisionModal({ open: true, expense: item, action: 'approve' })
                                }
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                title="Reject expense"
                                onClick={() =>
                                  setDecisionModal({ open: true, expense: item, action: 'reject' })
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)' }}>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={totalItems}
              onPageChange={setPage}
              itemLabel="expenses"
            />
          </div>
        </div>
      )}

      {/* Details Modal */}
      <ExpenseDetailModal
        open={Boolean(selectedExpense)}
        expense={selectedExpense}
        categories={categories}
        onClose={() => setSelectedExpense(null)}
        onOpenDecision={(exp, act) =>
          setDecisionModal({ open: true, expense: exp, action: act })
        }
      />

      {/* Decision Dialog */}
      <FinanceDecisionDialog
        open={decisionModal.open}
        expense={decisionModal.expense}
        action={decisionModal.action}
        onClose={() => setDecisionModal({ open: false, expense: null, action: null })}
      />
    </div>
  )
}
