import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Icon } from '../../components/Icon'
import { financeApi } from './financeApi'
import './finance.css'

export function FinanceLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileDropdownRef = useRef(null)
  const sidebarRef = useRef(null)
  const menuButtonRef = useRef(null)

  // Sync notification badges
  useEffect(() => {
    let active = true

    financeApi
      .getUnreadNotificationCount()
      .then((res) => {
        if (active) setUnreadCount(typeof res === 'number' ? res : res?.count || 0)
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

  // Escape key handler
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
    '/finance/dashboard': 'Finance Dashboard',
    '/finance/queue': 'Expense Review Queue',
    '/finance/payments': 'Internal Payment Release',
    '/finance/transactions': 'Transactions & Reconciliation',
    '/finance/notifications': 'Finance Notifications',
    '/finance/settings': 'Profile & Settings',
  }

  const currentTitle = titles[location.pathname] || 'Finance Officer Workspace'

  useEffect(() => {
    document.title = `${currentTitle} · FinStack`
  }, [currentTitle])

  return (
    <div
      className={`spa-workspace finance-workspace ${collapsed ? 'nav-collapsed' : ''} ${mobileOpen ? 'nav-mobile-open' : ''}`}
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
          <Link to="/finance/dashboard" className="spa-brand">
            <b style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>F</b>
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
        <nav aria-label="Finance navigation">
          <p className="nav-section">Finance Oversight</p>

          <NavLink
            to="/finance/dashboard"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <Icon name="home" size={19} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/finance/queue"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Review Queue' : undefined}
          >
            <Icon name="folder" size={19} />
            <span>Review Queue</span>
          </NavLink>

          <NavLink
            to="/finance/payments"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Payment Release' : undefined}
          >
            <Icon name="receipt" size={19} />
            <span>Payment Release</span>
          </NavLink>

          <NavLink
            to="/finance/transactions"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Transactions & Rec' : undefined}
          >
            <Icon name="calculator" size={19} />
            <span>Transactions &amp; Rec</span>
          </NavLink>

          <NavLink
            to="/finance/notifications"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Notifications' : undefined}
          >
            <Icon name="bell" size={19} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="finance-badge-count">{unreadCount}</span>}
          </NavLink>

          <p className="nav-section">Account</p>

          <NavLink
            to="/finance/settings"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? 'Profile & Settings' : undefined}
          >
            <Icon name="settings" size={19} />
            <span>Profile &amp; Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer with Settings link & full-width Logout button */}
        <div className="sidebar-bottom">
          <Link to="/finance/settings">Profile &amp; Settings</Link>
          <button type="button" className="sidebar-logout-btn" onClick={logout}>
            Logout
          </button>
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
              to="/finance/notifications"
              aria-label="Notifications"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--text-secondary, #94a3b8)',
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
                    background: '#22d3ee',
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
                  <p>{user?.employeeId || user?.email} · Finance Officer</p>
                  <Link to="/finance/settings" onClick={() => setProfileMenuOpen(false)}>
                    Profile &amp; Settings
                  </Link>
                  <Link to="/finance/notifications" onClick={() => setProfileMenuOpen(false)}>
                    Notifications ({unreadCount})
                  </Link>
                  <button type="button" onClick={logout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Child Pages Content */}
        <main id="workspace-main" tabIndex={-1} inert={mobileOpen}>
          <div className="finance-content">
            <Outlet />
          </div>
        </main>

        <footer className="spa-footer">
          FinStack · Finance Officer{' '}
          <Link to="/finance/settings">Profile &amp; Settings</Link>
        </footer>
      </div>
    </div>
  )
}
