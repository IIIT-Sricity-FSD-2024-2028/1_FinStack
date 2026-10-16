import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Icon } from '../../components/Icon'
import { complianceApi } from './complianceApi'
import { LogoutAction } from '../../components/LogoutAction'
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
  const sidebarRef = useRef(null)
  const menuButtonRef = useRef(null)

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
    document.getElementById('workspace-main')?.focus()
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

  // Escape key handler for mobile drawer and profile menu
  useEffect(() => {
    if (!profileMenuOpen && !mobileOpen) return
    const escape = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        setProfileMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [profileMenuOpen, mobileOpen])

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
      className={`spa-workspace compliance-workspace ${collapsed ? 'nav-collapsed' : ''} ${mobileOpen ? 'nav-mobile-open' : ''}`}
    >
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>

      {/* Mobile scrim */}
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside ref={sidebarRef} className="spa-sidebar" id="workspace-navigation">
        {/* Restored Sidebar Heading: Side-by-side Brand and Toggle */}
        <div className="restored-sidebar-heading">
          <Link to="/compliance/dashboard" className="spa-brand">
            <b style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}>F</b>
            <span>FinStack</span>
          </Link>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Compliance navigation">
          <p className="nav-section">Compliance Oversight</p>

          <NavLink
            to="/compliance/dashboard"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <Icon name="home" size={19} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/compliance/queue"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Review Queue' : undefined}
          >
            <Icon name="folder" size={19} />
            <span>Review Queue</span>
            {queueCount > 0 && (
              <span className="badge badge-red compliance-badge" style={{ marginLeft: 'auto' }}>
                {queueCount}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/compliance/policies"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Policy Monitoring' : undefined}
          >
            <Icon name="shield" size={19} />
            <span>Policies &amp; Rules</span>
          </NavLink>

          <NavLink
            to="/compliance/audit"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Audit Trail' : undefined}
          >
            <Icon name="clock" size={19} />
            <span>Audit Trail</span>
          </NavLink>

          <NavLink
            to="/compliance/notifications"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Notifications' : undefined}
          >
            <Icon name="bell" size={19} />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="badge badge-red compliance-badge" style={{ marginLeft: 'auto' }}>
                {unreadCount}
              </span>
            )}
          </NavLink>

          <p className="nav-section">Account</p>

          <NavLink
            to="/compliance/settings"
            className={({ isActive }) => `compliance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Profile & Settings' : undefined}
          >
            <Icon name="settings" size={19} />
            <span>Profile &amp; Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer with Settings link & full-width Logout button */}
        <div className="sidebar-bottom">
          <Link to="/compliance/settings">Profile &amp; Settings</Link>
          <LogoutAction className="sidebar-logout-btn" onLogout={logout}>Logout</LogoutAction>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="spa-workspace-body">
        {/* Unified FinStack Header Bar */}
        <header className="spa-header">
          <button
            ref={menuButtonRef}
            className="btn btn-secondary mobile-menu"
            aria-expanded={mobileOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMobileOpen((v) => !v)}
          >
            Menu
          </button>

          <span className="header-breadcrumb">{currentTitle}</span>

          <div className="header-actions">
            {/* Notifications Shortcut */}
            <Link
              to="/compliance/notifications"
              aria-label="Notifications"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--text-secondary, #9ca3af)',
                padding: '6px',
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
                    background: '#ef4444',
                  }}
                />
              )}
            </Link>

            {/* Profile Dropdown Menu matching Configuration Manager */}
            <div className="profile-menu" ref={profileDropdownRef}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-expanded={profileMenuOpen}
                aria-controls="account-menu"
              >
                {user?.firstName} {user?.lastName} ▾
              </button>

              {profileMenuOpen && (
                <div id="account-menu">
                  <p>{user?.employeeId || user?.email} · Compliance Officer</p>
                  <Link to="/compliance/settings" onClick={() => setProfileMenuOpen(false)}>
                    Profile &amp; Settings
                  </Link>
                  <Link to="/compliance/notifications" onClick={() => setProfileMenuOpen(false)}>
                    Notifications ({unreadCount})
                  </Link>
                  <LogoutAction onLogout={logout}>Sign out</LogoutAction>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Child Pages Content */}
        <main id="workspace-main" tabIndex={-1} inert={mobileOpen}>
          <div className="compliance-content">
            <Outlet />
          </div>
        </main>

        <footer className="spa-footer">
          FinStack · Compliance Officer{' '}
          <Link to="/compliance/settings">Profile &amp; Settings</Link>
        </footer>
      </div>
    </div>
  )
}
