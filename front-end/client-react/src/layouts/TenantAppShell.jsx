import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon";
import { LogoutAction } from "../components/LogoutAction";
import { initials } from "../features/submitter/utils";
import "../features/submitter/submitter.css";
import "./tenant-app-shell.css";

function NotificationControl({ href, count, panel, label = "Notifications" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return <div className="submitter-popover-anchor" ref={ref}>
    <button ref={triggerRef} className="submitter-icon-button" type="button" aria-label={label} aria-expanded={open} aria-controls="tenant-notification-panel" onClick={() => setOpen((value) => !value)}>
      <Icon name="bell" />{count > 0 && <span>{count > 9 ? "9+" : count}</span>}
    </button>
    {open && <div className="submitter-popover submitter-notification-popover" id="tenant-notification-panel">{panel || <>
      <header><div><strong>Notifications</strong><small>{count} unread</small></div></header>
      <div className="submitter-popover-list"><p>Review updates for your {label.toLowerCase()}.</p></div>
      <footer><Link to={href} onClick={() => setOpen(false)}>View all notifications</Link></footer>
    </>}</div>}
  </div>;
}

export function SharedPageHeader({ title, description, breadcrumb, actions, className = "" }) {
  return <header className={`page-header tenant-page-header ${className}`}>
    <div>{breadcrumb && <p className="tenant-page-breadcrumb">{breadcrumb}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="tenant-page-actions">{actions}</div>}
  </header>;
}

/**
 * @param {{ role: string, roleLabel: string, title: string, homePath: string, profilePath: string, notificationPath: string, navItems: Array<{ to: string, label: string, icon?: string, section?: string, end?: boolean, badge?: number }>, user: Record<string, any> | null, logout: () => void, notificationCount?: number, notificationPanel?: import("react").ReactNode, searchSlot?: import("react").ReactNode, children?: import("react").ReactNode, contentClassName?: string, footer?: import("react").ReactNode }} props
 */
export function TenantAppShell({
  role,
  roleLabel,
  title,
  homePath,
  profilePath,
  notificationPath,
  navItems,
  user,
  logout,
  notificationCount = 0,
  notificationPanel = null,
  searchSlot = null,
  children = null,
  contentClassName = "",
  footer = null,
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("finstack-sidebar-collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const accountRef = useRef(null);
  const accountButtonRef = useRef(null);
  const displayName = useMemo(() => user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || roleLabel, [user, roleLabel]);
  const identity = user?.employeeId || user?.email || roleLabel;
  const roleNavigation = navItems.map((item) => item.to === notificationPath ? { ...item, badge: notificationCount } : item);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    document.getElementById("workspace-main")?.focus();
  }, [location.pathname]);
  useEffect(() => {
    if (!accountOpen) return undefined;
    const outside = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [accountOpen]);
  useEffect(() => {
    if (!mobileOpen && !accountOpen) return undefined;
    const keydown = (event) => {
      if (event.key === "Escape") {
        const restoreAccountFocus = accountOpen && !mobileOpen;
        setMobileOpen(false);
        setAccountOpen(false);
        (restoreAccountFocus ? accountButtonRef.current : menuButtonRef.current)?.focus();
        return;
      }
      if (!mobileOpen || event.key !== "Tab") return;
      const nodes = Array.from(sidebarRef.current?.querySelectorAll("a[href],button:not([disabled])") || []).filter((node) => node.getClientRects().length);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [mobileOpen, accountOpen]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector("a[href]")?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      if (sidebarRef.current?.contains(document.activeElement)) menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => setCollapsed((current) => {
    localStorage.setItem("finstack-sidebar-collapsed", String(!current));
    return !current;
  });
  const closeMobile = () => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  };

  return <div className={`tenant-app-shell submitter-app ${role} ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`} data-tenant-role={role}>
    <button className="submitter-backdrop tenant-mobile-backdrop" type="button" aria-label="Close navigation" tabIndex={mobileOpen ? 0 : -1} onClick={closeMobile} />
    <aside className="submitter-sidebar tenant-sidebar" ref={sidebarRef} id="workspace-navigation" aria-label={`${roleLabel} workspace`}>
      <div className="submitter-brand tenant-brand">
        <Link to={homePath} className="tenant-brand-link"><span className="submitter-brand-mark">F</span><span>FinStack</span></Link>
        <button className="tenant-collapse-toggle" type="button" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed}><Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} /></button>
      </div>
      <nav aria-label={`${roleLabel} navigation`}>
        {roleNavigation.map((item, index) => <div className="tenant-nav-entry" key={item.to}>
          {item.section && (index === 0 || roleNavigation[index - 1]?.section !== item.section) && <p className="tenant-nav-section">{item.section}</p>}
          <NavLink to={item.to} end={item.end} title={collapsed ? item.label : undefined} aria-label={item.label}>
            <Icon name={item.icon || "file"} size={19} /><span>{item.label}</span>
            {item.badge > 0 && <b>{item.badge > 99 ? "99+" : item.badge}</b>}
          </NavLink>
        </div>)}
      </nav>
      <LogoutAction className="submitter-logout tenant-logout" aria-label="Log out" title={collapsed ? "Log out" : undefined} onLogout={logout}><Icon name="logout" size={19} /><span>Log out</span></LogoutAction>
    </aside>
    <div className="submitter-shell tenant-shell-content">
      <header className="submitter-topbar tenant-topbar">
        <button ref={menuButtonRef} className="submitter-menu tenant-menu" type="button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => setMobileOpen((open) => !open)}><span aria-hidden="true">☰</span></button>
        <div className="submitter-workspace-title tenant-workspace-title"><strong>{title || "FinStack Workspace"}</strong><small>{roleLabel}</small></div>
        {searchSlot}
        <div className="submitter-top-actions tenant-top-actions">
          <NotificationControl href={notificationPath} count={notificationCount} panel={notificationPanel} />
          <div className="submitter-popover-anchor" ref={accountRef}>
            <button ref={accountButtonRef} className="submitter-user-button tenant-user-button" type="button" aria-expanded={accountOpen} aria-controls="tenant-account-menu" onClick={() => setAccountOpen((open) => !open)}>
              <span>{initials(displayName)}</span><div><strong>{displayName}</strong><small>{identity}</small></div><Icon name="chevron" size={16} />
            </button>
            {accountOpen && <div className="submitter-popover submitter-user-popover" id="tenant-account-menu">
              <Link to={profilePath} onClick={() => setAccountOpen(false)}>Profile &amp; Settings</Link>
              <Link to={notificationPath} onClick={() => setAccountOpen(false)}>Notifications{notificationCount > 0 ? ` (${notificationCount})` : ""}</Link>
              <LogoutAction onLogout={logout}>Log out</LogoutAction>
            </div>}
          </div>
        </div>
      </header>
      <main className={`submitter-main tenant-main ${contentClassName}`} id="workspace-main" tabIndex={-1} inert={mobileOpen}>
        {children}
        {footer}
      </main>
    </div>
  </div>;
}
