import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'
import './compliance.css'

export function ComplianceLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [queueCount, setQueueCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Sync notification and queue badges
  useEffect(() => {
    let active = true

    complianceApi
      .getUnreadNotificationCount()
      .then((res) => {
        if (active) setUnreadCount(typeof res === 'number' ? res : res?.count || 0)
      })
      .catch(() => {})

    complianceApi
      .getComplianceQueue()
      .then((res) => {
        if (active && Array.isArray(res)) setQueueCount(res.length)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [location.pathname])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const titles = {
    '/compliance/dashboard': 'Compliance Dashboard',
    '/compliance/queue': 'Compliance Review Queue',
    '/compliance/policies': 'Policy & Violation Monitoring',
    '/compliance/audit': 'Compliance Audit Trail',
    '/compliance/notifications': 'Compliance Notifications',
  }

  const currentTitle = titles[location.pathname] || 'Compliance Officer Workspace'

  useEffect(() => {
    document.title = `${currentTitle} · FinStack`
  }, [currentTitle])

  return (
    <div className={`compliance-workspace ${mobileOpen ? 'nav-mobile-open' : ''}`}>
      {/* Mobile scrim */}
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          style={{
            display: 'block',
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 99,
            border: 'none',
            cursor: 'pointer',
          }}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className="spa-sidebar"
        style={{
          width: '260px',
          background: 'var(--bg-card, #111827)',
          borderRight: '1px solid var(--border-default, #1f2937)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-default, #1f2937)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            to="/compliance/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'var(--text-primary, #e5e7eb)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '16px',
              }}
            >
              F
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', color: '#f9fafb' }}>FinStack</div>
              <div style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600 }}>COMPLIANCE OFFICER</div>
            </div>
          </Link>
        </div>

        <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p
            className="nav-section"
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #9ca3af)',
              padding: '4px 10px',
              margin: '4px 0',
              fontWeight: 600,
            }}
          >
            Compliance Oversight
          </p>

          <NavLink
            to="/compliance/dashboard"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="home" size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/compliance/queue"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="shieldCheck" size={18} />
            <span>Review Queue</span>
            {queueCount > 0 && (
              <span className="compliance-badge-count" style={{ background: '#7c3aed' }}>
                {queueCount}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/compliance/policies"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="file" size={18} />
            <span>Policies & Rules</span>
          </NavLink>

          <NavLink
            to="/compliance/audit"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="audit" size={18} />
            <span>Audit Trail</span>
          </NavLink>

          <NavLink
            to="/compliance/notifications"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="bell" size={18} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="compliance-badge-count">{unreadCount}</span>}
          </NavLink>
        </nav>

        {/* User profile footer */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-default, #1f2937)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#4c1d95',
                color: '#e9d5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {user?.firstName?.[0] || 'C'}
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', color: '#f3f4f6' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)', whiteSpace: 'nowrap' }}>
                {user?.employeeId}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={logout}
            title="Sign Out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
            }}
          >
            <Icon name="userX" size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="compliance-main">
        {/* Header Bar */}
        <header className="compliance-header-bar">
          <div className="compliance-header-title">
            <button
              type="button"
              className="btn-icon mobile-menu-toggle"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              style={{ display: 'none', background: 'transparent', border: 'none', color: 'inherit' }}
            >
              <Icon name="chevronRight" size={20} />
            </button>
            <h1>{currentTitle}</h1>
          </div>

          <div className="compliance-header-actions">
            <Link
              to="/compliance/notifications"
              style={{
                position: 'relative',
                color: 'var(--text-secondary, #9ca3af)',
                textDecoration: 'none',
                padding: '6px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Notifications"
            >
              <Icon name="bell" size={20} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#7c3aed',
                  }}
                />
              )}
            </Link>
          </div>
        </header>

        {/* Child Pages Content */}
        <main className="compliance-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
