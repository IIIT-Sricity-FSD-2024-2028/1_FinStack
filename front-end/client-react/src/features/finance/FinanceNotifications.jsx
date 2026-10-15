import { useState, useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { LoadingState, ErrorState, EmptyState } from '../../components/OperationalStates'
import { Pagination } from '../../components/Pagination'
import { notify } from '../../components/ToastHost'
import { financeApi } from './financeApi'

const PAGE_SIZE = 15

export function FinanceNotifications() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [stateFilter, setStateFilter] = useState('all') // 'all' | 'unread' | 'read'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadNotifications() {
    setLoading(true)
    setError('')
    try {
      const response = await financeApi.getNotifications({
        page,
        pageSize: PAGE_SIZE,
        state: stateFilter,
      })
      setItems(response?.items || [])
      setTotal(response?.total || 0)
      setUnreadCount(response?.unreadCount || 0)
    } catch (err) {
      setError(err.message || 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [page, stateFilter])

  async function handleMarkRead(id) {
    try {
      await financeApi.markNotificationRead(id)
      await loadNotifications()
      notify('Notification marked read.', 'info')
    } catch (err) {
      setError(err.message || 'Failed to mark notification read.')
    }
  }

  async function handleMarkAllRead() {
    try {
      await financeApi.markAllNotificationsRead()
      setItems((prev) => prev.map((item) => ({ ...item, unread: false, readAt: new Date().toISOString() })))
      setUnreadCount(0)
      notify('All notifications marked read.', 'success')
      await loadNotifications()
    } catch (err) {
      setError(err.message || 'Failed to mark all read.')
    }
  }

  return (
    <div className="notifications-page">
      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <select
            className="finance-select"
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value)
              setPage(1)
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
            >
              Mark All as Read
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={loadNotifications}
          >
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading notifications..." />
      ) : error ? (
        <ErrorState title="Error" description={error} onRetry={loadNotifications} />
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
