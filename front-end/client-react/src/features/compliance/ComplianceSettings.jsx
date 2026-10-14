import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Icon } from '../../components/Icon'

export function ComplianceSettings() {
  const { user, logout } = useAuth()

  // Local preferences state
  const [notifyHighRisk, setNotifyHighRisk] = useState(true)
  const [notifyDailyDigest, setNotifyDailyDigest] = useState(true)
  const [notifyAuditActions, setNotifyAuditActions] = useState(true)
  const [savedMessage, setSavedMessage] = useState(false)

  function handleSavePreferences(e) {
    e.preventDefault()
    setSavedMessage(true)
    setTimeout(() => setSavedMessage(false), 3000)
  }

  const initials = `${user?.firstName?.[0] || 'C'}${user?.lastName?.[0] || 'O'}`

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#f9fafb' }}>
          Profile & Settings
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
          Manage your Compliance Officer profile, workspace preferences, and session security.
        </p>
      </div>

      {savedMessage && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.875rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name="check" size={16} />
          <span>Workspace preferences updated successfully.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Left Column: Profile Card & Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="compliance-card" style={{ margin: 0 }}>
            <div className="compliance-card-header">
              <h3 className="compliance-card-title">
                <Icon name="users" size={18} />
                <span>Compliance Officer Identity</span>
              </h3>
            </div>
            <div className="compliance-card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 20px rgba(124, 58, 237, 0.3)',
                }}
              >
                {initials}
              </div>

              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '2px' }}>
                {user?.email || 'compliance.officer@finstack.io'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                <span className="badge badge-purple">Compliance Officer</span>
                <span className="badge badge-green">Active</span>
              </div>

              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border-default, #1f2937)',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Employee ID:</span>
                  <span style={{ fontWeight: 600, color: '#f3f4f6' }}>{user?.employeeId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Organization ID:</span>
                  <span style={{ fontWeight: 600, color: '#c4b5fd' }}>{user?.organizationId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Account Role:</span>
                  <span style={{ fontWeight: 600, color: '#f3f4f6' }}>{user?.role}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Session State:</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>Authenticated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Session & Sign Out Card */}
          <div className="compliance-card" style={{ margin: 0 }}>
            <div className="compliance-card-header">
              <h3 className="compliance-card-title">
                <Icon name="userX" size={18} />
                <span>Session & Security</span>
              </h3>
            </div>
            <div className="compliance-card-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #9ca3af)', marginBottom: '16px' }}>
                Your session is secured using tenant bearer authorization. Terminating your session clears your stored
                access token and redirects to the login screen.
              </p>
              <button
                type="button"
                className="compliance-btn compliance-btn-danger"
                style={{ width: '100%' }}
                onClick={logout}
              >
                <Icon name="userX" size={16} />
                <span>Sign Out of FinStack</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Preferences & Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="compliance-card" style={{ margin: 0 }}>
            <div className="compliance-card-header">
              <h3 className="compliance-card-title">
                <Icon name="settings" size={18} />
                <span>Compliance Workspace Preferences</span>
              </h3>
            </div>
            <div className="compliance-card-body">
              <form onSubmit={handleSavePreferences}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label
                      htmlFor="settings-full-name"
                      style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}
                    >
                      Full Name
                    </label>
                    <input
                      id="settings-full-name"
                      type="text"
                      className="compliance-search-input"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      defaultValue={`${user?.firstName || ''} ${user?.lastName || ''}`}
                      disabled
                      title="Name managed by organization administrator"
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                      Managed centrally by Configuration Manager.
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="settings-email"
                      style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}
                    >
                      Email Address
                    </label>
                    <input
                      id="settings-email"
                      type="email"
                      className="compliance-search-input"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      defaultValue={user?.email || ''}
                      disabled
                      title="Email managed by organization administrator"
                    />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-default, #1f2937)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px', color: '#f3f4f6' }}>
                      Alerts & Anomaly Notifications
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={notifyHighRisk}
                          onChange={(e) => setNotifyHighRisk(e.target.checked)}
                          style={{ marginTop: '3px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f9fafb' }}>
                            High-Risk Claims Alerts
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                            Receive immediate notification when an expense with risk score ≥ 70 is escalated.
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={notifyDailyDigest}
                          onChange={(e) => setNotifyDailyDigest(e.target.checked)}
                          style={{ marginTop: '3px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f9fafb' }}>
                            Daily Compliance Digest
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                            Summary of pending reviews and policy exceptions every morning.
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={notifyAuditActions}
                          onChange={(e) => setNotifyAuditActions(e.target.checked)}
                          style={{ marginTop: '3px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f9fafb' }}>
                            Audit Event Confirmation
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                            Confirmation alerts when decisions or corrective actions are recorded to the audit trail.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button type="submit" className="compliance-btn compliance-btn-primary">
                      Save Preferences
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
