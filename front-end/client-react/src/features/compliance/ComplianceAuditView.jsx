import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'

export function ComplianceAuditView() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exporting, setExporting] = useState(false)

  function loadLogs() {
    setLoading(true)
    setError('')

    complianceApi
      .getAuditLogs({
        page,
        pageSize,
        search: search.trim() || undefined,
        outcome: outcome || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((data) => {
        setLogs(Array.isArray(data?.items) ? data.items : [])
        setTotal(data?.total || 0)
        setTotalPages(data?.totalPages || 1)
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load audit logs.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadLogs()
  }, [page, outcome])

  function handleFilterSubmit(e) {
    e.preventDefault()
    if (page === 1) loadLogs()
    else setPage(1)
  }

  async function handleExport() {
    try {
      setExporting(true)
      const blob = await complianceApi.exportAuditLogs({
        search: search.trim() || undefined,
        outcome: outcome || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'finstack-compliance-audit.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err?.message || 'Failed to export audit logs.')
    } finally {
      setExporting(false)
    }
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
            Compliance Audit Trail
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
            Authoritative, immutable event history of all organizational actions and policy enforcement.
          </p>
        </div>

        <button
          type="button"
          className="compliance-btn compliance-btn-secondary"
          onClick={handleExport}
          disabled={exporting || loading}
        >
          <Icon name="download" size={16} />
          <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
        </button>
      </div>

      <div className="compliance-card">
        {/* Filter Form */}
        <form onSubmit={handleFilterSubmit} className="compliance-filter-bar">
          <input
            type="text"
            className="compliance-search-input"
            placeholder="Search actor, event code, or target ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="compliance-select"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>

          <input
            type="date"
            className="compliance-select"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            title="From date"
          />

          <input
            type="date"
            className="compliance-select"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            title="To date"
          />

          <button type="submit" className="compliance-btn compliance-btn-primary compliance-btn-sm">
            Filter
          </button>
        </form>

        {/* Content Table / States */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
            <p>Loading audit events…</p>
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ color: '#f87171', marginBottom: '12px' }}>{error}</div>
            <button type="button" className="compliance-btn compliance-btn-primary" onClick={loadLogs}>
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
            No audit events found matching the specified criteria.
          </div>
        ) : (
          <>
            <div className="compliance-table-container">
              <table className="compliance-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Code</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isSuccess = log.outcome === 'SUCCESS'
                    return (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #9ca3af)', whiteSpace: 'nowrap' }}>
                          {log.occurredAt ? new Date(log.occurredAt).toLocaleString() : '—'}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#f9fafb' }}>{log.eventCode}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{log.actorName || log.actorUserId || 'System'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                            {log.actorRole || log.actorKind || '—'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8125rem' }}>{log.targetType || 'Record'}</div>
                          {log.targetId && (
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{log.targetId}</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${isSuccess ? 'badge-green' : 'badge-rose'}`}>
                            {log.outcome || 'SUCCESS'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

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
                  Showing {logs.length} of {total} events (Page {page} of {totalPages})
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
          </>
        )}
      </div>
    </div>
  )
}
