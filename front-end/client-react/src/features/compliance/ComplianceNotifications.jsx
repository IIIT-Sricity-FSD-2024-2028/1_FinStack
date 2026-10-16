import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'
import { announceLiveRefresh } from '../../hooks/liveRefreshController.js'
import { useLiveRefresh } from '../../hooks/useLiveRefresh.js'

export function ComplianceNotifications() {
  const [notifications, setNotifications] = useState([])
  const [total, setTotal] = useState(0)
  const [filterState, setFilterState] = useState('all') // 'all' | 'unread'
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function loadNotifications() {
    setLoading(true)
    setError('')

    complianceApi
      .getNotifications({
        page,
        pageSize,
        state: filterState === 'unread' ? 'unread' : undefined,
      })
      .then((data) => {
        // Handle both paginated response object and flat array
        if (Array.isArray(data)) {
          setNotifications(data)
          setTotal(data.length)
        } else {
          setNotifications(Array.isArray(data?.items) ? data.items : [])
          setTotal(data?.total || 0)
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load notifications.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadNotifications()
  }, [page, filterState])
  useLiveRefresh(loadNotifications, { refreshImmediately: false })

  async function handleMarkRead(id) {
    try {
      await complianceApi.markNotificationRead(id)
      announceLiveRefresh()
    } catch (err) {
      setError(err?.message || 'Failed to mark notification read.')
    }
  }

  async function handleMarkAllRead() {
    try {
      await complianceApi.markAllNotificationsRead()
      announceLiveRefresh()
    } catch (err) {
      setError(err?.message || 'Failed to mark all as read.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function renderTypeIcon(type) {
    if (type === 'danger') return <span style={{ color: '#ef4444' }}>⚠</span>
    if (type === 'warning') return <span style={{ color: '#f59e0b' }}>ℹ</span>
    if (type === 'success') return <span style={{ color: '#10b981' }}>✓</span>
    return <span style={{ color: '#22d3ee' }}>ℹ</span>
  }

  return (
    <div>
      {/* Header Info */}
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
            Compliance Notifications
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
            System alerts, manager escalations, and automated policy trigger events.
          </p>
        </div>

        <button
          type="button"
          className="compliance-btn compliance-btn-secondary"
          onClick={handleMarkAllRead}
          disabled={loading || notifications.every((n) => !n.unread)}
        >
          <Icon name="check" size={16} />
          <span>Mark All Read</span>
        </button>
      </div>

      <div className="compliance-card">
        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-default, #1f2937)',
            background: 'rgba(15, 23, 42, 0.5)',
          }}
        >
          <button
            type="button"
            className={`compliance-btn compliance-btn-sm ${
              filterState === 'all' ? 'compliance-btn-primary' : 'compliance-btn-secondary'
            }`}
            onClick={() => {
              setFilterState('all')
              setPage(1)
            }}
          >
            All Alerts
          </button>
          <button
            type="button"
            className={`compliance-btn compliance-btn-sm ${
              filterState === 'unread' ? 'compliance-btn-primary' : 'compliance-btn-secondary'
            }`}
            onClick={() => {
              setFilterState('unread')
              setPage(1)
            }}
          >
            Unread Only
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
            <p>Loading notifications…</p>
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ color: '#f87171', marginBottom: '12px' }}>{error}</div>
            <button type="button" className="compliance-btn compliance-btn-primary" onClick={loadNotifications}>
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
            <Icon name="bell" size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: '#f3f4f6' }}>No Notifications</div>
            <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
              {filterState === 'unread' ? 'You have read all your alerts.' : 'No notification history found.'}
            </div>
          </div>
        ) : (
          <div>
            {notifications.map((n) => {
              const isUnread = Boolean(n.unread || n.read === false)
              return (
                <div
                  key={n.id}
                  className={`compliance-notif-item ${isUnread ? 'is-unread' : ''}`}
                >
                  <div style={{ fontSize: '1.25rem', lineHeight: 1 }}>{renderTypeIcon(n.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: isUnread ? '#f9fafb' : '#d1d5db' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: isUnread ? '#e5e7eb' : '#9ca3af', lineHeight: 1.5 }}>
                      {n.message}
                    </div>
                  </div>
                  {isUnread && <div className="compliance-notif-dot" title="Unread" />}
                  {isUnread && (
                    <button type="button" className="compliance-btn compliance-btn-secondary compliance-btn-sm" onClick={() => handleMarkRead(n.id)}>
                      Mark Read
                    </button>
                  )}
                </div>
              )
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderTop: '1px solid var(--border-default, #1f2937)',
                }}
              >
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #9ca3af)' }}>
                  Page {page} of {totalPages}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="compliance-btn compliance-btn-secondary compliance-btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
