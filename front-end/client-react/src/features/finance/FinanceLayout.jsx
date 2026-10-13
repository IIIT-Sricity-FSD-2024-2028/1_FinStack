import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Icon } from '../../components/Icon'
import { financeApi } from './financeApi'
import './finance.css'

export function FinanceLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Poll or fetch unread notification count on mount & path change
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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const titles = {
    '/finance/dashboard': 'Finance Dashboard',
    '/finance/queue': 'Expense Review Queue',
    '/finance/payments': 'Internal Payment Release',
    '/finance/transactions': 'Transactions & Reconciliation',
    '/finance/notifications': 'Finance Notifications',
  }

  const currentTitle = titles[location.pathname] || 'Finance Officer Workspace'

  useEffect(() => {
    document.title = `${currentTitle} · FinStack`
  }, [currentTitle])

  return (
    <div className={`finance-workspace ${mobileOpen ? 'nav-mobile-open' : ''}`}>
      {/* Mobile scrim */}
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className="spa-sidebar"
        style={{
          width: '260px',
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            to="/finance/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'var(--text-primary)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
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
              <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>FinStack</div>
              <div style={{ fontSize: '11px', color: '#22d3ee', fontWeight: 600 }}>FINANCE OFFICER</div>
            </div>
          </Link>
        </div>

        <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p className="nav-section" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 10px', margin: '4px 0' }}>
            Main Workspace
          </p>

          <NavLink
            to="/finance/dashboard"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="home" size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/finance/queue"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="folder" size={18} />
            <span>Review Queue</span>
          </NavLink>

          <NavLink
            to="/finance/payments"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="receipt" size={18} />
            <span>Payment Release</span>
          </NavLink>

          <NavLink
            to="/finance/transactions"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="calculator" size={18} />
            <span>Transactions & Rec</span>
          </NavLink>

          <NavLink
            to="/finance/notifications"
            className={({ isActive }) => `finance-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name="bell" size={18} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="finance-badge-count">{unreadCount}</span>}
          </NavLink>
        </nav>

        {/* User profile footer */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-default)',
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
                background: '#334155',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {user?.firstName?.[0] || 'F'}
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
              color: 'var(--text-muted)',
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
      <div className="finance-main">
        {/* Header Bar */}
        <header className="finance-header-bar">
          <div className="finance-header-title">
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

          <div className="finance-header-actions">
            <Link
              to="/finance/notifications"
              style={{
                position: 'relative',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
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
          </div>
        </header>

        {/* Child Pages Content */}
        <main className="finance-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
