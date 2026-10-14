import { useEffect, useRef, useState } from 'react'
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
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileDropdownRef = useRef(null)

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

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false)
    setProfileMenuOpen(false)
  }, [location.pathname])

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileMenuOpen) return
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen])

  const titles = {
    '/compliance/dashboard': 'Compliance Dashboard',
    '/compliance/queue': 'Compliance Review Queue',
    '/compliance/policies': 'Policy & Violation Monitoring',
    '/compliance/audit': 'Compliance Audit Trail',
    '/compliance/notifications': 'Compliance Notifications',
    '/compliance/settings': 'Profile & Settings',
  }

  const currentTitle = titles[location.pathname] || 'Compliance Officer Workspace'

  useEffect(() => {
    document.title = `${currentTitle} · FinStack`
  }, [currentTitle])

  return (
    <div
      className={`compliance-workspace ${collapsed ? 'nav-collapsed' : ''} ${mobileOpen ? 'nav-mobile-open' : ''}`}
    >
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
          width: collapsed ? '72px' : '260px',
          background: 'var(--bg-card, #111827)',
          borderRight: '1px solid var(--border-default, #1f2937)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Sidebar Header with Brand and Collapse Button */}
        <div
          className="compliance-sidebar-heading"
          style={{
            padding: '18px 16px',
            borderBottom: '1px solid var(--border-default, #1f2937)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <Link
            to="/compliance/dashboard"
            className="compliance-brand"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'var(--text-primary, #e5e7eb)',
              minWidth: 0,
            }}
          >
            <div
              className="compliance-logo-icon"
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
                flexShrink: 0,
              }}
            >
              F
            </div>
            <div className="compliance-brand-text" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', color: '#f9fafb' }}>
                FinStack
              </div>
              <div style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 600, letterSpacing: '0.04em' }}>
                COMPLIANCE OFFICER
              </div>
            </div>
          </Link>

          <button
            type="button"
            className="compliance-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: '16px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p
            className="compliance-nav-section-title"
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
            title={collapsed ? 'Dashboard' : undefined}
          >
            <Icon name="home" size={18} />
            <span className="compliance-nav-text">Dashboard</span>
          </NavLink>

          <NavLink
            to="/compliance/queue"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Review Queue' : undefined}
          >
            <Icon name="shieldCheck" size={18} />
            <span className="compliance-nav-text">Review Queue</span>
            {queueCount > 0 && (
              <span className="compliance-badge-count" style={{ background: '#7c3aed' }}>
                {queueCount}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/compliance/policies"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Policies & Rules' : undefined}
          >
            <Icon name="file" size={18} />
            <span className="compliance-nav-text">Policies & Rules</span>
          </NavLink>

          <NavLink
            to="/compliance/audit"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Audit Trail' : undefined}
          >
            <Icon name="audit" size={18} />
            <span className="compliance-nav-text">Audit Trail</span>
          </NavLink>

          <NavLink
            to="/compliance/notifications"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Notifications' : undefined}
          >
            <Icon name="bell" size={18} />
            <span className="compliance-nav-text">Notifications</span>
            {unreadCount > 0 && <span className="compliance-badge-count">{unreadCount}</span>}
          </NavLink>

          <NavLink
            to="/compliance/settings"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Profile & Settings' : undefined}
          >
            <Icon name="settings" size={18} />
            <span className="compliance-nav-text">Profile & Settings</span>
          </NavLink>
        </nav>

        {/* User profile & explicit Logout Footer */}
        <div
          className="compliance-sidebar-footer"
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-default, #1f2937)',
            display: 'flex',
            flexDirection: 'column',
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
              title={`${user?.firstName} ${user?.lastName} (${user?.employeeId})`}
            >
              {user?.firstName?.[0] || 'C'}
            </div>
            <div className="compliance-footer-details" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
            className="compliance-sidebar-logout-btn"
            onClick={logout}
            title="Sign out of FinStack"
          >
            <Icon name="userX" size={16} />
            <span className="compliance-logout-text">Logout</span>
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
            {/* Notifications Shortcut */}
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

            {/* Profile Dropdown Menu */}
            <div className="compliance-header-profile-wrap" ref={profileDropdownRef}>
              <button
                type="button"
                className="compliance-header-profile-btn"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="true"
              >
                <span>{user?.firstName} {user?.lastName}</span>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>▾</span>
              </button>

              {profileMenuOpen && (
                <div className="compliance-profile-dropdown" role="menu">
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #1f2937' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f9fafb' }}>
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{user?.employeeId}</div>
                  </div>

                  <Link
                    to="/compliance/settings"
                    className="compliance-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <Icon name="settings" size={16} />
                    <span>Profile & Settings</span>
                  </Link>

                  <Link
                    to="/compliance/notifications"
                    className="compliance-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <Icon name="bell" size={16} />
                    <span>Notifications</span>
                  </Link>

                  <div className="compliance-dropdown-divider" />

                  <button
                    type="button"
                    className="compliance-dropdown-item is-logout"
                    role="menuitem"
                    onClick={logout}
                  >
                    <Icon name="userX" size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
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
