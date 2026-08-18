import { Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="FinStack Admin">
          <span className="brand-mark">F</span>
          <span>
            <strong>FinStack</strong>
            <small>Control plane</small>
          </span>
        </div>
        <nav aria-label="Admin navigation">
          <a className="nav-item nav-item-active" href="/health">
            <span className="nav-indicator" aria-hidden="true" />
            System health
          </a>
        </nav>
        <p className="foundation-label">Admin V1 foundation</p>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <span>Internal administration</span>
          <span className="environment-badge">Foundation</span>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
