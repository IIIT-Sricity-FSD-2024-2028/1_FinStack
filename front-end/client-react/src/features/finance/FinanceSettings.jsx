import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Icon } from '../../components/Icon'

export function FinanceSettings() {
  const { user, logout } = useAuth()
  const [notifyPaymentAlerts, setNotifyPaymentAlerts] = useState(true)
  const [notifyDailyDisbursements, setNotifyDailyDisbursements] = useState(true)
  const [notifyThresholdAlerts, setNotifyThresholdAlerts] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  const handleSavePreferences = (e) => {
    e.preventDefault()
    setStatusMessage('Saving alert preferences is unavailable for this role.')
    setTimeout(() => setStatusMessage(null), 3000)
  }

  return (
    <div className="finance-settings-page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Breadcrumb / Title */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '8px' }}>
          <Link to="/finance/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>
            Finance
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Profile &amp; Settings</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Finance Officer Profile &amp; Settings
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', margin: '4px 0 0 0' }}>
          View your account profile and sign out. Alert preference saving is unavailable for this role.
        </p>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name="check" size={16} />
          <span>{statusMessage}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
        {/* Left Column: Profile Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="finance-stat-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '28px',
                  marginBottom: '12px',
                }}
              >
                {user?.firstName?.[0] || 'F'}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {user?.firstName} {user?.lastName}
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#22d3ee',
                  background: 'rgba(34, 211, 238, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  marginTop: '4px',
                }}
              >
                FINANCE OFFICER
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Employee ID:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.employeeId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Organization ID:</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>{user?.organizationId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Account Role:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.role}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Session Status:</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>Authenticated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Session & Security */}
          <div className="finance-stat-card" style={{ padding: '24px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="userX" size={16} />
              <span>Session &amp; Security</span>
            </h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '16px', lineHeight: 1.5 }}>
              Your session is secured with tenant bearer authentication. Signing out clears your active session and stored tokens.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' }}
              onClick={logout}
            >
              Sign Out of FinStack
            </button>
          </div>
        </div>

        {/* Right Column: Preferences Form */}
        <div>
          <div className="finance-stat-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="settings" size={18} />
              <span>Finance Workspace Preferences</span>
            </h3>

            <form onSubmit={handleSavePreferences}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label htmlFor="finance-name" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <input
                    id="finance-name"
                    type="text"
                    className="finance-search-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    defaultValue={`${user?.firstName || ''} ${user?.lastName || ''}`}
                    disabled
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                    Managed centrally by Configuration Manager.
                  </span>
                </div>

                <div>
                  <label htmlFor="finance-email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    id="finance-email"
                    type="email"
                    className="finance-search-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    defaultValue={user?.email || ''}
                    disabled
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                    Payment &amp; Disbursement Notifications
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        disabled
                        checked={notifyPaymentAlerts}
                        onChange={(e) => setNotifyPaymentAlerts(e.target.checked)}
                        style={{ marginTop: '3px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          Payment Release Confirmations
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                          Receive alerts when payment batches are disbursed and reconciliation completes.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        disabled
                        checked={notifyDailyDisbursements}
                        onChange={(e) => setNotifyDailyDisbursements(e.target.checked)}
                        style={{ marginTop: '3px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          Daily Disbursement Summary
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                          Daily digest of processed expenses and pending finance review queue items.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        disabled
                        checked={notifyThresholdAlerts}
                        onChange={(e) => setNotifyThresholdAlerts(e.target.checked)}
                        style={{ marginTop: '3px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          High-Value Expense Notification
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                          Receive priority alerts when an expense exceeding policy limits enters the review queue.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled>
                    Save Preferences
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
