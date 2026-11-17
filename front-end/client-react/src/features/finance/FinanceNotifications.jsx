import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { financeSlice } from './financeSlice.js'
import { Icon } from '../../components/Icon'
import { LoadingState, ErrorState, EmptyState } from '../../components/OperationalStates'
import { Pagination } from '../../components/Pagination'
import { notify } from '../../components/ToastHost'
import { useFinanceNotificationsQuery, useFinanceUnreadCountQuery, useMarkFinanceNotificationReadMutation, useMarkAllFinanceNotificationsReadMutation } from './financeApiSlice.js'

const PAGE_SIZE = 15

export function FinanceNotifications() {
  const dispatch = useDispatch()
  const { page, stateFilter } = useSelector((state) => state.finance.notifications)
  const setPage = (page) => dispatch(financeSlice.actions.setNotificationPage(page))
  const setStateFilter = (stateFilter) => dispatch(financeSlice.actions.setNotificationFilter(stateFilter))
  const [actionError, setError] = useState('')
  const { currentData: data, isFetching, error: queryError, refetch } = useFinanceNotificationsQuery({
    page, pageSize: PAGE_SIZE, state: stateFilter,
  }, { pollingInterval: 15_000, skipPollingIfUnfocused: true })
  const { data: unread } = useFinanceUnreadCountQuery()
  const unreadCount = typeof unread === 'number' ? unread : unread?.count || 0
  const items = data?.items || []
  const total = data?.total || 0
  const loading = isFetching && !data
  const error = actionError || (!data && queryError?.message)
  const refreshError = data && queryError
  const refreshNow = () => { setError(''); refetch() }
  const retryNow = refreshNow
  const [markRead, readState] = useMarkFinanceNotificationReadMutation()
  const [markAllRead, readAllState] = useMarkAllFinanceNotificationsReadMutation()
  const markingRead = readState.isLoading || readAllState.isLoading

  async function handleMarkRead(id) {
    try {
      setError('')
      await markRead(id).unwrap()
      notify('Notification marked read.', 'info')
    } catch (err) {
      setError(err.message || 'Failed to mark notification read.')
    }
  }

  async function handleMarkAllRead() {
    try {
      setError('')
      await markAllRead().unwrap()
      notify('All notifications marked read.', 'success')
    } catch (err) {
      setError(err.message || 'Failed to mark all read.')
    }
  }

  return (
    <div className="notifications-page">
      {refreshError && <p role="alert" className="finance-refresh-error">Unable to refresh notifications. Showing the last loaded results.</p>}
      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <select
            className="finance-select"
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value)
            }}
          >
            <option value="all">All Notifications</option>
            <option value="unread">Unread Only ({unreadCount})</option>
            <option value="read">Read Only</option>
          </select>
        </div>

        <div className="finance-toolbar-group">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={handleMarkAllRead}
              disabled={markingRead}
            >
              Mark All as Read
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={refreshNow}
          >
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading notifications..." />
      ) : error ? (
        <ErrorState title="Error" description={error} onRetry={retryNow} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No Notifications"
          description={
            stateFilter === 'unread'
              ? 'You have caught up with all notifications.'
              : 'No notification records found in your feed.'
          }
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0 16px' }}>
            {items.map((item) => {
              const isUnread = item.unread !== false && !item.readAt

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '16px 0',
                    borderBottom: '1px solid var(--border-default)',
                    background: isUnread ? 'rgba(34, 211, 238, 0.03)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background:
                          item.type === 'danger'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : item.type === 'warning'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : item.type === 'success'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                        color:
                          item.type === 'danger'
                            ? '#f87171'
                            : item.type === 'warning'
                            ? '#fbbf24'
                            : item.type === 'success'
                            ? '#34d399'
                            : '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="bell" size={16} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px' }}>{item.title}</strong>
                        {isUnread && (
                          <span
                            style={{
                              background: '#22d3ee',
                              color: '#000',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {item.message}
                      </p>
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                        {item.relatedExpenseId && (
                          <span style={{ marginLeft: '10px', color: '#22d3ee' }}>
                            Claim: {item.relatedExpenseId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => handleMarkRead(item.id)}
                      disabled={markingRead}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)' }}>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={total}
              onPageChange={setPage}
              itemLabel="notifications"
            />
          </div>
        </div>
      )}
    </div>
  )
}
